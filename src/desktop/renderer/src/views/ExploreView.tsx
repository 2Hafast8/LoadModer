import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Check,
  RefreshCw,
  Sparkles,
  Package,
  Layers,
  Palette,
  AlertCircle,
} from 'lucide-react';

interface ProjectHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  author: string;
  downloads: number;
  follows: number;
  categories: string[];
  project_type: string;
}

export const ExploreView: React.FC = () => {
  const [query, setQuery] = useState('sodium');
  const [projectType, setProjectType] = useState<'mod' | 'shader' | 'resourcepack'>('mod');
  const [loader, setLoader] = useState<'all' | 'fabric' | 'forge' | 'neoforge'>('all');
  const [hits, setHits] = useState<ProjectHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const searchModrinth = async (customQuery?: string) => {
    const q = customQuery !== undefined ? customQuery : query;
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await window.api.modrinth.search(q, {
        type: projectType,
        loader: loader !== 'all' ? loader : undefined,
        limit: 24,
      });
      setHits(res.hits ?? []);
    } catch (err: any) {
      console.error('Search failed:', err);
      setStatusMessage({ text: 'Gagal memuat hasil dari Modrinth API', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchModrinth();
  }, [projectType, loader]);

  const handleInstall = async (hit: ProjectHit) => {
    setInstallingId(hit.project_id);
    setStatusMessage(null);
    try {
      const res = await window.api.modrinth.install(hit.slug, {
        type: hit.project_type,
        loader: loader !== 'all' ? loader : undefined,
      });

      if (res.success) {
        setInstalledMap((prev) => ({ ...prev, [hit.project_id]: true }));
        setStatusMessage({
          text: `Berhasil mengunduh dan memasang ${hit.title}`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.error ?? `Gagal memasang ${hit.title}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setInstallingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* Sub-header Filter & Search */}
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            searchModrinth();
          }}
          className="relative flex-1 max-w-lg flex items-center"
        >
          <Search className="w-4 h-4 absolute left-3 text-nordic-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari mod, shader, resource pack di Modrinth..."
            className="w-full bg-obsidian-card border border-obsidian-border rounded pl-9 pr-20 py-1.5 text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary transition-colors"
          />
          <button
            type="submit"
            className="absolute right-1 px-2.5 py-1 rounded bg-emerald-primary text-obsidian-bg text-[11px] font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
          >
            Cari
          </button>
        </form>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          {/* Project Type */}
          <div className="flex items-center bg-obsidian-card border border-obsidian-border rounded p-0.5 text-xs">
            <button
              onClick={() => setProjectType('mod')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors ${
                projectType === 'mod'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Package className="w-3 h-3" />
              <span>Mod</span>
            </button>
            <button
              onClick={() => setProjectType('shader')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors ${
                projectType === 'shader'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Shader</span>
            </button>
            <button
              onClick={() => setProjectType('resourcepack')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors ${
                projectType === 'resourcepack'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Palette className="w-3 h-3" />
              <span>Resource Pack</span>
            </button>
          </div>

          {/* Loader Filter */}
          <select
            value={loader}
            onChange={(e) => setLoader(e.target.value as any)}
            className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-muted focus:outline-none focus:border-emerald-primary cursor-pointer"
          >
            <option value="all">Semua Loader</option>
            <option value="fabric">Fabric</option>
            <option value="forge">Forge</option>
            <option value="neoforge">NeoForge</option>
          </select>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`px-4 py-2 text-xs flex items-center space-x-2 border-b ${
            statusMessage.type === 'success'
              ? 'bg-emerald-dark/30 border-emerald-primary text-emerald-active'
              : 'bg-status-danger/10 border-status-danger text-status-danger'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Grid Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-nordic-muted">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span className="text-xs">Menghubungi Modrinth API v2...</span>
          </div>
        ) : hits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center text-nordic-muted">
            <Search className="w-8 h-8 opacity-40" />
            <span className="text-xs">Tidak ada hasil yang cocok dengan kriteria pencarian.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hits.map((hit) => {
              const isInstalled = installedMap[hit.project_id];
              const isInstalling = installingId === hit.project_id;

              return (
                <div
                  key={hit.project_id}
                  className="bg-obsidian-card border border-obsidian-border rounded p-3.5 flex flex-col justify-between hover:border-obsidian-hover transition-colors"
                >
                  <div>
                    {/* Header: Icon + Title + Author */}
                    <div className="flex items-start space-x-3 mb-2">
                      {hit.icon_url ? (
                        <img
                          src={hit.icon_url}
                          alt={hit.title}
                          className="w-10 h-10 rounded object-cover bg-obsidian-surface shrink-0 border border-obsidian-border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-obsidian-surface border border-obsidian-border flex items-center justify-center shrink-0 text-emerald-primary">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-nordic-text truncate">
                          {hit.title}
                        </h4>
                        <span className="text-[11px] text-nordic-muted truncate block">
                          oleh {hit.author}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-nordic-muted line-clamp-2 mb-3 leading-relaxed">
                      {hit.description}
                    </p>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {hit.categories.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="px-1.5 py-0.5 rounded bg-obsidian-surface border border-obsidian-border text-[10px] font-mono text-nordic-muted"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer: Stats & Install Button */}
                  <div className="pt-2.5 border-t border-obsidian-border flex items-center justify-between">
                    <span className="text-[10px] font-mono text-nordic-muted">
                      {(hit.downloads / 1000).toFixed(0)}k unduhan
                    </span>

                    <button
                      onClick={() => handleInstall(hit)}
                      disabled={isInstalling || isInstalled}
                      className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        isInstalled
                          ? 'bg-emerald-dark/30 text-emerald-active border border-emerald-primary/40 cursor-default'
                          : isInstalling
                          ? 'bg-obsidian-hover text-nordic-muted cursor-wait'
                          : 'bg-emerald-primary text-obsidian-bg font-semibold hover:bg-emerald-active'
                      }`}
                    >
                      {isInstalled ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Terpasang</span>
                        </>
                      ) : isInstalling ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Memasang...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3" />
                          <span>Instal</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
