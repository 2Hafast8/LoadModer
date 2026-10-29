import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, X, AlertTriangle, ShieldAlert, CheckSquare, Square, CheckCircle2, RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface DeleteInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: {
    id: string;
    name: string;
    launcher: string;
    rootDir: string;
  } | null;
  onDeleted: () => void;
}

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#$!%*@';

function generateRandomCaptcha(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * CAPTCHA_CHARS.length);
    result += CAPTCHA_CHARS[randomIndex];
  }
  return result;
}

export const DeleteInstanceModal: React.FC<DeleteInstanceModalProps> = ({
  isOpen,
  onClose,
  instance,
  onDeleted,
}) => {
  const { t } = useLanguage();
  const [val1Checked, setVal1Checked] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [val2Text, setVal2Text] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshCaptcha = useCallback(() => {
    setCaptchaCode(generateRandomCaptcha(6));
    setVal2Text('');
  }, []);

  useEffect(() => {
    if (isOpen) {
      setVal1Checked(false);
      setVal2Text('');
      setDeleting(false);
      setErrorMsg(null);
      refreshCaptcha();
    }
  }, [isOpen, instance, refreshCaptcha]);

  if (!isOpen || !instance) return null;

  const isTextMatch = val2Text.trim() === captchaCode && captchaCode.length > 0;
  const canDelete = val1Checked && isTextMatch && !deleting;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;

    setDeleting(true);
    setErrorMsg(null);

    try {
      const res = await window.api.instances.delete(instance.id);
      if (res.success) {
        onDeleted();
        onClose();
      } else {
        setErrorMsg(res.error || t.instances.deleteInstanceFailed.replace('{error}', '') || 'Failed to delete launcher profile.');
        setDeleting(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t.common.error);
      setDeleting(false);
    }
  };

  const handlePasteAttempt = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setErrorMsg(t.modalDeleteInstance?.pasteDisabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-bg/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-obsidian-card border border-red-500/50 rounded-lg shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-obsidian-border bg-red-950/20">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-red-900/40 border border-red-500/50 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-400">
                {t.modalDeleteInstance?.title}
              </h2>
              <p className="text-[11px] text-nordic-muted">
                {t.modalDeleteInstance?.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="p-1 rounded text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDelete} className="p-5 space-y-4 overflow-y-auto">
          {/* Target Profile Card */}
          <div className="p-3 rounded bg-obsidian-surface border border-obsidian-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nordic-text truncate">
                {instance.name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-obsidian-card border border-obsidian-border text-emerald-primary">
                {instance.launcher}
              </span>
            </div>
            <p className="text-[11px] font-mono text-nordic-muted truncate">
              {instance.rootDir}
            </p>
          </div>

          {/* Safe Disk Warning */}
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span className="leading-relaxed">
              {t.modalDeleteInstance?.warning}
            </span>
          </div>

          {/* 1. VALIDASI LANGKAH PERTAMA (Checkbox Persetujuan Sadar Risiko) */}
          <div className="pt-2 border-t border-obsidian-border/60">
            <div className="text-[11px] font-bold text-nordic-muted uppercase tracking-wider mb-2">
              {t.modalDeleteInstance?.validation1Title}
            </div>
            <label
              onClick={() => setVal1Checked(!val1Checked)}
              className={`flex items-start space-x-2.5 p-3 rounded border transition-colors cursor-pointer select-none ${
                val1Checked
                  ? 'bg-emerald-950/20 border-emerald-primary/40'
                  : 'bg-obsidian-surface border-obsidian-border hover:border-obsidian-hover'
              }`}
            >
              <div className="mt-0.5">
                {val1Checked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-primary" />
                ) : (
                  <Square className="w-4 h-4 text-nordic-muted" />
                )}
              </div>
              <span className="text-xs text-nordic-text leading-relaxed">
                {t.modalDeleteInstance?.validation1Label}
              </span>
            </label>
          </div>

          {/* 2. VALIDASI LANGKAH KEDUA (Pengetikan Kode Captcha Acak) */}
          <div className="pt-2 border-t border-obsidian-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                {t.modalDeleteInstance?.validation2Title}
              </div>
              <button
                type="button"
                onClick={refreshCaptcha}
                title="Muat ulang kode acak"
                className="flex items-center space-x-1 text-[11px] text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t.modalDeleteInstance?.refreshCaptcha || 'Muat Ulang'}</span>
              </button>
            </div>
            <p className="text-xs text-nordic-muted leading-relaxed">
              {t.modalDeleteInstance?.validation2Label ||
                'Ketik kode verifikasi acak berikut secara manual:'}
            </p>

            {/* Target Captcha Display Box */}
            <div className="flex items-center justify-between p-3 rounded bg-obsidian-bg border border-red-500/30 select-none">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono text-nordic-muted">
                  {t.modalDeleteInstance?.captchaLabel || 'Kode Verifikasi:'}
                </span>
                <span className="font-mono text-base font-bold text-red-400 tracking-widest px-2.5 py-1 rounded bg-red-950/40 border border-red-500/40">
                  {captchaCode}
                </span>
              </div>
              <span className="text-[10px] text-red-400/80 font-mono">
                *Ketik persis huruf & simbol
              </span>
            </div>

            {/* Input field with Paste disabled */}
            <div className="space-y-1.5">
              <input
                type="text"
                value={val2Text}
                onChange={(e) => {
                  setVal2Text(e.target.value);
                  setErrorMsg(null);
                }}
                onPaste={handlePasteAttempt}
                placeholder={
                  t.modalDeleteInstance?.validation2Placeholder ||
                  'Ketik kode acak di atas...'
                }
                className={`w-full px-3 py-2 text-xs rounded bg-obsidian-surface border font-mono tracking-widest focus:outline-none transition-colors ${
                  isTextMatch
                    ? 'border-emerald-primary text-emerald-active bg-emerald-950/15'
                    : 'border-obsidian-border text-nordic-text focus:border-red-500'
                }`}
                autoFocus
              />

              {/* Progress and Match Feedback */}
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span
                  className={
                    isTextMatch
                      ? 'text-emerald-primary font-semibold flex items-center space-x-1'
                      : 'text-nordic-muted'
                  }
                >
                  {isTextMatch ? (
                    <span className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-primary" />
                      <span>{t.modalDeleteInstance?.textMatchSuccess || 'Kode verifikasi cocok'}</span>
                    </span>
                  ) : (
                    <span>{t.modalDeleteInstance?.textMatchPending || 'Menunggu pengetikan kode yang cocok...'}</span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-nordic-muted">
                  {val2Text.trim().length} / {captchaCode.length} karakter
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded bg-red-900/30 border border-red-500/50 text-xs text-red-300 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-obsidian-border flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 rounded text-xs text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
            >
              {t.modalDeleteInstance?.cancelBtn || 'Batal'}
            </button>
            <button
              type="submit"
              disabled={!canDelete}
              className="flex items-center space-x-1.5 px-4 py-2 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {deleting
                  ? t.modalDeleteInstance?.deleting || 'Menghapus...'
                  : t.modalDeleteInstance?.deleteBtn || 'Hapus Profil Launcher'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
