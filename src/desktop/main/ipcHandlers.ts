import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';
import { readdir, stat, rm } from 'node:fs/promises';
import { instanceConfig } from '../../core/instance/config.js';
import { instanceDetector } from '../../core/instance/detector.js';
import { toggleModFile } from '../../core/instance/modToggle.js';
import { BisectRunner } from '../../core/troubleshoot/bisect.js';
import { modrinthClient } from '../../api/client.js';
import { DependencyGraph } from '../../core/dependency/graph.js';
import { formatBytes } from '../../utils/format.js';
import { hashFile } from '../../utils/crypto.js';
import type { LauncherType, LoaderType } from '../../types/instance.js';

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
      // If instance is in detected, save it to ensure consistency
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

  // --- Mods Management ---
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

      // Reconcile graph if instance root exists
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

  // --- Modrinth Explore & Install ---
  ipcMain.handle('modrinth:search', async (_event, query: string, filter?: { type?: string; mcVersion?: string; loader?: string; limit?: number }) => {
    try {
      const results = await modrinthClient.search(
        query,
        {
          projectType: (filter?.type as any) ?? 'mod',
          loader: filter?.loader,
          gameVersion: filter?.mcVersion,
        },
        filter?.limit ?? 24
      );
      return results;
    } catch (err: any) {
      console.error('Error searching Modrinth:', err);
      return { hits: [], total_hits: 0, error: err.message };
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

  ipcMain.handle('modrinth:install', async (_event, slugOrId: string, options?: { type?: string; mcVersion?: string; loader?: string }) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.modsDir) throw new Error('Silakan pilih instance aktif terlebih dahulu di tab Instances.');

      const gameVersion = options?.mcVersion ?? active.gameVersion;
      const loader = options?.loader ?? active.loader;

      // Get compatible versions
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
}
