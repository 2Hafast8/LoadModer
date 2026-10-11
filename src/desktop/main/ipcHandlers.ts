import { ipcMain, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { readdir, stat, rm, copyFile } from 'node:fs/promises';
import { instanceConfig } from '../../core/instance/config.js';
import { instanceDetector, detectLauncherFromPath } from '../../core/instance/detector.js';
import { toggleModFile } from '../../core/instance/modToggle.js';
import { BisectRunner } from '../../core/troubleshoot/bisect.js';
import { modrinthClient } from '../../api/client.js';
import { DependencyGraph } from '../../core/dependency/graph.js';
import { formatBytes } from '../../utils/format.js';
import { hashFile } from '../../utils/crypto.js';
import { findMinecraftDirs, listLocalDrives, resolveManualMinecraftPath } from '../../core/instance/driveScanner.js';
import { ModpackUnpacker } from '../../core/modpack/unpacker.js';
import { ModpackProfileManager } from '../../core/modpack/profileManager.js';
import pLimit from 'p-limit';
import type { LauncherType, LoaderType, MinecraftInstance } from '../../types/instance.js';
import type { SearchIndex } from '../../api/client.js';

export function registerIpcHandlers(): void {
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

      // Ensure instances from config are included
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
      } else {
        instanceConfig.setActiveInstance(id);
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
      if (!valid.ok) {
        return { success: false, error: valid.reason };
      }

      const rootDir = valid.rootDir;
      const info = detectLauncherFromPath(rootDir);
      const modsDir = path.join(rootDir, 'mods');

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

      await toggleModFile(modsDir, fileName, enable);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mods:remove', async (_event, fileName: string, _prune = true, customDir?: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      const modsDir = customDir ?? active?.modsDir;
      if (!modsDir) throw new Error('Folder mods belum ditentukan');

      const targetPath = path.join(modsDir, fileName);
      await rm(targetPath, { force: true });

      const instanceDir = active?.rootDir ?? path.dirname(modsDir);
      const graph = new DependencyGraph(instanceDir);
      await graph.load();
      await graph.reconcileWithDisk(modsDir, instanceDir);
      await graph.save();

      return { success: true, removed: [fileName] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mods:checkUpdates', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.modsDir || !active?.gameVersion || !active?.loader) {
        return [];
      }

      const entries = await readdir(active.modsDir);
      const activeJars = entries.filter((f) => f.endsWith('.jar'));
      if (activeJars.length === 0) return [];

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

      const latestMap = await modrinthClient.getLatestByHashes(
        fileHashes.map((f) => f.sha1),
        { gameVersion: active.gameVersion, loader: active.loader },
        ['release']
      );

      const updates: Array<{
        currentFile: string;
        nextVersion: string;
        nextFileName: string;
        size: number;
      }> = [];

      for (const item of fileHashes) {
        const nextVer = latestMap[item.sha1];
        if (nextVer) {
          const nextFile = nextVer.files.find((f: any) => f.primary) ?? nextVer.files[0];
          if (nextFile && nextFile.hashes.sha1 !== item.sha1) {
            updates.push({
              currentFile: item.filename,
              nextVersion: nextVer.version_number,
              nextFileName: nextFile.filename,
              size: nextFile.size,
            });
          }
        }
      }

      return updates;
    } catch (err: any) {
      console.error('Check updates error:', err);
      return [];
    }
  });

  ipcMain.handle('mods:applyUpdate', async (_event, currentFile: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.modsDir || !active?.gameVersion || !active?.loader) {
        throw new Error('Instance belum lengkap');
      }

      const currentPath = path.join(active.modsDir, currentFile);
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

      const destPath = path.join(active.modsDir, nextFile.filename);
      await modrinthClient.download(nextFile.url, destPath, { sha512: nextFile.hashes.sha512 });

      // Remove old file
      if (currentFile !== nextFile.filename) {
        await rm(currentPath, { force: true });
      }

      // Reconcile graph
      const graph = new DependencyGraph(active.rootDir);
      await graph.load();
      graph.removeMod(currentFile);
      graph.registerMod(nextVer.project_id, {
        versionId: nextVer.id,
        projectId: nextVer.project_id,
        versionNumber: nextVer.version_number,
        filename: nextFile.filename,
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

  ipcMain.handle('modrinth:install', async (_event, slugOrId: string, options?: { type?: string; mcVersion?: string; loader?: string }) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Silakan pilih instance aktif terlebih dahulu di tab Instances.');

      const pType = options?.type ?? 'mod';
      const gameVersion = options?.mcVersion ?? active.gameVersion;
      const loader = options?.loader ?? active.loader;

      // Handle Modpack (.mrpack)
      if (pType === 'modpack' || slugOrId.endsWith('.mrpack')) {
        const versions = await modrinthClient.getProjectVersions(slugOrId, {
          loader: loader ?? undefined,
          gameVersion: gameVersion ?? undefined,
        });

        if (!versions || versions.length === 0) {
          throw new Error(`Tidak ditemukan versi modpack yang cocok untuk ${slugOrId}`);
        }

        const targetVersion = versions[0];
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
        const versions = await modrinthClient.getProjectVersions(slugOrId, {});
        if (!versions || versions.length === 0) throw new Error('Versi shader tidak ditemukan');
        const primaryFile = versions[0].files.find((f: any) => f.primary) ?? versions[0].files[0];
        const shaderDir = path.join(active.rootDir, 'shaderpacks');
        const dest = path.join(shaderDir, primaryFile.filename);
        await modrinthClient.download(primaryFile.url, dest, { sha512: primaryFile.hashes.sha512 });
        return { success: true, message: `Shader pack ${primaryFile.filename} berhasil dipasang.` };
      }

      // Handle Resource Packs
      if (pType === 'resourcepack') {
        const versions = await modrinthClient.getProjectVersions(slugOrId, {});
        if (!versions || versions.length === 0) throw new Error('Versi resource pack tidak ditemukan');
        const primaryFile = versions[0].files.find((f: any) => f.primary) ?? versions[0].files[0];
        const rpDir = path.join(active.rootDir, 'resourcepacks');
        const dest = path.join(rpDir, primaryFile.filename);
        await modrinthClient.download(primaryFile.url, dest, { sha512: primaryFile.hashes.sha512 });
        return { success: true, message: `Resource pack ${primaryFile.filename} berhasil dipasang.` };
      }

      // Handle Standard Mod (.jar)
      const versions = await modrinthClient.getProjectVersions(slugOrId, {
        loader: loader ?? undefined,
        gameVersion: gameVersion ?? undefined,
      });

      if (!versions || versions.length === 0) {
        throw new Error(`Tidak ditemukan versi yang kompatibel untuk ${slugOrId} (${loader ?? 'any'}, ${gameVersion ?? 'any'})`);
      }

      const targetVersion = versions[0];
      const primaryFile = targetVersion.files.find((f: any) => f.primary) ?? targetVersion.files[0];
      if (!primaryFile) throw new Error('Tidak ada berkas unduhan pada versi ini.');

      const destPath = path.join(active.modsDir, primaryFile.filename);
      await modrinthClient.download(primaryFile.url, destPath, {
        sha512: primaryFile.hashes.sha512,
      });

      // Register in DependencyGraph
      const instanceDir = active.rootDir;
      const graph = new DependencyGraph(instanceDir);
      await graph.load();
      graph.registerMod(slugOrId, {
        versionId: targetVersion.id,
        projectId: targetVersion.project_id,
        versionNumber: targetVersion.version_number,
        filename: primaryFile.filename,
        sha512: primaryFile.hashes.sha512,
        isRoot: true,
        dependencies: (targetVersion.dependencies ?? []).map((d: any) => d.project_id).filter(Boolean),
      });
      await graph.save();

      return { success: true, message: `Berhasil menginstal ${primaryFile.filename}` };
    } catch (err: any) {
      console.error('Error installing project:', err);
      return { success: false, error: err.message };
    }
  });

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
