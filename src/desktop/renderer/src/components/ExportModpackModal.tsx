import React, { useState, useEffect } from 'react';
import { Package, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface ExportModpackModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceName?: string;
}

export const ExportModpackModal: React.FC<ExportModpackModalProps> = ({
  isOpen,
  onClose,
  instanceName,
}) => {
  const { t } = useLanguage();
  const [format, setFormat] = useState<'mrpack' | 'zip'>('mrpack');
  const [name, setName] = useState(instanceName || 'My Modpack');
  const [version, setVersion] = useState('1.0.0');
  const [summary, setSummary] = useState('');
  const [includeConfigs, setIncludeConfigs] = useState(true);
  const [includeResourcepacks, setIncludeResourcepacks] = useState(false);
  const [includeShaderpacks, setIncludeShaderpacks] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('active');
  const [savedProfiles, setSavedProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(instanceName || 'My Modpack');
    setResultMessage(null);
    setErrorMessage(null);

    const loadProfiles = async () => {
      try {
        const list = await window.api.modpack.listProfiles();
        if (Array.isArray(list)) {
          setSavedProfiles(list);
        }
      } catch {}
    };
    loadProfiles();
  }, [isOpen, instanceName]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      const res = await window.api.modpack.export({
        format,
        name: name.trim() || 'Modpack',
        version: version.trim() || '1.0.0',
        summary: summary.trim() || undefined,
        includeConfigs,
        includeResourcepacks,
        includeShaderpacks,
        profileId: selectedProfile !== 'active' ? selectedProfile : undefined,
      });

      if (res.success) {
        setResultMessage(
          t.export.exportSuccess
            .replace('{path}', res.outputPath || '')
            .replace('{count}', String(res.filesCount || 0))
            .replace('{size}', res.sizeBytes ? `${(res.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : '')
        );
        setTimeout(() => {
          onClose();
        }, 2500);
      } else if (res.error && res.error !== 'Dibatalkan oleh pengguna') {
        setErrorMessage(res.error || t.export.exportFailed);
      }
    } catch (err: any) {
      setErrorMessage(err.message || t.export.exportFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0D1310] border border-[#1E2822] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2822] bg-[#131B16]">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">{t.export.modalTitle}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#1E2822] rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {resultMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{resultMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">{t.export.formatLabel}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('mrpack')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  format === 'mrpack'
                    ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                    : 'border-[#1E2822] bg-[#131B16] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-xs font-semibold">.mrpack</div>
                <div className="text-[10px] opacity-75">Modrinth Standard</div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('zip')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  format === 'zip'
                    ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                    : 'border-[#1E2822] bg-[#131B16] text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-xs font-semibold">.zip</div>
                <div className="text-[10px] opacity-75">Standalone Archive</div>
              </button>
            </div>
          </div>

          {savedProfiles.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">{t.export.sourceLabel}</label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#131B16] border border-[#1E2822] focus:border-emerald-500/60 rounded-lg text-xs text-zinc-200 outline-none"
              >
                <option value="active">{t.export.sourceActive}</option>
                {savedProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    Profil: {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">{t.export.packName}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-[#131B16] border border-[#1E2822] focus:border-emerald-500/60 rounded-lg text-xs text-zinc-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">{t.export.packVersion}</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-[#131B16] border border-[#1E2822] focus:border-emerald-500/60 rounded-lg text-xs text-zinc-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">{t.export.packSummary}</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Optimized vanilla performance pack"
              className="w-full px-3 py-1.5 bg-[#131B16] border border-[#1E2822] focus:border-emerald-500/60 rounded-lg text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2 pt-1 border-t border-[#1E2822]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeConfigs}
                onChange={(e) => setIncludeConfigs(e.target.checked)}
                className="rounded bg-[#131B16] border-[#1E2822] text-emerald-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">{t.export.includeConfigs}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeResourcepacks}
                onChange={(e) => setIncludeResourcepacks(e.target.checked)}
                className="rounded bg-[#131B16] border-[#1E2822] text-emerald-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">{t.export.includeResourcepacks}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeShaderpacks}
                onChange={(e) => setIncludeShaderpacks(e.target.checked)}
                className="rounded bg-[#131B16] border-[#1E2822] text-emerald-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">{t.export.includeShaderpacks}</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E2822]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg border border-[#1E2822] text-xs font-medium text-zinc-300 hover:bg-[#131B16] transition-colors"
            >
              {t.export.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.export.exporting}</span>
                </>
              ) : (
                <span>{t.export.exportBtn}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
