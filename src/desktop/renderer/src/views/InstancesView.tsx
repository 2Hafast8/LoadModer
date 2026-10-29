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
  Package,
  Shield,
  Trash2,
  Settings2,
  Boxes,
  Save,
  Home,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import { RestorePointsPanel } from '../components/RestorePointsPanel.js';
import { ExportModpackModal } from '../components/ExportModpackModal.js';
import { EditVersionLoaderModal } from '../components/EditVersionLoaderModal.js';
import { ConfigurePathsModal } from '../components/ConfigurePathsModal.js';
import { DeleteInstanceModal } from '../components/DeleteInstanceModal.js';
import { SwitchModeModal } from '../components/SwitchModeModal.js';
import { OperationLoadingOverlay } from '../components/OperationLoadingOverlay.js';

interface InstanceItem {
  id: string;
  name: string;
  launcher: string;
  rootDir: string;
  modsDir: string;
  resourcepacksDir?: string;
  shaderpacksDir?: string;
  modpacksDir?: string;
  gameVersion?: string;
  loader?: string;
  mode?: 'default' | 'modpack';
  activeContainer?: string;
  capabilities?: {
    launcher: string;
    supportsModpack: boolean;
    supportsContainers: boolean;
    supportsModeSwitch: boolean;
    modpackStrategy: string;
    incompatibilityReason?: string;
    isTLMods?: boolean;
    isLoadModerContainer?: boolean;
    notes?: string;
  };
}

interface InstanceStatusInfo {
  instanceName: string;
  gameVersion: string;
  loader: string;
  mode: 'default' | 'modpack';
  activeContainer?: string;
  supportsModeSwitch: boolean;
  modsCount: number;
  activeCount: number;
  storageUsage: string;
  statusText: string;
}

interface InstancesViewProps {
  onInstanceChanged?: (name: string) => void;
}

export const InstancesView: React.FC<InstancesViewProps> = ({ onInstanceChanged }) => {
  const { t } = useLanguage();
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [activeInstance, setActiveInstance] = useState<InstanceItem | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatusInfo | null>(null);
  const [modpackProfiles, setModpackProfiles] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [baselineInfo, setBaselineInfo] = useState<{
    exists: boolean;
    createdAt?: string;
    filesCount?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deepScanning, setDeepScanning] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedExportProfile, setSelectedExportProfile] = useState<any | null>(null);
  const [confirmSwitchTarget, setConfirmSwitchTarget] = useState<{
    mode: 'default' | 'modpack';
    containerName?: string;
    loader?: string;
    gameVersion?: string;
  } | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<InstanceItem | null>(null);
  const [pathsModalOpen, setPathsModalOpen] = useState(false);
  const [pathsInstance, setPathsInstance] = useState<InstanceItem | null>(null);
  const [instanceToDelete, setInstanceToDelete] = useState<InstanceItem | null>(null);
  const [savingTLMods, setSavingTLMods] = useState(false);
  const [containerSearch, setContainerSearch] = useState('');
  const [modpackPage, setModpackPage] = useState(1);
  const MODPACK_PAGE_SIZE = 6;
  const [operationBusy, setOperationBusy] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    detail?: string;
  }>({
    isOpen: false,
    title: '',
  });

  useEffect(() => {
    setModpackPage(1);
  }, [activeInstance?.activeContainer, modpackProfiles.length]);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const data = await window.api.instances.getAll();
      setInstances(data.list ?? []);
      setActiveInstance(data.active ?? null);
      if (data.status) {
        setInstanceStatus(data.status);
      } else if (data.active) {
        const s = await window.api.instances.getStatus();
        setInstanceStatus(s);
      } else {
        setInstanceStatus(null);
      }
      if (data.active?.name && onInstanceChanged) {
        onInstanceChanged(data.active.name);
      }

      try {
        const profiles = await window.api.modpack.listProfiles();
        setModpackProfiles(profiles ?? []);
      } catch {}

      try {
        const bInfo = await window.api.baseline.getStatus();
        setBaselineInfo(bInfo);
      } catch {}

      if (data.active?.capabilities?.supportsModeSwitch) {
        try {
          const cList = await window.api.instances.getContainers();
          setContainers(cList ?? []);
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to load instances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
    const unsub = window.api.instances.onChanged?.(() => {
      loadInstances();
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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
        loadInstances();
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
    const profObj = modpackProfiles.find((p) => p.id === profileId);
    const profName = profObj?.name ?? profileId;
    setOperationBusy({
      isOpen: true,
      title: t.loadingOverlay?.activatingModpackTitle || 'Mengaktifkan Profil Modpack',
      subtitle: t.loadingOverlay?.activatingModpackDesc || 'Mengekstrak dan memulihkan seluruh mod, konfigurasi, dan pengaturan dari brankas...',
      detail: profName,
    });
    try {
      const res = await window.api.modpack.switchProfile(profileId);
      if (res.success) {
        setNotification({ text: t.instances.containerSwitched.replace('{name}', profName), type: 'success' });
        await loadInstances();
      } else {
        setNotification({ text: res.error ?? t.instances.containerSwitchFailed, type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setOperationBusy({ isOpen: false, title: '' });
    }
  };

  const handleDisableModpack = async () => {
    setOperationBusy({
      isOpen: true,
      title: t.loadingOverlay?.disablingModpackTitle || 'Membersihkan Wadah ke Mode Vanilla',
      subtitle: t.loadingOverlay?.disablingModpackDesc || 'Menyimpan modpack aktif ke brankas dan membersihkan wadah...',
      detail: activeInstance?.activeContainer ?? 'Modpack',
    });
    try {
      const res = await window.api.modpack.disableActive();
      if (res.success) {
        setNotification({ text: t.instances.containerDisabled, type: 'success' });
        await loadInstances();
      } else {
        setNotification({ text: res.error ?? t.instances.containerDisableFailed, type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setOperationBusy({ isOpen: false, title: '' });
    }
  };

  const handleManualSaveTLModsProfile = async () => {
    setOperationBusy({
      isOpen: true,
      title: t.loadingOverlay?.savingModpackTitle || 'Menyimpan Profil Modpack',
      subtitle: t.loadingOverlay?.savingModpackDesc || 'Menyimpan seluruh mod, konfigurasi, shader, dan pengaturan ke brankas profil...',
      detail: activeInstance?.activeContainer ?? 'TL-Mods',
    });
    try {
      setSavingTLMods(true);
      const res = await window.api.modpack.manualSaveProfile();
      if (res.success) {
        setNotification({
          text: (t.instances.manualSaveProfileSuccess || 'Profil modpack berhasil disimpan ({count} berkas diamankan).').replace(
            '{count}',
            String(res.filesCount ?? 0)
          ),
          type: 'success',
        });
        await loadInstances();
      } else {
        setNotification({
          text: (t.instances.manualSaveProfileError || 'Gagal menyimpan profil modpack: {error}').replace(
            '{error}',
            res.error || ''
          ),
          type: 'error',
        });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setSavingTLMods(false);
      setOperationBusy({ isOpen: false, title: '' });
    }
  };

  const handleSwitchMode = async (mode: 'default' | 'modpack', containerName?: string) => {
    const detailText = mode === 'default' ? t.instances.modeDefault : `Wadah: ${containerName}`;
    setOperationBusy({
      isOpen: true,
      title: t.loadingOverlay?.switchingModeTitle || 'Memindahkan Mode Launcher',
      subtitle: t.loadingOverlay?.switchingModeDesc || 'Menyelaraskan direktori wadah dan mengamankan berkas mod. Harap tunggu...',
      detail: detailText,
    });
    try {
      const res = await window.api.instances.switchMode(mode, containerName);
      if (res.success) {
        setNotification({
          text: t.instances.modeSwitched.replace('{mode}', mode === 'default' ? 'Default (.minecraft)' : `Wadah (${containerName})`),
          type: 'success',
        });
        await loadInstances();
      } else {
        setNotification({ text: res.error || 'Gagal mengubah mode launcher', type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setOperationBusy({ isOpen: false, title: '' });
    }
  };

  const handleRestoreBaseline = async () => {
    if (!window.confirm(t.instances.confirmRestoreBaseline)) return;
    setOperationBusy({
      isOpen: true,
      title: t.loadingOverlay?.restoringBaselineTitle || 'Memulihkan Golden Baseline',
      subtitle: t.loadingOverlay?.restoringBaselineDesc || 'Mengembalikan berkas instalasi awal yang murni...',
    });
    try {
      const res = await window.api.baseline.restore();
      if (res.success) {
        setNotification({
          text: t.instances.baselineRestored.replace('{count}', String(res.restoredCount ?? 0)),
          type: 'success',
        });
        await loadInstances();
      } else {
        setNotification({ text: res.error || 'Gagal memulihkan baseline', type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    } finally {
      setOperationBusy({ isOpen: false, title: '' });
    }
  };

  const handleRemoveModpackProfile = async (profileId: string, profileName: string) => {
    if (!window.confirm(t.instances.confirmDeleteProfile.replace('{name}', profileName))) return;
    try {
      const res = await window.api.modpack.removeProfile(profileId);
      if (res.success) {
        setNotification({ text: t.instances.profileDeleted, type: 'success' });
        loadInstances();
      } else {
        setNotification({ text: res.error || 'Gagal menghapus profil modpack', type: 'error' });
      }
    } catch (err: any) {
      setNotification({ text: err.message, type: 'error' });
    }
  };

  const handleDeleteInstance = (inst: InstanceItem) => {
    setInstanceToDelete(inst);
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

          {activeInstance && (
            <button
              onClick={() => setExportModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              <span>{t.export.triggerBtn}</span>
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
        {/* ❖ STATUS INSTANCE (CLI Parity Box) */}
        {instanceStatus && (
          <div className="border border-emerald-primary/40 bg-obsidian-card/90 rounded-md p-3.5 space-y-2.5 shadow-sm font-sans">
            <div className="flex items-center justify-between border-b border-obsidian-border/80 pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-emerald-primary font-bold text-xs font-mono tracking-wider flex items-center space-x-1.5">
                  <span className="text-sm">❖</span>
                  <span>STATUS INSTANCE</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-dark/30 border border-emerald-primary/40 text-emerald-active font-mono uppercase font-semibold">
                  {instanceStatus.mode === 'modpack' ? `Modpack (${instanceStatus.activeContainer ?? 'wadah'})` : 'Default'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-nordic-muted">
                CLI Parity
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-nordic-muted">Instance :</span>
                <span className="font-bold text-emerald-primary">{instanceStatus.instanceName}</span>
              </div>
              <span className="text-nordic-muted hidden md:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-nordic-muted">Mode :</span>
                <span className="font-semibold text-nordic-text">
                  {instanceStatus.mode === 'modpack'
                    ? `modpack (${instanceStatus.activeContainer ?? 'wadah'})`
                    : 'default'}
                </span>
              </div>
              <span className="text-nordic-muted hidden md:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-nordic-muted">Loader :</span>
                <span className="font-semibold text-emerald-muted capitalize">
                  {instanceStatus.loader} {instanceStatus.gameVersion}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs border-t border-obsidian-border/40 pt-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-nordic-muted">Mods :</span>
                <span className="font-bold text-emerald-primary font-mono">{instanceStatus.activeCount} Aktif</span>
                <span className="text-nordic-muted font-mono">/ {instanceStatus.modsCount} Total</span>
              </div>
              <span className="text-nordic-muted hidden md:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-nordic-muted">Storage :</span>
                <span className="font-mono text-nordic-text font-semibold">{instanceStatus.storageUsage}</span>
              </div>
              <span className="text-nordic-muted hidden md:inline">•</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-emerald-active font-semibold">
                  {instanceStatus.statusText}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeInstance?.capabilities?.supportsModeSwitch && (
          <div className="border border-obsidian-border bg-obsidian-surface rounded p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                <Boxes className="w-4 h-4 text-emerald-primary" />
                <span className="text-xs font-bold text-nordic-text font-mono uppercase">
                  {t.instances.modeSelector}
                </span>
                <span className="text-[11px] text-nordic-muted">
                  • Launcher: <strong className="text-nordic-text">{activeInstance.launcher}</strong>
                </span>
                {containers.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-obsidian-card border border-obsidian-border text-emerald-primary">
                    {(t.instances.containerCount || '{count} Wadah').replace('{count}', String(containers.length))}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                {activeInstance.mode === 'modpack' ? (
                  <button
                    onClick={() => setConfirmSwitchTarget({ mode: 'default' })}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/40 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                    title="Beralih kembali ke direktori standar .minecraft"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>{t.instances.restoreDefaultBtn || 'Kembali ke Mode Default'}</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.instances.currentlyDefault || 'Mode Default (.minecraft)'}</span>
                  </div>
                )}

                {containers.length > 3 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-nordic-muted pointer-events-none" />
                    <input
                      type="text"
                      value={containerSearch}
                      onChange={(e) => setContainerSearch(e.target.value)}
                      placeholder={t.instances.searchContainers || 'Cari wadah client...'}
                      className="pl-8 pr-3 py-1 bg-obsidian-card border border-obsidian-border rounded text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary/60 w-full sm:w-48 transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Container List (Hanya wadah buatan sendiri dan TL-Mods) */}
            {(() => {
              const visibleContainers = containers
                .filter((c) => c.isLoadModerContainer || c.isTLMods || (!c.containerName.toLowerCase().includes('default') && !c.containerName.toLowerCase().includes('official')))
                .filter((c) => {
                  if (!containerSearch.trim()) return true;
                  const q = containerSearch.toLowerCase().trim();
                  return (
                    (c.containerName && c.containerName.toLowerCase().includes(q)) ||
                    (c.loader && c.loader.toLowerCase().includes(q)) ||
                    (c.gameVersion && c.gameVersion.toLowerCase().includes(q))
                  );
                });

              if (visibleContainers.length === 0) {
                return (
                  <div className="py-4 text-center text-xs text-nordic-muted border border-dashed border-obsidian-border rounded">
                    {t.instances.noMatchingContainers || 'Belum ada wadah kustom atau TL-Mods yang terdeteksi.'}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {visibleContainers.map((c) => {
                    const isSelected =
                      activeInstance.mode === 'modpack' && activeInstance.activeContainer === c.containerName;
                    const loaderLower = (c.loader || '').toLowerCase();
                    const loaderBadgeClass =
                      loaderLower === 'fabric'
                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                        : loaderLower === 'forge'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : loaderLower === 'neoforge'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

                    return (
                      <div
                        key={c.containerName}
                        onClick={() =>
                          setConfirmSwitchTarget({
                            mode: 'modpack',
                            containerName: c.containerName,
                            loader: c.loader,
                            gameVersion: c.gameVersion,
                          })
                        }
                        className={`p-3 rounded border text-xs flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-dark/20 border-emerald-primary/70 shadow-sm'
                            : 'bg-obsidian-card border-obsidian-border text-nordic-muted hover:border-emerald-primary/40 hover:text-nordic-text'
                        }`}
                        title={c.containerName}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                              <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${loaderBadgeClass}`}>
                                {c.loader}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-obsidian-surface border border-obsidian-border text-nordic-muted">
                                MC {c.gameVersion}
                              </span>
                              {c.isTLMods && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/30">
                                  TL-Mods
                                </span>
                              )}
                              {c.isLoadModerContainer && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                                  LoadModer
                                </span>
                              )}
                            </div>

                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-primary text-obsidian-bg shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{t.common.active}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-nordic-muted">
                                {c.profilesCount > 0 ? `${c.profilesCount} profil` : 'Siap'}
                              </span>
                            )}
                          </div>

                          <div className="font-semibold text-nordic-text text-xs truncate min-w-0 mb-1" title={c.containerName}>
                            {c.containerName}
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-nordic-muted truncate min-w-0 mt-1">
                          {c.activeProfileName ? (
                            <span className="text-emerald-active truncate block">
                              Aktif: {c.activeProfileName}
                            </span>
                          ) : (
                            <span>Wadah Client Bersih</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {baselineInfo?.exists && (
          <div className="border border-emerald-500/30 bg-emerald-950/20 rounded p-3 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-emerald-300 block">
                  {t.instances.goldenBaseline}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {t.instances.goldenBaselineDesc
                    .replace('{count}', String(baselineInfo.filesCount ?? 0))
                    .replace('{date}', baselineInfo.createdAt ? new Date(baselineInfo.createdAt).toLocaleDateString() : '')}
                </span>
              </div>
            </div>

            <button
              onClick={handleRestoreBaseline}
              className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
            >
              {t.instances.restoreBaseline}
            </button>
          </div>
        )}

        {activeInstance?.mode !== 'modpack' && (
          <RestorePointsPanel
            activeInstance={activeInstance}
            onOpenSwitchModal={() => {
              setEditingInstance(activeInstance);
              setEditModalOpen(true);
            }}
            onProfileSwitched={() => {
              loadInstances();
            }}
          />
        )}

        {(modpackProfiles.length > 0 || activeInstance?.capabilities?.isTLMods) && (
          <div className="border border-obsidian-border bg-obsidian-surface rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PackageCheck className="w-4 h-4 text-emerald-primary" />
                <span className="text-xs font-bold text-nordic-text uppercase font-mono">
                  {t.instances.modpackContainers.replace('{count}', String(modpackProfiles.length))}
                </span>
                {activeInstance?.capabilities?.isTLMods && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-950/40 text-amber-400 border border-amber-500/30">
                    TL-Mods Modpack
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {activeInstance?.capabilities?.isTLMods && (
                  <button
                    onClick={handleManualSaveTLModsProfile}
                    disabled={savingTLMods}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-300 hover:bg-amber-900/50 hover:border-amber-400 transition-colors cursor-pointer disabled:opacity-50"
                    title={t.instances.manualSaveProfile}
                  >
                    <Save className={`w-3.5 h-3.5 ${savingTLMods ? 'animate-spin' : ''}`} />
                    <span>{t.instances.manualSaveProfile}</span>
                  </button>
                )}
                {modpackProfiles.length > 0 && (
                  <button
                    onClick={handleDisableModpack}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-[11px] text-nordic-muted hover:text-status-warning hover:border-status-warning/40 transition-colors cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>{t.instances.vanillaMode}</span>
                  </button>
                )}
              </div>
            </div>

            {modpackProfiles.length === 0 ? (
              <div className="py-4 text-center text-xs text-nordic-muted border border-dashed border-obsidian-border rounded">
                Belum ada arsip profil tersimpan di wadah ini. Klik &quot;Simpan Profil Manual&quot; untuk mengamankan seluruh isi modpack.
              </div>
            ) : (() => {
              const totalModpackPages = Math.max(1, Math.ceil(modpackProfiles.length / MODPACK_PAGE_SIZE));
              const validModpackPage = Math.min(Math.max(1, modpackPage), totalModpackPages);
              const pagedProfiles = modpackProfiles.slice(
                (validModpackPage - 1) * MODPACK_PAGE_SIZE,
                validModpackPage * MODPACK_PAGE_SIZE
              );

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {pagedProfiles.map((prof) => (
                      <div
                        key={prof.id}
                        className={`p-2.5 rounded border text-xs flex items-center justify-between ${
                          prof.isActive
                            ? 'bg-emerald-dark/20 border-emerald-primary/60 text-emerald-active'
                            : 'bg-obsidian-card border-obsidian-border text-nordic-muted'
                        }`}
                      >
                        <div className="truncate min-w-0 mr-2">
                          <span className="font-semibold block truncate text-nordic-text" title={prof.name}>
                            {prof.name}
                          </span>
                          <span className="text-[10px] font-mono opacity-70">
                            {t.instances.filesCount.replace('{count}', String(prof.filesCount ?? 0))} • {prof.loader ?? 'modpack'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setSelectedExportProfile(prof);
                              setExportModalOpen(true);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors cursor-pointer"
                            title={t.export?.modalTitle || "Ekspor Modpack (.zip)"}
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleRemoveModpackProfile(prof.id, prof.name)}
                            className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title={t.instances.deleteProfile}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {prof.isActive && (
                            <button
                              onClick={() => handleSwitchModpackProfile(prof.id)}
                              className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors cursor-pointer"
                              title="Pulihkan / Ekstrak ulang berkas profil ini ke wadah"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

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
                      </div>
                    ))}
                  </div>

                  {totalModpackPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-obsidian-border text-xs text-nordic-muted">
                      <span className="text-[11px]">
                        {(t.instances.pageOf || 'Halaman {current} dari {total} ({count} item)')
                          .replace('{current}', String(validModpackPage))
                          .replace('{total}', String(totalModpackPages))
                          .replace('{count}', String(modpackProfiles.length))}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setModpackPage((p) => Math.max(1, p - 1))}
                          disabled={validModpackPage <= 1}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-text hover:text-emerald-primary disabled:opacity-40 disabled:hover:text-nordic-text transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-semibold"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>{t.instances.previousPage || 'Sebelumnya'}</span>
                        </button>
                        <span className="px-2 font-mono text-[11px] text-emerald-primary font-bold">
                          {validModpackPage} / {totalModpackPages}
                        </span>
                        <button
                          onClick={() => setModpackPage((p) => Math.min(totalModpackPages, p + 1))}
                          disabled={validModpackPage >= totalModpackPages}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-text hover:text-emerald-primary disabled:opacity-40 disabled:hover:text-nordic-text transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-semibold"
                        >
                          <span>{t.instances.nextPage || 'Selanjutnya'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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
                          {(isActive ? (activeInstance?.gameVersion ?? inst.gameVersion) : inst.gameVersion) ?? t.instances.autoDetect}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Cpu className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span>{t.instances.loaderLabel}</span>
                        <span className="font-mono text-nordic-text font-medium capitalize">
                          {(isActive ? (activeInstance?.loader ?? inst.loader) : inst.loader) ?? t.instances.universal}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Boxes className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span>Mode:</span>
                        <span className="font-mono text-nordic-text font-medium">
                          {isActive && instanceStatus
                            ? (instanceStatus.mode === 'modpack'
                                ? `modpack (${instanceStatus.activeContainer ?? 'wadah'})`
                                : 'default')
                            : (inst.mode === 'modpack'
                                ? `modpack (${inst.activeContainer ?? 'wadah'})`
                                : (inst.mode ?? 'default'))}
                        </span>
                      </div>
                      {isActive && instanceStatus && (
                        <div className="flex items-center space-x-2 text-nordic-muted">
                          <PackageCheck className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                          <span>Mods:</span>
                          <span className="font-mono text-emerald-primary font-medium">
                            {instanceStatus.activeCount} Aktif / {instanceStatus.modsCount} Total
                          </span>
                          <span>•</span>
                          <span className="font-mono text-nordic-text font-medium">
                            {instanceStatus.storageUsage}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2 text-nordic-muted">
                        <Folder className="w-3.5 h-3.5 shrink-0 text-emerald-muted" />
                        <span className="truncate font-mono text-[10px]">
                          {inst.rootDir}
                        </span>
                      </div>
                      {(inst.resourcepacksDir || inst.shaderpacksDir || inst.modpacksDir) && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {inst.resourcepacksDir && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-obsidian-surface border border-obsidian-border text-emerald-muted">
                              RP: Kustom
                            </span>
                          )}
                          {inst.shaderpacksDir && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-obsidian-surface border border-obsidian-border text-emerald-muted">
                              Shader: Kustom
                            </span>
                          )}
                          {inst.modpacksDir && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-obsidian-surface border border-obsidian-border text-emerald-muted">
                              Wadah: Kustom
                            </span>
                          )}
                        </div>
                      )}
                      {isActive && instanceStatus && (
                        <div className="pt-1 border-t border-obsidian-border/50 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-active font-semibold flex items-center space-x-1">
                            <span>{instanceStatus.statusText}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-obsidian-border flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenFolder(inst.rootDir)}
                        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
                        title={t.instances.openFolderTooltip}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>{t.instances.openFolderBtn}</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingInstance(inst);
                          setEditModalOpen(true);
                        }}
                        className="flex items-center space-x-1 px-2 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
                        title={t.instances.editVersionLoader}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setPathsInstance(inst);
                          setPathsModalOpen(true);
                        }}
                        className="flex items-center space-x-1 px-2 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
                        title={t.instances.configurePathsTooltip}
                      >
                        <Folder className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteInstance(inst)}
                        className="flex items-center space-x-1 px-2 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-xs text-red-400/80 hover:text-red-400 hover:border-red-500/40 hover:bg-red-950/20 transition-colors cursor-pointer"
                        title={t.instances.deleteInstance}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

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

      <ExportModpackModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setSelectedExportProfile(null);
        }}
        instanceName={activeInstance?.name}
        targetProfile={selectedExportProfile}
        mode={activeInstance?.mode || 'default'}
        defaultLoader={activeInstance?.loader}
        defaultGameVersion={activeInstance?.gameVersion}
      />

      <EditVersionLoaderModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingInstance(null);
        }}
        instance={editingInstance}
        onSaved={loadInstances}
      />

      <ConfigurePathsModal
        isOpen={pathsModalOpen}
        onClose={() => {
          setPathsModalOpen(false);
          setPathsInstance(null);
        }}
        instance={pathsInstance}
        onSaved={loadInstances}
      />

      <SwitchModeModal
        isOpen={Boolean(confirmSwitchTarget)}
        onClose={() => setConfirmSwitchTarget(null)}
        targetMode={confirmSwitchTarget?.mode || 'default'}
        targetContainer={confirmSwitchTarget?.containerName}
        targetLoader={confirmSwitchTarget?.loader}
        targetGameVersion={confirmSwitchTarget?.gameVersion}
        onConfirm={() => {
          if (confirmSwitchTarget) {
            handleSwitchMode(confirmSwitchTarget.mode, confirmSwitchTarget.containerName);
          }
        }}
      />

      <DeleteInstanceModal
        isOpen={Boolean(instanceToDelete)}
        onClose={() => setInstanceToDelete(null)}
        instance={instanceToDelete}
        onDeleted={() => {
          if (instanceToDelete) {
            setNotification({
              text: (t.instances.instanceDeleted || 'Profil launcher "{name}" berhasil dihapus.').replace('{name}', instanceToDelete.name),
              type: 'success',
            });
          }
          loadInstances();
        }}
      />

      <OperationLoadingOverlay
        {...operationBusy}
        onEmergencyUnlock={() => setOperationBusy({ isOpen: false, title: '' })}
      />
    </div>
  );
};
