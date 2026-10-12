import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';
import { ModpackUnpacker } from '../modpack/unpacker.js';
import { modrinthClient } from '../../api/client.js';
import { ModpackProfileManager } from '../modpack/profileManager.js';
import { BaselineManager } from '../modpack/baselineManager.js';
import { getLauncherCapabilities } from './capabilities.js';
import { detectLauncherFromPath } from './detector.js';
import { DependencyGraph } from '../dependency/graph.js';
import { instanceConfig, type InstanceConfigManager } from './config.js';

export interface InstalledLocalResult {
  file: string;
  fileName: string;
  type: 'mod' | 'mrpack' | 'shader' | 'resourcepack' | 'unknown';
  success: boolean;
  error?: string;
}

export interface LocalInstallOptions {
  launcher?: string;
  modsOnly?: boolean;
  configManager?: InstanceConfigManager;
}

async function installMrpackToContainer(
  filePath: string,
  fileName: string,
  instanceDir: string,
  unpacker: ModpackUnpacker,
  options?: LocalInstallOptions
): Promise<InstalledLocalResult> {
  const effectiveLauncher = options?.launcher ?? detectLauncherFromPath(instanceDir).launcher;
  const caps = getLauncherCapabilities(effectiveLauncher);
  if (!caps.supportsModpack) {
    return {
      file: filePath,
      fileName,
      type: 'mrpack',
      success: false,
      error:
        caps.incompatibilityReason ??
        `Launcher "${effectiveLauncher}" tidak mendukung format .mrpack secara langsung. Gunakan launcher pihak ketiga seperti TLauncher atau Legacy Launcher untuk modpack.`,
    };
  }

  const index = await unpacker.inspect(filePath);
  let packLoader: string = 'fabric';
  let packGameVersion: string = '1.20.1';
  if (index.dependencies) {
    for (const [dep, ver] of Object.entries(index.dependencies)) {
      const lower = dep.toLowerCase();
      if (lower.includes('fabric')) packLoader = 'fabric';
      else if (lower.includes('neoforge')) packLoader = 'neoforge';
      else if (lower.includes('forge')) packLoader = 'forge';
      else if (lower.includes('quilt')) packLoader = 'quilt';
      if (lower === 'minecraft' && typeof ver === 'string') packGameVersion = ver;
    }
  }

  const container = await ModpackProfileManager.resolveContainerForLoader(
    instanceDir,
    packLoader,
    packGameVersion,
    effectiveLauncher
  );

  await BaselineManager.createBaselineOnce(container.containerDir);

  const activeProfile = await ModpackProfileManager.getActiveProfile(container.containerDir);
  if (activeProfile?.activeProfile) {
    await ModpackProfileManager.saveActiveToProfile(container.containerDir);
    await ModpackProfileManager.clearContainerLiveFiles(container.containerDir);
  }

  const downloadsDir = ModpackProfileManager.getDownloadsDir(container.containerDir);
  await mkdir(downloadsDir, { recursive: true });

  const vaultPath = path.join(downloadsDir, fileName);
  if (path.resolve(filePath) !== path.resolve(vaultPath)) {
    await copyFile(filePath, vaultPath);
  }

  await unpacker.install(vaultPath, {
    instanceDir: container.containerDir,
    targetEnv: 'client',
    modsOnly: options?.modsOnly ?? false,
  });

  const profileId = path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  await ModpackProfileManager.createProfileAfterInstall(container.containerDir, {
    id: profileId,
    name: index.name,
    versionId: index.versionId || '1.0.0',
    loader: container.matchedLoader,
    gameVersion: packGameVersion,
  });

  await ModpackProfileManager.syncProfilesFromDownloads(container.containerDir);

  const packGraph = new DependencyGraph(container.containerDir, packGameVersion, container.matchedLoader);
  await packGraph.load();
  for (const file of index.files) {
    if (options?.modsOnly && !file.path.startsWith('mods/') && !file.path.endsWith('.jar')) continue;
    const basename = path.basename(file.path);
    const baseSlug = basename.replace(/\.(jar|zip|mrpack)$/i, '').toLowerCase();
    if (file.path.startsWith('shaderpacks/') || file.path.includes('/shaderpacks/')) {
      packGraph.registerAsset('shader', baseSlug, { filename: basename, sha512: file.hashes.sha512 });
    } else if (file.path.startsWith('resourcepacks/') || file.path.includes('/resourcepacks/')) {
      packGraph.registerAsset('resourcepack', baseSlug, { filename: basename, sha512: file.hashes.sha512 });
    } else if (file.path.endsWith('.jar') || file.path.startsWith('mods/')) {
      packGraph.registerMod(baseSlug, {
        projectId: baseSlug,
        versionId: index.versionId,
        versionNumber: index.versionId,
        filename: basename,
        sha512: file.hashes.sha512,
        isRoot: true,
        dependencies: [],
      });
    }
  }
  await packGraph.save();

  await ModpackProfileManager.saveActiveToProfile(container.containerDir);

  await ModpackProfileManager.setActiveProfileInfo(container.containerDir, {
    activeProfile: profileId,
    name: index.name,
    versionId: index.versionId || '1.0.0',
    loader: container.matchedLoader,
    gameVersion: packGameVersion,
    updatedAt: new Date().toISOString(),
  });

  const cfg = options?.configManager ?? instanceConfig;
  const activeKey = cfg.get().activeInstance;
  if (activeKey && cfg.get().instances[activeKey]) {
    const inst = cfg.get().instances[activeKey];
    inst.mode = 'modpack';
    inst.activeContainer = container.containerName;
    inst.modsDir = path.join(container.containerDir, 'mods');
    inst.gameVersion = packGameVersion;
    inst.loader = container.matchedLoader as any;
    await cfg.save();
  }

  return { file: filePath, fileName, type: 'mrpack', success: true };
}

export async function installLocalFiles(
  filePaths: string[],
  instanceDir: string,
  modsDir: string,
  unpackerInstance?: ModpackUnpacker,
  options?: LocalInstallOptions
): Promise<InstalledLocalResult[]> {
  const results: InstalledLocalResult[] = [];
  const unpacker = unpackerInstance ?? new ModpackUnpacker(modrinthClient);

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === '.jar') {
        await mkdir(modsDir, { recursive: true });
        const destPath = path.join(modsDir, fileName);
        await copyFile(filePath, destPath);
        results.push({ file: filePath, fileName, type: 'mod', success: true });
      } else if (ext === '.mrpack') {
        const mrpackRes = await installMrpackToContainer(
          filePath,
          fileName,
          instanceDir,
          unpacker,
          options
        );
        results.push(mrpackRes);
      } else if (ext === '.zip') {
        let zipHasShaders = false;
        let zipHasMcmeta = false;
        let zipHasModrinthIndex = false;
        const zipJarEntries: any[] = [];

        try {
          const zip = await unzipper.Open.file(filePath);
          for (const entry of zip.files) {
            const entryPath = entry.path.toLowerCase();
            if (entryPath === 'modrinth.index.json') {
              zipHasModrinthIndex = true;
              break;
            }
            if (entryPath.startsWith('shaders/') || entryPath.includes('/shaders/')) {
              zipHasShaders = true;
            }
            if (entryPath === 'pack.mcmeta' || entryPath.endsWith('/pack.mcmeta')) {
              zipHasMcmeta = true;
            }
            if (entryPath.endsWith('.jar') && !entryPath.startsWith('meta-inf/')) {
              zipJarEntries.push(entry);
            }
          }
        } catch {}

        if (zipHasModrinthIndex) {
          const mrpackRes = await installMrpackToContainer(
            filePath,
            fileName,
            instanceDir,
            unpacker,
            options
          );
          results.push(mrpackRes);
        } else if (zipHasShaders) {
          const shadersDir = path.join(instanceDir, 'shaderpacks');
          await mkdir(shadersDir, { recursive: true });
          await copyFile(filePath, path.join(shadersDir, fileName));
          results.push({ file: filePath, fileName, type: 'shader', success: true });
        } else if (zipJarEntries.length > 0 && !zipHasMcmeta) {
          await mkdir(modsDir, { recursive: true });
          for (const jarEntry of zipJarEntries) {
            const jarName = path.basename(jarEntry.path);
            const outStream = createWriteStream(path.join(modsDir, jarName));
            await pipeline(jarEntry.stream(), outStream);
          }
          results.push({ file: filePath, fileName, type: 'mod', success: true });
        } else {
          const rpDir = path.join(instanceDir, 'resourcepacks');
          await mkdir(rpDir, { recursive: true });
          await copyFile(filePath, path.join(rpDir, fileName));
          results.push({ file: filePath, fileName, type: 'resourcepack', success: true });
        }
      } else {
        results.push({
          file: filePath,
          fileName,
          type: 'unknown',
          success: false,
          error: 'Format berkas tidak didukung (harus .jar, .mrpack, atau .zip)',
        });
      }
    } catch (err: any) {
      results.push({
        file: filePath,
        fileName,
        type: 'unknown',
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}
