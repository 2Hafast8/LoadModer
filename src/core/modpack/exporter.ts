import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
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
  includeConfigs?: boolean;
}

export interface ModpackExportResult {
  outputPath: string;
  filesCount: number;
  sizeBytes: number;
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
    const modsDir = path.join(options.instanceDir, 'mods');
    const configDir = path.join(options.instanceDir, 'config');

    if (isMrpack) {
      const graph = new DependencyGraph(options.instanceDir, options.gameVersion, options.loader);
      await graph.load();

      const indexFiles: Array<{
        path: string;
        hashes: { sha1?: string; sha512?: string };
        env?: { client: string; server: string };
        downloads: string[];
        fileSize: number;
      }> = [];

      let localModFiles: string[] = [];
      try {
        localModFiles = await readdir(modsDir);
      } catch {}

      const activeJars = localModFiles.filter((f) => f.endsWith('.jar') && !f.endsWith('.disabled'));

      for (const jarName of activeJars) {
        const fullJarPath = path.join(modsDir, jarName);
        let jarSize = 0;
        try {
          const st = await stat(fullJarPath);
          jarSize = st.size;
        } catch {}

        const lockEntry = Object.values(graph.data.mods).find((m) => m.filename === jarName);

        if (lockEntry && lockEntry.versionId) {
          const sha1 = await hashFile(fullJarPath, 'sha1').catch(() => '');
          const sha512 = lockEntry.sha512 || (await hashFile(fullJarPath, 'sha512').catch(() => ''));
          indexFiles.push({
            path: `mods/${jarName}`,
            hashes: {
              sha1,
              sha512,
            },
            env: { client: 'required', server: 'required' },
            downloads: [],
            fileSize: jarSize,
          });
          totalFilesCount++;
        } else {
          archive.file(fullJarPath, { name: `overrides/mods/${jarName}` });
          totalFilesCount++;
        }
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
          ...(options.loader ? { [options.loader.toLowerCase()]: '*' } : {}),
        },
      };

      archive.append(JSON.stringify(modrinthIndex, null, 2), { name: 'modrinth.index.json' });

      if (options.includeConfigs) {
        totalFilesCount += await this.addDirectoryRecursive(archive, configDir, 'overrides/config');
      }
    } else {
      let localModFiles: string[] = [];
      try {
        localModFiles = await readdir(modsDir);
      } catch {}

      const activeJars = localModFiles.filter((f) => f.endsWith('.jar') && !f.endsWith('.disabled'));
      for (const jarName of activeJars) {
        archive.file(path.join(modsDir, jarName), { name: `mods/${jarName}` });
        totalFilesCount++;
      }

      if (options.includeConfigs) {
        totalFilesCount += await this.addDirectoryRecursive(archive, configDir, 'config');
      }
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
