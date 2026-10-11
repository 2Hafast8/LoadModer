import React, { useState, useEffect } from 'react';
import {
  Layers,
  Folder,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Gamepad2,
  AlertCircle,
  FolderSearch,
  FolderPlus,
  FolderOpen,
  PackageCheck,
  Undo2,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

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
  const { t } = useLanguage();
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [activeInstance, setActiveInstance] = useState<InstanceItem | null>(null);
  const [modpackProfiles, setModpackProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deepScanning, setDeepScanning] = useState(false);
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

      try {
        const profiles = await window.api.modpack.listProfiles();
        setModpackProfiles(profiles ?? []);
      } catch {}
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
          text: t.instances.switchedInstance.replace('{name}', inst.name),
          type: 'success',
        });
        const profiles = await window.api.modpack.listProfiles().catch(() => []);
        setModpackProfiles(profiles ?? []);
      } else {
        setNotification({
          text: res.error ?? t.instances.switchFailed,
          type: 'error',
        });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDeepScan = async () => {
    setDeepScanning(true);
    setNotification(null);
    try {
      const found = await window.api.instances.deepScanDrives();
      if (found.length > 0) {
        setInstances((prev) => {
          const ids = new Set(prev.map((i) => i.rootDir.toLowerCase()));
          const added = found.filter((f: InstanceItem) => !ids.has(f.rootDir.toLowerCase()));
          return [...prev, ...added];
        });
        setNotification({
          text: t.instances.deepScanSuccess.replace('{count}', String(found.length)),
          type: 'success',
        });
      } else {
        setNotification({
          text: t.instances.deepScanNone,
          type: 'success',
        });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setDeepScanning(false);
    }
  };

  const handleOpenFolder = async (folderPath?: string) => {
    try {
      const res = await window.api.instances.openFolder(folderPath);
      if (!res.success && res.error) {
        setNotification({ text: t.instances.openFolderFailed.replace('{error}', res.error), type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const res = await window.api.instances.browseFolder();
      if (res.success && res.instance) {
        setInstances((prev) => [res.instance, ...prev.filter((i) => i.id !== res.instance.id)]);
        setActiveInstance(res.instance);
        if (onInstanceChanged) onInstanceChanged(res.instance.name);
        setNotification({
          text: t.instances.folderAdded.replace('{name}', res.instance.name),
          type: 'success',
        });
      } else if (res.error) {
        setNotification({ text: res.error, type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    }
  };

  const handleSwitchModpackProfile = async (profileId: string) => {
    try {
      const res = await window.api.modpack.switchProfile(profileId);
      if (res.success) {
        setNotification({ text: t.instances.containerSwitched.replace('{name}', profileId), type: 'success' });
        loadInstances();
      } else {
        setNotification({ text: res.error ?? t.instances.containerSwitchFailed, type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    }
  };

  const handleDisableModpack = async () => {
    try {
      const res = await window.api.modpack.disableActive();
      if (res.success) {
        setNotification({ text: t.instances.containerDisabled, type: 'success' });
        loadInstances();
      } else {
        setNotification({ text: res.error ?? t.instances.containerDisableFailed, type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold text-nordic-text uppercase tracking-wider">
            {t.instances.title}
          </h2>
          <p className="text-[11px] text-nordic-muted">
            {t.instances.subtitle}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeInstance && (
            <button
              onClick={() => handleOpenFolder(activeInstance.rootDir)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-dark/30 border border-emerald-primary/40 text-xs text-emerald-active hover:bg-emerald-dark/50 transition-colors cursor-pointer"
              title={t.instances.openActiveFolderTooltip}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{t.instances.openActiveFolder}</span>
            </button>
          )}

          <button
            onClick={handleBrowseFolder}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title={t.instances.customFolderTooltip}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{t.instances.customFolder}</span>
          </button>

          <button
            onClick={handleDeepScan}
            disabled={deepScanning}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title={t.instances.scanDrivesTooltip}
          >
            <FolderSearch className={`w-3.5 h-3.5 ${deepScanning ? 'animate-spin' : ''}`} />
            <span>{t.instances.scanDrives}</span>
          </button>

          <button
            onClick={loadInstances}
            disabled={loading}
            className="p-1.5 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title={t.instances.refreshTooltip}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {modpackProfiles.length > 0 && (
          <div className="border border-obsidian-border bg-obsidian-surface rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PackageCheck className="w-4 h-4 text-emerald-primary" />
                <span className="text-xs font-bold text-nordic-text uppercase font-mono">
                  {t.instances.modpackContainers.replace('{count}', String(modpackProfiles.length))}
                </span>
              </div>
              <button
                onClick={handleDisableModpack}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-[11px] text-nordic-muted hover:text-status-warning hover:border-status-warning/40 transition-colors cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                <span>{t.instances.vanillaMode}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {modpackProfiles.map((prof) => (
                <div
                  key={prof.id}
                  className={`p-2.5 rounded border text-xs flex items-center justify-between ${
                    prof.isActive
                      ? 'bg-emerald-dark/20 border-emerald-primary/60 text-emerald-active'
                      : 'bg-obsidian-card border-obsidian-border text-nordic-muted'
                  }`}
                >
                  <div className="truncate min-w-0 mr-2">
                    <span className="font-semibold block truncate text-nordic-text">
                      {prof.name}
                    </span>
                    <span className="text-[10px] font-mono opacity-70">
                      {t.instances.filesCount.replace('{count}', String(prof.filesCount ?? 0))} • {prof.loader ?? 'modpack'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleSwitchModpackProfile(prof.id)}
                    disabled={prof.isActive}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      prof.isActive
                        ? 'bg-emerald-primary text-obsidian-bg cursor-default'
                        : 'bg-obsidian-surface border border-obsidian-border hover:border-emerald-primary hover:text-emerald-primary'
                    }`}
                  >
                    {prof.isActive ? t.common.active : t.common.install}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-nordic-muted">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span className="text-xs">{t.instances.detectingLaunchers}</span>
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center text-nordic-muted">
            <Layers className="w-8 h-8 opacity-40" />
            <span className="text-xs">{t.instances.noInstancesFound}</span>
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded bg-obsidian-surface border border-obsidian-border text-[10px] font-mono text-emerald-primary uppercase tracking-wide">
                        {inst.launcher}
                      </span>
                      {isActive && (
                        <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-active bg-emerald-dark/30 px-2 py-0.5 rounded border border-emerald-primary/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t.instances.activeBadge}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs font-bold text-nordic-text mb-3 truncate">
                      {inst.name}
                    </h3>

                    <div className="space-y-1.5 mb-4 text-[11px]">
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Gamepad2 className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span>{t.instances.gameVersionLabel}</span>
                        <span className="font-mono text-nordic-text font-medium">
                          {inst.gameVersion ?? t.instances.autoDetect}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Cpu className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span>{t.instances.loaderLabel}</span>
                        <span className="font-mono text-nordic-text font-medium capitalize">
                          {inst.loader ?? t.instances.universal}
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

                  <div className="pt-3 border-t border-obsidian-border flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenFolder(inst.rootDir)}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
                      title={t.instances.openFolderTooltip}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{t.instances.openFolderBtn}</span>
                    </button>

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
                        ? t.instances.currentInUse
                        : isSwitching
                        ? t.instances.switchingBtn
                        : t.instances.selectBtn}
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
