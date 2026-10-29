import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { TopBar, type NavTab } from './components/TopBar.js';
import { ModsView } from './views/ModsView.js';
import { ExploreView } from './views/ExploreView.js';
import { InstancesView } from './views/InstancesView.js';
import { BisectView } from './views/BisectView.js';
import { HelpView } from './views/HelpView.js';
import { SettingsView } from './views/SettingsView.js';
import { DownloadCenter } from './components/DownloadCenter.js';
import { DropZoneOverlay } from './components/DropZoneOverlay.js';
import { UpdateModal, type AppUpdateInfo } from './components/UpdateModal.js';
import { OnboardingModal } from './components/OnboardingModal.js';
import { TourOverlay, type TourStep } from './components/TourOverlay.js';
import { useLanguage } from './i18n/LanguageContext.js';
import type { TranslationSchema } from './i18n/translations.js';

const getTourSteps = (t: TranslationSchema): Record<NavTab, TourStep[]> => ({
  mods: [
    {
      targetSelector: '[data-tour="mods-search-input"]',
      title: t.tour.modsSearchTitle,
      description: t.tour.modsSearchDesc,
    },
    {
      targetSelector: '[data-tour="mods-sort-pagination"]',
      title: t.tour.modsSortTitle,
      description: t.tour.modsSortDesc,
    },
    {
      targetSelector: '[data-tour="mods-card-list"]',
      title: t.tour.modsCardsTitle,
      description: t.tour.modsCardsDesc,
    },
  ],
  explore: [
    {
      targetSelector: '[data-tour="explore-search-input"]',
      title: t.tour.exploreSearchTitle,
      description: t.tour.exploreSearchDesc,
    },
    {
      targetSelector: '[data-tour="explore-type-filters"]',
      title: t.tour.exploreFiltersTitle,
      description: t.tour.exploreFiltersDesc,
    },
    {
      targetSelector: '[data-tour="explore-card-list"]',
      title: t.tour.exploreCardsTitle,
      description: t.tour.exploreCardsDesc,
    },
  ],
  instances: [
    {
      targetSelector: '[data-tour="instances-status-card"]',
      title: t.tour.instancesStatusTitle,
      description: t.tour.instancesStatusDesc,
    },
    {
      targetSelector: '[data-tour="instances-export-button"]',
      title: t.tour.instancesExportTitle,
      description: t.tour.instancesExportDesc,
    },
    {
      targetSelector: '[data-tour="instances-mode-selector"]',
      title: t.tour.instancesModeTitle,
      description: t.tour.instancesModeDesc,
    },
    {
      targetSelector: '[data-tour="instances-list-grid"]',
      title: t.tour.instancesListTitle,
      description: t.tour.instancesListDesc,
    },
  ],
  bisect: [
    {
      targetSelector: '[data-tour="diagnostics-subtabs"]',
      title: t.tour.bisectNavTitle,
      description: t.tour.bisectNavDesc,
    },
    {
      targetSelector: '[data-tour="diagnostics-crash-logs"]',
      title: t.tour.bisectLogsTitle,
      description: t.tour.bisectLogsDesc,
    },
  ],
  help: [
    {
      targetSelector: '[data-tour="help-subtabs"]',
      title: t.tour.helpNavTitle,
      description: t.tour.helpNavDesc,
    },
    {
      targetSelector: '[data-tour="help-search-box"]',
      title: t.tour.helpSearchTitle,
      description: t.tour.helpSearchDesc,
    },
    {
      targetSelector: '[data-tour="help-content-card"]',
      title: t.tour.helpContentTitle,
      description: t.tour.helpContentDesc,
    },
  ],
  settings: [
    {
      targetSelector: '[data-tour="settings-update-hub"]',
      title: t.tour.settingsUpdateTitle,
      description: t.tour.settingsUpdateDesc,
    },
    {
      targetSelector: '[data-tour="settings-language-card"]',
      title: t.tour.settingsLangTitle,
      description: t.tour.settingsLangDesc,
    },
    {
      targetSelector: '[data-tour="settings-appearance-card"]',
      title: t.tour.settingsTourTitle,
      description: t.tour.settingsTourDesc,
    },
    {
      targetSelector: '[data-tour="settings-author-card"]',
      title: t.tour.settingsAuthorTitle,
      description: t.tour.settingsAuthorDesc,
    },
  ],
});

export const App: React.FC = () => {
  const { t } = useLanguage();
  const [currentTab, setCurrentTab] = useState<NavTab>('mods');
  const [activeInstanceName, setActiveInstanceName] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{
    success: boolean;
    count: number;
    error?: string;
  } | null>(null);

  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  // Onboarding & Spotlight Tour state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [activeTourPage, setActiveTourPage] = useState<NavTab>('mods');

  const handleResetAndStartOnboardingTour = () => {
    localStorage.removeItem('loadmoder_onboarding_welcomed');
    const tourPages: NavTab[] = ['mods', 'explore', 'instances', 'bisect', 'help', 'settings'];
    tourPages.forEach((p) => localStorage.removeItem(`loadmoder_tour_${p}`));
    setIsTourActive(false);
    setCurrentTab('mods');
    setActiveTourPage('mods');
    setTimeout(() => {
      setIsOnboardingOpen(true);
    }, 50);
  };

  const dragCounter = useRef(0);

  useEffect(() => {
    // Cek apakah pertama kali membuka aplikasi
    const welcomed = localStorage.getItem('loadmoder_onboarding_welcomed');
    if (!welcomed) {
      setIsOnboardingOpen(true);
    }
  }, []);

  useEffect(() => {
    // Saat berpindah halaman, cek apakah tur untuk halaman ini belum pernah dijalankan
    const welcomed = localStorage.getItem('loadmoder_onboarding_welcomed');
    const pageTourDone = localStorage.getItem(`loadmoder_tour_${currentTab}`);
    if (welcomed === 'true' && !pageTourDone && !isOnboardingOpen) {
      const timer = setTimeout(() => {
        setActiveTourPage(currentTab);
        setIsTourActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentTab, isOnboardingOpen]);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const data = await window.api.instances.getAll();
        if (data.active?.name) {
          setActiveInstanceName(data.active.name);
        } else {
          setActiveInstanceName(undefined);
        }
      } catch (err) {
        console.error('Failed to get active instance:', err);
      }
    };
    fetchActive();

    // Non-blocking auto check for updates 2.5s after launch
    const updateTimer = setTimeout(async () => {
      try {
        const info = await window.api.updater?.check?.();
        if (info) {
          setUpdateInfo(info);
          if (info.updateAvailable) {
            setShowUpdateBanner(true);
          }
        }
      } catch (err) {
        console.error('Failed to auto-check update:', err);
      }
    }, 2500);

    return () => clearTimeout(updateTimer);
  }, []);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const info = await window.api.updater?.check?.();
      if (info) {
        setUpdateInfo(info);
        setIsUpdateModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to check update:', err);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const rawFiles = Array.from(e.dataTransfer.files);
    const droppedUrl = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim();

    if (rawFiles.length === 0 && !droppedUrl) {
      return;
    }

    setIsInstalling(true);
    setInstallResult(null);

    try {
      const diskPaths: string[] = [];
      const memoryFiles: Array<{ name: string; buffer: Uint8Array }> = [];

      for (const f of rawFiles) {
        let filePath = '';
        if (window.api?.utils?.getPathForFile) {
          try {
            filePath = window.api.utils.getPathForFile(f);
          } catch {
            filePath = (f as any).path || '';
          }
        } else {
          filePath = (f as any).path || '';
        }

        if (filePath && filePath.length > 0) {
          diskPaths.push(filePath);
        } else {
          try {
            const arrayBuf = await f.arrayBuffer();
            if (arrayBuf.byteLength > 0) {
              memoryFiles.push({
                name: f.name,
                buffer: new Uint8Array(arrayBuf),
              });
            }
          } catch (readErr) {
            console.error('Failed to read dropped file buffer:', readErr);
          }
        }
      }

      let res: any = null;
      if (diskPaths.length > 0) {
        res = await window.api.mods.installDroppedFiles(diskPaths);
      } else if (memoryFiles.length > 0) {
        res = await window.api.mods.installDroppedBuffers(memoryFiles);
      } else if (droppedUrl && (droppedUrl.startsWith('http://') || droppedUrl.startsWith('https://'))) {
        res = await window.api.mods.installDroppedUrl(droppedUrl);
      } else {
        setInstallResult({
          success: false,
          count: 0,
          error: t.dropZone.invalidFiles,
        });
        return;
      }

      const successfulCount = res.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
      setInstallResult({
        success: res.success,
        count: successfulCount,
        error: res.error,
      });
    } catch (err: any) {
      setInstallResult({
        success: false,
        count: 0,
        error: err.message || t.dropZone.errorTitle,
      });
    } finally {
      setIsInstalling(false);
      setTimeout(() => {
        setInstallResult(null);
      }, 3500);
    }
  };

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-obsidian-bg text-nordic-text"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TopBar
        currentTab={currentTab}
        onTabChange={(tab: NavTab) => setCurrentTab(tab)}
        activeInstanceName={activeInstanceName}
        onOpenInstances={() => setCurrentTab('instances')}
        updateInfo={updateInfo}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onCheckUpdate={handleCheckUpdate}
        isCheckingUpdate={isCheckingUpdate}
      />

      <main className="flex-1 overflow-hidden relative">
        {currentTab === 'mods' && (
          <ModsView onGoToExplore={() => setCurrentTab('explore')} />
        )}
        {currentTab === 'explore' && <ExploreView />}
        {currentTab === 'instances' && (
          <InstancesView
            onInstanceChanged={(name: string) => setActiveInstanceName(name)}
          />
        )}
        {currentTab === 'bisect' && <BisectView />}
        {currentTab === 'help' && (
          <HelpView
            onStartTour={handleResetAndStartOnboardingTour}
          />
        )}
        {currentTab === 'settings' && (
          <SettingsView
            updateInfo={updateInfo}
            onCheckUpdate={handleCheckUpdate}
            isCheckingUpdate={isCheckingUpdate}
            onStartTour={handleResetAndStartOnboardingTour}
          />
        )}
      </main>

      <DownloadCenter />

      <DropZoneOverlay
        isDragging={isDragging}
        isInstalling={isInstalling}
        activeInstanceName={activeInstanceName}
        installResult={installResult}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onCheckUpdate={handleCheckUpdate}
        isCheckingUpdate={isCheckingUpdate}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onStartTour={() => {
          setActiveTourPage('mods');
          setIsTourActive(true);
        }}
      />

      <TourOverlay
        isOpen={isTourActive}
        page={activeTourPage}
        steps={getTourSteps(t)[activeTourPage] || []}
        onClose={() => setIsTourActive(false)}
      />

      {/* Floating Update Notification Banner */}
      {showUpdateBanner && updateInfo?.updateAvailable && !isUpdateModalOpen && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm bg-obsidian-surface/95 border border-emerald-primary/40 rounded-xl shadow-2xl backdrop-blur-md p-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-tint border border-emerald-primary/30 flex items-center justify-center text-emerald-primary shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-nordic-text">
                {t.updater.bannerTitle}
              </h4>
              <p className="text-[11px] text-nordic-muted mt-0.5 leading-snug">
                {t.updater.bannerDesc.replace('{version}', updateInfo.latestVersion)}
              </p>
              <div className="flex items-center space-x-2 mt-3">
                <button
                  onClick={() => {
                    setShowUpdateBanner(false);
                    setIsUpdateModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-primary text-black font-bold text-xs rounded hover:bg-emerald-hover transition-colors cursor-pointer shadow-sm"
                >
                  {t.updater.bannerAction}
                </button>
                <button
                  onClick={() => setShowUpdateBanner(false)}
                  className="px-2.5 py-1.5 text-xs text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
                >
                  {t.updater.later}
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="text-nordic-muted hover:text-nordic-text p-0.5 cursor-pointer"
              title={t.common.close}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
