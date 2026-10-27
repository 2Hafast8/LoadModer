import React, { useState, useEffect, useRef } from 'react';
import { TopBar, type NavTab } from './components/TopBar.js';
import { ModsView } from './views/ModsView.js';
import { ExploreView } from './views/ExploreView.js';
import { InstancesView } from './views/InstancesView.js';
import { BisectView } from './views/BisectView.js';
import { DownloadCenter } from './components/DownloadCenter.js';
import { DropZoneOverlay } from './components/DropZoneOverlay.js';
import { UpdateModal, type AppUpdateInfo } from './components/UpdateModal.js';
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

  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

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

    // Non-blocking auto check for updates 2.5s after launch
    const updateTimer = setTimeout(async () => {
      try {
        const info = await window.api.updater?.check?.();
        if (info) {
          setUpdateInfo(info);
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
      />
    </div>
  );
};

export default App;
