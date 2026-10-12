import React, { useState, useEffect } from 'react';
import { Package, X, RefreshCw, AlertTriangle, ShieldCheck, CheckCircle2, Folder, Layers, HardDrive } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

export interface ModpackTargetInfo {
  title: string;
  versionNumber?: string;
  loader?: string;
  gameVersion?: string;
  slugOrId?: string;
  versionId?: string;
  localFilePath?: string;
}

export interface ModpackInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetInfo: ModpackTargetInfo | null;
  onConfirm: (options: { modsOnly: boolean; cleanInstall: boolean }) => Promise<void>;
}

export const ModpackInstallModal: React.FC<ModpackInstallModalProps> = ({
  isOpen,
  onClose,
  targetInfo,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [modsOnly, setModsOnly] = useState(true);
  const [cleanInstall, setCleanInstall] = useState(true);
  const [loadingContainer, setLoadingContainer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [containerInfo, setContainerInfo] = useState<{
    containerName: string;
    containerDir: string;
    matchedLoader?: string;
    launcher?: string;
    activeProfile?: string | null;
    activeProfileName?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !targetInfo) return;

    setModsOnly(true);
    setCleanInstall(true);
    setSubmitting(false);
    setLoadingContainer(true);

    const resolve = async () => {
      try {
        if (targetInfo.localFilePath) {
          const inspected = await window.api.modpack.inspect(targetInfo.localFilePath);
          if (inspected && !inspected.error) {
            setContainerInfo({
              containerName: inspected.containerName || 'Default Container',
              containerDir: inspected.containerDir || '',
              matchedLoader: inspected.loader,
              activeProfile: inspected.activeProfile,
              activeProfileName: inspected.activeProfileName,
            });
            return;
          }
        }

        const res = await window.api.modpack.resolveContainer(
          targetInfo.loader,
          targetInfo.gameVersion
        );
        if (res) {
          setContainerInfo(res);
        }
      } catch (err) {
        console.error('Failed to resolve container info for modpack modal:', err);
      } finally {
        setLoadingContainer(false);
      }
    };

    resolve();
  }, [isOpen, targetInfo]);

  if (!isOpen || !targetInfo) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm({ modsOnly, cleanInstall });
      onClose();
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-obsidian-surface border border-obsidian-border rounded-lg shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-obsidian-border bg-obsidian-card/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-primary/10 border border-emerald-primary/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-emerald-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-nordic-text">
                {t.modpackModal.title}
              </h2>
              <p className="text-[11px] text-nordic-muted truncate max-w-xs">
                {targetInfo.title} {targetInfo.versionNumber ? `(${targetInfo.versionNumber})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded text-nordic-muted hover:text-nordic-text hover:bg-obsidian-card transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Target Container Box */}
          <div className="p-3.5 rounded bg-obsidian-card border border-obsidian-border space-y-2">
            <div className="flex items-center justify-between text-nordic-muted">
              <span className="font-semibold text-[11px] flex items-center space-x-1">
                <Folder className="w-3.5 h-3.5 text-emerald-primary" />
                <span>{t.modpackModal.targetContainer}</span>
              </span>
              {loadingContainer ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-primary" />
              ) : containerInfo?.matchedLoader ? (
                <span className="uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-dark/30 border border-emerald-primary/40 text-[10px] text-emerald-active font-semibold">
                  {containerInfo.matchedLoader}
                </span>
              ) : null}
            </div>

            {loadingContainer ? (
              <p className="text-[11px] text-nordic-muted animate-pulse">Menghitung isolasi wadah launcher...</p>
            ) : containerInfo ? (
              <div className="space-y-1">
                <div className="font-medium text-nordic-text flex items-center space-x-1.5">
                  <span className="text-emerald-primary font-bold">{containerInfo.containerName}</span>
                  {containerInfo.launcher && (
                    <span className="text-nordic-muted text-[10px]">({containerInfo.launcher})</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-nordic-muted truncate" title={containerInfo.containerDir}>
                  {containerInfo.containerDir}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-status-warning">Wadah otomatis launcher aktif</p>
            )}
          </div>

          {/* Active Conflict Warning */}
          {containerInfo?.activeProfile && (
            <div className="p-3 rounded bg-amber-950/20 border border-amber-600/40 space-y-2">
              <div className="flex items-start space-x-2 text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-[11px]">{t.modpackModal.conflictWarning}</p>
                  <p className="text-[11px] text-amber-400/80">
                    {t.modpackModal.activeProfilePrefix} <span className="font-bold text-amber-300">{containerInfo.activeProfileName || containerInfo.activeProfile}</span>
                  </p>
                </div>
              </div>
              <label className="flex items-start space-x-2 pt-1 border-t border-amber-600/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanInstall}
                  onChange={(e) => setCleanInstall(e.target.checked)}
                  className="mt-0.5 rounded border-amber-600/50 text-emerald-primary focus:ring-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-amber-200 font-medium text-[11px] block">{t.modpackModal.cleanInstall}</span>
                  <span className="text-amber-300/70 text-[10px] block leading-tight">{t.modpackModal.cleanInstallHint}</span>
                </div>
              </label>
            </div>
          )}

          {/* Install Mode Selection */}
          <div className="space-y-2">
            <span className="font-semibold text-nordic-text text-[11px] block">
              {t.modpackModal.installMode}
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Mods Only */}
              <div
                onClick={() => setModsOnly(true)}
                className={`p-3 rounded border transition-all cursor-pointer flex items-start space-x-3 ${
                  modsOnly
                    ? 'bg-emerald-dark/15 border-emerald-primary text-nordic-text'
                    : 'bg-obsidian-card border-obsidian-border text-nordic-muted hover:border-emerald-primary/40'
                }`}
              >
                <div className="mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      modsOnly
                        ? 'border-emerald-primary bg-emerald-primary text-obsidian-bg'
                        : 'border-nordic-muted/50'
                    }`}
                  >
                    {modsOnly && <div className="w-1.5 h-1.5 rounded-full bg-obsidian-bg" />}
                  </div>
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-nordic-text">
                      {t.modpackModal.modsOnlyTitle}
                    </span>
                  </div>
                  <p className="text-[11px] text-nordic-muted leading-relaxed">
                    {t.modpackModal.modsOnlyDesc}
                  </p>
                </div>
              </div>

              {/* Option 2: Full Modpack */}
              <div
                onClick={() => setModsOnly(false)}
                className={`p-3 rounded border transition-all cursor-pointer flex items-start space-x-3 ${
                  !modsOnly
                    ? 'bg-emerald-dark/15 border-emerald-primary text-nordic-text'
                    : 'bg-obsidian-card border-obsidian-border text-nordic-muted hover:border-emerald-primary/40'
                }`}
              >
                <div className="mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      !modsOnly
                        ? 'border-emerald-primary bg-emerald-primary text-obsidian-bg'
                        : 'border-nordic-muted/50'
                    }`}
                  >
                    {!modsOnly && <div className="w-1.5 h-1.5 rounded-full bg-obsidian-bg" />}
                  </div>
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-nordic-text">
                      {t.modpackModal.fullTitle}
                    </span>
                  </div>
                  <p className="text-[11px] text-nordic-muted leading-relaxed">
                    {t.modpackModal.fullDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-obsidian-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
            >
              {t.modpackModal.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={submitting || loadingContainer}
              className="px-4 py-1.5 rounded bg-emerald-primary text-obsidian-bg text-xs font-semibold hover:bg-emerald-active transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.modpackModal.installing}</span>
                </>
              ) : (
                <span>{t.modpackModal.confirmBtn}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

