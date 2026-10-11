import React, { useState, useEffect } from 'react';
import {
  Layers,
  Folder,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Cpu,
  Gamepad2,
  AlertCircle,
} from 'lucide-react';

interface InstanceItem {
  id: string;
  name: string;
  launcher: string;
  rootDir: string;
  modsDir: string;
  gameVersion?: string;
  loader?: string;
}

interface InstancesViewProps {
  onInstanceChanged?: (name: string) => void;
}

export const InstancesView: React.FC<InstancesViewProps> = ({ onInstanceChanged }) => {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [activeInstance, setActiveInstance] = useState<InstanceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const data = await window.api.instances.getAll();
      setInstances(data.list ?? []);
      setActiveInstance(data.active ?? null);
      if (data.active?.name && onInstanceChanged) {
        onInstanceChanged(data.active.name);
      }
    } catch (err: any) {
      console.error('Failed to load instances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleSelect = async (inst: InstanceItem) => {
    setSwitchingId(inst.id);
    setNotification(null);
    try {
      const res = await window.api.instances.setActive(inst.id);
      if (res.success) {
        setActiveInstance(inst);
        if (onInstanceChanged) onInstanceChanged(inst.name);
        setNotification({
          text: `Instance aktif dialihkan ke "${inst.name}"`,
          type: 'success',
        });
      } else {
        setNotification({
          text: res.error ?? 'Gagal memilih instance',
          type: 'error',
        });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* Header Bar */}
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold text-nordic-text uppercase tracking-wider">
            Pengelola Launcher & Instance
          </h2>
          <p className="text-[11px] text-nordic-muted">
            Pilih instance target yang akan dikelola oleh LoadModer
          </p>
        </div>

        <button
          onClick={loadInstances}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Pindai Ulang</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`px-4 py-2 text-xs flex items-center space-x-2 border-b ${
            notification.type === 'success'
              ? 'bg-emerald-dark/30 border-emerald-primary text-emerald-active'
              : 'bg-status-danger/10 border-status-danger text-status-danger'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-nordic-muted">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span className="text-xs">Mendeteksi launcher Minecraft lokal...</span>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center text-nordic-muted">
            <Layers className="w-8 h-8 opacity-40" />
            <span className="text-xs">Tidak ada instance Minecraft yang ditemukan di sistem.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instances.map((inst) => {
              const isActive =
                activeInstance?.id === inst.id ||
                activeInstance?.rootDir === inst.rootDir;
              const isSwitching = switchingId === inst.id;

              return (
                <div
                  key={inst.id}
                  className={`bg-obsidian-card border rounded p-4 flex flex-col justify-between transition-colors ${
                    isActive
                      ? 'border-emerald-primary/70 bg-obsidian-card/90 shadow-sm'
                      : 'border-obsidian-border hover:border-obsidian-hover'
                  }`}
                >
                  <div>
                    {/* Top line: Launcher Badge & Active Indicator */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded bg-obsidian-surface border border-obsidian-border text-[10px] font-mono text-emerald-primary uppercase tracking-wide">
                        {inst.launcher}
                      </span>
                      {isActive && (
                        <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-active bg-emerald-dark/30 px-2 py-0.5 rounded border border-emerald-primary/40">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Instance Aktif</span>
                        </span>
                      )}
                    </div>

                    {/* Instance Name */}
                    <h3 className="text-xs font-bold text-nordic-text mb-3 truncate">
                      {inst.name}
                    </h3>

                    {/* Metadata Specs */}
                    <div className="space-y-1.5 mb-4 text-[11px]">
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Gamepad2 className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span>Versi Game:</span>
                        <span className="font-mono text-nordic-text font-medium">
                          {inst.gameVersion ?? 'Auto-detect'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Cpu className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span>Loader:</span>
                        <span className="font-mono text-nordic-text font-medium capitalize">
                          {inst.loader ?? 'Universal'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Folder className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span className="truncate font-mono text-[10px]">
                          {inst.rootDir}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Select Button */}
                  <div className="pt-3 border-t border-obsidian-border flex justify-end">
                    <button
                      onClick={() => handleSelect(inst)}
                      disabled={isActive || isSwitching}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-obsidian-surface text-nordic-muted border border-obsidian-border cursor-default'
                          : isSwitching
                          ? 'bg-obsidian-hover text-nordic-muted cursor-wait'
                          : 'bg-emerald-primary text-obsidian-bg hover:bg-emerald-active'
                      }`}
                    >
                      {isActive
                        ? 'Sedang Dipakai'
                        : isSwitching
                        ? 'Mengalihkan...'
                        : 'Pilih Instance Ini'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
