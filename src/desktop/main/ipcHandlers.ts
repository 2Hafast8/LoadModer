import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import { readdir, stat, rm, mkdir } from 'node:fs/promises';
import { instanceConfig } from '../../core/instance/config.js';
import { instanceDetector, detectLauncherFromPath } from '../../core/instance/detector.js';
import { toggleModFile } from '../../core/instance/modToggle.js';
import { BisectRunner } from '../../core/troubleshoot/bisect.js';
import { modrinthClient } from '../../api/client.js';
import { DependencyGraph } from '../../core/dependency/graph.js';
import { resolveAndInstallDependencies } from '../../core/dependency/resolver.js';
import { formatBytes } from '../../utils/format.js';
import { hashFile } from '../../utils/crypto.js';
import { findMinecraftDirs, listLocalDrives, resolveManualMinecraftPath } from '../../core/instance/driveScanner.js';
import { ModpackUnpacker } from '../../core/modpack/unpacker.js';
import { ModpackProfileManager } from '../../core/modpack/profileManager.js';
import { profileSnapshotManager } from '../../core/profile/snapshotManager.js';
import { ModsWatcher } from '../../core/watcher/modsWatcher.js';
import { InstalledAssetsIndex } from '../../core/instance/installedIndex.js';
import { isTrueUpdate } from '../../utils/versionCompare.js';
import pLimit from 'p-limit';
import type { LauncherType, LoaderType, MinecraftInstance } from '../../types/instance.js';
import type { SearchIndex } from '../../api/client.js';
import type { ModVersion, VersionType } from '../../types/modrinth.js';

let activeWatcher: ModsWatcher | null = null;

function setupWatcher(modsDir: string, instanceDir: string, getMainWindow?: () => BrowserWindow | null): void {
  if (activeWatcher) {
    activeWatcher.stop();
    activeWatcher = null;
  }
  try {
    activeWatcher = new ModsWatcher(modsDir, instanceDir);
    const notifyRenderer = () => {
      const win = getMainWindow?.();
      win?.webContents.send('mods:changed');
    };
    activeWatcher.on('sync', notifyRenderer);
    activeWatcher.on('file-event', notifyRenderer);
    activeWatcher.start();
  } catch {
    // Graceful fallback if watching fails
  }
}

export function registerIpcHandlers(getMainWindow?: () => BrowserWindow | null): void {
  // Initialize watcher on active instance if available
  instanceConfig.load().then(() => {
    const active = instanceConfig.getActiveInstance();
    if (active?.modsDir && active?.rootDir) {
      setupWatcher(active.modsDir, active.rootDir, getMainWindow);
    }
  }).catch(() => {});

  // --- Window Controls ---
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() ?? false;
  });

  // --- Instances Management ---
  ipcMain.handle('instances:getAll', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance() ?? null;
      const detected = await instanceDetector.scanAll();

      const savedInstances = instanceConfig.get().instances ?? {};
      const list = [...detected];
      for (const [id, cfg] of Object.entries(savedInstances)) {
        if (!list.some((i) => i.id === id || i.rootDir === cfg.rootDir)) {
          list.push({
            id,
            name: cfg.name ?? id,
            launcher: (cfg.launcher ?? 'Custom') as LauncherType,
            rootDir: cfg.rootDir,
            modsDir: cfg.modsDir,
            gameVersion: cfg.gameVersion,
            loader: cfg.loader as LoaderType | undefined,
          });
        }
      }

      return { active, list };
    } catch (err: any) {
      console.error('Error fetching instances:', err);
      return { active: null, list: [], error: err.message };
    }
  });

  ipcMain.handle('instances:setActive', async (_event, id: string) => {
    try {
      await instanceConfig.load();
      const detected = await instanceDetector.scanAll();
      const match = detected.find((i) => i.id === id);
      if (match) {
        instanceConfig.saveInstance(
          id,
          {
            name: match.name,
            launcher: match.launcher,
            rootDir: match.rootDir,
            modsDir: match.modsDir,
            gameVersion: match.gameVersion,
            loader: match.loader,
          },
          true
        );
        setupWatcher(match.modsDir, match.rootDir, getMainWindow);
      } else {
        instanceConfig.setActiveInstance(id);
        const active = instanceConfig.getActiveInstance();
        if (active?.modsDir && active?.rootDir) {
          setupWatcher(active.modsDir, active.rootDir, getMainWindow);
        }
      }
      await instanceConfig.save();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('instances:scanAll', async () => {
    try {
      return await instanceDetector.scanAll();
    } catch (err: any) {
      console.error('Error scanning instances:', err);
      return [];
    }
  });

  ipcMain.handle('instances:deepScanDrives', async () => {
    try {
      const drives = await listLocalDrives();
      const scanResult = await findMinecraftDirs(drives, { maxDepth: 4 });
      const instances: MinecraftInstance[] = [];

      for (const dir of scanResult.found) {
        const info = detectLauncherFromPath(dir);
        instances.push({
          id: info.id,
          name: info.name,
          launcher: info.launcher,
          rootDir: dir,
          modsDir: path.join(dir, 'mods'),
        });
      }

      return instances;
    } catch (err: any) {
      console.error('Deep scan drives error:', err);
      return [];
    }
  });

  ipcMain.handle('instances:browseFolder', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Pilih Folder .minecraft atau Launcher Instance',
      });

      if (res.canceled || res.filePaths.length === 0) {
        return { success: false };
      }

      const selected = res.filePaths[0];
      const valid = await resolveManualMinecraftPath(selected);
      const rootDir = valid.ok ? valid.rootDir : path.resolve(selected);
      const info = detectLauncherFromPath(rootDir);
      const modsDir = path.join(rootDir, 'mods');
      await mkdir(modsDir, { recursive: true });

      await instanceConfig.load();
      instanceConfig.saveInstance(
        info.id,
        {
          name: info.name,
          launcher: info.launcher,
          rootDir,
          modsDir,
        },
        true
      );
      await instanceConfig.save();
      setupWatcher(modsDir, rootDir, getMainWindow);

      return {
        success: true,
        instance: {
          id: info.id,
          name: info.name,
          launcher: info.launcher,
          rootDir,
          modsDir,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('instances:openFolder', async (_event, targetPath?: string) => {
    try {
      let folderToOpen = targetPath;
      if (!folderToOpen) {
        await instanceConfig.load();
        const active = instanceConfig.getActiveInstance();
        folderToOpen = active?.rootDir;
      }
      if (!folderToOpen) throw new Error('Direktori instance belum ditentukan');
      const resolved = path.resolve(folderToOpen);
      const res = await shell.openPath(resolved);
      if (res) {
        return { success: false, error: res };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Mods & Assets Management ---
  ipcMain.handle('mods:list', async (_event, customDir?: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      const modsDir = customDir ?? active?.modsDir;

      if (!modsDir) {
        return { items: [], activeCount: 0, totalCount: 0, storageUsage: '0 B' };
      }

      let entries: string[] = [];
      try {
        entries = await readdir(modsDir);
      } catch {
        return { items: [], activeCount: 0, totalCount: 0, storageUsage: '0 B' };
      }

      const modFiles = entries.filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
      let totalBytes = 0;
      let activeCount = 0;

      const items = await Promise.all(
        modFiles.map(async (fileName) => {
          const filePath = path.join(modsDir, fileName);
          let size = 0;
          try {
            const s = await stat(filePath);
            size = s.size;
            totalBytes += size;
          } catch {}

          const enabled = !fileName.endsWith('.disabled');
          if (enabled) activeCount++;

          const cleanName = fileName.replace(/\.disabled$/, '').replace(/\.jar$/, '');
          return {
            name: cleanName,
            fileName,
            enabled,
            size,
            formattedSize: formatBytes(size),
          };
        })
      );

      return {
        items,
        activeCount,
        totalCount: items.length,
        storageUsage: formatBytes(totalBytes),
      };
    } catch (err: any) {
      console.error('Error listing mods:', err);
      return { items: [], activeCount: 0, totalCount: 0, storageUsage: '0 B', error: err.message };
    }
  });

  ipcMain.handle('mods:listPacks', async (_event, type: 'shaderpacks' | 'resourcepacks') => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) return [];

      const folder = path.join(active.rootDir, type);
      let entries: string[] = [];
      try {
        entries = await readdir(folder);
      } catch {
        return [];
      }

      const zipFiles = entries.filter((f) => f.endsWith('.zip'));
      const items = await Promise.all(
        zipFiles.map(async (fileName) => {
          const filePath = path.join(folder, fileName);
          let size = 0;
          try {
            const s = await stat(filePath);
            size = s.size;
          } catch {}
          return {
            fileName,
            size,
            formattedSize: formatBytes(size),
          };
        })
      );

      return items;
    } catch (err: any) {
      console.error(`Error listing ${type}:`, err);
      return [];
    }
  });

  ipcMain.handle('mods:toggle', async (_event, fileName: string, enable: boolean, customDir?: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      const modsDir = customDir ?? active?.modsDir;
      if (!modsDir) throw new Error('Folder mods belum ditentukan');

      const safeName = path.basename(fileName);
      await toggleModFile(modsDir, safeName, enable);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    'mods:remove',
    async (
      _event,
      fileName: string,
      prune = true,
      customDir?: string,
      type: 'mod' | 'shader' | 'resourcepack' = 'mod'
    ) => {
      try {
        await instanceConfig.load();
        const active = instanceConfig.getActiveInstance();
        if (!active?.rootDir) throw new Error('Instance belum ditentukan');

        const safeName = path.basename(fileName);
        let targetDir = customDir ?? active.modsDir;
        if (type === 'shader') {
          targetDir = path.join(active.rootDir, 'shaderpacks');
        } else if (type === 'resourcepack') {
          targetDir = path.join(active.rootDir, 'resourcepacks');
        }

        const targetPath = path.join(targetDir, safeName);
        await rm(targetPath, { force: true });

        if (type === 'shader' || type === 'resourcepack') {
          const graph = new DependencyGraph(active.rootDir);
          await graph.load();
          const matched = graph.findAsset(type, safeName);
          if (matched) graph.removeAsset(type, matched.slug);
          await graph.save();
          return { success: true, removed: [safeName] };
        }

        const graph = new DependencyGraph(active.rootDir);
        await graph.load();

        const matchClean = safeName.replace(/\.disabled$/, '');
        const lockEntry = Object.entries(graph.data.mods).find(
          ([slug, m]) =>
            m.filename === safeName ||
            m.filename === matchClean ||
            slug.toLowerCase() === safeName.toLowerCase()
        );
        const targetSlug = lockEntry ? lockEntry[0] : safeName;
        const { orphanedSlugs } = graph.removeMod(targetSlug);

        const removedFiles = [safeName];
        if (prune && orphanedSlugs.length > 0) {
          for (const orphanSlug of orphanedSlugs) {
            const orphanMod = graph.data.mods[orphanSlug];
            if (orphanMod?.filename) {
              const orphanSafe = path.basename(orphanMod.filename);
              await rm(path.join(targetDir, orphanSafe), { force: true });
              await rm(path.join(targetDir, `${orphanSafe}.disabled`), { force: true });
              removedFiles.push(orphanSafe);
            }
            graph.removeMod(orphanSlug);
          }
        }

        await graph.reconcileWithDisk(targetDir, active.rootDir);
        await graph.save();

        return { success: true, removed: removedFiles };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle('mods:checkUpdates', async () => {
    try {
      await instanceConfig.load();
      const activeKey = instanceConfig.get().activeInstance;
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir || !active?.modsDir || !activeKey) {
        return { updates: [], checkedCount: 0, gameVersion: 'Belum Ada', loader: 'Belum Ada' };
      }

      let gameVersion = active.gameVersion;
      let loader = active.loader;

      // Auto-detect version and loader if missing
      if (!gameVersion || !loader) {
        try {
          const inspected = await instanceDetector.inspectGameDir(active.rootDir, {
            id: activeKey,
            name: active.name,
            launcher: active.launcher as LauncherType,
          });
          if (inspected.gameVersion) gameVersion = inspected.gameVersion;
          if (inspected.loader) loader = inspected.loader;

          if (gameVersion || loader) {
            instanceConfig.saveInstance(
              activeKey,
              {
                ...active,
                gameVersion: gameVersion ?? active.gameVersion,
                loader: loader ?? active.loader,
              },
              true
            );
            await instanceConfig.save();
          }
        } catch {}
      }

      const entries = await readdir(active.modsDir).catch(() => [] as string[]);
      const activeJars = entries.filter((f) => f.endsWith('.jar'));
      if (activeJars.length === 0) {
        return { updates: [], checkedCount: 0, gameVersion: gameVersion ?? 'Auto', loader: loader ?? 'Auto' };
      }

      const limit = pLimit(8);
      const fileHashes = await Promise.all(
        activeJars.map((jar) =>
          limit(async () => {
            const filePath = path.join(active.modsDir, jar);
            const sha1 = await hashFile(filePath, 'sha1');
            return { filename: jar, sha1, filePath };
          })
        )
      );

      // Fetch version metadata of currently installed hashes from Modrinth
      const currentVersionsMap = await modrinthClient
        .getVersionsByHashes(fileHashes.map((f) => f.sha1))
        .catch(() => ({} as Record<string, ModVersion>));

      // Check if any installed mod is an alpha/beta channel
      let hasAlpha = false;
      let hasBeta = false;
      for (const ver of Object.values(currentVersionsMap)) {
        if (ver.version_type === 'alpha') hasAlpha = true;
        if (ver.version_type === 'beta') hasBeta = true;
        if (!loader && ver.loaders && ver.loaders.length > 0) {
          loader = ver.loaders[0] as LoaderType;
        }
        if (!gameVersion && ver.game_versions && ver.game_versions.length > 0) {
          gameVersion = ver.game_versions[0];
        }
      }

      // Also inspect filenames if hashes were unknown
      if (!hasAlpha) {
        hasAlpha = fileHashes.some((f) => /[-_.]alpha/i.test(f.filename));
      }
      if (!hasBeta) {
        hasBeta = fileHashes.some((f) => /[-_.]beta/i.test(f.filename));
      }

      const versionTypes: VersionType[] = hasAlpha
        ? ['release', 'beta', 'alpha']
        : hasBeta
        ? ['release', 'beta']
        : ['release', 'beta'];

      const targetGameVersion = gameVersion || '1.20.1';
      const targetLoader = loader || 'fabric';

      const latestMap = await modrinthClient.getLatestByHashes(
        fileHashes.map((f) => f.sha1),
        { gameVersion: targetGameVersion, loader: targetLoader },
        versionTypes
      );

      const updates: Array<{
        currentFile: string;
        nextVersion: string;
        nextFileName: string;
        size: number;
      }> = [];

      for (const item of fileHashes) {
        const nextVer = latestMap[item.sha1];
        const currentVer = currentVersionsMap[item.sha1];
        if (nextVer && isTrueUpdate(item, currentVer, nextVer)) {
          const nextFile = nextVer.files.find((f: any) => f.primary) ?? nextVer.files[0];
          updates.push({
            currentFile: item.filename,
            nextVersion: nextVer.version_number,
            nextFileName: nextFile.filename,
            size: nextFile.size,
          });
        }
      }

      return {
        updates,
        checkedCount: activeJars.length,
        gameVersion: targetGameVersion,
        loader: targetLoader,
      };
    } catch (err: any) {
      console.error('Check updates error:', err);
      return { updates: [], checkedCount: 0, error: err.message };
    }
  });

  ipcMain.handle('mods:getInstalledIndex', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      const index = await InstalledAssetsIndex.load(active);
      return index.getSummary();
    } catch (err: any) {
      return { projectIds: [], slugs: [], filenames: [], versionMap: {} };
    }
  });

  ipcMain.handle('mods:applyUpdate', async (_event, currentFile: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.modsDir || !active?.gameVersion || !active?.loader) {
        throw new Error('Instance belum lengkap');
      }

      const safeCurrent = path.basename(currentFile);
      const currentPath = path.join(active.modsDir, safeCurrent);
      const sha1 = await hashFile(currentPath, 'sha1');
      const latestMap = await modrinthClient.getLatestByHashes(
        [sha1],
        { gameVersion: active.gameVersion, loader: active.loader },
        ['release']
      );

      const nextVer = latestMap[sha1];
      if (!nextVer) throw new Error('Tidak ada versi pembaruan');

      const nextFile = nextVer.files.find((f: any) => f.primary) ?? nextVer.files[0];
      if (!nextFile) throw new Error('Berkas unduhan tidak ditemukan');

      const safeNext = path.basename(nextFile.filename);
      const destPath = path.join(active.modsDir, safeNext);
      await modrinthClient.download(nextFile.url, destPath, { sha512: nextFile.hashes.sha512 });

      if (safeCurrent !== safeNext) {
        await rm(currentPath, { force: true });
      }

      const graph = new DependencyGraph(active.rootDir);
      await graph.load();
      graph.removeMod(safeCurrent);
      graph.registerMod(nextVer.project_id, {
        versionId: nextVer.id,
        projectId: nextVer.project_id,
        versionNumber: nextVer.version_number,
        filename: safeNext,
        sha512: nextFile.hashes.sha512,
        isRoot: true,
        dependencies: (nextVer.dependencies ?? []).map((d: any) => d.project_id).filter(Boolean),
      });
      await graph.save();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Modrinth Explore & Install ---
  ipcMain.handle(
    'modrinth:search',
    async (
      _event,
      query: string,
      filter?: {
        type?: string;
        mcVersion?: string;
        loader?: string;
        limit?: number;
        index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
      }
    ) => {
      try {
        const results = await modrinthClient.search(
          query,
          {
            projectType: (filter?.type as any) ?? 'mod',
            loader: filter?.loader,
            gameVersion: filter?.mcVersion,
          },
          filter?.limit ?? 24,
          (filter?.index as SearchIndex) ?? 'relevance'
        );
        return results;
      } catch (err: any) {
        console.error('Error searching Modrinth:', err);
        return { hits: [], total_hits: 0, error: err.message };
      }
    }
  );

  ipcMain.handle('modrinth:getProject', async (_event, slugOrId: string) => {
    try {
      return await modrinthClient.getProject(slugOrId);
    } catch (err: any) {
      console.error('Error getting project metadata:', err);
      return null;
    }
  });

  ipcMain.handle('modrinth:getVersions', async (_event, slugOrId: string, filter?: { loader?: string; mcVersion?: string }) => {
    try {
      return await modrinthClient.getProjectVersions(slugOrId, {
        loader: filter?.loader,
        gameVersion: filter?.mcVersion,
      });
    } catch (err: any) {
      console.error('Error getting project versions:', err);
      return [];
    }
  });

  ipcMain.handle(
    'modrinth:install',
    async (
      _event,
      slugOrId: string,
      options?: { type?: string; mcVersion?: string; loader?: string; versionId?: string }
    ) => {
      try {
        await instanceConfig.load();
        const active = instanceConfig.getActiveInstance();
        if (!active?.rootDir) {
          throw new Error('Silakan pilih instance aktif terlebih dahulu di tab Instances.');
        }

        const activeKey = instanceConfig.get().activeInstance;
        const pType = options?.type ?? 'mod';
        let gameVersion = options?.mcVersion ?? active.gameVersion;
        let loader = options?.loader ?? active.loader;

        // Auto-detect version and loader if missing from active instance
        if (!gameVersion || !loader) {
          try {
            const inspected = await instanceDetector.inspectGameDir(active.rootDir, {
              id: activeKey ?? 'custom',
              name: active.name,
              launcher: active.launcher as LauncherType,
            });
            if (inspected.gameVersion) gameVersion = inspected.gameVersion;
            if (inspected.loader) loader = inspected.loader;

            if (activeKey && (gameVersion || loader)) {
              instanceConfig.saveInstance(activeKey, {
                ...active,
                gameVersion: gameVersion ?? active.gameVersion,
                loader: loader ?? active.loader,
              });
              await instanceConfig.save();
            }
          } catch {}
        }

        // Handle Modpack (.mrpack)
        if (pType === 'modpack' || slugOrId.endsWith('.mrpack')) {
          let targetVersion: any;
          if (options?.versionId) {
            targetVersion = await modrinthClient.getVersion(options.versionId);
          } else {
            const versions = await modrinthClient.getProjectVersions(slugOrId, {
              loader: loader ?? undefined,
              gameVersion: gameVersion ?? undefined,
            });

            if (!versions || versions.length === 0) {
              throw new Error(`Tidak ditemukan versi modpack yang cocok untuk ${slugOrId}`);
            }
            targetVersion = versions[0];
          }

          const primaryFile = targetVersion.files.find((f: any) => f.primary) ?? targetVersion.files[0];
          const tempMrpack = path.join(active.rootDir, `.temp_${Date.now()}.mrpack`);

          await modrinthClient.download(primaryFile.url, tempMrpack, { sha512: primaryFile.hashes.sha512 });
          const unpacker = new ModpackUnpacker(modrinthClient);
          await unpacker.install(tempMrpack, { instanceDir: active.rootDir });
          await rm(tempMrpack, { force: true });

          return { success: true, message: `Modpack ${targetVersion.name || slugOrId} berhasil diekstrak dan dipasang.` };
        }

        // Handle Shaders
        if (pType === 'shader') {
          let targetVersion: any;
          if (options?.versionId) {
            targetVersion = await modrinthClient.getVersion(options.versionId);
          } else {
            const versions = await modrinthClient.getProjectVersions(slugOrId, {});
            if (!versions || versions.length === 0) throw new Error('Versi shader tidak ditemukan');
            targetVersion = versions[0];
          }

          const primaryFile = targetVersion.files.find((f: any) => f.primary) ?? targetVersion.files[0];
          const shaderDir = path.join(active.rootDir, 'shaderpacks');
          await mkdir(shaderDir, { recursive: true });
          const safeName = path.basename(primaryFile.filename);
          const dest = path.join(shaderDir, safeName);
          await modrinthClient.download(primaryFile.url, dest, { sha512: primaryFile.hashes.sha512 });

          const graph = new DependencyGraph(active.rootDir, gameVersion ?? '', loader ?? '');
          await graph.load();
          graph.registerAsset('shader', slugOrId, {
            filename: safeName,
            sha512: primaryFile.hashes.sha512,
          });

          // Check required shader dependencies (e.g. Iris/Oculus/Fabric API)
          let depCount = 0;
          try {
            const project = await modrinthClient.getProject(slugOrId).catch(() => undefined);
            const depResult = await resolveAndInstallDependencies({
              mainModSlug: slugOrId,
              mainVersion: targetVersion,
              project,
              modsDir: active.modsDir,
              gameVersion: gameVersion ?? active.gameVersion ?? '',
              loader: loader ?? active.loader ?? '',
              graph,
            });
            depCount = depResult.installed.length;
          } catch (depErr) {
            console.warn('Shader dependency resolution note:', depErr);
          }

          await graph.save();

          const depMsg = depCount > 0 ? ` (+ ${depCount} dependensi otomatis dipasang)` : '';
          return { success: true, message: `Shader pack ${safeName} berhasil dipasang.${depMsg}` };
        }

        // Handle Resource Packs
        if (pType === 'resourcepack') {
          let targetVersion: any;
          if (options?.versionId) {
            targetVersion = await modrinthClient.getVersion(options.versionId);
          } else {
            const versions = await modrinthClient.getProjectVersions(slugOrId, {});
            if (!versions || versions.length === 0) throw new Error('Versi resource pack tidak ditemukan');
            targetVersion = versions[0];
          }

          const primaryFile = targetVersion.files.find((f: any) => f.primary) ?? targetVersion.files[0];
          const rpDir = path.join(active.rootDir, 'resourcepacks');
          await mkdir(rpDir, { recursive: true });
          const safeName = path.basename(primaryFile.filename);
          const dest = path.join(rpDir, safeName);
          await modrinthClient.download(primaryFile.url, dest, { sha512: primaryFile.hashes.sha512 });

          const graph = new DependencyGraph(active.rootDir, gameVersion ?? '', loader ?? '');
          await graph.load();
          graph.registerAsset('resourcepack', slugOrId, {
            filename: safeName,
            sha512: primaryFile.hashes.sha512,
          });

          // Check required resourcepack dependencies (e.g. ETF/EMF/CIT Resewn/Continuity)
          let depCount = 0;
          try {
            const project = await modrinthClient.getProject(slugOrId).catch(() => undefined);
            const depResult = await resolveAndInstallDependencies({
              mainModSlug: slugOrId,
              mainVersion: targetVersion,
              project,
              modsDir: active.modsDir,
              gameVersion: gameVersion ?? active.gameVersion ?? '',
              loader: loader ?? active.loader ?? '',
              graph,
            });
            depCount = depResult.installed.length;
          } catch (depErr) {
            console.warn('Resource pack dependency resolution note:', depErr);
          }

          await graph.save();

          const depMsg = depCount > 0 ? ` (+ ${depCount} dependensi otomatis dipasang)` : '';
          return { success: true, message: `Resource pack ${safeName} berhasil dipasang.${depMsg}` };
        }

        // Handle Standard Mod (.jar)
        let targetVersion: any;
        if (options?.versionId) {
          targetVersion = await modrinthClient.getVersion(options.versionId);
        } else {
          let versions = await modrinthClient.getProjectVersions(slugOrId, {
            loader: loader ?? undefined,
            gameVersion: gameVersion ?? undefined,
          });

          // Intelligent fallback: if no version found for specific gameVersion (e.g. snapshot/26.3 tag),
          // fallback to matching by loader so mods like FerriteCore can still be installed
          if ((!versions || versions.length === 0) && gameVersion) {
            versions = await modrinthClient.getProjectVersions(slugOrId, {
              loader: loader ?? undefined,
            });
          }

          if (!versions || versions.length === 0) {
            throw new Error(
              `Tidak ditemukan versi yang cocok untuk "${slugOrId}" dengan loader ${loader ? loader.toUpperCase() : 'apapun'}.`
            );
          }
          targetVersion = versions.find((v: any) => v.version_type === 'release') ?? versions[0];
        }

        // Strict Loader Compatibility Validation (Ensures Fabric mod is NEVER installed on Forge!)
        if (loader && targetVersion.loaders && targetVersion.loaders.length > 0) {
          const currentLoader = loader.toLowerCase();
          const versionLoaders = targetVersion.loaders.map((l: string) => l.toLowerCase());
          const isLoaderMatch =
            versionLoaders.includes(currentLoader) ||
            (currentLoader === 'quilt' && versionLoaders.includes('fabric'));

          if (!isLoaderMatch) {
            throw new Error(
              `Tidak Kompatibel: Mod "${targetVersion.name || slugOrId}" (${versionLoaders.join(', ')}) tidak cocok untuk loader instance aktif (${loader.toUpperCase()}).`
            );
          }
        }

        const primaryFile = targetVersion.files.find((f: any) => f.primary) ?? targetVersion.files[0];
        if (!primaryFile) throw new Error('Tidak ada berkas unduhan pada versi ini.');

        const safeDest = path.basename(primaryFile.filename);
        const destPath = path.join(active.modsDir, safeDest);

        const instanceDir = active.rootDir;
        const graph = new DependencyGraph(instanceDir, gameVersion ?? '', loader ?? '');
        await graph.load();

        // 1. Validasi Bentrok (Incompatibilities)
        const incompatibilities = (targetVersion.dependencies ?? []).filter(
          (d: any) => d.dependency_type === 'incompatible'
        );
        for (const inc of incompatibilities) {
          const incId = inc.project_id || inc.version_id;
          if (incId) {
            const conflict = graph.findMod(incId);
            if (conflict) {
              throw new Error(
                `Bentrok: Mod "${targetVersion.name || slugOrId}" tidak kompatibel dengan "${conflict.entry.filename}" yang sudah terpasang.`
              );
            }
          }
        }

        const reverseConflicts = graph.checkIncompatibilities([targetVersion.project_id, slugOrId]);
        if (reverseConflicts.length > 0) {
          throw new Error(
            `Bentrok: Mod "${reverseConflicts.join(', ')}" yang sudah terpasang menyatakan tidak kompatibel dengan mod ini.`
          );
        }

        // 2. Validasi Duplikat (Duplicate Prevention)
        const existingMod = graph.findMod(slugOrId) || graph.findMod(targetVersion.project_id);
        if (existingMod) {
          if (existingMod.entry.versionId === targetVersion.id || existingMod.entry.filename === safeDest) {
            return {
              success: false,
              error: `Mod "${existingMod.entry.filename}" dengan versi yang sama sudah terpasang di instance ini.`,
            };
          }
          // Jika mengganti versi, hapus versi lama agar tidak terjadi duplikat berkas .jar
          const oldPath = path.join(active.modsDir, existingMod.entry.filename);
          await rm(oldPath, { force: true });
          await rm(`${oldPath}.disabled`, { force: true });
          graph.removeMod(existingMod.slug);
        }

        // Bersihkan berkas lawas yang mungkin memiliki slug sama di disk
        const cleanSlug = slugOrId.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanSlug.length >= 3) {
          const diskJars = await readdir(active.modsDir).catch(() => [] as string[]);
          for (const jar of diskJars) {
            const cleanJar = jar.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanJar.startsWith(cleanSlug) && jar.endsWith('.jar') && jar !== safeDest) {
              await rm(path.join(active.modsDir, jar), { force: true });
              await rm(path.join(active.modsDir, `${jar}.disabled`), { force: true });
            }
          }
        }

        await modrinthClient.download(primaryFile.url, destPath, {
          sha512: primaryFile.hashes.sha512,
        });

        graph.registerMod(slugOrId, {
          versionId: targetVersion.id,
          projectId: targetVersion.project_id,
          versionNumber: targetVersion.version_number,
          filename: safeDest,
          sha512: primaryFile.hashes.sha512,
          isRoot: true,
          dependencies: (targetVersion.dependencies ?? []).map((d: any) => d.project_id).filter(Boolean),
        });

        // Automatically resolve and install required dependencies
        let depCount = 0;
        try {
          const project = await modrinthClient.getProject(slugOrId).catch(() => undefined);
          const depResult = await resolveAndInstallDependencies({
            mainModSlug: slugOrId,
            mainVersion: targetVersion,
            project,
            modsDir: active.modsDir,
            gameVersion: gameVersion ?? active.gameVersion ?? '',
            loader: loader ?? active.loader ?? '',
            graph,
          });
          depCount = depResult.installed.length;
        } catch (depErr) {
          console.warn('Dependency resolution notice:', depErr);
        }

        await graph.save();

        const depMsg = depCount > 0 ? ` (+ ${depCount} dependensi otomatis dipasang)` : '';
        return { success: true, message: `Berhasil menginstal ${safeDest}${depMsg}` };
      } catch (err: any) {
        console.error('Error installing project:', err);
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle('modrinth:installLocalMrpack', async (event, customFilePath?: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Silakan pilih instance aktif terlebih dahulu.');

      let mrpackPath = customFilePath;
      if (!mrpackPath) {
        const win = BrowserWindow.fromWebContents(event.sender);
        const res = await dialog.showOpenDialog(win!, {
          properties: ['openFile'],
          filters: [{ name: 'Modrinth Modpack', extensions: ['mrpack'] }],
          title: 'Pilih Berkas .mrpack Modpack',
        });
        if (res.canceled || res.filePaths.length === 0) return { success: false };
        mrpackPath = res.filePaths[0];
      }

      const unpacker = new ModpackUnpacker(modrinthClient);
      const result = await unpacker.install(mrpackPath, { instanceDir: active.rootDir });

      return {
        success: true,
        message: `Modpack "${result.index.name}" berhasil dipasang (${result.installedFiles.length} berkas diekstrak).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Modpack Profile Containers ---
  ipcMain.handle('modpack:listProfiles', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) return [];

      return await ModpackProfileManager.listProfiles(active.rootDir);
    } catch (err: any) {
      console.error('List modpack profiles error:', err);
      return [];
    }
  });

  ipcMain.handle('modpack:switchProfile', async (_event, profileId: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Instance belum aktif');

      await ModpackProfileManager.activateProfile(active.rootDir, profileId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('modpack:disableActive', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Instance belum aktif');

      await ModpackProfileManager.disableProfile(active.rootDir);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Version Snapshot Profiles ---
  ipcMain.handle('snapshots:list', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active) return [];
      return await profileSnapshotManager.listSnapshots(active);
    } catch {
      return [];
    }
  });

  ipcMain.handle('snapshots:switchProfile', async (_event, loader: string, gameVersion: string) => {
    try {
      await instanceConfig.load();
      const cfg = instanceConfig.get();
      const activeKey = cfg.activeInstance;
      if (!activeKey) throw new Error('Tidak ada instance aktif');
      const res = await profileSnapshotManager.switchProfile(activeKey, loader, gameVersion);
      return { success: true, savedCount: res.savedCount, restoredCount: res.restoredCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // --- Bisect Diagnostics ---
  ipcMain.handle('bisect:status', async (_event, customDir?: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      const modsDir = customDir ?? active?.modsDir;
      if (!modsDir) return { active: false };

      const statePath = path.join(modsDir, '.loadmoder_bisect.json');
      const s = await stat(statePath).catch(() => null);
      if (!s) return { active: false };

      return { active: true, runner: true };
    } catch {
      return { active: false };
    }
  });

  ipcMain.handle('bisect:step', async (_event, action: 'start' | 'good' | 'bad' | 'reset', customDir?: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      const modsDir = customDir ?? active?.modsDir;
      if (!modsDir) throw new Error('Folder mods belum ditentukan.');

      const runner = new BisectRunner(modsDir);
      if (action === 'start') {
        const res = await runner.start();
        return {
          success: true,
          message: `Sesi bisect dimulai. Sedang menguji ${res.testingCount} dari ${res.totalMods} mod.`,
        };
      } else if (action === 'good' || action === 'bad') {
        const res = await runner.report(action);
        if (res.finished) {
          return {
            success: true,
            message: `Penyebab crash ditemukan: ${res.culprit}`,
            culprit: res.culprit,
            finished: true,
          };
        }
        return {
          success: true,
          message: `Langkah ${res.step}: Tersisa ${res.remaining} kandidat mod untuk diuji.`,
          remaining: res.remaining,
          step: res.step,
          finished: false,
        };
      } else if (action === 'reset') {
        await runner.reset();
        return { success: true, message: 'Sesi bisect dibatalkan dan seluruh mod dipulihkan ke status semula.' };
      }
      return { success: false, message: 'Aksi bisect tidak dikenali.' };
    } catch (err: any) {
      return { success: false, error: err.message, message: err.message };
    }
  });

  ipcMain.handle('dialog:selectMrpack', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'Modrinth Modpack', extensions: ['mrpack'] }],
      title: 'Pilih Berkas .mrpack Modpack',
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });
}
