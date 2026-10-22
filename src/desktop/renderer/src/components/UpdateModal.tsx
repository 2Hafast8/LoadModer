import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Package,
  FolderOpen,
  Info,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import { MarkdownViewer } from './MarkdownViewer.js';
import { formatBytes } from '../../../../utils/format.js';
import type { UpdateDownloadProgress } from '../../../../core/updater/downloader.js';

export interface AppUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  tagName: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  setupAsset?: {
    name: string;
    downloadUrl: string;
    size: number;
    sha256?: string;
  };
  portableAsset?: {
    name: string;
    downloadUrl: string;
    size: number;
    sha256?: string;
  };
  error?: string;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppUpdateInfo | null;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, updateInfo }) => {
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    speed: string;
    downloadedBytes: number;
    totalBytes: number;
  } | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false);
      setDownloadProgress(null);
      setDownloadedFilePath(null);
      setIsInstalling(false);
      setErrorMessage(null);
      return;
    }

    const unsubscribe = window.api.updater?.onProgress?.((progress: UpdateDownloadProgress) => {
      setDownloadProgress(progress);
    });

    return () => {
      unsubscribe?.();
    };
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const handleDownload = async (isPortable: boolean = false) => {
    const targetAsset = isPortable ? updateInfo.portableAsset : updateInfo.setupAsset;
    if (!targetAsset) {
      setErrorMessage('Asset binary not found for target release.');
      return;
    }

    setErrorMessage(null);
    setDownloading(true);
    setDownloadProgress({
      percent: 0,
      speed: '0 B/s',
      downloadedBytes: 0,
      totalBytes: targetAsset.size,
    });

    try {
      const res = await window.api.updater.download(
        targetAsset.downloadUrl,
        targetAsset.name,
        targetAsset.sha256
      );

      if (res.success && res.filePath) {
        setDownloadedFilePath(res.filePath);
      } else {
        setErrorMessage(res.error || t.updater.downloadFailed);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || t.updater.downloadFailed);
    } finally {
      setDownloading(false);
    }
  };

  const handleInstallNow = async () => {
    if (!downloadedFilePath) return;
    setIsInstalling(true);
    try {
      const res = await window.api.updater.install(downloadedFilePath);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to execute update installer.');
        setIsInstalling(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to launch installer');
      setIsInstalling(false);
    }
  };

  const handleOpenGitHub = () => {
    if (updateInfo.htmlUrl) {
      window.open(updateInfo.htmlUrl, '_blank');
    }
  };

  const handleOpenDownloadFolder = () => {
    if (downloadedFilePath) {
      const folder = downloadedFilePath.substring(0, Math.max(downloadedFilePath.lastIndexOf('\\'), downloadedFilePath.lastIndexOf('/')));
      window.api.instances.openFolder(folder || downloadedFilePath);
    }
  };

  const publishedDateFormatted = updateInfo.publishedAt
    ? new Date(updateInfo.publishedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-obsidian-surface border border-obsidian-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-obsidian-border flex items-center justify-between bg-obsidian-card/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-tint border border-emerald-primary/30 flex items-center justify-center text-emerald-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-nordic-text">
                {updateInfo.updateAvailable ? t.updater.newVersionTitle : t.updater.upToDate}
              </h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-[11px] text-nordic-muted">
                  {t.updater.currentVersion}: <span className="font-mono text-nordic-text">v{updateInfo.currentVersion}</span>
                </span>
                <span className="text-obsidian-border">•</span>
                <span className="text-[11px] text-nordic-muted">
                  {t.updater.latestVersion}:{' '}
                  <span className="font-mono text-emerald-active font-semibold">
                    v{updateInfo.latestVersion}
                  </span>
                </span>
                {publishedDateFormatted && (
                  <>
                    <span className="text-obsidian-border">•</span>
                    <span className="text-[11px] text-nordic-muted">
                      {t.updater.publishedOn} {publishedDateFormatted}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={downloading || isInstalling}
            className="p-1 rounded text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Status Banners */}
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg flex items-start space-x-2.5 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">{t.updater.downloadFailed}</div>
                <div className="text-[11px] text-red-300/80 mt-0.5">{errorMessage}</div>
              </div>
            </div>
          )}

          {downloadedFilePath && !errorMessage && (
            <div className="p-3.5 bg-emerald-tint border border-emerald-primary/40 rounded-lg flex items-start space-x-3 text-xs text-emerald-active">
              <CheckCircle2 className="w-5 h-5 text-emerald-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-sm text-nordic-text">
                  {t.updater.readyToInstall}
                </div>
                <div className="text-[11px] text-nordic-muted mt-0.5">
                  {downloadedFilePath.toLowerCase().includes('portable')
                    ? t.updater.portableReadyDesc
                    : t.updater.readyToInstallDesc}
                </div>
                {downloadedFilePath.toLowerCase().includes('portable') && (
                  <button
                    onClick={handleOpenDownloadFolder}
                    className="mt-2.5 flex items-center space-x-1.5 px-3 py-1 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-primary" />
                    <span>{t.updater.openDownloadFolder}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SmartScreen guidance notice */}
          <div className="p-3 bg-obsidian-card/60 border border-obsidian-border rounded-lg text-[11px] text-nordic-muted flex items-start space-x-2">
            <Info className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-nordic-text">{t.updater.smartScreenTitle}</span>{' '}
              {t.updater.smartScreenDesc}
            </div>
          </div>

          {/* Download Progress Bar */}
          {downloading && downloadProgress && (
            <div className="p-4 bg-obsidian-card border border-emerald-primary/20 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-nordic-text font-medium">
                  <Loader2 className="w-3.5 h-3.5 text-emerald-primary animate-spin" />
                  <span>{t.updater.downloading}</span>
                </div>
                <div className="font-mono text-emerald-active font-semibold">
                  {downloadProgress.percent}%
                </div>
              </div>

              {/* Progress track */}
              <div className="w-full bg-obsidian-border rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-primary h-2 rounded-full transition-all duration-200"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-nordic-muted">
                <span>
                  {formatBytes(downloadProgress.downloadedBytes)} / {formatBytes(downloadProgress.totalBytes)}
                </span>
                <span>{downloadProgress.speed}</span>
              </div>
            </div>
          )}

          {/* Release Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-nordic-text uppercase tracking-wider">
                {t.updater.releaseNotes}
              </span>
              {updateInfo.setupAsset?.sha256 && (
                <div className="flex items-center space-x-1 text-[10px] text-nordic-muted" title={updateInfo.setupAsset.sha256}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-primary" />
                  <span>SHA-256 Verified</span>
                </div>
              )}
            </div>

            <div className="max-h-[260px] overflow-y-auto bg-obsidian-bg p-4 rounded-lg border border-obsidian-border text-xs leading-relaxed">
              <MarkdownViewer content={updateInfo.releaseNotes || t.updater.noReleaseNotes} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-obsidian-border bg-obsidian-card/40 flex items-center justify-between">
          <button
            onClick={handleOpenGitHub}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t.updater.viewOnGitHub}</span>
          </button>

          <div className="flex items-center space-x-2">
            {!downloadedFilePath && !downloading && (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded text-xs text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors"
                >
                  {t.updater.later}
                </button>

                {updateInfo.portableAsset && (
                  <button
                    onClick={() => handleDownload(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-text hover:border-emerald-primary/40 transition-colors"
                    title={updateInfo.portableAsset.name}
                  >
                    <Package className="w-3.5 h-3.5 text-nordic-muted" />
                    <span>{t.updater.downloadPortable}</span>
                  </button>
                )}

                {updateInfo.setupAsset && (
                  <button
                    onClick={() => handleDownload(false)}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-emerald-primary text-black font-semibold text-xs hover:bg-emerald-hover transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.updater.installSetup}</span>
                  </button>
                )}
              </>
            )}

            {downloadedFilePath && (
              <button
                onClick={handleInstallNow}
                disabled={isInstalling}
                className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-primary text-black font-bold text-xs hover:bg-emerald-hover transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Launching installer...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{t.updater.restartAndInstall}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
