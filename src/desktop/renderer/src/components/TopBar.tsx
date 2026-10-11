import React from 'react';
import {
  Layers,
  Boxes,
  Compass,
  Activity,
  Minus,
  Square,
  X,
  FolderGit2,
} from 'lucide-react';

export type NavTab = 'mods' | 'explore' | 'instances' | 'bisect';

interface TopBarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeInstanceName?: string;
  onOpenInstances: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onTabChange,
  activeInstanceName,
  onOpenInstances,
}) => {
  const handleMinimize = () => window.api?.window?.minimize();
  const handleMaximize = () => window.api?.window?.maximize();
  const handleClose = () => window.api?.window?.close();

  const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'mods', label: 'Mods', icon: <Boxes className="w-4 h-4" /> },
    { id: 'explore', label: 'Explore', icon: <Compass className="w-4 h-4" /> },
    { id: 'instances', label: 'Instances', icon: <Layers className="w-4 h-4" /> },
    { id: 'bisect', label: 'Diagnostics', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <header className="h-11 bg-obsidian-surface border-b border-obsidian-border flex items-center justify-between px-3 select-none app-drag text-sm">
      {/* Brand & Indicator */}
      <div className="flex items-center space-x-3 app-no-drag">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-primary" />
          <span className="font-bold tracking-tight text-nordic-text text-xs uppercase">
            LoadModer
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-obsidian-card text-nordic-muted border border-obsidian-border">
            v2.5.0
          </span>
        </div>
      </div>

      {/* Horizontal Navigation Tabs */}
      <nav className="flex items-center space-x-1 app-no-drag">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'bg-emerald-tint text-emerald-active border border-emerald-primary/30'
                  : 'text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Active Instance Selector & Windows 11 Controls */}
      <div className="flex items-center space-x-2 app-no-drag">
        {/* Active Instance Button */}
        <button
          onClick={onOpenInstances}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors duration-150 cursor-pointer max-w-[200px]"
          title="Ganti Instance Aktif"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-emerald-primary shrink-0" />
          <span className="truncate font-mono text-[11px]">
            {activeInstanceName ?? 'Pilih Instance'}
          </span>
        </button>

        {/* Windows 11 Controls */}
        <div className="flex items-center ml-1">
          <button
            onClick={handleMinimize}
            className="w-8 h-8 flex items-center justify-center text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors duration-150 cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-8 flex items-center justify-center text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors duration-150 cursor-pointer"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-nordic-muted hover:text-white hover:bg-status-danger transition-colors duration-150 cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
