import React, { useState, useEffect, useRef } from 'react';
import { TopBar, type NavTab } from './components/TopBar.js';
import { ModsView } from './views/ModsView.js';
import { ExploreView } from './views/ExploreView.js';
import { InstancesView } from './views/InstancesView.js';
import { BisectView } from './views/BisectView.js';
import { DownloadCenter } from './components/DownloadCenter.js';
import { DropZoneOverlay } from './components/DropZoneOverlay.js';
import { useLanguage } from './i18n/LanguageContext.js';

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

  const dragCounter = useRef(0);

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
  }, []);

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

    const files = Array.from(e.dataTransfer.files);
    const filePaths = files
      .map((f: any) => f.path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);

    if (filePaths.length === 0) return;

    setIsInstalling(true);
    setInstallResult(null);

    try {
      const res = await window.api.mods.installDroppedFiles(filePaths);
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
        error: err.message,
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
      </main>

      <DownloadCenter />

      <DropZoneOverlay
        isDragging={isDragging}
        isInstalling={isInstalling}
        activeInstanceName={activeInstanceName}
        installResult={installResult}
      />
    </div>
  );
};

export default App;
