import React, { useState, useEffect } from 'react';
import { Folder, X, CheckCircle2, RotateCcw, Save, FolderOpen, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface ConfigurePathsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: {
    id: string;
    name: string;
    launcher: string;
    rootDir: string;
    modsDir: string;
    resourcepacksDir?: string;
    shaderpacksDir?: string;
    modpacksDir?: string;
  } | null;
  onSaved: () => void;
}

export const ConfigurePathsModal: React.FC<ConfigurePathsModalProps> = ({
  isOpen,
  onClose,
  instance,
  onSaved,
}) => {
  const { t } = useLanguage();
  const [modsDir, setModsDir] = useState('');
  const [resourcepacksDir, setResourcepacksDir] = useState('');
  const [shaderpacksDir, setShaderpacksDir] = useState('');
  const [modpacksDir, setModpacksDir] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (instance) {
      setModsDir(instance.modsDir || '');
      setResourcepacksDir(instance.resourcepacksDir || '');
      setShaderpacksDir(instance.shaderpacksDir || '');
      setModpacksDir(instance.modpacksDir || '');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [instance, isOpen]);

  if (!isOpen || !instance) return null;

  const handleBrowse = async (field: 'mods' | 'resourcepacks' | 'shaderpacks' | 'modpacks') => {
    try {
      const titles = {
        mods: t.modalPaths.modsLabel,
        resourcepacks: t.modalPaths.resourcepacksLabel,
        shaderpacks: t.modalPaths.shaderpacksLabel,
        modpacks: t.modalPaths.modpacksLabel,
      };
      const res = await window.api.instances.selectFolder(titles[field]);
      if (res.success && res.path) {
        if (field === 'mods') setModsDir(res.path);
        else if (field === 'resourcepacks') setResourcepacksDir(res.path);
        else if (field === 'shaderpacks') setShaderpacksDir(res.path);
        else if (field === 'modpacks') setModpacksDir(res.path);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleResetDefaults = () => {
    if (!instance) return;
    const defaultMods = `${instance.rootDir}/mods`.replace(/[\\]/g, '/');
    setModsDir(defaultMods);
    setResourcepacksDir('');
    setShaderpacksDir('');
    setModpacksDir('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await window.api.instances.updateCustomPaths(instance.id, {
        modsDir: modsDir.trim() || undefined,
        resourcepacksDir: resourcepacksDir.trim() || undefined,
        shaderpacksDir: shaderpacksDir.trim() || undefined,
        modpacksDir: modpacksDir.trim() || undefined,
      });

      if (res.success) {
        setSuccessMessage(t.modalPaths.savedSuccess);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Failed to update custom paths');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const defaultRp = `${instance.rootDir}/resourcepacks`.replace(/[\\]/g, '/');
  const defaultSp = `${instance.rootDir}/shaderpacks`.replace(/[\\]/g, '/');
  const defaultMp = `${instance.rootDir}/versions`.replace(/[\\]/g, '/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-bg/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-obsidian-card border border-obsidian-border rounded-lg shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-obsidian-border bg-obsidian-surface/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-dark/30 border border-emerald-primary/40 flex items-center justify-center text-emerald-primary">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-nordic-text">
                {t.modalPaths.title}
              </h2>
              <p className="text-[11px] text-nordic-muted truncate max-w-xs md:max-w-md">
                {instance.name} ({instance.launcher})
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4">
          <p className="text-xs text-nordic-muted">
            {t.modalPaths.subtitle}
          </p>

          {/* 1. Mods Folder */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-nordic-text flex items-center justify-between">
              <span>{t.modalPaths.modsLabel}</span>
              <span className="text-[10px] text-emerald-primary font-mono font-normal">Wajib</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={modsDir}
                onChange={(e) => setModsDir(e.target.value)}
                placeholder="Path ke folder mods"
                className="flex-1 px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border text-nordic-text font-mono focus:border-emerald-primary focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => handleBrowse('mods')}
                className="px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border hover:border-emerald-primary/50 text-nordic-text transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Folder className="w-3.5 h-3.5 text-emerald-primary" />
                <span>{t.modalPaths.browseBtn}</span>
              </button>
            </div>
          </div>

          {/* 2. Resource Packs Folder */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-nordic-text flex items-center justify-between">
              <span>{t.modalPaths.resourcepacksLabel}</span>
              <span className="text-[10px] text-nordic-muted font-mono font-normal">Opsional</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={resourcepacksDir}
                onChange={(e) => setResourcepacksDir(e.target.value)}
                placeholder={t.modalPaths.placeholderDefault.replace('{path}', defaultRp)}
                className="flex-1 px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border text-nordic-text font-mono focus:border-emerald-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleBrowse('resourcepacks')}
                className="px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border hover:border-emerald-primary/50 text-nordic-text transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Folder className="w-3.5 h-3.5 text-emerald-primary" />
                <span>{t.modalPaths.browseBtn}</span>
              </button>
            </div>
          </div>

          {/* 3. Shader Packs Folder */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-nordic-text flex items-center justify-between">
              <span>{t.modalPaths.shaderpacksLabel}</span>
              <span className="text-[10px] text-nordic-muted font-mono font-normal">Opsional</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shaderpacksDir}
                onChange={(e) => setShaderpacksDir(e.target.value)}
                placeholder={t.modalPaths.placeholderDefault.replace('{path}', defaultSp)}
                className="flex-1 px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border text-nordic-text font-mono focus:border-emerald-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleBrowse('shaderpacks')}
                className="px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border hover:border-emerald-primary/50 text-nordic-text transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Folder className="w-3.5 h-3.5 text-emerald-primary" />
                <span>{t.modalPaths.browseBtn}</span>
              </button>
            </div>
          </div>

          {/* 4. Modpacks / Containers Folder */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-nordic-text flex items-center justify-between">
              <span>{t.modalPaths.modpacksLabel}</span>
              <span className="text-[10px] text-nordic-muted font-mono font-normal">Opsional (Versions / Instances)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={modpacksDir}
                onChange={(e) => setModpacksDir(e.target.value)}
                placeholder={t.modalPaths.placeholderDefault.replace('{path}', defaultMp)}
                className="flex-1 px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border text-nordic-text font-mono focus:border-emerald-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleBrowse('modpacks')}
                className="px-3 py-2 text-xs rounded bg-obsidian-surface border border-obsidian-border hover:border-emerald-primary/50 text-nordic-text transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Folder className="w-3.5 h-3.5 text-emerald-primary" />
                <span>{t.modalPaths.browseBtn}</span>
              </button>
            </div>
          </div>

          {/* Alert Messages */}
          {errorMessage && (
            <div className="p-3 rounded bg-red-900/30 border border-red-500/50 flex items-center space-x-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded bg-emerald-dark/30 border border-emerald-primary/50 flex items-center space-x-2 text-xs text-emerald-active font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-primary" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-obsidian-border flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center space-x-1.5 px-3 py-2 rounded text-xs text-nordic-muted hover:text-nordic-text bg-obsidian-surface border border-obsidian-border hover:bg-obsidian-hover transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.modalPaths.resetBtn}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded text-xs text-nordic-muted hover:text-nordic-text transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-1.5 px-4 py-2 rounded text-xs font-semibold bg-emerald-primary text-obsidian-bg hover:bg-emerald-active transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? t.modalPaths.saving : t.modalPaths.saveBtn}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

