import React, { useState, useEffect } from 'react';
import { Cpu, X, CheckCircle2, AlertCircle, Loader2, Sparkles, Layers } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface EditVersionLoaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: {
    id: string;
    name: string;
    gameVersion?: string;
    loader?: string;
  } | null;
  onSaved: () => void;
}

const LOADERS = [
  { id: 'fabric', label: 'Fabric', desc: 'Lightweight & fast' },
  { id: 'forge', label: 'Forge', desc: 'Extensive mod library' },
  { id: 'neoforge', label: 'NeoForge', desc: 'Modern Forge fork' },
  { id: 'quilt', label: 'Quilt', desc: 'Fabric compatible ecosystem' },
];

export const EditVersionLoaderModal: React.FC<EditVersionLoaderModalProps> = ({
  isOpen,
  onClose,
  instance,
  onSaved,
}) => {
  const { t } = useLanguage();
  const [loader, setLoader] = useState<'fabric' | 'forge' | 'neoforge' | 'quilt'>('fabric');
  const [gameVersion, setGameVersion] = useState('1.21.1');
  const [versions, setVersions] = useState<string[]>([]);
  const [autoSnapshot, setAutoSnapshot] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetchingVersions, setFetchingVersions] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (instance) {
      if (instance.loader && ['fabric', 'forge', 'neoforge', 'quilt'].includes(instance.loader.toLowerCase())) {
        setLoader(instance.loader.toLowerCase() as any);
      }
      if (instance.gameVersion) {
        setGameVersion(instance.gameVersion);
      }
    }
  }, [instance]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchVersions = async () => {
      setFetchingVersions(true);
      try {
        const list = await window.api.minecraft.getVersions();
        if (list && list.length > 0) {
          setVersions(list);
          if (!instance?.gameVersion) {
            setGameVersion(list[0]);
          }
        }
      } catch {
        setVersions(['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5']);
      } finally {
        setFetchingVersions(false);
      }
    };
    fetchVersions();
  }, [isOpen, instance]);

  if (!isOpen || !instance) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      if (autoSnapshot) {
        const res = await window.api.instances.switchVersionAndLoader(loader, gameVersion);
        if (res.success) {
          setResultMessage(
            (t.modalVersion?.syncSuccess || 'Profil berhasil diselaraskan ke {loader} {version}. ({saved} mod disimpan, {restored} dipulihkan)')
              .replace('{loader}', loader.toUpperCase())
              .replace('{version}', gameVersion)
              .replace('{saved}', String(res.savedCount ?? 0))
              .replace('{restored}', String(res.restoredCount ?? 0))
          );
          setTimeout(() => {
            onSaved();
            onClose();
          }, 1500);
        } else {
          setErrorMessage(res.error || t.modalVersion?.syncFailed || 'Gagal mengubah profil versi.');
        }
      } else {
        const res = await window.api.instances.updateConfig(instance.id, {
          loader,
          gameVersion,
        });
        if (res.success) {
          setResultMessage(
            (t.modalVersion?.configSuccess || 'Konfigurasi instance berhasil diperbarui ke {loader} {version}.')
              .replace('{loader}', loader.toUpperCase())
              .replace('{version}', gameVersion)
          );
          setTimeout(() => {
            onSaved();
            onClose();
          }, 1200);
        } else {
          setErrorMessage(res.error || t.modalVersion?.configFailed || 'Gagal memperbarui konfigurasi.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || t.modalVersion?.processError || 'Terjadi kesalahan saat memproses.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0D1310] border border-[#1E2822] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2822] bg-[#131B16]">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{t.modalVersion.title}</h3>
              <p className="text-[11px] text-zinc-400 font-mono">{instance.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#1E2822] rounded transition-colors cursor-pointer"
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
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {t.modalVersion.loaderLabel}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LOADERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLoader(item.id as any)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    loader === item.id
                      ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                      : 'border-[#1E2822] bg-[#131B16] text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-semibold">{item.label}</div>
                  <div className="text-[10px] opacity-75">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {t.modalVersion.versionLabel}
            </label>
            <div className="relative">
              <select
                value={gameVersion}
                onChange={(e) => setGameVersion(e.target.value)}
                disabled={fetchingVersions || loading}
                className="w-full px-3 py-2 bg-[#131B16] border border-[#1E2822] rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60 font-mono cursor-pointer"
              >
                {versions.map((ver) => (
                  <option key={ver} value={ver} className="bg-[#0D1310] text-zinc-200">
                    Minecraft {ver}
                  </option>
                ))}
              </select>
              {fetchingVersions && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-[#131B16] border border-[#1E2822] rounded-lg">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSnapshot}
                onChange={(e) => setAutoSnapshot(e.target.checked)}
                className="mt-0.5 rounded border-[#1E2822] text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-[#0D1310] cursor-pointer"
              />
              <div className="text-xs">
                <span className="text-zinc-200 font-medium block">
                  {t.modalVersion.snapshotToggle}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  Menyimpan mod lama ke cadangan snapshot terisolasi dan menyiapkan direktori mods bersih untuk versi ini.
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E2822]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg border border-[#1E2822] bg-[#131B16] text-xs font-medium text-zinc-300 hover:bg-[#1A241E] transition-colors cursor-pointer"
            >
              {t.modalVersion.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? t.modalVersion.saving : t.modalVersion.saveBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

