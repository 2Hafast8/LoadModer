import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Trash2,
  Package,
  CheckCircle2,
  HardDrive,
  AlertCircle,
  ArrowUpCircle,
  Sparkles,
  Palette,
  Boxes,
  FolderOpen,
} from 'lucide-react';

interface ModItem {
  name: string;
  fileName: string;
  enabled: boolean;
  size: number;
  formattedSize: string;
}

interface PackItem {
  fileName: string;
  size: number;
  formattedSize: string;
}

interface UpdateItem {
  currentFile: string;
  nextVersion: string;
  nextFileName: string;
  size: number;
}

interface ModsViewProps {
  onGoToExplore?: () => void;
}

export const ModsView: React.FC<ModsViewProps> = ({ onGoToExplore }) => {
  const [assetType, setAssetType] = useState<'mods' | 'shaders' | 'resourcepacks'>('mods');
  const [mods, setMods] = useState<ModItem[]>([]);
  const [packs, setPacks] = useState<PackItem[]>([]);
  const [updates, setUpdates] = useState<Record<string, UpdateItem>>({});
  const [loading, setLoading] = useState(true);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'updates'>('all');
  const [storageUsage, setStorageUsage] = useState('0 B');
  const [activeCount, setActiveCount] = useState(0);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchMods = async () => {
    setLoading(true);
    try {
      if (assetType === 'mods') {
        const data = await window.api.mods.list();
        setMods(data.items ?? []);
        setActiveCount(data.activeCount ?? 0);
        setStorageUsage(data.storageUsage ?? '0 B');
      } else {
        const folderName = assetType === 'shaders' ? 'shaderpacks' : 'resourcepacks';
        const items = await window.api.mods.listPacks(folderName);
        setPacks(items ?? []);
      }
    } catch (err: any) {
      console.error('Failed to load assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
    const unsubscribe = window.api.mods.onChanged?.(() => {
      fetchMods();
    });
    return () => {
      unsubscribe?.();
    };
  }, [assetType]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleOpenFolder = async () => {
    try {
      const data = await window.api.instances.getAll();
      const active = data?.active;
      if (!active?.rootDir) {
        showNotification('Tidak ada instance aktif', 'error');
        return;
      }
      let folderToOpen = active.modsDir;
      if (assetType === 'shaders') {
        folderToOpen = `${active.rootDir}\\shaderpacks`;
      } else if (assetType === 'resourcepacks') {
        folderToOpen = `${active.rootDir}\\resourcepacks`;
      }
      const res = await window.api.instances.openFolder(folderToOpen);
      if (!res.success && res.error) {
        showNotification(res.error, 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleToggle = async (mod: ModItem) => {
    const nextState = !mod.enabled;
    setMods((prev) =>
      prev.map((m) =>
        m.fileName === mod.fileName
          ? {
              ...m,
              enabled: nextState,
              fileName: nextState
                ? m.fileName.replace(/\.disabled$/, '')
                : `${m.fileName}.disabled`,
            }
          : m
      )
    );
    setActiveCount((c) => (nextState ? c + 1 : c - 1));

    try {
      const res = await window.api.mods.toggle(mod.fileName, nextState);
      if (res.success) {
        showNotification(`${mod.name} ${nextState ? 'diaktifkan' : 'dinonaktifkan'}`);
      } else {
        showNotification(res.error ?? 'Gagal mengubah status mod', 'error');
        fetchMods();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
      fetchMods();
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!window.confirm(`Hapus berkas ${fileName}?`)) return;

    try {
      const type = assetType === 'mods' ? 'mod' : assetType === 'shaders' ? 'shader' : 'resourcepack';
      const res = await window.api.mods.remove(fileName, true, undefined, type);
      if (res.success) {
        showNotification(`${fileName} berhasil dihapus`);
        if (assetType === 'mods') {
          setMods((prev) => prev.filter((m) => m.fileName !== fileName));
          setActiveCount((c) => Math.max(0, c - 1));
        } else {
          setPacks((prev) => prev.filter((p) => p.fileName !== fileName));
        }
      } else {
        showNotification(res.error ?? 'Gagal menghapus berkas', 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await window.api.mods.checkUpdates();
      const list: UpdateItem[] = Array.isArray(res) ? res : (res?.updates ?? []);
      const map: Record<string, UpdateItem> = {};
      for (const item of list) {
        map[item.currentFile] = item;
      }
      setUpdates(map);

      if (list.length === 0) {
        const info = (!Array.isArray(res) && res?.gameVersion) ? ` (${res.gameVersion} • ${res.loader})` : '';
        showNotification(`Seluruh ${mods.length} mod sudah versi terbaru yang kompatibel${info}! ✨`);
      } else {
        showNotification(`Ditemukan ${list.length} mod yang memiliki pembaruan!`);
        setStatusFilter('updates');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleApplyUpdate = async (item: UpdateItem) => {
    try {
      const res = await window.api.mods.applyUpdate(item.currentFile);
      if (res.success) {
        showNotification(`Berhasil memperbarui ke ${item.nextFileName}`);
        setUpdates((prev) => {
          const next = { ...prev };
          delete next[item.currentFile];
          return next;
        });
        fetchMods();
      } else {
        showNotification(res.error ?? 'Gagal memperbarui mod', 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const filteredMods = useMemo(() => {
    return mods.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'active') return m.enabled;
      if (statusFilter === 'disabled') return !m.enabled;
      if (statusFilter === 'updates') return !!updates[m.fileName];
      return true;
    });
  }, [mods, searchQuery, statusFilter, updates]);

  const filteredPacks = useMemo(() => {
    return packs.filter((p) =>
      p.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [packs, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-obsidian-card border border-obsidian-border rounded p-0.5 text-xs">
            <button
              onClick={() => setAssetType('mods')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded cursor-pointer transition-colors ${
                assetType === 'mods'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Mods (.jar)</span>
            </button>
            <button
              onClick={() => setAssetType('shaders')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded cursor-pointer transition-colors ${
                assetType === 'shaders'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Shaders</span>
            </button>
            <button
              onClick={() => setAssetType('resourcepacks')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded cursor-pointer transition-colors ${
                assetType === 'resourcepacks'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Resource Packs</span>
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-nordic-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari ${assetType}...`}
            className="w-full bg-obsidian-card border border-obsidian-border rounded pl-9 pr-3 py-1.5 text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2">
          {assetType === 'mods' && (
            <>
              <div className="flex items-center bg-obsidian-card border border-obsidian-border rounded p-0.5 text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                      : 'text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  Semua ({mods.length})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    statusFilter === 'active'
                      ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                      : 'text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  Aktif ({activeCount})
                </button>
                <button
                  onClick={() => setStatusFilter('disabled')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    statusFilter === 'disabled'
                      ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                      : 'text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  Nonaktif ({mods.length - activeCount})
                </button>
                {Object.keys(updates).length > 0 && (
                  <button
                    onClick={() => setStatusFilter('updates')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors font-semibold ${
                      statusFilter === 'updates'
                        ? 'bg-status-warning text-obsidian-bg'
                        : 'text-status-warning hover:bg-status-warning/10'
                    }`}
                  >
                    Update ({Object.keys(updates).length})
                  </button>
                )}
              </div>

              <button
                onClick={handleCheckUpdates}
                disabled={checkingUpdates}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
                title="Periksa pembaruan versi"
              >
                <ArrowUpCircle className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
                <span>Cek Update</span>
              </button>
            </>
          )}

          <button
            onClick={handleOpenFolder}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title={`Buka folder ${assetType} di Windows File Explorer`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Buka Folder</span>
          </button>

          <button
            onClick={fetchMods}
            disabled={loading}
            className="p-1.5 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title="Refresh Daftar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`px-4 py-2 text-xs flex items-center space-x-2 border-b ${
            actionMessage.type === 'success'
              ? 'bg-emerald-dark/30 border-emerald-primary text-emerald-active'
              : 'bg-status-danger/10 border-status-danger text-status-danger'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-nordic-muted">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span className="text-xs">Memindai berkas {assetType}...</span>
          </div>
        ) : assetType === 'mods' ? (
          filteredMods.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 space-y-3 text-center">
              <Package className="w-10 h-10 text-nordic-muted/50" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-nordic-text">
                  {searchQuery ? 'Mod tidak ditemukan' : 'Belum ada mod terpasang'}
                </p>
                <p className="text-xs text-nordic-muted max-w-sm">
                  {searchQuery
                    ? 'Coba gunakan kata kunci pencarian yang berbeda.'
                    : 'Instance aktif belum memiliki mod di foldernya. Anda dapat mencari dan memasang mod melalui tab Explore.'}
                </p>
              </div>
              {!searchQuery && onGoToExplore && (
                <button
                  onClick={onGoToExplore}
                  className="mt-2 px-3 py-1.5 rounded bg-emerald-primary text-obsidian-bg text-xs font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
                >
                  Jelajahi Katalog
                </button>
              )}
            </div>
          ) : (
            <div className="border border-obsidian-border rounded overflow-hidden bg-obsidian-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-obsidian-border bg-obsidian-surface text-nordic-muted font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-12 text-center">Status</th>
                    <th className="py-2.5 px-3">Nama Mod / Berkas</th>
                    <th className="py-2.5 px-3 w-32 text-center">Update</th>
                    <th className="py-2.5 px-3 w-28 text-right">Ukuran</th>
                    <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border">
                  {filteredMods.map((mod) => {
                    const updateInfo = updates[mod.fileName];

                    return (
                      <tr
                        key={mod.fileName}
                        className="hover:bg-obsidian-hover/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleToggle(mod)}
                            className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${
                              mod.enabled ? 'bg-emerald-primary' : 'bg-nordic-muted/30'
                            }`}
                            title={mod.enabled ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
                          >
                            <div
                              className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                                mod.enabled ? 'left-3.5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </td>

                        <td className="py-2 px-3">
                          <div className="flex flex-col">
                            <span
                              className={`font-medium ${
                                mod.enabled ? 'text-nordic-text' : 'text-nordic-muted line-through'
                              }`}
                            >
                              {mod.name}
                            </span>
                            <span className="text-[11px] font-mono text-nordic-muted truncate max-w-md">
                              {mod.fileName}
                            </span>
                          </div>
                        </td>

                        <td className="py-2 px-3 text-center">
                          {updateInfo ? (
                            <button
                              onClick={() => handleApplyUpdate(updateInfo)}
                              className="px-2 py-0.5 rounded bg-status-warning/20 border border-status-warning/40 text-status-warning hover:bg-status-warning hover:text-obsidian-bg text-[10px] font-mono font-semibold transition-colors cursor-pointer"
                              title={`Update ke ${updateInfo.nextFileName}`}
                            >
                              ⬆ {updateInfo.nextVersion}
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono text-nordic-muted/60">-</span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-right font-mono text-nordic-muted">
                          {mod.formattedSize}
                        </td>

                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleDelete(mod.fileName)}
                            className="p-1 rounded text-nordic-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer"
                            title="Hapus mod dari disk"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Shaders & Resource Packs View */
          filteredPacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center text-nordic-muted">
              {assetType === 'shaders' ? (
                <Sparkles className="w-8 h-8 opacity-40" />
              ) : (
                <Palette className="w-8 h-8 opacity-40" />
              )}
              <span className="text-xs">
                Tidak ada berkas {assetType} (.zip) di folder instance.
              </span>
            </div>
          ) : (
            <div className="border border-obsidian-border rounded overflow-hidden bg-obsidian-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-obsidian-border bg-obsidian-surface text-nordic-muted font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">Nama Berkas</th>
                    <th className="py-2.5 px-3 w-28 text-right">Ukuran</th>
                    <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border">
                  {filteredPacks.map((pack) => (
                    <tr key={pack.fileName} className="hover:bg-obsidian-hover/50 transition-colors">
                      <td className="py-2 px-3 font-medium text-nordic-text font-mono">
                        {pack.fileName}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-nordic-muted">
                        {pack.formattedSize}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDelete(pack.fileName)}
                          className="p-1 rounded text-nordic-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer"
                          title="Hapus berkas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <div className="h-7 border-t border-obsidian-border bg-obsidian-surface px-4 flex items-center justify-between text-[11px] text-nordic-muted font-mono">
        <div className="flex items-center space-x-3">
          {assetType === 'mods' ? (
            <>
              <span>{mods.length} berkas mod</span>
              <span>•</span>
              <span className="text-emerald-active">{activeCount} aktif</span>
              <span>•</span>
              <span>{mods.length - activeCount} nonaktif</span>
            </>
          ) : (
            <span>{packs.length} berkas {assetType} terpasang</span>
          )}
        </div>
        <div className="flex items-center space-x-1.5">
          <HardDrive className="w-3.5 h-3.5" />
          <span>Penggunaan disk: {storageUsage}</span>
        </div>
      </div>
    </div>
  );
};
