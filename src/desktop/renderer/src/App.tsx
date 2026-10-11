import React, { useState, useEffect } from 'react';
import { TopBar, type NavTab } from './components/TopBar.js';
import { ModsView } from './views/ModsView.js';
import { ExploreView } from './views/ExploreView.js';
import { InstancesView } from './views/InstancesView.js';
import { BisectView } from './views/BisectView.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('mods');
  const [activeInstanceName, setActiveInstanceName] = useState<string>('Memuat...');

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const data = await window.api.instances.getAll();
        if (data.active?.name) {
          setActiveInstanceName(data.active.name);
        } else {
          setActiveInstanceName('Belum Ada');
        }
      } catch (err) {
        console.error('Failed to get active instance:', err);
      }
    };
    fetchActive();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-obsidian-bg text-nordic-text">
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
    </div>
  );
};

export default App;
