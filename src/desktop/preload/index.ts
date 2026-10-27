import { contextBridge, ipcRenderer } from 'electron';

export interface DownloadProgressPayload {
  id: string;
  name: string;
  percent: number;
  speed: string;
  downloadedBytes: number;
  totalBytes: number;
  status: 'downloading' | 'completed' | 'failed';
}

export interface UpdateProgressPayload {
  percent: number;
  speed: string;
  downloadedBytes: number;
  totalBytes: number;
}

export interface DesktopAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  instances: {
    getAll: () => Promise<{ active: any | null; list: any[]; status?: any }>;
    getStatus: () => Promise<any | null>;
    setActive: (id: string) => Promise<{ success: boolean; error?: string }>;
    scanAll: () => Promise<any[]>;
    deepScanDrives: () => Promise<any[]>;
    browseFolder: () => Promise<{ success: boolean; instance?: any; error?: string }>;
    openFolder: (targetPath?: string) => Promise<{ success: boolean; error?: string }>;
    switchMode: (mode: 'default' | 'modpack', containerName?: string) => Promise<{ success: boolean; active?: any; error?: string }>;
    getContainers: () => Promise<any[]>;
    switchVersionAndLoader: (loader: string, gameVersion: string) => Promise<{ success: boolean; savedCount?: number; restoredCount?: number; error?: string }>;
    updateConfig: (instanceId: string, updates: { name?: string; loader?: string; gameVersion?: string }) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    updateCustomPaths: (instanceId: string, paths: { modsDir?: string; resourcepacksDir?: string; shaderpacksDir?: string; modpacksDir?: string }) => Promise<{ success: boolean; error?: string }>;
    selectFolder: (title?: string) => Promise<{ success: boolean; path?: string }>;
    onChanged: (callback: () => void) => () => void;
  };
  minecraft: {
    getVersions: () => Promise<string[]>;
  };
  baseline: {
    getStatus: () => Promise<{ exists: boolean; createdAt?: string; filesCount?: number }>;
    restore: () => Promise<{ success: boolean; restoredCount?: number; error?: string }>;
  };
  mods: {
    list: (customDir?: string) => Promise<{
      items: Array<{
        name: string;
        fileName: string;
        version?: string;
        enabled: boolean;
        size: number;
        formattedSize: string;
        updateAvailable?: {
          versionNumber: string;
          filename: string;
          downloadUrl: string;
          size: number;
        };
      }>;
      activeCount: number;
      totalCount: number;
      storageUsage: string;
    }>;
    listPacks: (type: 'shaderpacks' | 'resourcepacks') => Promise<Array<{
      fileName: string;
      size: number;
      formattedSize: string;
    }>>;
    toggle: (fileName: string, enable: boolean, customDir?: string) => Promise<{ success: boolean; error?: string }>;
    remove: (
      fileName: string,
      prune?: boolean,
      customDir?: string,
      type?: 'mod' | 'shader' | 'resourcepack'
    ) => Promise<{ success: boolean; removed?: string[]; error?: string }>;
    checkUpdates: () => Promise<{
      updates: Array<{
        currentFile: string;
        nextVersion: string;
        nextFileName: string;
        size: number;
      }>;
      checkedCount?: number;
      gameVersion?: string;
      loader?: string;
    }>;
    applyUpdate: (currentFile: string) => Promise<{ success: boolean; error?: string }>;
    applyAllUpdates: () => Promise<{
      success: boolean;
      updatedCount: number;
      errors?: Array<{ filename: string; error: string }>;
      error?: string;
    }>;
    getInstalledIndex: () => Promise<{
      projectIds: string[];
      slugs: string[];
      filenames: string[];
      versionMap: Record<string, string>;
    }>;
    installDroppedFiles: (filePaths: string[]) => Promise<{
      success: boolean;
      results: Array<{
        file: string;
        fileName: string;
        type: 'mod' | 'mrpack' | 'shader' | 'resourcepack' | 'unknown';
        success: boolean;
        error?: string;
      }>;
      error?: string;
    }>;
    onChanged: (callback: () => void) => () => void;
  };
  modrinth: {
    search: (
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
    ) => Promise<{ hits: any[]; total_hits: number; offset: number; limit: number; error?: string }>;
    getProject: (slugOrId: string) => Promise<any>;
    getVersions: (slugOrId: string, filter?: { loader?: string; mcVersion?: string }) => Promise<any[]>;
    install: (
      slugOrId: string,
      options?: {
        type?: string;
        mcVersion?: string;
        loader?: string;
        versionId?: string;
        modsOnly?: boolean;
        cleanInstall?: boolean;
      }
    ) => Promise<{ success: boolean; message?: string; error?: string }>;
    installLocalMrpack: (
      filePath?: string,
      options?: { modsOnly?: boolean; cleanInstall?: boolean }
    ) => Promise<{ success: boolean; message?: string; error?: string }>;
  };
  modpack: {
    resolveContainer: (loader?: string, gameVersion?: string) => Promise<{
      containerDir: string;
      containerName: string;
      matchedLoader: string;
      launcher: string;
      activeProfile: string | null;
      activeProfileName: string | null;
    } | null>;
    inspect: (filePath: string) => Promise<{
      name?: string;
      versionId?: string;
      gameVersion?: string;
      loader?: string;
      containerName?: string;
      containerDir?: string;
      activeProfile?: string | null;
      activeProfileName?: string | null;
      error?: string;
    }>;
    listProfiles: () => Promise<any[]>;
    switchProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
    disableActive: () => Promise<{ success: boolean; error?: string }>;
    removeProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
    manualSaveProfile: () => Promise<{ success: boolean; profile?: any; filesCount?: number; error?: string }>;
    export: (options: {
      format: 'mrpack' | 'zip';
      name: string;
      version: string;
      summary?: string;
      includeConfigs?: boolean;
      includeResourcepacks?: boolean;
      includeShaderpacks?: boolean;
      profileId?: string;
    }) => Promise<{
      success: boolean;
      outputPath?: string;
      filesCount?: number;
      sizeBytes?: number;
      error?: string;
    }>;
  };
  snapshots: {
    list: () => Promise<any[]>;
    create: (note?: string) => Promise<{ success: boolean; snapshot?: any; error?: string }>;
    restore: (snapshotId: string) => Promise<{ success: boolean; restoredCount?: number; error?: string }>;
    delete: (snapshotId: string) => Promise<{ success: boolean; error?: string }>;
    saveCurrent: () => Promise<{ success: boolean; snapshot?: any; savedCount?: number; error?: string }>;
    switchProfile: (loader: string, gameVersion: string) => Promise<{ success: boolean; savedCount?: number; restoredCount?: number; error?: string }>;
  };
  logs: {
    analyze: () => Promise<any>;
    getLatestLog: () => Promise<string>;
  };
  bisect: {
    status: (customDir?: string) => Promise<{ active: boolean; step?: number; totalSteps?: number; remainingMods?: number; state?: any }>;
    step: (action: 'start' | 'good' | 'bad' | 'reset', customDir?: string) => Promise<{ success: boolean; message: string; state?: any; error?: string }>;
  };
  downloads: {
    onProgress: (callback: (payload: DownloadProgressPayload) => void) => () => void;
  };
  dialog: {
    selectMrpack: () => Promise<string | null>;
  };
  updater: {
    check: () => Promise<any>;
    download: (
      assetUrl: string,
      fileName: string,
      expectedSha256?: string,
      expectedSize?: number
    ) => Promise<{ success: boolean; filePath?: string; sha256?: string; error?: string }>;
    install: (filePath: string, silent?: boolean) => Promise<{ success: boolean; error?: string }>;
    onProgress: (callback: (payload: UpdateProgressPayload) => void) => () => void;
  };
}

const api: DesktopAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  instances: {
    getAll: () => ipcRenderer.invoke('instances:getAll'),
    getStatus: () => ipcRenderer.invoke('instances:getStatus'),
    setActive: (id: string) => ipcRenderer.invoke('instances:setActive', id),
    scanAll: () => ipcRenderer.invoke('instances:scanAll'),
    deepScanDrives: () => ipcRenderer.invoke('instances:deepScanDrives'),
    browseFolder: () => ipcRenderer.invoke('instances:browseFolder'),
    openFolder: (targetPath?: string) => ipcRenderer.invoke('instances:openFolder', targetPath),
    switchMode: (mode: 'default' | 'modpack', containerName?: string) =>
      ipcRenderer.invoke('instances:switchMode', mode, containerName),
    getContainers: () => ipcRenderer.invoke('instances:getContainers'),
    switchVersionAndLoader: (loader: string, gameVersion: string) =>
      ipcRenderer.invoke('instances:switchVersionAndLoader', loader, gameVersion),
    updateConfig: (instanceId: string, updates: { name?: string; loader?: string; gameVersion?: string }) =>
      ipcRenderer.invoke('instances:updateConfig', instanceId, updates),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    updateCustomPaths: (instanceId: string, paths: { modsDir?: string; resourcepacksDir?: string; shaderpacksDir?: string; modpacksDir?: string }) =>
      ipcRenderer.invoke('instances:updateCustomPaths', instanceId, paths),
    selectFolder: (title?: string) => ipcRenderer.invoke('instances:selectFolder', title),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('instances:changed', listener);
      return () => {
        ipcRenderer.removeListener('instances:changed', listener);
      };
    },
  },
  minecraft: {
    getVersions: () => ipcRenderer.invoke('minecraft:getVersions'),
  },
  baseline: {
    getStatus: () => ipcRenderer.invoke('baseline:getStatus'),
    restore: () => ipcRenderer.invoke('baseline:restore'),
  },
  mods: {
    list: (customDir?: string) => ipcRenderer.invoke('mods:list', customDir),
    listPacks: (type: 'shaderpacks' | 'resourcepacks') => ipcRenderer.invoke('mods:listPacks', type),
    toggle: (fileName: string, enable: boolean, customDir?: string) =>
      ipcRenderer.invoke('mods:toggle', fileName, enable, customDir),
    remove: (fileName: string, prune?: boolean, customDir?: string, type?: 'mod' | 'shader' | 'resourcepack') =>
      ipcRenderer.invoke('mods:remove', fileName, prune, customDir, type),
    checkUpdates: () => ipcRenderer.invoke('mods:checkUpdates'),
    applyUpdate: (currentFile: string) => ipcRenderer.invoke('mods:applyUpdate', currentFile),
    applyAllUpdates: () => ipcRenderer.invoke('mods:applyAllUpdates'),
    getInstalledIndex: () => ipcRenderer.invoke('mods:getInstalledIndex'),
    installDroppedFiles: (filePaths: string[]) =>
      ipcRenderer.invoke('mods:installDroppedFiles', filePaths),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('mods:changed', listener);
      return () => {
        ipcRenderer.removeListener('mods:changed', listener);
      };
    },
  },
  modrinth: {
    search: (query: string, filter) => ipcRenderer.invoke('modrinth:search', query, filter),
    getProject: (slugOrId: string) => ipcRenderer.invoke('modrinth:getProject', slugOrId),
    getVersions: (slugOrId: string, filter) => ipcRenderer.invoke('modrinth:getVersions', slugOrId, filter),
    install: (slugOrId: string, options) => ipcRenderer.invoke('modrinth:install', slugOrId, options),
    installLocalMrpack: (filePath?: string, options?: any) =>
      ipcRenderer.invoke('modrinth:installLocalMrpack', filePath, options),
  },
  modpack: {
    resolveContainer: (loader?: string, gameVersion?: string) =>
      ipcRenderer.invoke('modpack:resolveContainer', loader, gameVersion),
    inspect: (filePath: string) => ipcRenderer.invoke('modpack:inspect', filePath),
    listProfiles: () => ipcRenderer.invoke('modpack:listProfiles'),
    switchProfile: (profileId: string) => ipcRenderer.invoke('modpack:switchProfile', profileId),
    disableActive: () => ipcRenderer.invoke('modpack:disableActive'),
    removeProfile: (profileId: string) => ipcRenderer.invoke('modpack:removeProfile', profileId),
    manualSaveProfile: () => ipcRenderer.invoke('modpack:manualSaveProfile'),
    export: (options) => ipcRenderer.invoke('modpack:export', options),
  },
  snapshots: {
    list: () => ipcRenderer.invoke('snapshots:list'),
    create: (note?: string) => ipcRenderer.invoke('snapshots:create', note),
    restore: (snapshotId: string) => ipcRenderer.invoke('snapshots:restore', snapshotId),
    delete: (snapshotId: string) => ipcRenderer.invoke('snapshots:delete', snapshotId),
    saveCurrent: () => ipcRenderer.invoke('snapshots:saveCurrent'),
    switchProfile: (loader: string, gameVersion: string) =>
      ipcRenderer.invoke('snapshots:switchProfile', loader, gameVersion),
  },
  logs: {
    analyze: () => ipcRenderer.invoke('logs:analyze'),
    getLatestLog: () => ipcRenderer.invoke('logs:getLatestLog'),
  },
  bisect: {
    status: (customDir?: string) => ipcRenderer.invoke('bisect:status', customDir),
    step: (action: 'start' | 'good' | 'bad' | 'reset', customDir?: string) =>
      ipcRenderer.invoke('bisect:step', action, customDir),
  },
  downloads: {
    onProgress: (callback: (payload: DownloadProgressPayload) => void) => {
      const listener = (_event: any, data: DownloadProgressPayload) => callback(data);
      ipcRenderer.on('download:progress', listener);
      return () => {
        ipcRenderer.removeListener('download:progress', listener);
      };
    },
  },
  dialog: {
    selectMrpack: () => ipcRenderer.invoke('dialog:selectMrpack'),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: (assetUrl: string, fileName: string, expectedSha256?: string, expectedSize?: number) =>
      ipcRenderer.invoke('updater:download', assetUrl, fileName, expectedSha256, expectedSize),
    install: (filePath: string, silent?: boolean) =>
      ipcRenderer.invoke('updater:install', filePath, silent),
    onProgress: (callback: (payload: UpdateProgressPayload) => void) => {
      const listener = (_event: any, data: UpdateProgressPayload) => callback(data);
      ipcRenderer.on('updater:progress', listener);
      return () => {
        ipcRenderer.removeListener('updater:progress', listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
