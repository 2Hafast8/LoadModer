import React from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface DropZoneOverlayProps {
  isDragging: boolean;
  isInstalling: boolean;
  activeInstanceName?: string;
  installResult?: {
    success: boolean;
    count: number;
    error?: string;
  } | null;
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({
  isDragging,
  isInstalling,
  activeInstanceName,
  installResult,
}) => {
  const { t } = useLanguage();

  if (!isDragging && !isInstalling && !installResult) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-obsidian-bg/85 backdrop-blur-md transition-all duration-200 pointer-events-none">
      <div className="flex flex-col items-center max-w-lg w-full p-8 rounded-2xl bg-obsidian-surface/95 border-2 border-dashed border-emerald-500/60 shadow-2xl text-center">
        {isInstalling ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 animate-spin">
              <Loader2 className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-semibold text-white">
              {t.dropZone.installing}
            </h3>
            <p className="text-sm text-nordic-muted">
              {activeInstanceName
                ? t.dropZone.targetInstance.replace('{instance}', activeInstanceName)
                : ''}
            </p>
          </div>
        ) : installResult ? (
          <div className="flex flex-col items-center space-y-4">
            {installResult.success ? (
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-12 h-12" />
              </div>
            ) : (
              <div className="p-4 rounded-full bg-rose-500/10 text-rose-400">
                <AlertCircle className="w-12 h-12" />
              </div>
            )}
            <h3 className="text-xl font-semibold text-white">
              {installResult.success
                ? t.dropZone.successTitle
                : t.dropZone.errorTitle}
            </h3>
            <p className="text-sm text-nordic-muted">
              {installResult.success
                ? t.dropZone.successMessage.replace('{count}', String(installResult.count))
                : installResult.error || t.dropZone.errorTitle}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-5 rounded-full bg-emerald-500/15 text-emerald-400 shadow-inner animate-pulse">
              <UploadCloud className="w-14 h-14" />
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {t.dropZone.title}
            </h3>
            <p className="text-sm text-nordic-muted max-w-sm">
              {t.dropZone.subtitle}
            </p>
            {activeInstanceName ? (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {t.dropZone.targetInstance.replace('{instance}', activeInstanceName)}
              </div>
            ) : (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                {t.dropZone.noInstance}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2 justify-center">
              <span className="px-2.5 py-1 text-xs rounded bg-white/5 border border-white/10 text-nordic-muted font-mono">
                .jar
              </span>
              <span className="px-2.5 py-1 text-xs rounded bg-white/5 border border-white/10 text-nordic-muted font-mono">
                .mrpack
              </span>
              <span className="px-2.5 py-1 text-xs rounded bg-white/5 border border-white/10 text-nordic-muted font-mono">
                .zip
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
