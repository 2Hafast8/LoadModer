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
  };
  // Installed mods
  mods: {
    list: (customDir?: string) => Promise<{
      items: Array<{
        name: string;
        fileName: string;
        version?: string;
        enabled: boolean;
        size: number;
        formattedSize: string;
        modId?: string;
        source?: string;
      }>;
      activeCount: number;
      totalCount: number;
      storageUsage: string;
    }>;
    toggle: (fileName: string, enable: boolean, customDir?: string) => Promise<{ success: boolean; error?: string }>;
    remove: (fileName: string, prune?: boolean, customDir?: string) => Promise<{ success: boolean; removed?: string[]; error?: string }>;
  };
  // Modrinth explore & install
  modrinth: {
    search: (query: string, filter?: { type?: string; mcVersion?: string; loader?: string; limit?: number }) => Promise<any>;
    getVersions: (slugOrId: string, filter?: { loader?: string; mcVersion?: string }) => Promise<any[]>;
    install: (slugOrId: string, options?: { type?: string; mcVersion?: string; loader?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  };
  // Bisect diagnostics
  bisect: {
    status: (customDir?: string) => Promise<{ active: boolean; step?: number; totalSteps?: number; remainingMods?: number; state?: any }>;
    step: (action: 'start' | 'good' | 'bad' | 'reset', customDir?: string) => Promise<{ success: boolean; message: string; state?: any; error?: string }>;
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
  },
  mods: {
    list: (customDir?: string) => ipcRenderer.invoke('mods:list', customDir),
    toggle: (fileName: string, enable: boolean, customDir?: string) =>
      ipcRenderer.invoke('mods:toggle', fileName, enable, customDir),
    remove: (fileName: string, prune?: boolean, customDir?: string) =>
      ipcRenderer.invoke('mods:remove', fileName, prune, customDir),
  },
  modrinth: {
    search: (query: string, filter?: { type?: string; mcVersion?: string; loader?: string; limit?: number }) =>
      ipcRenderer.invoke('modrinth:search', query, filter),
    getVersions: (slugOrId: string, filter?: { loader?: string; mcVersion?: string }) =>
      ipcRenderer.invoke('modrinth:getVersions', slugOrId, filter),
    install: (slugOrId: string, options?: { type?: string; mcVersion?: string; loader?: string }) =>
      ipcRenderer.invoke('modrinth:install', slugOrId, options),
  },
  bisect: {
    status: (customDir?: string) => ipcRenderer.invoke('bisect:status', customDir),
    step: (action: 'start' | 'good' | 'bad' | 'reset', customDir?: string) =>
      ipcRenderer.invoke('bisect:step', action, customDir),
  },
};

contextBridge.exposeInMainWorld('api', api);
