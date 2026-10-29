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
  Languages,
  Sparkles,
  RefreshCw,
  HelpCircle,
  Settings,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';
import type { AppUpdateInfo } from './UpdateModal.js';

export type NavTab = 'mods' | 'explore' | 'instances' | 'bisect' | 'help' | 'settings';

interface TopBarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeInstanceName?: string;
  onOpenInstances: () => void;
  updateInfo?: AppUpdateInfo | null;
  onOpenUpdateModal?: () => void;
  onCheckUpdate?: () => void;
  isCheckingUpdate?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onTabChange,
  activeInstanceName,
  onOpenInstances,
  updateInfo,
}) => {
  const { language, toggleLanguage, t } = useLanguage();

  const handleMinimize = () => window.api?.window?.minimize();
  const handleMaximize = () => window.api?.window?.maximize();
  const handleClose = () => window.api?.window?.close();

  const tabs: { id: NavTab; label: string; icon: React.ReactNode; hasBadge?: boolean }[] = [
    { id: 'mods', label: t.topbar.mods, icon: <Boxes className="w-4 h-4" /> },
    { id: 'explore', label: t.topbar.explore, icon: <Compass className="w-4 h-4" /> },
    { id: 'instances', label: t.topbar.instances, icon: <Layers className="w-4 h-4" /> },
    { id: 'bisect', label: t.topbar.diagnostics, icon: <Activity className="w-4 h-4" /> },
    { id: 'help', label: t.topbar.help || 'Help', icon: <HelpCircle className="w-4 h-4" /> },
    {
      id: 'settings',
      label: t.topbar.settings || 'Settings',
      icon: <Settings className="w-4 h-4" />,
      hasBadge: Boolean(updateInfo?.updateAvailable),
    },
  ];

  return (
    <header className="h-11 bg-obsidian-surface border-b border-obsidian-border flex items-center justify-between px-3 select-none app-drag text-sm overflow-hidden">
      <div className="flex items-center space-x-2 shrink-0 app-no-drag">
        <div className="flex items-center space-x-2">
          <img src="./favicon-32x32.png" alt="LoadModer" className="w-4 h-4 rounded-sm object-contain shrink-0" />
          <span className="font-bold tracking-tight text-nordic-text text-xs uppercase shrink-0">
            LoadModer
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-obsidian-card text-nordic-muted border border-obsidian-border select-none shrink-0"
            title="LoadModer Standalone Desktop"
          >
            v{updateInfo?.currentVersion || '2.11.2'}
          </span>
        </div>
      </div>

      <nav className="flex items-center space-x-0.5 sm:space-x-1 app-no-drag overflow-x-auto no-scrollbar shrink mx-1">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 lg:px-3 py-1 rounded text-[11px] sm:text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-emerald-tint text-emerald-active border border-emerald-primary/30'
                  : 'text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
              {tab.hasBadge && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-primary animate-pulse ml-0.5" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 app-no-drag">
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1 sm:space-x-1.5 px-2 py-1 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors duration-150 cursor-pointer shrink-0"
          title={t.topbar.langTooltip}
        >
          <Languages className="w-3.5 h-3.5 text-emerald-primary shrink-0" />
          <span className="font-mono text-[11px] font-semibold uppercase">{language}</span>
        </button>

        <button
          onClick={onOpenInstances}
          className="flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors duration-150 cursor-pointer min-w-0 max-w-[110px] md:max-w-[150px] lg:max-w-[200px] shrink"
          title={t.topbar.changeInstance}
        >
          <FolderGit2 className="w-3.5 h-3.5 text-emerald-primary shrink-0" />
          <span className="truncate font-mono text-[11px] min-w-0">
            {activeInstanceName ?? t.topbar.selectInstance}
          </span>
        </button>

        <div className="flex items-center ml-1 shrink-0">
          <button
            onClick={handleMinimize}
            className="w-8 h-8 flex items-center justify-center text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors duration-150 cursor-pointer"
            title={t.common.minimize}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-8 flex items-center justify-center text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors duration-150 cursor-pointer"
            title={t.common.maximize}
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-nordic-muted hover:text-white hover:bg-status-danger transition-colors duration-150 cursor-pointer"
            title={t.common.close}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
