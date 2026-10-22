import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

export interface OperationLoadingOverlayProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  detail?: string;
  onEmergencyUnlock?: () => void;
}

export const OperationLoadingOverlay: React.FC<OperationLoadingOverlayProps> = ({
  isOpen,
  title,
  subtitle,
  detail,
  onEmergencyUnlock,
}) => {
  const { t } = useLanguage();
  const [showEmergencyUnlock, setShowEmergencyUnlock] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowEmergencyUnlock(false);
      return;
    }

    // Safety timeout: after 45 seconds of continuous blocking, surface an emergency unlock option
    const timer = setTimeout(() => {
      setShowEmergencyUnlock(true);
    }, 45000);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-11 inset-x-0 bottom-0 z-40 flex items-center justify-center p-6 bg-obsidian-bg/85 backdrop-blur-md transition-all duration-200 pointer-events-auto select-none">
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

        {showEmergencyUnlock && (
          <div className="mt-4 pt-4 border-t border-obsidian-border w-full flex flex-col items-center animate-in fade-in duration-200">
            <div className="flex items-center space-x-1.5 text-[11px] text-amber-400 font-medium mb-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{t.loadingOverlay?.takingLonger || 'Operasi memakan waktu lebih lama dari biasanya.'}</span>
            </div>
            <button
              onClick={onEmergencyUnlock}
              className="px-3.5 py-1.5 rounded-lg bg-red-950/70 border border-red-500/50 text-xs font-semibold text-red-300 hover:bg-red-900/80 transition-colors cursor-pointer shadow-sm"
            >
              {t.loadingOverlay?.emergencyUnlock || 'Buka Kunci Layar (Batalkan)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
