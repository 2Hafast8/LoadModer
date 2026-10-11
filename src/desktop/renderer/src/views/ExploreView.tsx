import React, { useState, useEffect, useRef } from 'react';
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
  FileArchive,
  ArrowUpDown,
  ArrowLeft,
  ExternalLink,
  Code2,
  Bug,
  BookOpen,
  MessageSquare,
  Users,
  Calendar,
  Shield,
  FileCode,
  X,
} from 'lucide-react';
import { MarkdownViewer } from '../components/MarkdownViewer.js';

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
  const [query, setQuery] = useState('');
  const [projectType, setProjectType] = useState<'mod' | 'modpack' | 'shader' | 'resourcepack'>('mod');
  const [loader, setLoader] = useState<'all' | 'fabric' | 'forge' | 'neoforge'>('all');
  const [sortIndex, setSortIndex] = useState<'relevance' | 'downloads' | 'newest' | 'updated'>('downloads');
  const [hits, setHits] = useState<ProjectHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeInstance, setActiveInstance] = useState<{
    name: string;
    gameVersion?: string;
    loader?: string;
  } | null>(null);
  const [installedIndex, setInstalledIndex] = useState<{
    projectIds: string[];
    slugs: string[];
    filenames: string[];
    versionMap: Record<string, string>;
  }>({ projectIds: [], slugs: [], filenames: [], versionMap: {} });

  // Detail Page State
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<any | null>(null);
  const [projectVersions, setProjectVersions] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'description' | 'versions'>('description');

  const fetchInstalledIndex = async () => {
    try {
      const idx = await window.api.mods.getInstalledIndex();
      if (idx) {
        setInstalledIndex(idx);
      }
    } catch {}
  };

  const fetchActiveInstance = async () => {
    try {
      const data = await window.api.instances.getAll();
      if (data.active) {
        setActiveInstance({
          name: data.active.name,
          gameVersion: data.active.gameVersion,
          loader: data.active.loader,
        });
        if (data.active.loader && ['fabric', 'forge', 'neoforge'].includes(data.active.loader.toLowerCase())) {
          setLoader(data.active.loader.toLowerCase() as any);
        }
      }
    } catch (err) {
      console.error('Failed to get active instance in Explore:', err);
    }
  };

  useEffect(() => {
    fetchInstalledIndex();
    fetchActiveInstance();
    const unsub = window.api.mods.onChanged?.(() => {
      fetchInstalledIndex();
      fetchActiveInstance();
    });
    return () => unsub?.();
  }, []);

  const checkIsInstalled = (item: { project_id?: string; id?: string; slug?: string }) => {
    const pid = (item.project_id || item.id || '').toLowerCase().trim();
    const slug = (item.slug || '').toLowerCase().trim();

    if (pid && (installedIndex.projectIds.includes(pid) || installedMap[pid])) return true;
    if (slug && (installedIndex.slugs.includes(slug) || installedMap[slug])) return true;

    if (slug) {
      return installedIndex.filenames.some((f) => {
        const cleanF = f.toLowerCase();
        return cleanF.startsWith(slug + '-') || cleanF.startsWith(slug + '.') || cleanF.includes(slug);
      });
    }
    return false;
  };

  const searchModrinth = async (customQuery?: string) => {
    const q = customQuery !== undefined ? customQuery : query;
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await window.api.modrinth.search(q, {
        type: projectType,
        loader: loader !== 'all' ? loader : undefined,
        limit: 24,
        index: q.trim() ? (sortIndex === 'downloads' ? 'relevance' : sortIndex) : sortIndex,
      });

      if (res.error) {
        setStatusMessage({ text: res.error, type: 'error' });
        setHits([]);
      } else {
        setHits(res.hits ?? []);
      }
    } catch (err: any) {
      console.error('Search failed:', err);
      setStatusMessage({ text: err.message || 'Gagal memuat katalog Modrinth API', type: 'error' });
      setHits([]);
    } finally {
      setLoading(false);
    }
  };

  const isFirstRender = useRef(true);

  // Debounced instant live search as user types
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      searchModrinth(query);
      return;
    }

    const timer = setTimeout(() => {
      searchModrinth(query);
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  // Immediate search when filter criteria change
  useEffect(() => {
    if (!isFirstRender.current) {
      searchModrinth(query);
    }
  }, [projectType, loader, sortIndex]);

  // Fetch full details when a project is selected
  const handleOpenDetail = async (hit: ProjectHit) => {
    setSelectedSlug(hit.slug);
    setDetailLoading(true);
    setDetailTab('description');
    setProjectDetail(null);
    setProjectVersions([]);

    try {
      const [project, versions] = await Promise.all([
        window.api.modrinth.getProject(hit.slug),
        window.api.modrinth.getVersions(hit.slug, {
          loader: loader !== 'all' ? loader : undefined,
        }),
      ]);

      setProjectDetail(project ?? hit);
      setProjectVersions(versions ?? []);
    } catch (err) {
      console.error('Failed to load project details:', err);
      setProjectDetail(hit);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleInstall = async (slug: string, id: string, type: string) => {
    setInstallingId(id);
    setStatusMessage(null);
    try {
      const res = await window.api.modrinth.install(slug, {
        type,
        loader: loader !== 'all' ? loader : undefined,
      });

      if (res.success) {
        setInstalledMap((prev) => ({ ...prev, [id]: true, [slug]: true }));
        await fetchInstalledIndex();
        setStatusMessage({
          text: res.message ?? `Berhasil memasang ${slug}`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.error ?? `Gagal memasang ${slug}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setInstallingId(null);
    }
  };

  const handleInstallVersion = async (v: any) => {
    if (!projectDetail) return;
    setInstallingId(v.id);
    setStatusMessage(null);
    try {
      const res = await window.api.modrinth.install(projectDetail.slug, {
        type: projectDetail.project_type || projectType,
        loader: loader !== 'all' ? loader : undefined,
        versionId: v.id,
      });

      if (res.success) {
        setInstalledMap((prev) => ({
          ...prev,
          [projectDetail.id || projectDetail.project_id]: true,
          [projectDetail.slug]: true,
        }));
        await fetchInstalledIndex();
        setStatusMessage({
          text: res.message ?? `Berhasil memasang versi ${v.version_number}`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.error ?? `Gagal memasang versi ${v.version_number}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setInstallingId(null);
    }
  };

  const handleInstallLocalMrpack = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await window.api.modrinth.installLocalMrpack();
      if (res.success) {
        setStatusMessage({
          text: res.message ?? 'Modpack lokal berhasil dipasang!',
          type: 'success',
        });
      } else if (res.error) {
        setStatusMessage({ text: res.error, type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- Render Project Detail View ---
  if (selectedSlug) {
    const isInstalled = projectDetail ? checkIsInstalled(projectDetail) : false;
    const isInstalling = projectDetail ? installingId === (projectDetail.id || projectDetail.project_id) : false;

    return (
      <div className="flex flex-col h-full bg-obsidian-bg overflow-hidden">
        {/* Detail Top Bar */}
        <div className="p-3.5 border-b border-obsidian-border bg-obsidian-surface flex items-center justify-between">
          <button
            onClick={() => setSelectedSlug(null)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-primary" />
            <span>Kembali ke Jelajahi</span>
          </button>

          {projectDetail && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-obsidian-card border border-obsidian-border text-emerald-primary">
                {projectDetail.project_type || projectType}
              </span>
              <button
                onClick={() =>
                  handleInstall(
                    projectDetail.slug,
                    projectDetail.id || projectDetail.project_id,
                    projectDetail.project_type || projectType
                  )
                }
                disabled={isInstalling || isInstalled}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  isInstalled
                    ? 'bg-obsidian-card border border-emerald-primary/40 text-emerald-primary'
                    : 'bg-emerald-primary text-obsidian-bg hover:bg-emerald-active'
                }`}
              >
                {isInstalling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memasang & Resolusi Dependensi...</span>
                  </>
                ) : isInstalled ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Sudah Terpasang</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Pasang Proyek Ini</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Status Toast */}
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

        {/* Detail Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3 text-nordic-muted text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
              <span>Memuat detail metadata dari Modrinth API...</span>
            </div>
          ) : projectDetail ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Project Hero Header */}
              <div className="p-5 rounded border border-obsidian-border bg-obsidian-surface flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-5">
                <div className="w-20 h-20 rounded bg-obsidian-card border border-obsidian-border overflow-hidden shrink-0 flex items-center justify-center">
                  {projectDetail.icon_url ? (
                    <img src={projectDetail.icon_url} alt={projectDetail.title} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-emerald-primary/60" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-bold text-nordic-text">{projectDetail.title}</h1>
                    <span className="text-[11px] font-mono text-nordic-muted">({projectDetail.slug})</span>
                  </div>

                  <p className="text-xs text-nordic-muted leading-relaxed">{projectDetail.description}</p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-nordic-muted">
                    <span className="flex items-center space-x-1">
                      <Download className="w-3.5 h-3.5 text-emerald-primary" />
                      <span>{projectDetail.downloads ? projectDetail.downloads.toLocaleString() : 0} unduhan</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-nordic-muted" />
                      <span>{projectDetail.followers || projectDetail.follows ? (projectDetail.followers || projectDetail.follows).toLocaleString() : 0} pengikut</span>
                    </span>
                    {projectDetail.license?.name && (
                      <span className="flex items-center space-x-1">
                        <Shield className="w-3.5 h-3.5 text-nordic-muted" />
                        <span>Lisensi: {projectDetail.license.name}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* External Links Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {projectDetail.source_url && (
                  <a
                    href={projectDetail.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Source Code</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                  </a>
                )}
                {projectDetail.issues_url && (
                  <a
                    href={projectDetail.issues_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors"
                  >
                    <Bug className="w-3.5 h-3.5" />
                    <span>Issue Tracker</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                  </a>
                )}
                {projectDetail.wiki_url && (
                  <a
                    href={projectDetail.wiki_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Dokumentasi / Wiki</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                  </a>
                )}
                {projectDetail.discord_url && (
                  <a
                    href={projectDetail.discord_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Komunitas Discord</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                  </a>
                )}
              </div>

              {/* Detail Tabs */}
              <div className="border-b border-obsidian-border flex items-center space-x-4">
                <button
                  onClick={() => setDetailTab('description')}
                  className={`pb-2.5 text-xs font-semibold cursor-pointer transition-colors border-b-2 ${
                    detailTab === 'description'
                      ? 'border-emerald-primary text-emerald-active'
                      : 'border-transparent text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  Deskripsi Lengkap
                </button>
                <button
                  onClick={() => setDetailTab('versions')}
                  className={`pb-2.5 text-xs font-semibold cursor-pointer transition-colors border-b-2 ${
                    detailTab === 'versions'
                      ? 'border-emerald-primary text-emerald-active'
                      : 'border-transparent text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  Daftar Versi ({projectVersions.length})
                </button>
              </div>

              {/* Tab Content */}
              {detailTab === 'description' ? (
                <div className="p-6 rounded border border-obsidian-border bg-obsidian-surface">
                  <MarkdownViewer content={projectDetail.body || projectDetail.description} />
                </div>
              ) : (
                <div className="rounded border border-obsidian-border bg-obsidian-surface overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-obsidian-card text-nordic-muted font-medium border-b border-obsidian-border">
                      <tr>
                        <th className="px-4 py-2.5">Rilis Versi</th>
                        <th className="px-4 py-2.5">Minecraft</th>
                        <th className="px-4 py-2.5">Loader</th>
                        <th className="px-4 py-2.5">Tipe</th>
                        <th className="px-4 py-2.5">Tanggal</th>
                        <th className="px-4 py-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-border">
                      {projectVersions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-nordic-muted">
                            Tidak ada versi yang cocok dengan filter saat ini.
                          </td>
                        </tr>
                      ) : (
                        projectVersions.map((v) => {
                          const vName = v.version_number || v.name;
                          const pId = (projectDetail?.id || projectDetail?.project_id || '').toLowerCase();
                          const pSlug = (projectDetail?.slug || '').toLowerCase();
                          const isThisVerInstalled =
                            (installedIndex.versionMap[pId] && installedIndex.versionMap[pId] === vName) ||
                            (installedIndex.versionMap[pSlug] && installedIndex.versionMap[pSlug] === vName) ||
                            (v.files?.[0]?.filename && installedIndex.filenames.includes(v.files[0].filename));
                          const isAnyVerInstalled = checkIsInstalled(projectDetail);

                          const isLoaderMatch =
                            !activeInstance?.loader ||
                            (v.loaders &&
                              (v.loaders.map((l: string) => l.toLowerCase()).includes(activeInstance.loader.toLowerCase()) ||
                                (activeInstance.loader.toLowerCase() === 'quilt' &&
                                  v.loaders.map((l: string) => l.toLowerCase()).includes('fabric'))));

                          const isGameVerMatch =
                            !activeInstance?.gameVersion ||
                            (v.game_versions && v.game_versions.includes(activeInstance.gameVersion));

                          const isCompatible = isLoaderMatch && isGameVerMatch;

                          return (
                            <tr key={v.id} className="hover:bg-obsidian-hover/40 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-nordic-text">
                                <div className="flex items-center space-x-2">
                                  <span>{v.name || v.version_number}</span>
                                  {!isCompatible && (
                                    <span
                                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-600/40 text-[10px] font-semibold text-amber-400"
                                      title={`Versi ini berbeda dengan instance aktif (${activeInstance?.loader?.toUpperCase()} ${activeInstance?.gameVersion})`}
                                    >
                                      <AlertCircle className="w-3 h-3 text-amber-400" />
                                      <span>Beda {!isLoaderMatch ? 'Loader' : 'MC'}</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-nordic-muted">
                                <span className={!isGameVerMatch ? 'text-amber-400/80 font-semibold' : ''}>
                                  {v.game_versions ? v.game_versions.slice(0, 3).join(', ') : '-'}
                                  {v.game_versions && v.game_versions.length > 3 ? ` +${v.game_versions.length - 3}` : ''}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`capitalize text-[11px] px-1.5 py-0.5 rounded border ${
                                    isLoaderMatch
                                      ? 'bg-obsidian-card border-obsidian-border text-emerald-primary'
                                      : 'bg-amber-950/30 border-amber-500/30 text-amber-400'
                                  }`}
                                >
                                  {v.loaders ? v.loaders.join(', ') : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 uppercase font-mono text-[10px] text-nordic-muted">
                                {v.version_type}
                              </td>
                              <td className="px-4 py-2.5 text-nordic-muted text-[11px]">
                                {v.date_published ? new Date(v.date_published).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {isThisVerInstalled ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-dark/30 border border-emerald-primary/40 text-[11px] font-semibold text-emerald-active">
                                    <Check className="w-3 h-3" />
                                    <span>Terpasang</span>
                                  </span>
                                ) : !isCompatible ? (
                                  <button
                                    disabled
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card/40 border border-obsidian-border text-nordic-muted/40 text-[11px] font-semibold cursor-not-allowed"
                                    title={`Tidak dapat dipasang: versi ini tidak kompatibel dengan instance aktif (${activeInstance?.loader?.toUpperCase()} ${activeInstance?.gameVersion})`}
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Tidak Cocok</span>
                                  </button>
                                ) : isAnyVerInstalled ? (
                                  <button
                                    onClick={() => handleInstallVersion(v)}
                                    disabled={installingId === v.id}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 text-[11px] font-semibold transition-colors cursor-pointer"
                                    title="Ganti ke versi ini (versi lama akan digantikan otomatis)"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${installingId === v.id ? 'animate-spin' : ''}`} />
                                    <span>Ganti Versi</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleInstallVersion(v)}
                                    disabled={installingId === v.id}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-primary text-obsidian-bg text-[11px] font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
                                  >
                                    <Download className={`w-3 h-3 ${installingId === v.id ? 'animate-spin' : ''}`} />
                                    <span>Pasang</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-nordic-muted py-12 text-xs">
              Detail proyek tidak ditemukan.
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Render Main Explore Catalogue ---
  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* Sub-header Filter & Search */}
      <div className="p-3.5 border-b border-obsidian-border bg-obsidian-surface flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Search Bar & Local Pack Button */}
        <div className="flex items-center space-x-2 w-full xl:w-auto xl:flex-1 xl:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchModrinth();
            }}
            className="relative flex-1 flex items-center"
          >
            <Search className="w-4 h-4 absolute left-3 text-nordic-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari mod, modpack, shader, resource pack..."
              className="w-full bg-obsidian-card border border-obsidian-border rounded pl-9 pr-20 py-1.5 text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-14 text-nordic-muted hover:text-nordic-text p-1 cursor-pointer transition-colors"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1 px-2.5 py-1 rounded bg-emerald-primary text-obsidian-bg text-[11px] font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
            >
              Cari
            </button>
          </form>

          <button
            onClick={handleInstallLocalMrpack}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Pilih dan pasang berkas .mrpack dari komputer"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>Pasang .mrpack</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 justify-start xl:justify-end">
          {/* Project Type */}
          <div className="flex items-center bg-obsidian-card border border-obsidian-border rounded p-0.5 text-xs shrink-0">
            <button
              onClick={() => setProjectType('mod')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
                projectType === 'mod'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Package className="w-3 h-3" />
              <span>Mod</span>
            </button>
            <button
              onClick={() => setProjectType('modpack')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
                projectType === 'modpack'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Modpack</span>
            </button>
            <button
              onClick={() => setProjectType('shader')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
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
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
                projectType === 'resourcepack'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Palette className="w-3 h-3" />
              <span>Resource Pack</span>
            </button>
          </div>

          {/* Loader Selection */}
          <select
            value={loader}
            onChange={(e) => setLoader(e.target.value as any)}
            className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer shrink-0"
          >
            <option value="all">Semua Loader</option>
            <option value="fabric">Fabric</option>
            <option value="forge">Forge</option>
            <option value="neoforge">NeoForge</option>
          </select>

          {/* Sort Selection */}
          <select
            value={sortIndex}
            onChange={(e) => setSortIndex(e.target.value as any)}
            className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer shrink-0"
          >
            <option value="downloads">Terpopuler</option>
            <option value="relevance">Relevansi</option>
            <option value="updated">Terbaru Diperbarui</option>
            <option value="newest">Rilis Baru</option>
          </select>

          <button
            onClick={() => searchModrinth()}
            disabled={loading}
            className="p-1.5 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer shrink-0"
            title="Muat Ulang Katalog"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
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

      {/* Grid of Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3 text-nordic-muted text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span>Menghubungi Modrinth API v2...</span>
          </div>
        ) : hits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-2 text-nordic-muted text-xs">
            <Search className="w-8 h-8 opacity-40 text-emerald-primary" />
            <span>Tidak ada hasil yang cocok dengan kriteria pencarian.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hits.map((hit) => {
              const isInstalled = checkIsInstalled(hit);
              const isInstalling = installingId === hit.project_id;

              return (
                <div
                  key={hit.project_id}
                  onClick={() => handleOpenDetail(hit)}
                  className="p-3.5 rounded border border-obsidian-border bg-obsidian-surface hover:border-emerald-primary/40 transition-all duration-150 flex flex-col justify-between space-y-3 group cursor-pointer"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded bg-obsidian-card border border-obsidian-border overflow-hidden shrink-0 flex items-center justify-center">
                      {hit.icon_url ? (
                        <img src={hit.icon_url} alt={hit.title} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-emerald-primary/60" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-semibold text-xs text-nordic-text group-hover:text-emerald-active transition-colors truncate">
                          {hit.title}
                        </h3>
                        {isInstalled && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-dark/30 border border-emerald-primary/40 text-[10px] font-semibold text-emerald-active flex items-center space-x-0.5">
                            <Check className="w-2.5 h-2.5" />
                            <span>Terpasang</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-nordic-muted line-clamp-2 mt-0.5 leading-relaxed">
                        {hit.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-obsidian-border text-[11px] text-nordic-muted">
                    <div className="flex items-center space-x-3 truncate">
                      <span>{hit.downloads ? hit.downloads.toLocaleString() : 0} unduhan</span>
                      <span className="truncate">oleh {hit.author}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isInstalled) {
                          handleInstall(hit.slug, hit.project_id, hit.project_type);
                        }
                      }}
                      disabled={isInstalling || isInstalled}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        isInstalled
                          ? 'bg-obsidian-card border border-emerald-primary/40 text-emerald-primary cursor-default'
                          : 'bg-emerald-primary text-obsidian-bg hover:bg-emerald-active cursor-pointer'
                      }`}
                      title={isInstalled ? 'Aset ini sudah terpasang di instance aktif' : 'Pasang aset ini'}
                    >
                      {isInstalling ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : isInstalled ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      <span>{isInstalling ? 'Memasang...' : isInstalled ? 'Terpasang' : 'Pasang'}</span>
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
