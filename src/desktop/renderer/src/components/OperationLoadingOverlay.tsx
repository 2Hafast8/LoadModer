import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

export interface OperationLoadingOverlayProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  detail?: string;
}

export const OperationLoadingOverlay: React.FC<OperationLoadingOverlayProps> = ({
  isOpen,
  title,
  subtitle,
  detail,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-obsidian-bg/85 backdrop-blur-md transition-all duration-200 pointer-events-auto select-none">
      <div className="flex flex-col items-center max-w-md w-full p-6 sm:p-8 rounded-2xl bg-obsidian-surface border border-obsidian-border shadow-2xl text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-primary mb-4 flex items-center justify-center shadow-inner">
          <Loader2 className="w-9 h-9 animate-spin" />
        </div>

        <h3 className="text-sm font-bold text-nordic-text font-mono uppercase tracking-wider mb-1.5">
          {title}
        </h3>

        {subtitle && (
          <p className="text-xs text-nordic-muted max-w-sm text-center leading-relaxed">
            {subtitle}
          </p>
        )}

        {detail && (
          <div className="mt-3 px-3 py-1 rounded bg-obsidian-card border border-obsidian-border text-[11px] font-mono text-emerald-active max-w-xs truncate shadow-sm">
            {detail}
          </div>
        )}

        <div className="w-52 h-1 bg-obsidian-card rounded-full overflow-hidden mt-4 border border-obsidian-border">
          <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 rounded-full animate-pulse" />
        </div>

        <span className="text-[10px] text-zinc-500 font-mono mt-3">
          {t.loadingOverlay?.inProgressNotice || 'Proses sedang berjalan • Mohon jangan menutup aplikasi'}
        </span>
      </div>
    </div>
  );
};

