import React, { useState, useEffect } from 'react';
import {
  Layers,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRightLeft,
  Save,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import { OperationLoadingOverlay } from './OperationLoadingOverlay.js';

interface SnapshotItem {
  snapshotId: string;
  instanceName?: string;
  gameVersion?: string;
  loader?: string;
  createdAt: string;
  note?: string;
  modsCount: number;
  activeCount: number;
}

interface RestorePointsPanelProps {
  activeInstance: any | null;
  onOpenSwitchModal?: () => void;
  onProfileSwitched?: () => void;
}

export const RestorePointsPanel: React.FC<RestorePointsPanelProps> = ({
  activeInstance,
  onOpenSwitchModal,
  onProfileSwitched,
}) => {
  const { t } = useLanguage();
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;
  const [panelBusy, setPanelBusy] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    detail?: string;
  }>({
    isOpen: false,
    title: '',
  });

  const loadSnapshots = async () => {
    if (!activeInstance) return;
    setLoading(true);
    try {
      const list = await window.api.snapshots.list();
      setSnapshots(list ?? []);
    } catch {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [activeInstance?.id, activeInstance?.rootDir, activeInstance?.gameVersion, activeInstance?.loader]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => {
        setNotice(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const handleSaveCurrent = async () => {
    if (!activeInstance) return;
    setSaving(true);
    setNotice(null);
    setPanelBusy({
      isOpen: true,
      title: t.loadingOverlay?.savingVersionTitle || 'Menyimpan Profil Versi',
      subtitle: t.loadingOverlay?.savingVersionDesc || 'Menyimpan mod aktif ke arsip profil versi...',
      detail: `${activeInstance?.loader?.toUpperCase() ?? 'MOD'} ${activeInstance?.gameVersion ?? ''}`,
    });
    try {
      const res = await window.api.snapshots.saveCurrent();
      if (res.success) {
        setNotice({ text: t.snapshots.createSuccess, type: 'success' });
        await loadSnapshots();
      } else {
        setNotice({ text: res.error || 'Gagal menyimpan profil versi.', type: 'error' });
      }
    } catch (err: any) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
      setPanelBusy({ isOpen: false, title: '' });
    }
  };

  const handleSwitchProfile = async (loader: string, gameVersion: string) => {
    const confirmMsg = t.snapshots.confirmSwitch
      .replace('{loader}', loader.toUpperCase())
      .replace('{version}', gameVersion);
    if (!window.confirm(confirmMsg)) return;

    const snapKey = `${loader}-${gameVersion}`;
    setSwitchingId(snapKey);
    setNotice(null);
    setPanelBusy({
      isOpen: true,
      title: t.loadingOverlay?.switchingVersionTitle || 'Mengalihkan Profil Versi Game',
      subtitle: t.loadingOverlay?.switchingVersionDesc || 'Mengarsipkan mod versi sebelumnya dan memulihkan mod versi target...',
      detail: `${loader.toUpperCase()} ${gameVersion}`,
    });
    try {
      const res = await window.api.snapshots.switchProfile(loader, gameVersion);
      if (res.success) {
        setNotice({
          text: t.snapshots.restoreSuccess.replace('{count}', String(res.restoredCount ?? 0)),
          type: 'success',
        });
        await loadSnapshots();
        onProfileSwitched?.();
      } else {
        setNotice({ text: res.error || 'Gagal mengalihkan profil versi.', type: 'error' });
      }
    } catch (err: any) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setSwitchingId(null);
      setPanelBusy({ isOpen: false, title: '' });
    }
  };

  const handleDelete = async (snapshotId: string, label: string) => {
    const confirmMsg = t.snapshots.confirmDelete.replace('{name}', label);
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await window.api.snapshots.delete(snapshotId);
      if (res.success) {
        setNotice({ text: t.snapshots.deleteSuccess, type: 'success' });
        loadSnapshots();
      }
    } catch (err: any) {
      setNotice({ text: err.message, type: 'error' });
    }
  };

  if (!activeInstance) return null;

  return (
    <div className="border border-obsidian-border bg-obsidian-surface rounded p-4 space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Layers className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-nordic-text uppercase tracking-wider font-mono">
              {t.snapshots.title}
            </h3>
            <p className="text-[11px] text-nordic-muted mt-0.5 max-w-xl leading-relaxed">
              {t.snapshots.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveCurrent}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title={t.snapshots.saveCurrentBtn}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{t.snapshots.saveCurrentBtn}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSwitchModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-primary text-obsidian-bg text-xs font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
            title={t.snapshots.switchVersionBtn}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{t.snapshots.switchVersionBtn}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-2.5 rounded text-xs flex items-center gap-2 border ${
            notice.type === 'success'
              ? 'bg-emerald-dark/30 text-emerald-active border-emerald-primary/40'
              : 'bg-status-danger/10 text-status-danger border-status-danger/30'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-primary shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-status-danger shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="py-6 flex items-center justify-center space-x-2 text-xs text-nordic-muted">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-primary" />
          <span>Memuat profil versi...</span>
        </div>
      ) : snapshots.length === 0 ? (
        <div className="py-4 text-center text-xs text-nordic-muted border border-dashed border-obsidian-border rounded">
          {t.snapshots.emptySnapshots}
        </div>
      ) : (() => {
        const sorted = [...snapshots].sort((a, b) => {
          const loaderA = (a.loader || '').toLowerCase();
          const loaderB = (b.loader || '').toLowerCase();
          if (loaderA !== loaderB) {
            return loaderA.localeCompare(loaderB);
          }

          const verA = a.gameVersion || '';
          const verB = b.gameVersion || '';
          if (verA !== verB) {
            const partsA = verA.split('.').map((n) => parseInt(n, 10) || 0);
            const partsB = verB.split('.').map((n) => parseInt(n, 10) || 0);
            const maxLen = Math.max(partsA.length, partsB.length);
            for (let i = 0; i < maxLen; i++) {
              const numA = partsA[i] ?? 0;
              const numB = partsB[i] ?? 0;
              if (numA !== numB) {
                return numB - numA;
              }
            }
            return verB.localeCompare(verA);
          }

          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
          return a.snapshotId.localeCompare(b.snapshotId);
        });

        const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
        const validPage = Math.min(Math.max(1, currentPage), totalPages);
        const pagedSnapshots = sorted.slice((validPage - 1) * PAGE_SIZE, validPage * PAGE_SIZE);

        return (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {pagedSnapshots.map((snap) => {
                const snapLoader = (snap.loader || 'fabric').toLowerCase();
                const snapVersion = snap.gameVersion || 'unknown';
                const isSwitching = switchingId === `${snapLoader}-${snapVersion}`;

                const activeLoader = (activeInstance?.loader || '').toLowerCase();
                const activeVersion = (activeInstance?.gameVersion || '').toLowerCase();
                const isActive =
                  activeLoader && activeVersion && snapLoader === activeLoader && snapVersion === activeVersion;

                const dateStr = snap.createdAt ? new Date(snap.createdAt).toLocaleDateString() : '-';

                return (
                  <div
                    key={snap.snapshotId}
                    className={`p-3 rounded border text-xs flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-emerald-dark/20 border-emerald-primary/60 text-emerald-active shadow-sm'
                        : 'bg-obsidian-card border-obsidian-border text-nordic-muted hover:border-obsidian-hover'
                    }`}
                  >
                    <div className="truncate min-w-0 mr-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-nordic-text uppercase font-mono text-xs">
                          {snap.loader || 'Fabric'} {snap.gameVersion}
                        </span>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-dark/40 border border-emerald-primary/40 text-emerald-active">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t.snapshots.currentActiveBadge}</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-obsidian-surface border border-obsidian-border text-nordic-muted">
                            {t.snapshots.savedBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-nordic-muted font-mono flex items-center gap-2">
                        <span>{t.snapshots.modsCount.replace('{count}', String(snap.modsCount ?? 0))}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive ? (
                        <span className="px-2.5 py-1 rounded bg-emerald-primary/20 border border-emerald-primary/40 text-emerald-active text-[11px] font-semibold cursor-default">
                          {t.snapshots.currentInUseBtn}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSwitchProfile(snap.loader || 'fabric', snap.gameVersion || '1.20.1')}
                          disabled={isSwitching}
                          title={t.snapshots.switchBtn}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-obsidian-surface hover:bg-emerald-dark/30 text-nordic-text hover:text-emerald-primary border border-obsidian-border hover:border-emerald-primary/40 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSwitching ? 'animate-spin' : ''}`} />
                          <span>{isSwitching ? t.snapshots.switching : t.snapshots.switchBtn}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(snap.snapshotId, `${snap.loader} ${snap.gameVersion}`)}
                        title={t.snapshots.deleteBtn}
                        className="p-1.5 rounded text-nordic-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-obsidian-border text-xs text-nordic-muted">
                <span className="text-[11px]">
                  {(t.snapshots.pageOf || 'Halaman {current} dari {total} ({count} profil)')
                    .replace('{current}', String(validPage))
                    .replace('{total}', String(totalPages))
                    .replace('{count}', String(sorted.length))}
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validPage <= 1}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-text hover:text-emerald-primary disabled:opacity-40 disabled:hover:text-nordic-text transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{t.snapshots.previousPage || 'Sebelumnya'}</span>
                  </button>
                  <span className="px-2 font-mono text-[11px] text-emerald-primary font-bold">
                    {validPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={validPage >= totalPages}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-text hover:text-emerald-primary disabled:opacity-40 disabled:hover:text-nordic-text transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-semibold"
                  >
                    <span>{t.snapshots.nextPage || 'Selanjutnya'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <OperationLoadingOverlay
        {...panelBusy}
        onEmergencyUnlock={() => setPanelBusy({ isOpen: false, title: '' })}
      />
    </div>
  );
};
