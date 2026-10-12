import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { readdir, stat, access } from 'node:fs/promises';
import { ZipArchive } from 'archiver';
import { DependencyGraph } from '../dependency/graph.js';
import { hashFile } from '../../utils/crypto.js';

export interface ModpackExportOptions {
  format: 'mrpack' | 'zip';
  instanceDir: string;
  outputPath: string;
  name: string;
  version: string;
  summary?: string;
  author?: string;
  gameVersion: string;
  loader: string;
  modsDir?: string;
  configDir?: string;
  resourcepacksDir?: string;
  shaderpacksDir?: string;
  includeConfigs?: boolean;
  includeResourcepacks?: boolean;
  includeShaderpacks?: boolean;
  sourceProfileDir?: string;
}

export interface ModpackExportResult {
  outputPath: string;
  filesCount: number;
  sizeBytes: number;
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeLoaderDependency(loader: string): string {
  const l = (loader || '').toLowerCase().trim();
  if (l === 'fabric') return 'fabric-loader';
  if (l === 'quilt') return 'quilt-loader';
  return l || 'fabric-loader';
}

export class ModpackExporter {
  private async addDirectoryRecursive(
    archive: any,
    dirPath: string,
    archivePrefix: string
  ): Promise<number> {
    let count = 0;
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const archiveTarget = path.join(archivePrefix, entry.name).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          count += await this.addDirectoryRecursive(archive, fullPath, archiveTarget);
        } else if (entry.isFile()) {
          archive.file(fullPath, { name: archiveTarget });
          count++;
        }
      }
    } catch {}
    return count;
  }

  async exportModpack(options: ModpackExportOptions): Promise<ModpackExportResult> {
    const isMrpack = options.format === 'mrpack';
    const outputStream = createWriteStream(options.outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    const archivePromise = new Promise<void>((resolve, reject) => {
      outputStream.on('close', resolve);
      outputStream.on('error', reject);
      archive.on('error', reject);
    });

    archive.pipe(outputStream);

    let totalFilesCount = 0;

    let modsDir: string;
    let configDir: string;
    let resourcepacksDir: string;
    let shaderpacksDir: string;
    let lockfileDir: string;

    if (options.sourceProfileDir) {
      let filesDir = path.join(options.sourceProfileDir, 'files');
      try {
        const st = await stat(filesDir);
        if (!st.isDirectory()) {
          filesDir = options.sourceProfileDir;
        }
      } catch {
        filesDir = options.sourceProfileDir;
      }
      modsDir = path.join(filesDir, 'mods');
      configDir = path.join(filesDir, 'config');
      resourcepacksDir = path.join(filesDir, 'resourcepacks');
      shaderpacksDir = path.join(filesDir, 'shaderpacks');
      lockfileDir = filesDir;
    } else {
      modsDir = options.modsDir || path.join(options.instanceDir, 'mods');
      const baseModsParent = path.dirname(modsDir);
      configDir = options.configDir || path.join(baseModsParent, 'config');
      resourcepacksDir = options.resourcepacksDir || path.join(baseModsParent, 'resourcepacks');
      shaderpacksDir = options.shaderpacksDir || path.join(baseModsParent, 'shaderpacks');
      lockfileDir = baseModsParent;
      if (options.instanceDir && lockfileDir !== options.instanceDir) {
        try {
          await stat(path.join(options.instanceDir, 'loadmoder.lock.json'));
          lockfileDir = options.instanceDir;
        } catch {}
      }
    }

    let localModFiles: string[] = [];
    try {
      localModFiles = await readdir(modsDir);
    } catch {}

    const activeJars = localModFiles.filter(
      (f) => f.toLowerCase().endsWith('.jar') && !f.toLowerCase().endsWith('.disabled')
    );

    if (isMrpack) {
      const graph = new DependencyGraph(lockfileDir, options.gameVersion, options.loader);
      await graph.load();

      const indexFiles: Array<{
        path: string;
        hashes: { sha1: string; sha512: string };
        env?: { client: 'required' | 'optional' | 'unsupported'; server: 'required' | 'optional' | 'unsupported' };
        downloads: string[];
        fileSize: number;
      }> = [];

      for (const jarName of activeJars) {
        const fullJarPath = path.join(modsDir, jarName);
        let jarSize = 0;
        try {
          const st = await stat(fullJarPath);
          jarSize = st.size;
        } catch {}

        const lockEntry = Object.values(graph.data.mods).find((m) => m.filename === jarName);

        if (lockEntry && lockEntry.projectId && lockEntry.versionId) {
          const sha1 = await hashFile(fullJarPath, 'sha1').catch(() => '');
          const sha512 = lockEntry.sha512 || (await hashFile(fullJarPath, 'sha512').catch(() => ''));

          const cdnUrl = `https://cdn.modrinth.com/data/${lockEntry.projectId}/versions/${lockEntry.versionId}/${encodeURIComponent(jarName)}`;

          if (sha1 && sha512) {
            indexFiles.push({
              path: `mods/${jarName}`,
              hashes: {
                sha1,
                sha512,
              },
              env: { client: 'required', server: 'required' },
              downloads: [cdnUrl],
              fileSize: jarSize,
            });
            totalFilesCount++;
            continue;
          }
        }

        archive.file(fullJarPath, { name: `overrides/mods/${jarName}` });
        totalFilesCount++;
      }

      const modrinthIndex = {
        formatVersion: 1,
        game: 'minecraft',
        versionId: options.version || '1.0.0',
        name: options.name || 'LoadModer Pack',
        summary: options.summary || 'Custom Minecraft pack created with LoadModer',
        files: indexFiles,
        dependencies: {
          minecraft: options.gameVersion,
          ...(options.loader ? { [normalizeLoaderDependency(options.loader)]: '*' } : {}),
        },
      };

      archive.append(JSON.stringify(modrinthIndex, null, 2), { name: 'modrinth.index.json' });

      if (options.includeConfigs !== false && (await dirExists(configDir))) {
        totalFilesCount += await this.addDirectoryRecursive(archive, configDir, 'overrides/config');
      }

      if (options.includeResourcepacks && (await dirExists(resourcepacksDir))) {
        totalFilesCount += await this.addDirectoryRecursive(archive, resourcepacksDir, 'overrides/resourcepacks');
      }

      if (options.includeShaderpacks && (await dirExists(shaderpacksDir))) {
        totalFilesCount += await this.addDirectoryRecursive(archive, shaderpacksDir, 'overrides/shaderpacks');
      }
    } else {
      for (const jarName of activeJars) {
        archive.file(path.join(modsDir, jarName), { name: `mods/${jarName}` });
        totalFilesCount++;
      }

      if (options.includeConfigs !== false && (await dirExists(configDir))) {
        totalFilesCount += await this.addDirectoryRecursive(archive, configDir, 'config');
      }

      if (options.includeResourcepacks && (await dirExists(resourcepacksDir))) {
        totalFilesCount += await this.addDirectoryRecursive(archive, resourcepacksDir, 'resourcepacks');
      }

      if (options.includeShaderpacks && (await dirExists(shaderpacksDir))) {
        totalFilesCount += await this.addDirectoryRecursive(archive, shaderpacksDir, 'shaderpacks');
      }

      const packManifest = {
        name: options.name || 'LoadModer Pack',
        version: options.version || '1.0.0',
        gameVersion: options.gameVersion,
        loader: options.loader,
        author: options.author || 'LoadModer',
        summary: options.summary,
        exportedAt: new Date().toISOString(),
        modsCount: activeJars.length,
        mods: activeJars,
      };

      archive.append(JSON.stringify(packManifest, null, 2), { name: 'modpack.json' });
    }

    await archive.finalize();
    await archivePromise;

    let sizeBytes = 0;
    try {
      const st = await stat(options.outputPath);
      sizeBytes = st.size;
    } catch {}

    return {
      outputPath: options.outputPath,
      filesCount: totalFilesCount,
      sizeBytes,
    };
  }
}

export const modpackExporter = new ModpackExporter();
