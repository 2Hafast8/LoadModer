import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import os from 'node:os';
import { readdir, stat, rm, mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import { USER_AGENT } from '../../constants.js';
import { instanceConfig } from '../../core/instance/config.js';
import { instanceDetector, detectLauncherFromPath, detectLauncherFromFolder } from '../../core/instance/detector.js';
import { getLauncherCapabilities, isLoadModerModpackContainerName, type InstanceContext } from '../../core/instance/capabilities.js';
import { toggleModFile } from '../../core/instance/modToggle.js';
import { BisectRunner } from '../../core/troubleshoot/bisect.js';
import { logAnalyzer } from '../../core/troubleshoot/logAnalyzer.js';
import { modpackExporter } from '../../core/modpack/exporter.js';
import { modrinthClient } from '../../api/client.js';
import { DependencyGraph } from '../../core/dependency/graph.js';
import { resolveAndInstallDependencies } from '../../core/dependency/resolver.js';
import { formatBytes } from '../../utils/format.js';
import { hashFile } from '../../utils/crypto.js';
import { findMinecraftDirs, listLocalDrives, resolveManualMinecraftPath } from '../../core/instance/driveScanner.js';
import { ModpackUnpacker } from '../../core/modpack/unpacker.js';
import { ModpackProfileManager } from '../../core/modpack/profileManager.js';
import { BaselineManager } from '../../core/modpack/baselineManager.js';
import { profileSnapshotManager } from '../../core/profile/snapshotManager.js';
import { getMinecraftReleaseVersions, FALLBACK_MINECRAFT_VERSIONS } from '../../core/minecraft/versions.js';
import { ModsWatcher } from '../../core/watcher/modsWatcher.js';
import { InstalledAssetsIndex } from '../../core/instance/installedIndex.js';
import { installLocalFiles } from '../../core/instance/localInstaller.js';
import { isTrueUpdate } from '../../utils/versionCompare.js';
import { desktopUpdater } from './updaterService.js';
import { assertMinecraftNotRunning } from '../../core/instance/processGuard.js';
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
  }
}

function createDownloadNotifier(
  id: string,
  name: string,
  getMainWindow?: () => BrowserWindow | null
) {
  let lastUpdate = 0;
  let lastBytes = 0;
  return {
    onProgress: (received: number, total: number) => {
      const now = Date.now();
      if (now - lastUpdate < 120 && received < total) return;
      const elapsedSec = Math.max(0.001, (now - lastUpdate) / 1000);
      const speedBps = received >= lastBytes ? (received - lastBytes) / elapsedSec : 0;
      lastUpdate = now;
      lastBytes = received;

      const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
      const speed =
        speedBps > 1048576
          ? `${(speedBps / 1048576).toFixed(1)} MB/s`
          : `${(speedBps / 1024).toFixed(0)} KB/s`;

      const win = getMainWindow?.();
      win?.webContents.send('download:progress', {
        id,
        name,
        percent,
        speed,
        downloadedBytes: received,
        totalBytes: total,
        status: received >= total && total > 0 ? 'completed' : 'downloading',
      });
    },
    done: () => {
      const win = getMainWindow?.();
      win?.webContents.send('download:progress', {
        id,
        name,
        percent: 100,
        speed: '0 KB/s',
        downloadedBytes: 0,
        totalBytes: 0,
        status: 'completed',
      });
    },
    failed: () => {
      const win = getMainWindow?.();
      win?.webContents.send('download:progress', {
        id,
        name,
        percent: 0,
        speed: '0 KB/s',
        downloadedBytes: 0,
        totalBytes: 0,
        status: 'failed',
      });
    },
  };
}

export function registerIpcHandlers(getMainWindow?: () => BrowserWindow | null): void {
  instanceConfig.load().then(() => {
    const active = instanceConfig.getActiveInstance();
    if (active?.modsDir && active?.rootDir) {
      setupWatcher(active.modsDir, active.rootDir, getMainWindow);
    }
  }).catch(() => {});

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

function formatInstanceWithCaps(inst: any) {
  if (!inst) return null;
  let isTLMods = false;
  if (inst.mode === 'modpack' && inst.activeContainer) {
    isTLMods = !isLoadModerModpackContainerName(inst.activeContainer);
  } else if (
    inst.rootDir &&
    path.basename(path.dirname(inst.rootDir)).toLowerCase() === 'versions' &&
    !isLoadModerModpackContainerName(path.basename(inst.rootDir))
  ) {
    isTLMods = true;
  }

  const context: InstanceContext = {
    rootDir: inst.rootDir,
    mode: inst.mode ?? 'default',
    activeContainer: inst.activeContainer,
    isTLMods,
  };

  return {
    ...inst,
    capabilities: getLauncherCapabilities(inst.launcher, context),
    mode: inst.mode ?? 'default',
    activeContainer: inst.activeContainer,
  };
}

async function computeInstanceStatus(active: any) {
  if (!active) {
    return null;
  }

  const containerDir = active.rootDir ?? (active.modsDir ? path.dirname(active.modsDir) : '');
  let activeModpack: any = null;
  if (containerDir) {
    try {
      activeModpack = await ModpackProfileManager.getActiveProfile(containerDir);
      if (!activeModpack) {
        const containers = await ModpackProfileManager.discoverClientContainers(containerDir, active.launcher);
        const anyActive = containers.find((c) => c.activeProfileName);
        if (anyActive) {
          activeModpack = {
            activeProfile: anyActive.activeProfileName,
            name: anyActive.activeProfileName ?? undefined,
            loader: anyActive.loader,
            gameVersion: anyActive.gameVersion,
          };
        }
      }
    } catch {}
  }

  let modsCount = 0;
  let activeCount = 0;
  let storageUsage = '0 B';

  if (active.modsDir) {
    try {
      const files = await readdir(active.modsDir);
      const modFiles = files.filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
      activeCount = modFiles.filter((f) => !f.endsWith('.disabled')).length;
      modsCount = modFiles.length;

      let totalBytes = 0;
      for (const f of modFiles) {
        try {
          const s = await stat(path.join(active.modsDir, f));
          totalBytes += s.size;
        } catch {}
      }
      storageUsage = formatBytes(totalBytes);
    } catch {}
  }

  let isTLMods = false;
  if (active.mode === 'modpack' && active.activeContainer) {
    isTLMods = !isLoadModerModpackContainerName(active.activeContainer);
  } else if (
    active.rootDir &&
    path.basename(path.dirname(active.rootDir)).toLowerCase() === 'versions' &&
    !isLoadModerModpackContainerName(path.basename(active.rootDir))
  ) {
    isTLMods = true;
  }

  const context: InstanceContext = {
    rootDir: active.rootDir,
    mode: active.mode ?? 'default',
    activeContainer: active.activeContainer,
    isTLMods,
  };
  const caps = getLauncherCapabilities(active.launcher, context);
  const statusText = caps.supportsContainers
    ? activeModpack?.activeProfile
      ? `● Modpack: ${activeModpack.name ?? activeModpack.activeProfile}`
      : '● Siap (Clean State)'
    : '● Siap';

  return {
    instanceName: active.name ?? 'Default',
    gameVersion: active.gameVersion ?? '-',
    loader: active.loader ?? '-',
    mode: (active.mode ?? 'default') as 'default' | 'modpack',
    activeContainer: active.activeContainer,
    supportsModeSwitch: caps.supportsModeSwitch,
    modsCount,
    activeCount,
    storageUsage,
    statusText,
  };
}

  ipcMain.handle('instances:getAll', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance() ?? null;
      const detected = await instanceDetector.scanAll();

      const savedInstances = instanceConfig.get().instances ?? {};
      const deletedSet = new Set(
        (instanceConfig.get().deletedInstances ?? []).map((x) => x.toLowerCase())
      );
      const list: any[] = [];
      const handledSavedKeys = new Set<string>();

      for (const d of detected) {
        const normRoot = path.resolve(d.rootDir).toLowerCase();
        if (deletedSet.has(d.id.toLowerCase()) || deletedSet.has(normRoot)) {
          continue;
        }

        const savedEntry = Object.entries(savedInstances).find(
          ([sId, sCfg]) => sId === d.id || (sCfg.rootDir && path.resolve(sCfg.rootDir).toLowerCase() === normRoot)
        );

        if (savedEntry) {
          const [savedId, savedCfg] = savedEntry;
          handledSavedKeys.add(savedId);
          list.push({
            id: savedId,
            name: savedCfg.name ?? d.name,
            launcher: (savedCfg.launcher ?? d.launcher) as LauncherType,
            rootDir: savedCfg.rootDir ?? d.rootDir,
            modsDir: savedCfg.modsDir ?? d.modsDir,
            resourcepacksDir: savedCfg.resourcepacksDir ?? d.resourcepacksDir,
            shaderpacksDir: savedCfg.shaderpacksDir ?? d.shaderpacksDir,
            modpacksDir: savedCfg.modpacksDir ?? d.modpacksDir,
            gameVersion: savedCfg.gameVersion ?? d.gameVersion,
            loader: (savedCfg.loader ?? d.loader) as LoaderType | undefined,
            mode: savedCfg.mode ?? d.mode ?? 'default',
            activeContainer: savedCfg.activeContainer ?? d.activeContainer,
          });
        } else {
          list.push({
            ...d,
            mode: d.mode ?? 'default',
          });
        }
      }

      for (const [id, cfg] of Object.entries(savedInstances)) {
        if (!handledSavedKeys.has(id)) {
          const normRoot = cfg.rootDir ? path.resolve(cfg.rootDir).toLowerCase() : '';
          if (deletedSet.has(id.toLowerCase()) || (normRoot && deletedSet.has(normRoot))) {
            continue;
          }
          const alreadyInList = list.some(
            (i) => i.id === id || (i.rootDir && path.resolve(i.rootDir).toLowerCase() === normRoot)
          );
          if (!alreadyInList) {
            list.push({
              id,
              name: cfg.name ?? id,
              launcher: (cfg.launcher ?? 'Custom') as LauncherType,
              rootDir: cfg.rootDir,
              modsDir: cfg.modsDir,
              resourcepacksDir: cfg.resourcepacksDir,
              shaderpacksDir: cfg.shaderpacksDir,
              modpacksDir: cfg.modpacksDir,
              gameVersion: cfg.gameVersion,
              loader: cfg.loader as LoaderType | undefined,
              mode: cfg.mode ?? 'default',
              activeContainer: cfg.activeContainer,
            });
          }
        }
      }

      const status = await computeInstanceStatus(active);

      return {
        active: formatInstanceWithCaps(active),
        list: list.map(formatInstanceWithCaps),
        status,
      };
    } catch (err: any) {
      console.error('Error fetching instances:', err);
      return { active: null, list: [], status: null, error: err.message };
    }
  });

  ipcMain.handle('instances:getStatus', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      return await computeInstanceStatus(active);
    } catch {
      return null;
    }
  });

  ipcMain.handle('instances:setActive', async (_event, id: string) => {
    try {
      await instanceConfig.load();
      const detected = await instanceDetector.scanAll();
      const saved = instanceConfig.get().instances ?? {};
      const match = detected.find((i) => i.id === id);
      const existing = saved[id];

      if (match) {
        instanceConfig.saveInstance(
          id,
          {
            name: existing?.name ?? match.name,
            launcher: match.launcher,
            rootDir: match.rootDir,
            modsDir: existing?.modsDir ?? match.modsDir,
            gameVersion: existing?.gameVersion ?? match.gameVersion,
            loader: existing?.loader ?? match.loader,
            mode: existing?.mode ?? match.mode ?? 'default',
            activeContainer: existing?.activeContainer ?? match.activeContainer,
          },
          true
        );
        const updated = instanceConfig.getActiveInstance();
        if (updated?.modsDir && updated?.rootDir) {
          setupWatcher(updated.modsDir, updated.rootDir, getMainWindow);
        }
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

  ipcMain.handle('instances:switchMode', async (_event, mode: 'default' | 'modpack', containerName?: string) => {
    try {
      await assertMinecraftNotRunning("berpindah mode instance");
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Tidak ada instance launcher yang aktif');

      const baseDir = active.rootDir;
      if (mode === 'default') {
        await ModpackProfileManager.disableAllModpackContainers(baseDir, active.launcher);
        active.mode = 'default';
        active.activeContainer = undefined;
        active.modsDir = path.join(active.rootDir, 'mods');
      } else {
        const containers = await ModpackProfileManager.discoverClientContainers(baseDir, active.launcher);
        const targetContainer = containers.find((c) => c.containerName === containerName) ?? containers[0];
        if (!targetContainer) {
          throw new Error(`Wadah modpack "${containerName}" tidak ditemukan.`);
        }
        if (targetContainer.isTLMods) {
          await ModpackProfileManager.ensureTLModsProfile(targetContainer.containerDir);
        }
        for (const c of containers) {
          if (c.containerName !== targetContainer.containerName && c.activeProfileName) {
            await ModpackProfileManager.disableProfile(c.containerDir);
          }
        }
        active.mode = 'modpack';
        active.activeContainer = targetContainer.containerName;
        active.modsDir = path.join(targetContainer.containerDir, 'mods');
        active.gameVersion = targetContainer.gameVersion;
        active.loader = targetContainer.loader;
      }

      await instanceConfig.save();
      setupWatcher(active.modsDir, active.rootDir, getMainWindow);
      return { success: true, active: formatInstanceWithCaps(active) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('instances:getContainers', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) return [];
      const targetDir = active.modpacksDir || active.rootDir;
      return await ModpackProfileManager.discoverClientContainers(targetDir, active.launcher);
    } catch {
      return [];
    }
  });

  ipcMain.handle('instances:updateConfig', async (_event, instanceId: string, updates: { name?: string; loader?: string; gameVersion?: string }) => {
    try {
      await instanceConfig.load();
      const cfg = instanceConfig.get();
      const target = cfg.instances[instanceId];
      if (!target) throw new Error(`Instance "${instanceId}" tidak ditemukan`);

      if (updates.name) target.name = updates.name.trim();
      if (updates.loader) target.loader = updates.loader as LoaderType;
      if (updates.gameVersion) target.gameVersion = updates.gameVersion.trim();

      await instanceConfig.save();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('instances:switchVersionAndLoader', async (_event, loader: string, gameVersion: string) => {
    try {
      await instanceConfig.load();
      const activeKey = instanceConfig.get().activeInstance;
      if (!activeKey) throw new Error('Tidak ada instance launcher aktif');

      const result = await profileSnapshotManager.switchProfile(activeKey, loader, gameVersion);
      const active = instanceConfig.getActiveInstance();
      if (active?.modsDir && active?.rootDir) {
        setupWatcher(active.modsDir, active.rootDir, getMainWindow);
      }
      return {
        success: true,
        savedCount: result.savedCount,
        restoredCount: result.restoredCount,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('minecraft:getVersions', async () => {
    try {
      return await getMinecraftReleaseVersions();
    } catch {
      return FALLBACK_MINECRAFT_VERSIONS;
    }
  });

  ipcMain.handle('baseline:getStatus', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) return { exists: false };

      const targetDir = active.mode === 'modpack' && active.modsDir ? path.dirname(active.modsDir) : active.rootDir;
      const exists = await BaselineManager.hasBaseline(targetDir);
      if (!exists) return { exists: false };

      try {
        const manifestPath = BaselineManager.getManifestPath(targetDir);
        const data = JSON.parse(await readFile(manifestPath, 'utf8'));
        return {
          exists: true,
          createdAt: data.createdAt,
          filesCount: data.filesCount,
        };
      } catch {
        return { exists: true };
      }
    } catch {
      return { exists: false };
    }
  });

  ipcMain.handle('baseline:restore', async () => {
    try {
      await assertMinecraftNotRunning("memulihkan baseline");
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Tidak ada instance aktif');

      const targetDir = active.mode === 'modpack' && active.modsDir ? path.dirname(active.modsDir) : active.rootDir;
      const restoredCount = await BaselineManager.restoreBaseline(targetDir);
      return { success: true, restoredCount };
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
      const info = await detectLauncherFromFolder(rootDir);
      const modsDir = path.join(rootDir, 'mods');
      await mkdir(modsDir, { recursive: true });

      const inspected = await instanceDetector.inspectGameDir(rootDir, {
        id: info.id,
        name: info.name,
        launcher: info.launcher,
      });

      await instanceConfig.load();
      instanceConfig.saveInstance(
        info.id,
        {
          name: info.name,
          launcher: info.launcher,
          rootDir,
          modsDir,
          gameVersion: inspected.gameVersion,
          loader: inspected.loader,
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
          gameVersion: inspected.gameVersion,
          loader: inspected.loader,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('instances:delete', async (_event, id: string) => {
    try {
      await assertMinecraftNotRunning("menghapus profil instance");
      await instanceConfig.load();
      instanceConfig.deleteInstance(id);
      await instanceConfig.save();

      const active = instanceConfig.getActiveInstance();
      if (active?.modsDir && active?.rootDir) {
        setupWatcher(active.modsDir, active.rootDir, getMainWindow);
      } else if (activeWatcher) {
        activeWatcher.stop();
        activeWatcher = null;
      }

      const win = getMainWindow?.();
      win?.webContents.send('instances:changed');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    'instances:updateCustomPaths',
    async (
      _event,
      instanceId: string,
      paths: {
        modsDir?: string;
        resourcepacksDir?: string;
        shaderpacksDir?: string;
        modpacksDir?: string;
      }
    ) => {
      try {
        await assertMinecraftNotRunning("memperbarui jalur direktori");
        await instanceConfig.load();
        instanceConfig.updateCustomPaths(instanceId, paths);
        await instanceConfig.save();

        const active = instanceConfig.getActiveInstance();
        if (active && instanceId === instanceConfig.get().activeInstance) {
          if (active.modsDir && active.rootDir) {
            setupWatcher(active.modsDir, active.rootDir, getMainWindow);
          }
        }

        const win = getMainWindow?.();
        win?.webContents.send('instances:changed');
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle('instances:selectFolder', async (event, title?: string) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: title ?? 'Pilih Direktori',
      });
      if (res.canceled || res.filePaths.length === 0) {
        return { success: false };
      }
      return { success: true, path: res.filePaths[0] };
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

      const baseDir =
        active.mode === 'modpack' && active.modsDir
          ? path.dirname(active.modsDir)
          : active.rootDir;

      const folder =
        type === 'shaderpacks'
          ? (active.mode === 'modpack' ? path.join(baseDir, 'shaderpacks') : (active.shaderpacksDir || path.join(active.rootDir, 'shaderpacks')))
          : (active.mode === 'modpack' ? path.join(baseDir, 'resourcepacks') : (active.resourcepacksDir || path.join(active.rootDir, 'resourcepacks')));
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
      await profileSnapshotManager.syncActiveProfile();
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
        await assertMinecraftNotRunning("menghapus berkas");
        await instanceConfig.load();
        const active = instanceConfig.getActiveInstance();
        if (!active?.rootDir) throw new Error('Instance belum ditentukan');

        const safeName = path.basename(fileName);
        const baseDir =
          active.mode === 'modpack' && active.modsDir
            ? path.dirname(active.modsDir)
            : active.rootDir;

        let targetDir = customDir ?? active.modsDir;
        if (type === 'shader') {
          targetDir =
            active.mode === 'modpack'
              ? path.join(baseDir, 'shaderpacks')
              : (active.shaderpacksDir || path.join(active.rootDir, 'shaderpacks'));
        } else if (type === 'resourcepack') {
          targetDir =
            active.mode === 'modpack'
              ? path.join(baseDir, 'resourcepacks')
              : (active.resourcepacksDir || path.join(active.rootDir, 'resourcepacks'));
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
        await profileSnapshotManager.syncActiveProfile();

        return { success: true, removed: removedFiles };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle('mods:installDroppedFiles', async (_event, filePaths: string[]) => {
    try {
      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return { success: false, error: 'Tidak ada berkas yang diterima' };
      }

      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir || !active?.modsDir) {
        return { success: false, error: 'Tidak ada instance Minecraft aktif yang dipilih' };
      }

      const baseDir =
        active.mode === 'modpack' && active.modsDir
          ? path.dirname(active.modsDir)
          : active.rootDir;

      const results = await installLocalFiles(filePaths, baseDir, active.modsDir, undefined, {
        launcher: active.launcher,
      });
      const anySuccess = results.some((r) => r.success);
      if (anySuccess) {
        await profileSnapshotManager.syncActiveProfile();
        const win = getMainWindow?.();
        win?.webContents.send('mods:changed');
        win?.webContents.send('instances:changed');
      }

      return {
        success: anySuccess,
        results,
      };
    } catch (err: any) {
      return { success: false, error: err.message, results: [] };
    }
  });

  ipcMain.handle('mods:installDroppedBuffers', async (_event, files: Array<{ name: string; buffer: Uint8Array }>) => {
    try {
      if (!Array.isArray(files) || files.length === 0) {
        return { success: false, error: 'Tidak ada berkas yang diterima' };
      }

      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir || !active?.modsDir) {
        return { success: false, error: 'Tidak ada instance Minecraft aktif yang dipilih' };
      }

      const tempDropDir = path.join(os.tmpdir(), 'loadmoder-dropped');
      await mkdir(tempDropDir, { recursive: true });

      const tempFilePaths: string[] = [];
      for (const item of files) {
        const safeName = path.basename(item.name);
        const tempPath = path.join(tempDropDir, `${Date.now()}-${safeName}`);
        await writeFile(tempPath, Buffer.from(item.buffer));
        tempFilePaths.push(tempPath);
      }

      const baseDir =
        active.mode === 'modpack' && active.modsDir
          ? path.dirname(active.modsDir)
          : active.rootDir;

      const results = await installLocalFiles(tempFilePaths, baseDir, active.modsDir, undefined, {
        launcher: active.launcher,
      });

      for (const p of tempFilePaths) {
        await rm(p, { force: true }).catch(() => {});
      }

      const anySuccess = results.some((r) => r.success);
      if (anySuccess) {
        await profileSnapshotManager.syncActiveProfile();
        const win = getMainWindow?.();
        win?.webContents.send('mods:changed');
        win?.webContents.send('instances:changed');
      }

      return {
        success: anySuccess,
        results,
      };
    } catch (err: any) {
      return { success: false, error: err.message, results: [] };
    }
  });

  ipcMain.handle('mods:installDroppedUrl', async (_event, url: string) => {
    try {
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'Tautan URL tidak valid' };
      }

      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir || !active?.modsDir) {
        return { success: false, error: 'Tidak ada instance Minecraft aktif yang dipilih' };
      }

      const parsedUrl = new URL(url);
      let rawName = path.basename(parsedUrl.pathname);
      if (!rawName || (!rawName.endsWith('.jar') && !rawName.endsWith('.mrpack') && !rawName.endsWith('.zip'))) {
        rawName = 'downloaded-mod.jar';
      }

      const tempDropDir = path.join(os.tmpdir(), 'loadmoder-dropped');
      await mkdir(tempDropDir, { recursive: true });
      const tempPath = path.join(tempDropDir, `${Date.now()}-${rawName}`);

      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!resp.ok || !resp.body) {
        throw new Error(`Gagal mengunduh berkas dari URL (HTTP ${resp.status})`);
      }

      const arrayBuf = await resp.arrayBuffer();
      await writeFile(tempPath, Buffer.from(arrayBuf));

      const baseDir =
        active.mode === 'modpack' && active.modsDir
          ? path.dirname(active.modsDir)
          : active.rootDir;

      const results = await installLocalFiles([tempPath], baseDir, active.modsDir, undefined, {
        launcher: active.launcher,
      });

      await rm(tempPath, { force: true }).catch(() => {});

      const anySuccess = results.some((r) => r.success);
      if (anySuccess) {
        await profileSnapshotManager.syncActiveProfile();
        const win = getMainWindow?.();
        win?.webContents.send('mods:changed');
        win?.webContents.send('instances:changed');
      }

      return {
        success: anySuccess,
        results,
      };
    } catch (err: any) {
      return { success: false, error: err.message, results: [] };
    }
  });

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

      const currentVersionsMap = await modrinthClient
        .getVersionsByHashes(fileHashes.map((f) => f.sha1))
        .catch(() => ({} as Record<string, ModVersion>));

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
      if (!active?.rootDir || !active?.modsDir || !active?.gameVersion || !active?.loader) {
        throw new Error('Instance belum lengkap');
      }

      const safeCurrent = path.basename(currentFile);
      const currentPath = path.join(active.modsDir, safeCurrent);
      const sha1 = await hashFile(currentPath, 'sha1');
      const latestMap = await modrinthClient.getLatestByHashes(
        [sha1],
        { gameVersion: active.gameVersion, loader: active.loader },
        ['release', 'beta']
      );

      const nextVer = latestMap[sha1];
      if (!nextVer) throw new Error('Tidak ada versi pembaruan');

      const nextFile = nextVer.files.find((f: any) => f.primary) ?? nextVer.files[0];
      if (!nextFile) throw new Error('Berkas unduhan tidak ditemukan');

      if (!nextFile.hashes?.sha512) {
        throw new Error(`Berkas ${nextFile.filename} tidak memiliki hash SHA-512.`);
      }

      const safeNext = path.basename(nextFile.filename);
      const rootModsDir = path.resolve(active.modsDir);
      const destPath = path.resolve(active.modsDir, safeNext);
      if (!destPath.startsWith(rootModsDir + path.sep) && destPath !== rootModsDir) {
        throw new Error(`Nama berkas tidak aman (path traversal): ${nextFile.filename}`);
      }

      const notifier = createDownloadNotifier(`update-${safeNext}`, safeNext, getMainWindow);
      try {
        await modrinthClient.download(nextFile.url, destPath, {
          sha512: nextFile.hashes.sha512,
          size: nextFile.size,
          onProgress: notifier.onProgress,
        });
        notifier.done();
      } catch (dlErr) {
        notifier.failed();
        throw dlErr;
      }

      if (safeCurrent !== safeNext) {
        await rm(currentPath, { force: true }).catch(() => {});
      }

      const graph = new DependencyGraph(active.rootDir, active.gameVersion, active.loader);
      await graph.load();
      await graph.reconcileWithDisk(active.modsDir);

      const existingLockEntry = Object.entries(graph.data.mods).find(
        ([, m]) => m.filename === safeCurrent || m.projectId === nextVer.project_id
      );
      const slug = existingLockEntry ? existingLockEntry[0] : nextVer.project_id;
      const isRoot = existingLockEntry ? existingLockEntry[1].isRoot : true;
      const reqDeps = (nextVer.dependencies || [])
        .filter((d: any) => d.dependency_type === 'required' && Boolean(d.project_id))
        .map((d: any) => d.project_id);

      graph.removeMod(safeCurrent);
      graph.registerMod(slug, {
        versionId: nextVer.id,
        projectId: nextVer.project_id,
        versionNumber: nextVer.version_number,
        filename: safeNext,
        sha512: nextFile.hashes.sha512,
        isRoot,
        dependencies: reqDeps,
      });

      const missingDeps = reqDeps.filter((depId: string) => !graph.findMod(depId));
      if (missingDeps.length > 0) {
        let depNotifier: any = null;
        try {
          await resolveAndInstallDependencies({
            mainModSlug: slug,
            mainVersion: nextVer,
            modsDir: active.modsDir,
            gameVersion: active.gameVersion,
            loader: active.loader,
            graph,
            onDownloadProgress: (info) => {
              if (!depNotifier || depNotifier.name !== info.name) {
                depNotifier = {
                  name: info.name,
                  notifier: createDownloadNotifier(`dep-${info.name}`, info.name, getMainWindow),
                };
              }
              depNotifier.notifier.onProgress(info.received, info.total);
              if (info.received >= info.total && info.total > 0) {
                depNotifier.notifier.done();
              }
            },
          });
        } catch (depErr) {
          console.warn('Dependency resolution notice during update:', depErr);
        }
      }

      await graph.save();
      await profileSnapshotManager.syncActiveProfile();

      const win = getMainWindow?.();
      win?.webContents.send('mods:changed');
      win?.webContents.send('instances:changed');

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mods:applyAllUpdates', async () => {
    try {
      await instanceConfig.load();
      const activeKey = instanceConfig.get().activeInstance;
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir || !active?.modsDir || !activeKey) {
        throw new Error('Tidak ada instance Minecraft aktif yang dipilih');
      }

      let gameVersion = active.gameVersion;
      let loader = active.loader;

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

      const targetGameVersion = gameVersion || '1.20.1';
      const targetLoader = loader || 'fabric';

      const entries = await readdir(active.modsDir).catch(() => [] as string[]);
      const activeJars = entries.filter((f) => f.endsWith('.jar'));
      if (activeJars.length === 0) {
        return { success: true, updatedCount: 0 };
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

      const currentVersionsMap = await modrinthClient
        .getVersionsByHashes(fileHashes.map((f) => f.sha1))
        .catch(() => ({} as Record<string, ModVersion>));

      let hasAlpha = false;
      let hasBeta = false;
      for (const cur of Object.values(currentVersionsMap)) {
        if (cur.version_type === 'alpha') hasAlpha = true;
        if (cur.version_type === 'beta') hasBeta = true;
      }

      const versionTypes: VersionType[] = hasAlpha
        ? ['release', 'beta', 'alpha']
        : hasBeta
        ? ['release', 'beta']
        : ['release', 'beta'];

      const latestMap = await modrinthClient.getLatestByHashes(
        fileHashes.map((f) => f.sha1),
        { gameVersion: targetGameVersion, loader: targetLoader },
        versionTypes
      );

      const updates: Array<{
        current: string;
        currentPath: string;
        nextVersion: ModVersion;
        nextFile: any;
      }> = [];

      for (const item of fileHashes) {
        const nextVer = latestMap[item.sha1];
        const currentVer = currentVersionsMap[item.sha1];
        if (nextVer && isTrueUpdate(item, currentVer, nextVer)) {
          const nextFile = nextVer.files.find((f: any) => f.primary) ?? nextVer.files[0];
          if (nextFile) {
            updates.push({
              current: item.filename,
              currentPath: item.filePath,
              nextVersion: nextVer,
              nextFile,
            });
          }
        }
      }

      if (updates.length === 0) {
        return { success: true, updatedCount: 0 };
      }

      const graph = new DependencyGraph(active.rootDir, targetGameVersion, targetLoader);
      await graph.load();
      await graph.reconcileWithDisk(active.modsDir);

      let updatedCount = 0;
      const errors: Array<{ filename: string; error: string }> = [];
      const rootModsDir = path.resolve(active.modsDir);

      for (const up of updates) {
        try {
          if (!up.nextFile.hashes?.sha512) {
            throw new Error(`Berkas ${up.nextFile.filename} tidak memiliki hash SHA-512.`);
          }

          const safeNext = path.basename(up.nextFile.filename);
          const safeCurrent = path.basename(up.current);
          const newDest = path.resolve(active.modsDir, safeNext);

          if (!newDest.startsWith(rootModsDir + path.sep) && newDest !== rootModsDir) {
            throw new Error(`Nama berkas tidak aman (path traversal): ${up.nextFile.filename}`);
          }

          const notifier = createDownloadNotifier(`update-${safeNext}`, safeNext, getMainWindow);
          try {
            await modrinthClient.download(up.nextFile.url, newDest, {
              sha512: up.nextFile.hashes.sha512,
              size: up.nextFile.size,
              onProgress: notifier.onProgress,
            });
            notifier.done();
          } catch (dlErr) {
            notifier.failed();
            throw dlErr;
          }

          if (up.currentPath !== newDest) {
            await rm(up.currentPath, { force: true }).catch(() => {});
          }

          const existingLockEntry = Object.entries(graph.data.mods).find(
            ([, m]) => m.filename === safeCurrent || m.projectId === up.nextVersion.project_id
          );
          const slug = existingLockEntry ? existingLockEntry[0] : up.nextVersion.project_id;
          const isRoot = existingLockEntry ? existingLockEntry[1].isRoot : true;
          const reqDeps = (up.nextVersion.dependencies || [])
            .filter((d: any) => d.dependency_type === 'required' && Boolean(d.project_id))
            .map((d: any) => d.project_id);

          graph.removeMod(safeCurrent);
          graph.registerMod(slug, {
            projectId: up.nextVersion.project_id,
            versionId: up.nextVersion.id,
            versionNumber: up.nextVersion.version_number,
            filename: safeNext,
            sha512: up.nextFile.hashes.sha512,
            isRoot,
            dependencies: reqDeps,
          });

          const missingDeps = reqDeps.filter((depId: string) => !graph.findMod(depId));
          if (missingDeps.length > 0) {
            let depNotifier: any = null;
            try {
              await resolveAndInstallDependencies({
                mainModSlug: slug,
                mainVersion: up.nextVersion,
                modsDir: active.modsDir,
                gameVersion: targetGameVersion,
                loader: targetLoader,
                graph,
                onDownloadProgress: (info) => {
                  if (!depNotifier || depNotifier.name !== info.name) {
                    depNotifier = {
                      name: info.name,
                      notifier: createDownloadNotifier(`dep-${info.name}`, info.name, getMainWindow),
                    };
                  }
                  depNotifier.notifier.onProgress(info.received, info.total);
                  if (info.received >= info.total && info.total > 0) {
                    depNotifier.notifier.done();
                  }
                },
              });
            } catch (depErr) {
              console.warn(`Dependency resolution warning during bulk update of ${safeNext}:`, depErr);
            }
          }

          updatedCount++;
        } catch (itemErr: any) {
          errors.push({
            filename: up.current,
            error: itemErr.message || 'Gagal memperbarui berkas',
          });
        }
      }

      if (updatedCount > 0) {
        await graph.save();
        await profileSnapshotManager.syncActiveProfile();
        const win = getMainWindow?.();
        win?.webContents.send('mods:changed');
        win?.webContents.send('instances:changed');
      }

      return {
        success: updatedCount > 0 || errors.length === 0,
        updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err: any) {
      return { success: false, updatedCount: 0, error: err.message };
    }
  });

  ipcMain.handle(
    'modrinth:search',
    async (
      _event,
      query: string,
      filter?: {
        type?: string;
        mcVersion?: string;
        loader?: string;
        category?: string;
        environment?: 'client' | 'server' | 'all';
        limit?: number;
        offset?: number;
        index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
      }
    ) => {
      try {
        const results = await modrinthClient.search(
          query,
          {
            projectType: (filter?.type as any) ?? 'mod',
            loader: filter?.loader && filter.loader !== 'all' ? filter.loader : undefined,
            gameVersion: filter?.mcVersion && filter.mcVersion !== 'all' ? filter.mcVersion : undefined,
            category: filter?.category && filter.category !== 'all' ? filter.category : undefined,
            environment: filter?.environment && filter.environment !== 'all' ? (filter.environment as 'client' | 'server') : undefined,
          },
          filter?.limit ?? 24,
          (filter?.index as SearchIndex) ?? 'relevance',
          filter?.offset ?? 0
        );
        return {
          hits: results.hits ?? [],
          total_hits: results.total_hits ?? 0,
          offset: results.offset ?? 0,
          limit: results.limit ?? (filter?.limit ?? 24),
        };
      } catch (err: any) {
        console.error('Error searching Modrinth:', err);
        return { hits: [], total_hits: 0, offset: 0, limit: filter?.limit ?? 24, error: err.message };
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
      options?: {
        type?: string;
        mcVersion?: string;
        loader?: string;
        versionId?: string;
        modsOnly?: boolean;
        cleanInstall?: boolean;
      }
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

        if (pType === 'modpack' || slugOrId.endsWith('.mrpack')) {
          let isTLMods = false;
          if (active.mode === 'modpack' && active.activeContainer) {
            isTLMods = !isLoadModerModpackContainerName(active.activeContainer);
          } else if (
            active.rootDir &&
            path.basename(path.dirname(active.rootDir)).toLowerCase() === 'versions' &&
            !isLoadModerModpackContainerName(path.basename(active.rootDir))
          ) {
            isTLMods = true;
          }
          const caps = getLauncherCapabilities(active.launcher, {
            rootDir: active.rootDir,
            mode: active.mode,
            activeContainer: active.activeContainer,
            isTLMods,
          });
          if (!caps.supportsModpack) {
            throw new Error(
              caps.incompatibilityReason ??
              `Launcher "${active.launcher}" tidak mendukung format .mrpack secara langsung. Gunakan launcher pihak ketiga seperti TLauncher atau Legacy Launcher untuk modpack.`
            );
          }

          let targetVersion: any;
          if (options?.versionId) {
            targetVersion = await modrinthClient.getVersion(options.versionId);
          } else {
            let versions = await modrinthClient.getProjectVersions(slugOrId, {
              loader: loader ?? undefined,
              gameVersion: gameVersion ?? undefined,
            });

            if (!versions || versions.length === 0) {
              throw new Error(`Tidak ditemukan versi modpack yang cocok untuk ${slugOrId}`);
            }
            targetVersion = versions[0];
          }

          const primaryFile = targetVersion.files.find((f: any) => f.primary) ?? targetVersion.files[0];
          if (!primaryFile) throw new Error('Tidak ada berkas unduhan modpack (.mrpack) yang valid');
          const safeFilename = path.basename(primaryFile.filename);

          const tempDir = path.join(active.rootDir, '.loadmoder', 'temp');
          await mkdir(tempDir, { recursive: true });
          const tempMrpackPath = path.join(tempDir, safeFilename);

          const packLabel = targetVersion.name || slugOrId;
          const notifier = createDownloadNotifier(`mrpack-${Date.now()}`, packLabel, getMainWindow);
          try {
            await modrinthClient.download(primaryFile.url, tempMrpackPath, {
              sha512: primaryFile.hashes.sha512,
              size: primaryFile.size,
              onProgress: notifier.onProgress,
            });
            notifier.done();
          } catch (dlErr) {
            notifier.failed();
            throw dlErr;
          }

          const unpacker = new ModpackUnpacker(modrinthClient);
          let packLoader = loader ?? active.loader ?? 'fabric';
          let packGameVersion = gameVersion ?? active.gameVersion ?? '1.20.1';

          try {
            const inspectedIndex = await unpacker.inspect(tempMrpackPath);
            if (inspectedIndex.dependencies) {
              for (const [dep, ver] of Object.entries(inspectedIndex.dependencies)) {
                const lower = dep.toLowerCase();
                if (lower.includes('fabric')) packLoader = 'fabric';
                else if (lower.includes('neoforge')) packLoader = 'neoforge';
                else if (lower.includes('forge')) packLoader = 'forge';
                else if (lower.includes('quilt')) packLoader = 'quilt';
                if (lower === 'minecraft' && typeof ver === 'string') packGameVersion = ver;
              }
            }
          } catch {}

          const container = await ModpackProfileManager.resolveContainerForLoader(
            active.rootDir,
            packLoader,
            packGameVersion,
            active.launcher
          );

          await BaselineManager.createBaselineOnce(container.containerDir);

          const activeProfile = await ModpackProfileManager.getActiveProfile(container.containerDir);
          if (activeProfile?.activeProfile || options?.cleanInstall) {
            await ModpackProfileManager.saveActiveToProfile(container.containerDir);
            await ModpackProfileManager.clearContainerLiveFiles(container.containerDir);
          }

          const downloadsDir = ModpackProfileManager.getDownloadsDir(container.containerDir);
          await mkdir(downloadsDir, { recursive: true });
          const targetVaultPath = path.join(downloadsDir, safeFilename);

          if (path.resolve(tempMrpackPath) !== path.resolve(targetVaultPath)) {
            await copyFile(tempMrpackPath, targetVaultPath);
            await rm(tempMrpackPath, { force: true }).catch(() => {});
          }

          const modsOnly = options?.modsOnly ?? false;
          const unpackResult = await unpacker.install(targetVaultPath, {
            instanceDir: container.containerDir,
            targetEnv: 'client',
            modsOnly,
          });

          const profileId = path
            .basename(safeFilename, '.mrpack')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_');

          await ModpackProfileManager.createProfileAfterInstall(container.containerDir, {
            id: profileId,
            name: packLabel,
            versionId: unpackResult.index.versionId || targetVersion.id,
            loader: container.matchedLoader,
            gameVersion: packGameVersion,
          });

          await ModpackProfileManager.syncProfilesFromDownloads(container.containerDir);

          const packGraph = new DependencyGraph(
            container.containerDir,
            packGameVersion ?? '',
            container.matchedLoader
          );
          await packGraph.load();
          for (const file of unpackResult.index.files) {
            if (modsOnly && !file.path.startsWith('mods/') && !file.path.endsWith('.jar')) continue;
            const basename = path.basename(file.path);
            const baseSlug = basename.replace(/\.(jar|zip|mrpack)$/i, '').toLowerCase();
            if (file.path.startsWith('shaderpacks/') || file.path.includes('/shaderpacks/')) {
              packGraph.registerAsset('shader', baseSlug, { filename: basename, sha512: file.hashes.sha512 });
            } else if (file.path.startsWith('resourcepacks/') || file.path.includes('/resourcepacks/')) {
              packGraph.registerAsset('resourcepack', baseSlug, { filename: basename, sha512: file.hashes.sha512 });
            } else if (file.path.endsWith('.jar') || file.path.startsWith('mods/')) {
              packGraph.registerMod(baseSlug, {
                projectId: baseSlug,
                versionId: unpackResult.index.versionId,
                versionNumber: unpackResult.index.versionId,
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
            name: packLabel,
            versionId: unpackResult.index.versionId || targetVersion.id,
            loader: container.matchedLoader,
            gameVersion: packGameVersion,
            updatedAt: new Date().toISOString(),
          });

          const activeKey = instanceConfig.get().activeInstance;
          if (activeKey && instanceConfig.get().instances[activeKey]) {
            const inst = instanceConfig.get().instances[activeKey];
            inst.mode = 'modpack';
            inst.activeContainer = container.containerName;
            inst.modsDir = path.join(container.containerDir, 'mods');
            if (packGameVersion) inst.gameVersion = packGameVersion;
            if (container.matchedLoader) inst.loader = container.matchedLoader as any;
            await instanceConfig.save();
          }

          const win = getMainWindow?.();
          win?.webContents.send('mods:changed');
          win?.webContents.send('instances:changed');

          return {
            success: true,
            message: `Modpack "${packLabel}" berhasil dipasang & diaktifkan di wadah ${container.containerName} (${unpackResult.installedFiles.length} berkas diproses).`,
          };
        }

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
          const notifier = createDownloadNotifier(`shader-${safeName}`, safeName, getMainWindow);
          try {
            await modrinthClient.download(primaryFile.url, dest, {
              sha512: primaryFile.hashes.sha512,
              size: primaryFile.size,
              onProgress: notifier.onProgress,
            });
            notifier.done();
          } catch (dlErr) {
            notifier.failed();
            throw dlErr;
          }

          const graph = new DependencyGraph(active.rootDir, gameVersion ?? '', loader ?? '');
          await graph.load();
          graph.registerAsset('shader', slugOrId, {
            filename: safeName,
            sha512: primaryFile.hashes.sha512,
          });

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
          const notifier = createDownloadNotifier(`rp-${safeName}`, safeName, getMainWindow);
          try {
            await modrinthClient.download(primaryFile.url, dest, {
              sha512: primaryFile.hashes.sha512,
              size: primaryFile.size,
              onProgress: notifier.onProgress,
            });
            notifier.done();
          } catch (dlErr) {
            notifier.failed();
            throw dlErr;
          }

          const graph = new DependencyGraph(active.rootDir, gameVersion ?? '', loader ?? '');
          await graph.load();
          graph.registerAsset('resourcepack', slugOrId, {
            filename: safeName,
            sha512: primaryFile.hashes.sha512,
          });

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

        const instanceLoader = (active.loader ?? '').toLowerCase();
        const requestedLoader = (options?.loader ?? instanceLoader).toLowerCase();
        if (instanceLoader && requestedLoader && instanceLoader !== requestedLoader) {
          const isCompatible =
            (instanceLoader === 'quilt' && requestedLoader === 'fabric') ||
            (instanceLoader === 'fabric' && requestedLoader === 'quilt');
          if (!isCompatible) {
            throw new Error(
              `Tidak Kompatibel: Anda mencoba memasang mod untuk loader ${requestedLoader.toUpperCase()}, tetapi instance aktif menggunakan ${instanceLoader.toUpperCase()}.`
            );
          }
        }
        const effectiveLoader = instanceLoader || requestedLoader || undefined;
        const effectiveGameVersion = (active.gameVersion ?? options?.mcVersion ?? '').trim() || undefined;

        let targetVersion: any;
        if (options?.versionId) {
          targetVersion = await modrinthClient.getVersion(options.versionId);
        } else {
          const versions = await modrinthClient.getProjectVersions(slugOrId, {
            loader: effectiveLoader,
            gameVersion: effectiveGameVersion,
          });

          if (!versions || versions.length === 0) {
            const infoLoader = effectiveLoader ? `loader ${effectiveLoader.toUpperCase()}` : 'loader apapun';
            const infoVer = effectiveGameVersion ? `Minecraft ${effectiveGameVersion}` : 'versi apapun';
            throw new Error(
              `Tidak ditemukan versi yang cocok untuk "${slugOrId}" pada ${infoVer} dengan ${infoLoader}.`
            );
          }
          targetVersion = versions.find((v: any) => v.version_type === 'release') ?? versions[0];
        }

        if (effectiveLoader && targetVersion.loaders && targetVersion.loaders.length > 0) {
          const versionLoaders = targetVersion.loaders.map((l: string) => l.toLowerCase());
          const isLoaderMatch =
            versionLoaders.includes(effectiveLoader) ||
            (effectiveLoader === 'quilt' && versionLoaders.includes('fabric'));

          if (!isLoaderMatch) {
            throw new Error(
              `Tidak Kompatibel: Mod "${targetVersion.name || slugOrId}" (${versionLoaders.join(', ')}) tidak cocok untuk loader instance aktif (${effectiveLoader.toUpperCase()}).`
            );
          }
        }

        if (effectiveGameVersion && targetVersion.game_versions && targetVersion.game_versions.length > 0) {
          const isGameVerMatch = targetVersion.game_versions.includes(effectiveGameVersion);
          if (!isGameVerMatch) {
            throw new Error(
              `Tidak Kompatibel: Mod "${targetVersion.name || slugOrId}" mendukung versi (${targetVersion.game_versions.join(', ')}), tidak cocok untuk Minecraft instance aktif (${effectiveGameVersion}).`
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

        const existingMod = graph.findMod(slugOrId) || graph.findMod(targetVersion.project_id);
        if (existingMod) {
          if (existingMod.entry.versionId === targetVersion.id || existingMod.entry.filename === safeDest) {
            return {
              success: false,
              error: `Mod "${existingMod.entry.filename}" dengan versi yang sama sudah terpasang di instance ini.`,
            };
          }
          const oldPath = path.join(active.modsDir, existingMod.entry.filename);
          await rm(oldPath, { force: true });
          await rm(`${oldPath}.disabled`, { force: true });
          graph.removeMod(existingMod.slug);
        }

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

        const notifier = createDownloadNotifier(`mod-${safeDest}`, safeDest, getMainWindow);
        try {
          await modrinthClient.download(primaryFile.url, destPath, {
            sha512: primaryFile.hashes.sha512,
            size: primaryFile.size,
            onProgress: notifier.onProgress,
          });
          notifier.done();
        } catch (dlErr) {
          notifier.failed();
          throw dlErr;
        }

        graph.registerMod(slugOrId, {
          versionId: targetVersion.id,
          projectId: targetVersion.project_id,
          versionNumber: targetVersion.version_number,
          filename: safeDest,
          sha512: primaryFile.hashes.sha512,
          isRoot: true,
          dependencies: (targetVersion.dependencies ?? []).map((d: any) => d.project_id).filter(Boolean),
        });

        let depCount = 0;
        try {
          const project = await modrinthClient.getProject(slugOrId).catch(() => undefined);
          let depNotifier: any = null;
          const depResult = await resolveAndInstallDependencies({
            mainModSlug: slugOrId,
            mainVersion: targetVersion,
            project,
            modsDir: active.modsDir,
            gameVersion: effectiveGameVersion ?? active.gameVersion ?? '',
            loader: effectiveLoader ?? active.loader ?? '',
            graph,
            onDownloadProgress: (info) => {
              if (!depNotifier || depNotifier.name !== info.name) {
                depNotifier = {
                  name: info.name,
                  notifier: createDownloadNotifier(`dep-${info.name}`, info.name, getMainWindow),
                };
              }
              depNotifier.notifier.onProgress(info.received, info.total);
              if (info.received >= info.total && info.total > 0) {
                depNotifier.notifier.done();
              }
            },
          });
          depCount = depResult.installed.length;
        } catch (depErr) {
          console.warn('Dependency resolution notice:', depErr);
        }

        await graph.save();
        await profileSnapshotManager.syncActiveProfile();

        const depMsg = depCount > 0 ? ` (+ ${depCount} dependensi otomatis dipasang)` : '';
        return { success: true, message: `Berhasil menginstal ${safeDest}${depMsg}` };
      } catch (err: any) {
        console.error('Error installing project:', err);
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle(
    'modrinth:installLocalMrpack',
    async (
      event,
      customFilePath?: string,
      options?: { modsOnly?: boolean; cleanInstall?: boolean }
    ) => {
      try {
        await instanceConfig.load();
        const active = instanceConfig.getActiveInstance();
        if (!active?.rootDir) throw new Error('Silakan pilih instance aktif terlebih dahulu.');

        let isTLMods = false;
        if (active.mode === 'modpack' && active.activeContainer) {
          isTLMods = !isLoadModerModpackContainerName(active.activeContainer);
        } else if (
          active.rootDir &&
          path.basename(path.dirname(active.rootDir)).toLowerCase() === 'versions' &&
          !isLoadModerModpackContainerName(path.basename(active.rootDir))
        ) {
          isTLMods = true;
        }
        const caps = getLauncherCapabilities(active.launcher, {
          rootDir: active.rootDir,
          mode: active.mode,
          activeContainer: active.activeContainer,
          isTLMods,
        });
        if (!caps.supportsModpack) {
          throw new Error(
            caps.incompatibilityReason ??
            `Launcher "${active.launcher}" tidak mendukung format .mrpack secara langsung. Gunakan launcher pihak ketiga seperti TLauncher atau Legacy Launcher untuk modpack.`
          );
        }

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
        let packLoader = active.loader ?? 'fabric';
        let packGameVersion = active.gameVersion ?? '1.20.1';
        let packTitle = path.basename(mrpackPath, '.mrpack');

        try {
          const modpackIndex = await unpacker.inspect(mrpackPath);
          if (modpackIndex.name) packTitle = modpackIndex.name;
          if (modpackIndex.dependencies) {
            for (const [dep, ver] of Object.entries(modpackIndex.dependencies)) {
              const lower = dep.toLowerCase();
              if (lower.includes('fabric')) packLoader = 'fabric';
              else if (lower.includes('neoforge')) packLoader = 'neoforge';
              else if (lower.includes('forge')) packLoader = 'forge';
              else if (lower.includes('quilt')) packLoader = 'quilt';
              if (lower === 'minecraft' && typeof ver === 'string') packGameVersion = ver;
            }
          }
        } catch {}

        const container = await ModpackProfileManager.resolveContainerForLoader(
          active.rootDir,
          packLoader,
          packGameVersion,
          active.launcher
        );

        await BaselineManager.createBaselineOnce(container.containerDir);

        const activeProfile = await ModpackProfileManager.getActiveProfile(container.containerDir);
        if (activeProfile?.activeProfile) {
          await ModpackProfileManager.saveActiveToProfile(container.containerDir);
          await ModpackProfileManager.clearContainerLiveFiles(container.containerDir);
        }

        const downloadsDir = ModpackProfileManager.getDownloadsDir(container.containerDir);
        await mkdir(downloadsDir, { recursive: true });

        const safeFilename = path.basename(mrpackPath);
        const vaultPath = path.join(downloadsDir, safeFilename);
        if (path.resolve(mrpackPath) !== path.resolve(vaultPath)) {
          await copyFile(mrpackPath, vaultPath);
        }

        const modsOnly = options?.modsOnly ?? false;
        const result = await unpacker.install(vaultPath, {
          instanceDir: container.containerDir,
          targetEnv: 'client',
          modsOnly,
        });

        const profileId = path
          .basename(safeFilename, '.mrpack')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_');

        await ModpackProfileManager.createProfileAfterInstall(container.containerDir, {
          id: profileId,
          name: packTitle,
          versionId: result.index.versionId || '1.0.0',
          loader: container.matchedLoader,
          gameVersion: packGameVersion,
        });

        await ModpackProfileManager.syncProfilesFromDownloads(container.containerDir);

        const packGraph = new DependencyGraph(
          container.containerDir,
          packGameVersion ?? '',
          container.matchedLoader
        );
        await packGraph.load();
        for (const file of result.index.files) {
          if (modsOnly && !file.path.startsWith('mods/') && !file.path.endsWith('.jar')) continue;
          const basename = path.basename(file.path);
          const baseSlug = basename.replace(/\.(jar|zip|mrpack)$/i, '').toLowerCase();
          if (file.path.startsWith('shaderpacks/') || file.path.includes('/shaderpacks/')) {
            packGraph.registerAsset('shader', baseSlug, { filename: basename, sha512: file.hashes.sha512 });
          } else if (file.path.startsWith('resourcepacks/') || file.path.includes('/resourcepacks/')) {
            packGraph.registerAsset('resourcepack', baseSlug, { filename: basename, sha512: file.hashes.sha512 });
          } else if (file.path.endsWith('.jar') || file.path.startsWith('mods/')) {
            packGraph.registerMod(baseSlug, {
              projectId: baseSlug,
              versionId: result.index.versionId,
              versionNumber: result.index.versionId,
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
          name: packTitle,
          versionId: result.index.versionId || '1.0.0',
          loader: container.matchedLoader,
          gameVersion: packGameVersion,
          updatedAt: new Date().toISOString(),
        });

        const activeKey = instanceConfig.get().activeInstance;
        if (activeKey && instanceConfig.get().instances[activeKey]) {
          const inst = instanceConfig.get().instances[activeKey];
          inst.mode = 'modpack';
          inst.activeContainer = container.containerName;
          inst.modsDir = path.join(container.containerDir, 'mods');
          if (packGameVersion) inst.gameVersion = packGameVersion;
          if (container.matchedLoader) inst.loader = container.matchedLoader as any;
          await instanceConfig.save();
        }

        const win = getMainWindow?.();
        win?.webContents.send('mods:changed');
        win?.webContents.send('instances:changed');

        return {
          success: true,
          message: `Modpack "${result.index.name}" berhasil dipasang & diaktifkan di wadah ${container.containerName} (${result.installedFiles.length} berkas diproses).`,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle('modpack:resolveContainer', async (_event, loader?: string, gameVersion?: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) return null;

      const container = await ModpackProfileManager.resolveContainerForLoader(
        active.rootDir,
        loader,
        gameVersion,
        active.launcher
      );

      const activeProfile = await ModpackProfileManager.getActiveProfile(container.containerDir);

      return {
        containerDir: container.containerDir,
        containerName: container.containerName,
        matchedLoader: container.matchedLoader,
        launcher: active.launcher,
        activeProfile: activeProfile?.activeProfile ?? null,
        activeProfileName: activeProfile?.name ?? activeProfile?.activeProfile ?? null,
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle('modpack:inspect', async (_event, filePath: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Tidak ada instance aktif');

      const unpacker = new ModpackUnpacker(modrinthClient);
      const index = await unpacker.inspect(filePath);

      let packLoader = active.loader ?? 'fabric';
      let packGameVersion = active.gameVersion ?? '1.20.1';
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
        active.rootDir,
        packLoader,
        packGameVersion,
        active.launcher
      );

      const activeProfile = await ModpackProfileManager.getActiveProfile(container.containerDir);

      return {
        name: index.name,
        versionId: index.versionId,
        gameVersion: packGameVersion,
        loader: packLoader,
        containerName: container.containerName,
        containerDir: container.containerDir,
        activeProfile: activeProfile?.activeProfile ?? null,
        activeProfileName: activeProfile?.name ?? activeProfile?.activeProfile ?? null,
      };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('modpack:listProfiles', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) return [];

      const targetDir = active.mode === 'modpack' && active.modsDir ? path.dirname(active.modsDir) : active.rootDir;
      return await ModpackProfileManager.listProfiles(targetDir);
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

      const targetDir = active.mode === 'modpack' && active.modsDir ? path.dirname(active.modsDir) : active.rootDir;
      await ModpackProfileManager.activateProfile(targetDir, profileId);
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

      const targetDir = active.mode === 'modpack' && active.modsDir ? path.dirname(active.modsDir) : active.rootDir;
      await ModpackProfileManager.disableProfile(targetDir);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('modpack:removeProfile', async (_event, profileId: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Instance belum aktif');

      const targetDir = active.mode === 'modpack' && active.modsDir ? path.dirname(active.modsDir) : active.rootDir;
      await ModpackProfileManager.removeProfile(targetDir, profileId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('modpack:manualSaveProfile', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Instance belum aktif');

      const targetDir = active.mode === 'modpack' && active.modsDir ? path.dirname(active.modsDir) : active.rootDir;
      const res = await ModpackProfileManager.manualSaveTLModsProfile(targetDir);
      return { success: true, profile: res.profile, filesCount: res.filesCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    'modpack:export',
    async (
      event,
      options: {
        format: 'mrpack' | 'zip';
        name: string;
        version: string;
        summary?: string;
        includeConfigs?: boolean;
        includeResourcepacks?: boolean;
        includeShaderpacks?: boolean;
        profileId?: string;
      }
    ) => {
      try {
        await instanceConfig.load();
        const active = instanceConfig.getActiveInstance();
        if (!active?.rootDir && !active?.modsDir) {
          throw new Error('Silakan pilih instance aktif terlebih dahulu.');
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        const ext = options.format === 'mrpack' ? 'mrpack' : 'zip';
        const safeBaseName = (options.name || 'modpack').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const defaultFilename = `${safeBaseName}-${options.version || '1.0.0'}.${ext}`;

        const res = await dialog.showSaveDialog(win!, {
          title: 'Simpan Ekspor Modpack',
          defaultPath: defaultFilename,
          filters: [
            options.format === 'mrpack'
              ? { name: 'Modrinth Modpack (*.mrpack)', extensions: ['mrpack'] }
              : { name: 'ZIP Archive (*.zip)', extensions: ['zip'] },
          ],
        });

        if (res.canceled || !res.filePath) {
          return { success: false, error: 'Dibatalkan oleh pengguna' };
        }

        let sourceProfileDir: string | undefined = undefined;
        const effectiveModsDir = active.modsDir;
        const effectiveInstanceDir = active.rootDir || (active.modsDir ? path.dirname(active.modsDir) : '');

        if (options.profileId && effectiveInstanceDir) {
          const profilePath = path.join(ModpackProfileManager.getProfilesDir(effectiveInstanceDir), options.profileId);
          try {
            const st = await stat(profilePath);
            if (st.isDirectory()) {
              sourceProfileDir = profilePath;
            }
          } catch {}
        }

        const result = await modpackExporter.exportModpack({
          format: options.format,
          instanceDir: effectiveInstanceDir,
          modsDir: effectiveModsDir,
          outputPath: res.filePath,
          name: options.name,
          version: options.version,
          summary: options.summary,
          gameVersion: active.gameVersion || '1.20.1',
          loader: active.loader || 'fabric',
          includeConfigs: options.includeConfigs ?? true,
          includeResourcepacks: options.includeResourcepacks ?? false,
          includeShaderpacks: options.includeShaderpacks ?? false,
          sourceProfileDir,
        });

        return {
          success: true,
          outputPath: result.outputPath,
          filesCount: result.filesCount,
          sizeBytes: result.sizeBytes,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  );

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

  ipcMain.handle('snapshots:create', async (_event, note?: string) => {
    try {
      await instanceConfig.load();
      const activeKey = instanceConfig.get().activeInstance;
      const active = instanceConfig.getActiveInstance();
      if (!active || !activeKey) throw new Error('Tidak ada instance aktif');
      const snapshot = await profileSnapshotManager.createBackupPoint(activeKey, active, note);
      return { success: true, snapshot };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshots:restore', async (_event, snapshotId: string) => {
    try {
      await instanceConfig.load();
      const activeKey = instanceConfig.get().activeInstance;
      const active = instanceConfig.getActiveInstance();
      if (!active || !activeKey) throw new Error('Tidak ada instance aktif');
      const res = await profileSnapshotManager.restoreBackupPoint(activeKey, active, snapshotId);
      return { success: true, restoredCount: res.restoredCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshots:delete', async (_event, snapshotId: string) => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active) throw new Error('Tidak ada instance aktif');
      const ok = await profileSnapshotManager.deleteSnapshot(active, snapshotId);
      return { success: ok };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshots:saveCurrent', async () => {
    try {
      await instanceConfig.load();
      const activeKey = instanceConfig.get().activeInstance;
      const active = instanceConfig.getActiveInstance();
      if (!active || !activeKey) throw new Error('Tidak ada instance aktif');
      const res = await profileSnapshotManager.saveCurrentSnapshot(activeKey, active, {
        preserveLiveFiles: true,
      });
      const win = getMainWindow?.();
      win?.webContents.send('instances:changed');
      win?.webContents.send('mods:changed');
      return { success: true, snapshot: res.snapshot, savedCount: res.savedCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('snapshots:switchProfile', async (_event, loader: string, gameVersion: string) => {
    try {
      await assertMinecraftNotRunning("berpindah profil versi");
      await instanceConfig.load();
      const cfg = instanceConfig.get();
      const activeKey = cfg.activeInstance;
      if (!activeKey) throw new Error('Tidak ada instance aktif');
      const res = await profileSnapshotManager.switchProfile(activeKey, loader, gameVersion);
      const active = instanceConfig.getActiveInstance();
      if (active?.modsDir && active?.rootDir) {
        setupWatcher(active.modsDir, active.rootDir, getMainWindow);
      }
      const win = getMainWindow?.();
      win?.webContents.send('instances:changed');
      win?.webContents.send('mods:changed');
      return { success: true, savedCount: res.savedCount, restoredCount: res.restoredCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('logs:analyze', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) throw new Error('Instance belum aktif');
      return await logAnalyzer.analyze(active.rootDir);
    } catch (err: any) {
      return {
        hasLogs: false,
        findings: [],
        error: err.message,
      };
    }
  });

  ipcMain.handle('logs:getLatestLog', async () => {
    try {
      await instanceConfig.load();
      const active = instanceConfig.getActiveInstance();
      if (!active?.rootDir) return '';
      return await logAnalyzer.getLatestLog(active.rootDir);
    } catch {
      return '';
    }
  });

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

  ipcMain.handle('updater:check', async () => {
    return await desktopUpdater.check();
  });

  ipcMain.handle('updater:download', async (event, assetUrl: string, fileName: string, expectedSha256?: string, expectedSize?: number, expectedSha512?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? getMainWindow?.();
    return await desktopUpdater.download(assetUrl, fileName, expectedSha256, expectedSize, expectedSha512, (progress) => {
      win?.webContents.send('updater:progress', progress);
    });
  });

  ipcMain.handle('updater:install', async (_event, filePath: string, silent: boolean = false) => {
    return await desktopUpdater.install(filePath, silent);
  });
}
