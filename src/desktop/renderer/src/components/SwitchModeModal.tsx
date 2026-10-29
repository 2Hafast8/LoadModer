import React from 'react';
import { AlertTriangle, Home, Boxes, X, Check } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface SwitchModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMode: 'default' | 'modpack';
  targetContainer?: string;
  targetLoader?: string;
  targetGameVersion?: string;
  onConfirm: () => void;
}

export const SwitchModeModal: React.FC<SwitchModeModalProps> = ({
  isOpen,
  onClose,
  targetMode,
  targetContainer,
  targetLoader,
  targetGameVersion,
  onConfirm,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const isSwitchingToDefault = targetMode === 'default';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-bg/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-obsidian-card border border-obsidian-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-obsidian-border bg-obsidian-surface">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded border flex items-center justify-center ${
              isSwitchingToDefault
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            }`}>
              {isSwitchingToDefault ? <Home className="w-4 h-4" /> : <Boxes className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-nordic-text">
                {isSwitchingToDefault
                  ? (t.instances.confirmDefaultTitle || 'Konfirmasi Kembali ke Mode Default')
                  : (t.instances.confirmContainerTitle || 'Konfirmasi Beralih Wadah Modpack')}
              </h2>
              <p className="text-[11px] text-nordic-muted">
                {t.instances.confirmModeSubtitle || 'Validasi perpindahan direktori launcher'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded bg-obsidian-surface border border-obsidian-border space-y-2">
            <div className="text-xs text-nordic-text">
              {isSwitchingToDefault ? (
                <span>
                  {t.instances.confirmDefaultMessage ||
                    'Anda akan beralih ke Mode Standar (.minecraft). Folder mods utama game akan digunakan.'}
                </span>
              ) : (
                <div className="space-y-1.5">
                  <span className="block text-nordic-muted text-[11px]">
                    {t.instances.targetContainerLabel || 'Wadah Sasaran:'}
                  </span>
                  <div className="text-xs font-bold text-emerald-primary">
                    {targetContainer}
                  </div>
                  {(targetLoader || targetGameVersion) && (
                    <div className="text-[10px] font-mono text-nordic-muted">
                      {targetLoader?.toUpperCase()} • MC {targetGameVersion}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start space-x-2.5 p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span className="leading-relaxed">
              {t.instances.confirmModeWarning}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-obsidian-border bg-obsidian-surface flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-xs text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded text-xs font-semibold text-obsidian-bg transition-colors cursor-pointer ${
              isSwitchingToDefault
                ? 'bg-amber-400 hover:bg-amber-300'
                : 'bg-emerald-primary hover:bg-emerald-active'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.instances.confirmSwitchBtn || 'Ya, Lanjutkan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

