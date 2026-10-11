import { contextBridge, ipcRenderer } from 'electron';

export interface DesktopAPI {
  // Window controls
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  // Instance management
  instances: {
    getAll: () => Promise<{ active: any | null; list: any[] }>;
    setActive: (id: string) => Promise<{ success: boolean; error?: string }>;
    scanAll: () => Promise<any[]>;
    deepScanDrives: () => Promise<any[]>;
    browseFolder: () => Promise<{ success: boolean; instance?: any; error?: string }>;
  };
  // Installed assets (mods, shaders, resource packs)
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
    checkUpdates: () => Promise<Array<{
      currentFile: string;
      nextVersion: string;
      nextFileName: string;
      size: number;
    }>>;
    applyUpdate: (currentFile: string) => Promise<{ success: boolean; error?: string }>;
    onChanged: (callback: () => void) => () => void;
  };
  // Modrinth explore & install
  modrinth: {
    search: (
      query: string,
      filter?: {
        type?: string;
        mcVersion?: string;
        loader?: string;
        limit?: number;
        index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
      }
    ) => Promise<any>;
    getVersions: (slugOrId: string, filter?: { loader?: string; mcVersion?: string }) => Promise<any[]>;
    install: (
      slugOrId: string,
      options?: { type?: string; mcVersion?: string; loader?: string }
    ) => Promise<{ success: boolean; message?: string; error?: string }>;
    installLocalMrpack: (filePath?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  };
  // Modpack profile containers
  modpack: {
    listProfiles: () => Promise<any[]>;
    switchProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
    disableActive: () => Promise<{ success: boolean; error?: string }>;
  };
  // Profile snapshots
  snapshots: {
    list: () => Promise<any[]>;
    switchProfile: (loader: string, gameVersion: string) => Promise<{ success: boolean; savedCount?: number; restoredCount?: number; error?: string }>;
  };
  // Bisect diagnostics
  bisect: {
    status: (customDir?: string) => Promise<{ active: boolean; step?: number; totalSteps?: number; remainingMods?: number; state?: any }>;
    step: (action: 'start' | 'good' | 'bad' | 'reset', customDir?: string) => Promise<{ success: boolean; message: string; state?: any; error?: string }>;
  };
  // Dialogs
  dialog: {
    selectMrpack: () => Promise<string | null>;
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
    setActive: (id: string) => ipcRenderer.invoke('instances:setActive', id),
    scanAll: () => ipcRenderer.invoke('instances:scanAll'),
    deepScanDrives: () => ipcRenderer.invoke('instances:deepScanDrives'),
    browseFolder: () => ipcRenderer.invoke('instances:browseFolder'),
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
    getVersions: (slugOrId: string, filter) => ipcRenderer.invoke('modrinth:getVersions', slugOrId, filter),
    install: (slugOrId: string, options) => ipcRenderer.invoke('modrinth:install', slugOrId, options),
    installLocalMrpack: (filePath?: string) => ipcRenderer.invoke('modrinth:installLocalMrpack', filePath),
  },
  modpack: {
    listProfiles: () => ipcRenderer.invoke('modpack:listProfiles'),
    switchProfile: (profileId: string) => ipcRenderer.invoke('modpack:switchProfile', profileId),
    disableActive: () => ipcRenderer.invoke('modpack:disableActive'),
  },
  snapshots: {
    list: () => ipcRenderer.invoke('snapshots:list'),
    switchProfile: (loader: string, gameVersion: string) =>
      ipcRenderer.invoke('snapshots:switchProfile', loader, gameVersion),
  },
  bisect: {
    status: (customDir?: string) => ipcRenderer.invoke('bisect:status', customDir),
    step: (action: 'start' | 'good' | 'bad' | 'reset', customDir?: string) =>
      ipcRenderer.invoke('bisect:step', action, customDir),
  },
  dialog: {
    selectMrpack: () => ipcRenderer.invoke('dialog:selectMrpack'),
  },
};

contextBridge.exposeInMainWorld('api', api);
