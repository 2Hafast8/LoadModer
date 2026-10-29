import React, { useState } from 'react';
import {
  Settings,
  Sparkles,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Languages,
  Sliders,
  FolderOpen,
  Info,
  Bug,
  Heart,
  Palette,
  FolderGit2,
  ChevronDown,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import { MarkdownViewer } from '../components/MarkdownViewer.js';
import { formatBytes } from '../../../../utils/format.js';
import type { AppUpdateInfo } from '../components/UpdateModal.js';

interface SettingsViewProps {
  updateInfo?: AppUpdateInfo | null;
  onCheckUpdate?: () => void;
  isCheckingUpdate?: boolean;
  onStartTour?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  updateInfo,
  onCheckUpdate,
  isCheckingUpdate = false,
  onStartTour,
}) => {
  const { language, setLanguage, t } = useLanguage();
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
  const [showNotes, setShowNotes] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDownload = async (target: 'setup' | 'portable') => {
    if (downloading || isInstalling) return;
    setDownloading(true);
    setErrorMessage(null);
    setDownloadedFilePath(null);

    try {
      const res = await window.api.updater.downloadUpdate(target, (progress: any) => {
        setDownloadProgress({
          percent: progress.percent,
          speed: progress.speed,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: progress.totalBytes,
        });
      });

      if (res.success && res.filePath) {
        setDownloadedFilePath(res.filePath);
      } else {
        setErrorMessage(res.error || t.updater?.downloadFailed || 'Failed to download update.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred.');
    } finally {
      setDownloading(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!downloadedFilePath || isInstalling) return;
    setIsInstalling(true);
    setErrorMessage(null);

    try {
      const res = await window.api.updater.applyUpdate(downloadedFilePath);
      if (!res.success) {
        setIsInstalling(false);
        setErrorMessage(res.error || 'Failed to apply update.');
      }
    } catch (err: any) {
      setIsInstalling(false);
      setErrorMessage(err.message || 'System error occurred.');
    }
  };

  const handleOpenFolder = (filePath: string) => {
    window.api.instances.openFolder(filePath);
  };

  const handleOpenGitHubIssues = () => {
    window.open('https://github.com/2Hafast8/LoadModer/issues/new', '_blank');
  };

  const handleOpenGitHubRepo = () => {
    window.open('https://github.com/2Hafast8/LoadModer', '_blank');
  };

  const currentVer = updateInfo?.currentVersion || '2.11.2';
  const hasUpdate = Boolean(updateInfo?.updateAvailable);

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* Header Bar */}
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex items-center justify-between">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-emerald-primary" />
              <h2 className="text-xs font-semibold text-nordic-text uppercase tracking-wider">
                {t.settings?.title || 'Application Settings'}
              </h2>
            </div>
            <p className="text-[11px] text-nordic-muted">
              {t.settings?.subtitle || 'Update hub, language, appearance, and developer information'}
            </p>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="px-4 py-2 text-xs flex items-center justify-center space-x-2 bg-emerald-dark/30 border-b border-emerald-primary text-emerald-active animate-fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Settings Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="w-full max-w-5xl mx-auto space-y-5">
          {/* 1. PUSAT PEMBARUAN (UPDATE HUB) */}
          <section data-tour="settings-update-hub" className="border border-obsidian-border bg-obsidian-card rounded-lg p-4 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-obsidian-border pb-3">
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-nordic-text truncate">
                    {t.settings?.updateHubTitle || 'Update Hub'}
                  </h3>
                  <p className="text-[11px] text-nordic-muted truncate">
                    {t.settings?.updateHubDesc || 'Check for the latest releases and update LoadModer safely'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={onCheckUpdate}
                  disabled={isCheckingUpdate || downloading || isInstalling}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-surface border border-obsidian-border hover:border-emerald-primary/40 text-xs font-semibold text-nordic-text hover:text-emerald-primary transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-emerald-primary' : ''}`} />
                  <span>{isCheckingUpdate ? (t.settings?.checkingBtn || 'Checking...') : (t.settings?.checkUpdatesBtn || 'Check for Updates')}</span>
                </button>
              </div>
            </div>

            {/* Status Kartu Versi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-obsidian-surface border border-obsidian-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-nordic-muted block">
                    {t.settings?.installedVersion || 'Installed Version:'}
                  </span>
                  <span className="font-mono font-bold text-nordic-text text-sm">v{currentVer}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-obsidian-bg border border-obsidian-border text-nordic-muted">
                  {t.settings?.statusCurrent || 'Current'}
                </span>
              </div>

              <div className={`p-3 rounded border flex items-center justify-between ${
                hasUpdate
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-obsidian-surface border-obsidian-border'
              }`}>
                <div>
                  <span className="text-[11px] text-nordic-muted block">
                    {t.settings?.latestVersion || 'Latest Version:'}
                  </span>
                  <span className={`font-mono font-bold text-sm ${hasUpdate ? 'text-emerald-primary' : 'text-nordic-text'}`}>
                    v{updateInfo?.latestVersion || currentVer}
                  </span>
                </div>
                {hasUpdate ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-primary text-obsidian-bg animate-pulse">
                    {t.settings?.statusAvailable || 'Available ✨'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    {t.settings?.statusLatest || 'Latest ✓'}
                  </span>
                )}
              </div>
            </div>

            {/* Download & Action Box if update is available */}
            {hasUpdate && (
              <div className="p-3.5 rounded bg-emerald-950/25 border border-emerald-500/30 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-primary">
                      {(t.settings?.updateReadyTitle || 'Update v{version} Ready to Download!').replace('{version}', updateInfo?.latestVersion || '')}
                    </h4>
                    <p className="text-[11px] text-nordic-muted">
                      {(t.settings?.releasedOn || 'Released on {date}').replace('{date}', updateInfo?.publishedAt ? new Date(updateInfo.publishedAt).toLocaleDateString() : '')}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className="flex items-center space-x-1 text-[11px] text-emerald-primary hover:underline cursor-pointer"
                  >
                    <span>{showNotes ? (t.settings?.hideNotes || 'Hide Notes') : (t.settings?.showNotes || 'View Release Notes')}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {showNotes && updateInfo?.releaseNotes && (
                  <div className="p-3 rounded bg-obsidian-bg border border-obsidian-border max-h-48 overflow-y-auto text-xs">
                    <MarkdownViewer content={updateInfo.releaseNotes} />
                  </div>
                )}

                {/* Download Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => handleDownload('setup')}
                    disabled={downloading || isInstalling || Boolean(downloadedFilePath)}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded bg-emerald-primary text-obsidian-bg hover:bg-emerald-active text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.settings?.downloadSetup || 'Download & Install Setup (.exe)'}</span>
                  </button>

                  <button
                    onClick={() => handleDownload('portable')}
                    disabled={downloading || isInstalling || Boolean(downloadedFilePath)}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded bg-obsidian-surface border border-obsidian-border text-nordic-text hover:border-emerald-primary/40 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.settings?.downloadPortable || 'Download Portable (.exe)'}</span>
                  </button>
                </div>

                {/* Progress Display */}
                {downloading && downloadProgress && (
                  <div className="space-y-1.5 pt-2 border-t border-obsidian-border">
                    <div className="flex items-center justify-between text-[11px] font-mono text-nordic-muted">
                      <span>{(t.settings?.downloadingProgress || 'Downloading: {percent}%').replace('{percent}', downloadProgress.percent.toFixed(1))}</span>
                      <span>{downloadProgress.speed}</span>
                    </div>
                    <div className="w-full bg-obsidian-surface h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-primary h-full transition-all duration-150"
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Ready to apply button */}
                {downloadedFilePath && (
                  <div className="p-3 rounded bg-emerald-950/40 border border-emerald-500/50 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-xs text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-primary shrink-0" />
                      <span>{t.settings?.updateVerifiedReady || 'Verified update package is ready to apply!'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenFolder(downloadedFilePath)}
                        className="px-2.5 py-1 text-xs text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
                      >
                        {t.settings?.openFolderBtn || 'Open Folder'}
                      </button>
                      <button
                        onClick={handleApplyUpdate}
                        disabled={isInstalling}
                        className="px-3.5 py-1.5 rounded bg-emerald-primary text-obsidian-bg hover:bg-emerald-active text-xs font-bold transition-colors cursor-pointer"
                      >
                        {isInstalling ? (t.settings?.applyingBtn || 'Applying...') : (t.settings?.applyAndRestartBtn || 'Install & Restart')}
                      </button>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 rounded bg-red-950/30 border border-red-500/40 text-xs text-red-300 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 2. PENGATURAN BAHASA (LANGUAGE) */}
          <section data-tour="settings-language-card" className="border border-obsidian-border bg-obsidian-card rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center space-x-2.5 border-b border-obsidian-border pb-3">
              <div className="w-8 h-8 rounded bg-obsidian-surface border border-obsidian-border flex items-center justify-center text-nordic-text">
                <Languages className="w-4 h-4 text-emerald-primary" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-nordic-text">
                  {t.settings?.languageTitle || 'Application Language'}
                </h3>
                <p className="text-[11px] text-nordic-muted">
                  {t.settings?.languageDesc || 'Choose the interface language for LoadModer'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  setLanguage('id');
                  showNotice('Bahasa diubah ke Bahasa Indonesia.');
                }}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between ${
                  language === 'id'
                    ? 'border-emerald-primary/70 bg-emerald-dark/20 text-emerald-active'
                    : 'border-obsidian-border bg-obsidian-surface text-nordic-muted hover:text-nordic-text'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">{t.settings?.langIndonesian || 'Bahasa Indonesia'}</div>
                  <div className="text-[10px] font-mono opacity-70">{t.settings?.langIndonesianSub || 'Bahasa Baku Nasional'}</div>
                </div>
                {language === 'id' && <CheckCircle2 className="w-4 h-4 text-emerald-primary shrink-0 ml-2" />}
              </button>

              <button
                onClick={() => {
                  setLanguage('en');
                  showNotice('Language switched to English.');
                }}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between ${
                  language === 'en'
                    ? 'border-emerald-primary/70 bg-emerald-dark/20 text-emerald-active'
                    : 'border-obsidian-border bg-obsidian-surface text-nordic-muted hover:text-nordic-text'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">{t.settings?.langEnglish || 'English'}</div>
                  <div className="text-[10px] font-mono opacity-70">{t.settings?.langEnglishSub || 'International English'}</div>
                </div>
                {language === 'en' && <CheckCircle2 className="w-4 h-4 text-emerald-primary shrink-0 ml-2" />}
              </button>
            </div>
          </section>

          {/* 3. TAMPILAN & TUR (APPEARANCE & ONBOARDING) */}
          <section data-tour="settings-appearance-card" className="border border-obsidian-border bg-obsidian-card rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center space-x-2.5 border-b border-obsidian-border pb-3">
              <div className="w-8 h-8 rounded bg-obsidian-surface border border-obsidian-border flex items-center justify-center text-nordic-text shrink-0">
                <Palette className="w-4 h-4 text-emerald-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-nordic-text">
                  {t.settings?.appearanceTitle || 'Appearance & Tour'}
                </h3>
                <p className="text-[11px] text-nordic-muted">
                  {t.settings?.appearanceDesc || 'Nordic Obsidian theme and interactive spotlight tour reset'}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded bg-obsidian-surface border border-obsidian-border gap-2">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-semibold text-nordic-text">{t.settings?.visualThemeLabel || 'Visual Theme'}</div>
                  <div className="text-[11px] text-nordic-muted leading-relaxed break-words">{t.settings?.visualThemeDesc || 'Nordic Clean Deep Obsidian Palette (#0A0F0D)'}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 shrink-0 self-start sm:self-auto">
                  {t.settings?.themeDefaultBadge || 'Default Nordic'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded bg-obsidian-surface border border-obsidian-border gap-2.5">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-semibold text-nordic-text">{t.settings?.tourLabel || 'Interactive Spotlight Tour'}</div>
                  <div className="text-[11px] text-nordic-muted leading-relaxed break-words">{t.settings?.tourDesc || 'Re-run the guided tour to learn how to use LoadModer features'}</div>
                </div>
                <button
                  onClick={() => {
                    if (onStartTour) {
                      onStartTour();
                      showNotice(t.settings?.tourStartedNotice || 'Interactive tour started.');
                    }
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.settings?.startTourBtn || 'Start Tour'}</span>
                </button>
              </div>
            </div>
          </section>

          {/* 4. LAPORAN BUG & DOKUMENTASI (BUG REPORT) */}
          <section className="border border-obsidian-border bg-obsidian-card rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center space-x-2.5 border-b border-obsidian-border pb-3">
              <div className="w-8 h-8 rounded bg-obsidian-surface border border-obsidian-border flex items-center justify-center text-nordic-text shrink-0">
                <Bug className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-nordic-text">
                  {t.settings?.bugReportTitle || 'Bug Report & Issues'}
                </h3>
                <p className="text-[11px] text-nordic-muted">
                  {t.settings?.bugReportDesc || 'Encountered a bug or unexpected behavior? Open an issue on GitHub'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded bg-obsidian-surface border border-obsidian-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1 pr-2 text-xs">
                <span className="font-semibold text-nordic-text block">{t.settings?.issueTrackerTitle || 'GitHub Issue Tracker'}</span>
                <span className="text-[11px] text-nordic-muted leading-relaxed break-words">{t.settings?.issueTrackerDesc || 'Please include crash logs or screenshots if available'}</span>
              </div>
              <button
                onClick={handleOpenGitHubIssues}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border hover:border-amber-500/40 text-xs font-semibold text-nordic-text hover:text-amber-400 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <span>{t.settings?.openIssuesBtn || 'Open GitHub Issues'}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </section>

          {/* 5. INFORMASI APLIKASI & TIM PENGEMBANG (ABOUT & CREDITS) */}
          <section data-tour="settings-author-card" className="border border-obsidian-border bg-obsidian-card rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center space-x-2.5 border-b border-obsidian-border pb-3">
              <div className="w-8 h-8 rounded bg-obsidian-surface border border-obsidian-border flex items-center justify-center text-nordic-text shrink-0">
                <Info className="w-4 h-4 text-emerald-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-nordic-text">
                  {t.settings?.aboutTitle || 'About LoadModer & Team'}
                </h3>
                <p className="text-[11px] text-nordic-muted">
                  {t.settings?.aboutDesc || 'Architecture, version, and open-source license information'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-obsidian-border/50">
                <span className="text-nordic-muted shrink-0">{t.settings?.appLabel || 'Application:'}</span>
                <span className="font-semibold text-nordic-text">LoadModer Desktop</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-obsidian-border/50">
                <span className="text-nordic-muted shrink-0">{t.settings?.versionLabel || 'Release Version:'}</span>
                <span className="font-mono text-emerald-primary font-bold">v{currentVer}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-obsidian-border/50">
                <span className="text-nordic-muted shrink-0">{t.settings?.developerLabel || 'Lead Developer:'}</span>
                <span className="font-semibold text-nordic-text">Hafiz Noval Rianto</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-obsidian-border/50 gap-1">
                <span className="text-nordic-muted shrink-0">{t.settings?.teamLabel || 'Team & Contributors:'}</span>
                <span className="font-semibold text-nordic-text text-left sm:text-right min-w-0 break-words">Hafiz Noval Rianto & LoadModer Community Contributors</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-obsidian-border/50">
                <span className="text-nordic-muted shrink-0">{t.settings?.licenseLabel || 'License:'}</span>
                <span className="font-mono text-nordic-text">MIT License (Open Source)</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-nordic-muted shrink-0">{t.settings?.repoLabel || 'GitHub Repository:'}</span>
                <button
                  onClick={handleOpenGitHubRepo}
                  className="flex items-center space-x-1 text-emerald-primary hover:underline cursor-pointer shrink-0"
                >
                  <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                  <span>2Hafast8/LoadModer</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
