import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

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
  const { t } = useLanguage();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [assetType, setAssetType] = useState<'mods' | 'shaders' | 'resourcepacks'>('mods');
  const [mods, setMods] = useState<ModItem[]>([]);
  const [packs, setPacks] = useState<PackItem[]>([]);
  const [updates, setUpdates] = useState<Record<string, UpdateItem>>({});
  const [loading, setLoading] = useState(true);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'updates'>('all');
  const [storageUsage, setStorageUsage] = useState('0 B');
  const [activeCount, setActiveCount] = useState(0);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Features: Modpack Mode, Sorting & Pagination
  const [isModpackMode, setIsModpackMode] = useState(false);
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'>('name-asc');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // In-app Delete Confirmation Modal (solves search bar freeze bug completely)
  const [deleteTarget, setDeleteTarget] = useState<{ fileName: string; type: 'mod' | 'shader' | 'resourcepack' } | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

  const assetTypeName = useMemo(() => {
    if (assetType === 'mods') return t.topbar.mods;
    if (assetType === 'shaders') return t.mods.tabShaders;
    return t.mods.tabResourcepacks;
  }, [assetType, t]);

  const fetchMods = async () => {
    setLoading(true);
    try {
      const instData = await window.api.instances.getAll();
      setIsModpackMode(instData?.active?.mode === 'modpack');

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

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, assetType, sortBy, pageSize]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleOpenFolder = async () => {
    try {
      const data = await window.api.instances.getAll();
      const active = data?.active;
      if (!active?.rootDir) {
        showNotification(t.mods.noActiveInstance, 'error');
        return;
      }
      let folderToOpen = active.modsDir;
      const baseDir =
        active.mode === 'modpack' && active.modsDir
          ? active.modsDir.substring(0, Math.max(active.modsDir.lastIndexOf('\\'), active.modsDir.lastIndexOf('/')))
          : active.rootDir;

      if (assetType === 'shaders') {
        folderToOpen = active.mode === 'modpack' ? `${baseDir}\\shaderpacks` : (active.shaderpacksDir || `${active.rootDir}\\shaderpacks`);
      } else if (assetType === 'resourcepacks') {
        folderToOpen = active.mode === 'modpack' ? `${baseDir}\\resourcepacks` : (active.resourcepacksDir || `${active.rootDir}\\resourcepacks`);
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
        const msg = nextState
          ? t.mods.statusEnabled.replace('{name}', mod.name)
          : t.mods.statusDisabled.replace('{name}', mod.name);
        showNotification(msg);
      } else {
        showNotification(res.error ?? t.mods.toggleFailed, 'error');
        fetchMods();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
      fetchMods();
    }
  };

  const initiateDelete = (fileName: string) => {
    const type = assetType === 'mods' ? 'mod' : assetType === 'shaders' ? 'shader' : 'resourcepack';
    setDeleteTarget({ fileName, type });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingFile(true);
    try {
      const res = await window.api.mods.remove(deleteTarget.fileName, true, undefined, deleteTarget.type);
      if (res.success) {
        showNotification(t.mods.deleteSuccess.replace('{file}', deleteTarget.fileName));
        if (deleteTarget.type === 'mod') {
          setMods((prev) => prev.filter((m) => m.fileName !== deleteTarget.fileName));
          setActiveCount((c) => Math.max(0, c - 1));
        } else {
          setPacks((prev) => prev.filter((p) => p.fileName !== deleteTarget.fileName));
        }
      } else {
        showNotification(res.error ?? t.mods.deleteFailed, 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setDeletingFile(false);
      setDeleteTarget(null);
      // Restore search input focus smoothly without freezing
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleCheckUpdates = async () => {
    if (isModpackMode) return;
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
        showNotification(t.mods.allUpToDate.replace('{count}', String(mods.length)).replace('{info}', info));
      } else {
        showNotification(t.mods.updatesFound.replace('{count}', String(list.length)));
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
        showNotification(t.mods.updateSuccess.replace('{file}', item.nextFileName));
        setUpdates((prev) => {
          const next = { ...prev };
          delete next[item.currentFile];
          return next;
        });
        fetchMods();
      } else {
        showNotification(res.error ?? t.mods.updateFailed, 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleApplyAllUpdates = async () => {
    if (isModpackMode) return;
    const updateCount = Object.keys(updates).length;
    if (updateCount === 0) return;

    const confirmed = window.confirm(
      t.mods.updateAllConfirm.replace('{count}', String(updateCount))
    );
    if (!confirmed) return;

    setUpdatingAll(true);
    try {
      const res = await window.api.mods.applyAllUpdates();
      if (res.success) {
        showNotification(
          t.mods.updateAllSuccess.replace('{count}', String(res.updatedCount))
        );
        setUpdates({});
        if (statusFilter === 'updates') {
          setStatusFilter('all');
        }
        await fetchMods();
      } else {
        showNotification(res.error ?? t.mods.updateFailed, 'error');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setUpdatingAll(false);
    }
  };

  // Filter and Sort mods
  const filteredAndSortedMods = useMemo(() => {
    const list = mods.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'active') return m.enabled;
      if (statusFilter === 'disabled') return !m.enabled;
      if (statusFilter === 'updates') return !!updates[m.fileName];
      return true;
    });

    if (sortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'size-desc') {
      list.sort((a, b) => b.size - a.size);
    } else if (sortBy === 'size-asc') {
      list.sort((a, b) => a.size - b.size);
    }

    return list;
  }, [mods, searchQuery, statusFilter, updates, sortBy]);

  // Filter and Sort packs
  const filteredAndSortedPacks = useMemo(() => {
    const list = packs.filter((p) =>
      p.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'name-asc') {
      list.sort((a, b) => a.fileName.localeCompare(b.fileName));
    } else if (sortBy === 'name-desc') {
      list.sort((a, b) => b.fileName.localeCompare(a.fileName));
    } else if (sortBy === 'size-desc') {
      list.sort((a, b) => b.size - a.size);
    } else if (sortBy === 'size-asc') {
      list.sort((a, b) => a.size - b.size);
    }

    return list;
  }, [packs, searchQuery, sortBy]);

  // Pagination calculation
  const totalItems = assetType === 'mods' ? filteredAndSortedMods.length : filteredAndSortedPacks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedMods = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedMods.slice(start, start + pageSize);
  }, [filteredAndSortedMods, safeCurrentPage, pageSize]);

  const paginatedPacks = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedPacks.slice(start, start + pageSize);
  }, [filteredAndSortedPacks, safeCurrentPage, pageSize]);

  const startItemIdx = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItemIdx = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* Top Toolbar */}
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex flex-wrap items-center justify-between gap-3">
        {/* Asset Type Tabs */}
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
              <span>{t.mods.tabMods}</span>
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
              <span>{t.mods.tabShaders}</span>
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
              <span>{t.mods.tabResourcepacks}</span>
            </button>
          </div>
        </div>

        {/* Search input with ref focus guard */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-nordic-muted pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.mods.searchPlaceholder.replace('{type}', assetTypeName)}
            className="w-full bg-obsidian-card border border-obsidian-border rounded pl-9 pr-3 py-1.5 text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary transition-colors"
          />
        </div>

        {/* Sort & Filter controls */}
        <div className="flex items-center space-x-2">
          {/* Sort Dropdown */}
          <div className="flex items-center space-x-1 bg-obsidian-card border border-obsidian-border rounded px-2 py-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-nordic-muted shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-nordic-text focus:outline-none cursor-pointer pr-1"
              title={t.mods.sortBy}
            >
              <option value="name-asc" className="bg-obsidian-card text-nordic-text">{t.mods.sortNameAsc}</option>
              <option value="name-desc" className="bg-obsidian-card text-nordic-text">{t.mods.sortNameDesc}</option>
              <option value="size-desc" className="bg-obsidian-card text-nordic-text">{t.mods.sortSizeDesc}</option>
              <option value="size-asc" className="bg-obsidian-card text-nordic-text">{t.mods.sortSizeAsc}</option>
            </select>
          </div>

          {assetType === 'mods' && (
            <>
              {/* Status filter tabs */}
              <div className="flex items-center bg-obsidian-card border border-obsidian-border rounded p-0.5 text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                      : 'text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  {t.mods.filterAll} ({mods.length})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    statusFilter === 'active'
                      ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                      : 'text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  {t.mods.filterActive} ({activeCount})
                </button>
                <button
                  onClick={() => setStatusFilter('disabled')}
                  className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                    statusFilter === 'disabled'
                      ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                      : 'text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  {t.mods.filterDisabled} ({mods.length - activeCount})
                </button>
                {Object.keys(updates).length > 0 && !isModpackMode && (
                  <button
                    onClick={() => setStatusFilter('updates')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                      statusFilter === 'updates'
                        ? 'bg-status-warning text-obsidian-bg font-semibold'
                        : 'text-status-warning hover:bg-status-warning/10'
                    }`}
                  >
                    {t.mods.filterUpdates} ({Object.keys(updates).length})
                  </button>
                )}
              </div>

              {/* Modpack Mode Guard: Hide Check Updates if in modpack mode */}
              {isModpackMode ? (
                <div
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-medium cursor-help"
                  title={t.mods.modpackUpdateDisabled}
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.mods.modpackModeBadge}</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleCheckUpdates}
                    disabled={checkingUpdates || updatingAll}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer disabled:opacity-50"
                    title={t.mods.checkUpdatesTooltip}
                  >
                    <ArrowUpCircle className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin text-emerald-primary' : ''}`} />
                    <span>{t.mods.checkUpdates}</span>
                  </button>

                  {Object.keys(updates).length > 0 && (
                    <button
                      onClick={handleApplyAllUpdates}
                      disabled={updatingAll || checkingUpdates}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-status-warning/20 border border-status-warning/40 text-xs text-status-warning hover:bg-status-warning hover:text-obsidian-bg transition-colors cursor-pointer disabled:opacity-50 font-semibold"
                      title={t.mods.updateAllTooltip}
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${updatingAll ? 'animate-spin' : ''}`} />
                      <span>
                        {updatingAll
                          ? t.mods.updatingAll
                          : t.mods.updateAll.replace('{count}', String(Object.keys(updates).length))}
                      </span>
                    </button>
                  )}
                </>
              )}
            </>
          )}

          <button
            onClick={handleOpenFolder}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title={t.mods.openFolderTooltip.replace('{type}', assetTypeName)}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{t.mods.openFolder}</span>
          </button>

          <button
            onClick={fetchMods}
            disabled={loading}
            className="p-1.5 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
            title={t.mods.refreshTooltip}
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

      {/* Main Asset Table View */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-nordic-muted">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span className="text-xs">{t.mods.scanning.replace('{type}', assetTypeName)}</span>
          </div>
        ) : assetType === 'mods' ? (
          filteredAndSortedMods.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 space-y-3 text-center">
              <Package className="w-10 h-10 text-nordic-muted/50" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-nordic-text">
                  {searchQuery ? t.mods.emptySearchTitle : t.mods.emptyModsTitle}
                </p>
                <p className="text-xs text-nordic-muted max-w-sm">
                  {searchQuery ? t.mods.emptySearchDesc : t.mods.emptyModsDesc}
                </p>
              </div>
              {!searchQuery && onGoToExplore && (
                <button
                  onClick={onGoToExplore}
                  className="mt-2 px-3 py-1.5 rounded bg-emerald-primary text-obsidian-bg text-xs font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
                >
                  {t.mods.browseCatalogue}
                </button>
              )}
            </div>
          ) : (
            <div className="border border-obsidian-border rounded overflow-hidden bg-obsidian-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-obsidian-border bg-obsidian-surface text-nordic-muted font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-12 text-center">{t.mods.colStatus}</th>
                    <th className="py-2.5 px-3">{t.mods.colName}</th>
                    <th className="py-2.5 px-3 w-32 text-center">{t.mods.colUpdate}</th>
                    <th className="py-2.5 px-3 w-28 text-right">{t.mods.colSize}</th>
                    <th className="py-2.5 px-3 w-20 text-center">{t.mods.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border">
                  {paginatedMods.map((mod) => {
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
                            title={mod.enabled ? t.mods.toggleDisable : t.mods.toggleEnable}
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
                          {updateInfo && !isModpackMode ? (
                            <button
                              onClick={() => handleApplyUpdate(updateInfo)}
                              disabled={updatingAll}
                              className="px-2 py-0.5 rounded bg-status-warning/20 border border-status-warning/40 text-status-warning hover:bg-status-warning hover:text-obsidian-bg text-[10px] font-mono font-semibold transition-colors cursor-pointer disabled:opacity-50"
                              title={t.mods.updateTo.replace('{version}', updateInfo.nextFileName)}
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
                            onClick={() => initiateDelete(mod.fileName)}
                            className="p-1 rounded text-nordic-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer"
                            title={t.mods.deleteTooltip}
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
          filteredAndSortedPacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center text-nordic-muted">
              {assetType === 'shaders' ? (
                <Sparkles className="w-8 h-8 opacity-40" />
              ) : (
                <Palette className="w-8 h-8 opacity-40" />
              )}
              <span className="text-xs">
                {t.mods.emptyPacksDesc.replace('{type}', assetTypeName)}
              </span>
            </div>
          ) : (
            <div className="border border-obsidian-border rounded overflow-hidden bg-obsidian-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-obsidian-border bg-obsidian-surface text-nordic-muted font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">{t.mods.colPackFile}</th>
                    <th className="py-2.5 px-3 w-28 text-right">{t.mods.colSize}</th>
                    <th className="py-2.5 px-3 w-20 text-center">{t.mods.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border">
                  {paginatedPacks.map((pack) => (
                    <tr key={pack.fileName} className="hover:bg-obsidian-hover/50 transition-colors">
                      <td className="py-2 px-3 font-medium text-nordic-text font-mono">
                        {pack.fileName}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-nordic-muted">
                        {pack.formattedSize}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => initiateDelete(pack.fileName)}
                          className="p-1 rounded text-nordic-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer"
                          title={t.mods.deletePackTooltip}
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

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="px-4 py-2 border-t border-obsidian-border bg-obsidian-surface/60 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-nordic-muted font-mono text-[11px]">
            <span>{t.mods.showingItems.replace('{start}', String(startItemIdx)).replace('{end}', String(endItemIdx)).replace('{total}', String(totalItems))}</span>
            <span>•</span>
            <div className="flex items-center space-x-1">
              <span>{t.mods.pageSize}:</span>
              <div className="flex items-center space-x-1 bg-obsidian-card border border-obsidian-border rounded px-1.5 py-0.5">
                {[25, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      pageSize === size
                        ? 'bg-emerald-primary text-black font-bold'
                        : 'text-nordic-muted hover:text-nordic-text'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-nordic-text px-1">
              {t.mods.pageIndicator.replace('{current}', String(safeCurrentPage)).replace('{total}', String(totalPages))}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Summary Bar */}
      <div className="h-7 border-t border-obsidian-border bg-obsidian-surface px-4 flex items-center justify-between text-[11px] text-nordic-muted font-mono">
        <div className="flex items-center space-x-3">
          {assetType === 'mods' ? (
            <>
              <span>{t.mods.footerModsCount.replace('{count}', String(mods.length))}</span>
              <span>•</span>
              <span className="text-emerald-active">{t.mods.footerActive.replace('{count}', String(activeCount))}</span>
              <span>•</span>
              <span>{t.mods.footerDisabled.replace('{count}', String(mods.length - activeCount))}</span>
            </>
          ) : (
            <span>{t.mods.footerPacksCount.replace('{count}', String(packs.length)).replace('{type}', assetTypeName)}</span>
          )}
        </div>
        <div className="flex items-center space-x-1.5">
          <HardDrive className="w-3.5 h-3.5" />
          <span>{t.mods.footerDiskUsage.replace('{size}', storageUsage)}</span>
        </div>
      </div>

      {/* Non-blocking in-app Delete Confirmation Dialog (solves Chromium input freeze) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-obsidian-surface border border-obsidian-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-lg bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-nordic-text">
                  {t.mods.confirmDeleteModalTitle}
                </h3>
                <p className="text-xs text-nordic-muted mt-1 leading-relaxed break-words font-mono">
                  {t.mods.confirmDeleteModalDesc.replace('{file}', deleteTarget.fileName)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-obsidian-border">
              <button
                onClick={cancelDelete}
                disabled={deletingFile}
                className="px-3 py-1.5 rounded text-xs text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors cursor-pointer"
              >
                {t.common.cancel || 'Batal'}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingFile}
                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {deletingFile ? (t.common.loading || 'Menghapus...') : (t.mods.deleteTooltip || 'Hapus')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
