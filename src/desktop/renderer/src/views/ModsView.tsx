import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Trash2,
  Package,
  CheckCircle2,
  XCircle,
  HardDrive,
  AlertCircle,
} from 'lucide-react';

interface ModItem {
  name: string;
  fileName: string;
  enabled: boolean;
  size: number;
  formattedSize: string;
}

interface ModsViewProps {
  onGoToExplore?: () => void;
}

export const ModsView: React.FC<ModsViewProps> = ({ onGoToExplore }) => {
  const [mods, setMods] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [storageUsage, setStorageUsage] = useState('0 B');
  const [activeCount, setActiveCount] = useState(0);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchMods = async () => {
    setLoading(true);
    try {
      const data = await window.api.mods.list();
      setMods(data.items ?? []);
      setActiveCount(data.activeCount ?? 0);
      setStorageUsage(data.storageUsage ?? '0 B');
    } catch (err: any) {
      console.error('Failed to load mods:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleToggle = async (mod: ModItem) => {
    const nextState = !mod.enabled;
    // Optimistic UI update
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

  const handleDelete = async (mod: ModItem) => {
    if (!window.confirm(`Hapus berkas mod ${mod.name}?`)) return;

    try {
      const res = await window.api.mods.remove(mod.fileName);
      if (res.success) {
        showNotification(`${mod.name} berhasil dihapus`);
        setMods((prev) => prev.filter((m) => m.fileName !== mod.fileName));
        if (mod.enabled) setActiveCount((c) => c - 1);
      } else {
        showNotification(res.error ?? 'Gagal menghapus mod', 'error');
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
      return true;
    });
  }, [mods, searchQuery, statusFilter]);

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* Sub-header Controls */}
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-nordic-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari mod terpasang..."
            className="w-full bg-obsidian-card border border-obsidian-border rounded pl-9 pr-3 py-1.5 text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary transition-colors"
          />
        </div>

        {/* Filter Pills & Stats */}
        <div className="flex items-center space-x-2">
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
          </div>

          <button
            onClick={fetchMods}
            disabled={loading}
            className="p-1.5 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title="Refresh Daftar Mod"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-nordic-muted">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span className="text-xs">Memindai folder mods...</span>
          </div>
        ) : filteredMods.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 space-y-3 text-center">
            <Package className="w-10 h-10 text-nordic-muted/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-nordic-text">
                {searchQuery ? 'Mod tidak ditemukan' : 'Belum ada mod terpasang'}
              </p>
              <p className="text-xs text-nordic-muted max-w-sm">
                {searchQuery
                  ? 'Coba gunakan kata kunci pencarian yang berbeda.'
                  : 'Instance aktif belum memiliki mod di foldernya. Anda dapat mengunduh mod dari katalog Modrinth.'}
              </p>
            </div>
            {!searchQuery && onGoToExplore && (
              <button
                onClick={onGoToExplore}
                className="mt-2 px-3 py-1.5 rounded bg-emerald-primary text-obsidian-bg text-xs font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
              >
                Jelajahi Modrinth
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
                  <th className="py-2.5 px-3 w-28 text-right">Ukuran</th>
                  <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border">
                {filteredMods.map((mod) => (
                  <tr
                    key={mod.fileName}
                    className="hover:bg-obsidian-hover/50 transition-colors"
                  >
                    {/* Toggle Switch */}
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

                    {/* Mod Name & Filename */}
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

                    {/* Size */}
                    <td className="py-2 px-3 text-right font-mono text-nordic-muted">
                      {mod.formattedSize}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDelete(mod)}
                        className="p-1 rounded text-nordic-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer"
                        title="Hapus mod dari disk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="h-7 border-t border-obsidian-border bg-obsidian-surface px-4 flex items-center justify-between text-[11px] text-nordic-muted font-mono">
        <div className="flex items-center space-x-3">
          <span>{mods.length} berkas mod</span>
          <span>•</span>
          <span className="text-emerald-active">{activeCount} aktif</span>
          <span>•</span>
          <span>{mods.length - activeCount} nonaktif</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <HardDrive className="w-3.5 h-3.5" />
          <span>Penggunaan disk: {storageUsage}</span>
        </div>
      </div>
    </div>
  );
};
