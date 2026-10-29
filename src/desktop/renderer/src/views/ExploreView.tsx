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
  ArrowLeft,
  ExternalLink,
  Code2,
  Bug,
  BookOpen,
  MessageSquare,
  Users,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Filter,
} from 'lucide-react';
import { MarkdownViewer } from '../components/MarkdownViewer.js';
import { ModpackInstallModal, type ModpackTargetInfo } from '../components/ModpackInstallModal.js';
import { useLanguage } from '../i18n/LanguageContext.js';

export const CATEGORIES_BY_TYPE_EN: Record<string, Array<{ slug: string; name: string }>> = {
  mod: [
    { slug: 'optimization', name: 'Optimization & Performance' },
    { slug: 'adventure', name: 'Adventure & Exploration' },
    { slug: 'magic', name: 'Magic & Supernatural' },
    { slug: 'technology', name: 'Technology & Automation' },
    { slug: 'decoration', name: 'Decoration & Blocks' },
    { slug: 'storage', name: 'Storage & Chests' },
    { slug: 'utility', name: 'Utility & Tools' },
    { slug: 'library', name: 'Library & API' },
    { slug: 'worldgen', name: 'World Generation & Biomes' },
    { slug: 'mobs', name: 'Mobs & Creatures' },
    { slug: 'food', name: 'Food & Farming' },
    { slug: 'equipment', name: 'Weapons, Armor & Tools' },
  ],
  modpack: [
    { slug: 'optimization', name: 'Optimization & Lightweight' },
    { slug: 'adventure', name: 'Adventure & Exploration' },
    { slug: 'quests', name: 'Quests & Progression' },
    { slug: 'tech', name: 'Technology & Industrial' },
    { slug: 'magic', name: 'Magic & Mystery' },
    { slug: 'combat', name: 'PvP & Combat' },
    { slug: 'kitchen-sink', name: 'All-in-One (Kitchen Sink)' },
    { slug: 'challenging', name: 'Hardcore & Challenges' },
  ],
  shader: [
    { slug: 'low', name: 'Low-End (Fast & Lightweight)' },
    { slug: 'medium', name: 'Medium (Balanced)' },
    { slug: 'high', name: 'High / Ultra (Maximum Detail)' },
    { slug: 'path-tracing', name: 'Ray Tracing / Path Tracing' },
    { slug: 'photorealistic', name: 'Photorealistic' },
    { slug: 'cartoon', name: 'Cartoon & Cel Shading' },
    { slug: 'vanilla-like', name: 'Vanilla Plus' },
  ],
  resourcepack: [
    { slug: 'combat', name: 'PvP & Combat (Compact)' },
    { slug: 'faith-vanilla', name: 'Faithful / Vanilla Plus' },
    { slug: 'medieval', name: 'Medieval & Fantasy' },
    { slug: 'modern', name: 'Modern & Minimalist' },
    { slug: 'photo-realistic', name: 'Photorealistic' },
    { slug: 'futuristic', name: 'Futuristic & Sci-Fi' },
    { slug: 'utility', name: 'Utility, Font & GUI' },
  ],
};

export const CATEGORIES_BY_TYPE_ID: Record<string, Array<{ slug: string; name: string }>> = {
  mod: [
    { slug: 'optimization', name: 'Optimasi & FPS Boost' },
    { slug: 'adventure', name: 'Petualangan & Eksplorasi' },
    { slug: 'magic', name: 'Sihir & Supranatural' },
    { slug: 'technology', name: 'Teknologi & Otomasi' },
    { slug: 'decoration', name: 'Dekorasi & Blok' },
    { slug: 'storage', name: 'Penyimpanan & Chest' },
    { slug: 'utility', name: 'Utilitas & Tool' },
    { slug: 'library', name: 'Library & API' },
    { slug: 'worldgen', name: 'Generasi Dunia & Bioma' },
    { slug: 'mobs', name: 'Mob & Makhluk' },
    { slug: 'food', name: 'Makanan & Pertanian' },
    { slug: 'equipment', name: 'Senjata, Armor & Alat' },
  ],
  modpack: [
    { slug: 'optimization', name: 'Optimasi & Ringan' },
    { slug: 'adventure', name: 'Petualangan & Eksplorasi' },
    { slug: 'quests', name: 'Quest & Progresi' },
    { slug: 'tech', name: 'Teknologi & Industri' },
    { slug: 'magic', name: 'Sihir & Misteri' },
    { slug: 'combat', name: 'PvP & Pertarungan' },
    { slug: 'kitchen-sink', name: 'All-in-One (Kitchen Sink)' },
    { slug: 'challenging', name: 'Tantangan Hardcore' },
  ],
  shader: [
    { slug: 'low', name: 'Low-End (Ringan & Cepat)' },
    { slug: 'medium', name: 'Medium (Seimbang)' },
    { slug: 'high', name: 'High / Ultra (Detail Tinggi)' },
    { slug: 'path-tracing', name: 'Ray Tracing / Path Tracing' },
    { slug: 'photorealistic', name: 'Fotorealistis' },
    { slug: 'cartoon', name: 'Kartun & Cel Shading' },
    { slug: 'vanilla-like', name: 'Vanilla Plus' },
  ],
  resourcepack: [
    { slug: 'combat', name: 'PvP & Combat (Ringkas)' },
    { slug: 'faith-vanilla', name: 'Faithful / Vanilla Plus' },
    { slug: 'medieval', name: 'Abad Pertengahan' },
    { slug: 'modern', name: 'Modern & Minimalis' },
    { slug: 'photo-realistic', name: 'Fotorealistis' },
    { slug: 'futuristic', name: 'Futuristik & Sci-Fi' },
    { slug: 'utility', name: 'Utilitas, Font & GUI' },
  ],
};

export const CATEGORIES_BY_TYPE = CATEGORIES_BY_TYPE_EN;

function getPageNumbers(current: number, total: number): Array<number | '...'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | '...'> = [1];
  if (current > 3) {
    pages.push('...');
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) {
    pages.push('...');
  }
  pages.push(total);
  return pages;
}

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
  const { t, language } = useLanguage();
  const categoriesByType = language === 'id' ? CATEGORIES_BY_TYPE_ID : CATEGORIES_BY_TYPE_EN;
  const [query, setQuery] = useState('');
  const [projectType, setProjectType] = useState<'mod' | 'modpack' | 'shader' | 'resourcepack'>('mod');
  const [loader, setLoader] = useState<'all' | 'fabric' | 'forge' | 'neoforge' | 'quilt'>('all');
  const [mcVersionFilter, setMcVersionFilter] = useState<string>('all');
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [environment, setEnvironment] = useState<'all' | 'client' | 'server'>('all');
  const [sortIndex, setSortIndex] = useState<'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'>('downloads');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [hits, setHits] = useState<ProjectHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeInstance, setActiveInstance] = useState<{
    name: string;
    gameVersion?: string;
    loader?: string;
    capabilities?: any;
  } | null>(null);
  const [installedIndex, setInstalledIndex] = useState<{
    projectIds: string[];
    slugs: string[];
    filenames: string[];
    versionMap: Record<string, string>;
  }>({ projectIds: [], slugs: [], filenames: [], versionMap: {} });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<any | null>(null);
  const [projectVersions, setProjectVersions] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'description' | 'versions'>('description');

  const [modpackModalTarget, setModpackModalTarget] = useState<ModpackTargetInfo | null>(null);
  const [isModpackModalOpen, setIsModpackModalOpen] = useState(false);

  const fetchInstalledIndex = async () => {
    try {
      const idx = await window.api.mods.getInstalledIndex();
      if (idx) {
        setInstalledIndex(idx);
      }
    } catch {}
  };

  const fetchActiveInstance = async (forceSyncFilters = false) => {
    try {
      const data = await window.api.instances.getAll();
      if (data.active) {
        setActiveInstance({
          name: data.active.name,
          gameVersion: data.active.gameVersion,
          loader: data.active.loader,
          capabilities: data.active.capabilities,
        });
        const ldr = data.active.loader?.toLowerCase();
        if (ldr && ['fabric', 'forge', 'neoforge', 'quilt'].includes(ldr)) {
          if (forceSyncFilters || loader === 'all') {
            setLoader(ldr as any);
          }
        }
        if (data.active.gameVersion) {
          if (forceSyncFilters || mcVersionFilter === 'all') {
            setMcVersionFilter(data.active.gameVersion);
          }
        }
      }
    } catch (err) {
      console.error('Failed to get active instance in Explore:', err);
    }
  };

  const fetchMinecraftVersions = async () => {
    try {
      const vers = await window.api.minecraft.getVersions();
      if (Array.isArray(vers)) {
        const releaseVers = vers
          .filter((v: any) => v.type === 'release')
          .map((v: any) => v.id);
        if (releaseVers.length > 0) {
          setAvailableVersions(releaseVers);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchInstalledIndex();
    fetchActiveInstance();
    fetchMinecraftVersions();
    const unsubMods = window.api.mods.onChanged?.(() => {
      fetchInstalledIndex();
      fetchActiveInstance();
    });
    const unsubInst = window.api.instances.onChanged?.(() => {
      fetchInstalledIndex();
      fetchActiveInstance(true);
    });
    return () => {
      unsubMods?.();
      unsubInst?.();
    };
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (activeInstance?.capabilities && activeInstance.capabilities.supportsModpack === false && projectType === 'modpack') {
      setProjectType('mod');
    }
  }, [activeInstance?.capabilities?.supportsModpack, projectType]);

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

  const searchModrinth = async (customQuery?: string, targetPage?: number) => {
    const q = customQuery !== undefined ? customQuery : query;
    const activePage = targetPage !== undefined ? targetPage : page;
    const offset = Math.max(0, (activePage - 1) * pageSize);
    setLoading(true);
    setStatusMessage(null);
    try {
      const isPackOrShader = projectType === 'shader' || projectType === 'resourcepack';
      const res = await window.api.modrinth.search(q, {
        type: projectType,
        loader: isPackOrShader ? undefined : (loader !== 'all' ? loader : undefined),
        mcVersion: mcVersionFilter !== 'all' ? mcVersionFilter : undefined,
        category: category !== 'all' ? category : undefined,
        environment: environment !== 'all' ? environment : undefined,
        limit: pageSize,
        offset,
        index: q.trim() ? (sortIndex === 'downloads' ? 'relevance' : sortIndex) : sortIndex,
      });

      if (res.error) {
        setStatusMessage({ text: res.error, type: 'error' });
        setHits([]);
        setTotalHits(0);
      } else {
        setHits(res.hits ?? []);
        setTotalHits(res.total_hits ?? 0);
      }
    } catch (err: any) {
      console.error('Search failed:', err);
      setStatusMessage({ text: err.message || t.explore.loadError, type: 'error' });
      setHits([]);
      setTotalHits(0);
    } finally {
      setLoading(false);
    }
  };

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      searchModrinth(query, 1);
      return;
    }

    const timer = setTimeout(() => {
      setPage(1);
      searchModrinth(query, 1);
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isFirstRender.current) {
      setPage(1);
      searchModrinth(query, 1);
    }
  }, [projectType, loader, category, environment, mcVersionFilter, sortIndex, pageSize]);

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.max(1, Math.ceil(totalHits / pageSize));
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    searchModrinth(query, newPage);
  };

  const handleSelectProjectType = (type: 'mod' | 'modpack' | 'shader' | 'resourcepack') => {
    setProjectType(type);
    setCategory('all');
  };

  const handleResetFilters = () => {
    setQuery('');
    setProjectType('mod');
    if (activeInstance?.loader && ['fabric', 'forge', 'neoforge', 'quilt'].includes(activeInstance.loader.toLowerCase())) {
      setLoader(activeInstance.loader.toLowerCase() as any);
    } else {
      setLoader('all');
    }
    if (activeInstance?.gameVersion) {
      setMcVersionFilter(activeInstance.gameVersion);
    } else {
      setMcVersionFilter('all');
    }
    setCategory('all');
    setEnvironment('all');
    setSortIndex('downloads');
    setPage(1);
    setPageSize(24);
  };

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

  const executeModpackInstall = async (options: { modsOnly: boolean; cleanInstall: boolean }) => {
    if (!modpackModalTarget) return;
    setLoading(true);
    setStatusMessage(null);

    try {
      if (modpackModalTarget.localFilePath) {
        const res = await window.api.modrinth.installLocalMrpack(
          modpackModalTarget.localFilePath,
          options
        );
        if (res.success) {
          setStatusMessage({
            text: res.message ?? t.explore.mrpackSuccess,
            type: 'success',
          });
          await fetchInstalledIndex();
        } else {
          setStatusMessage({
            text: res.error ?? (t.explore.installFailed?.replace('{name}', 'modpack') || 'Failed to install modpack'),
            type: 'error',
          });
        }
      } else if (modpackModalTarget.slugOrId) {
        const res = await window.api.modrinth.install(modpackModalTarget.slugOrId, {
          type: 'modpack',
          loader: modpackModalTarget.loader,
          versionId: modpackModalTarget.versionId,
          modsOnly: options.modsOnly,
          cleanInstall: options.cleanInstall,
        });

        if (res.success) {
          if (modpackModalTarget.slugOrId) {
            setInstalledMap((prev) => ({ ...prev, [modpackModalTarget.slugOrId!]: true }));
          }
          await fetchInstalledIndex();
          setStatusMessage({
            text: res.message ?? t.explore.installSuccess.replace('{name}', modpackModalTarget.title),
            type: 'success',
          });
        } else {
          setStatusMessage({
            text: res.error ?? t.explore.installFailed.replace('{name}', modpackModalTarget.title),
            type: 'error',
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (slug: string, id: string, type: string) => {
    if (type === 'modpack') {
      if (activeInstance?.capabilities && !activeInstance.capabilities.supportsModpack) {
        setStatusMessage({
          text: activeInstance.capabilities.incompatibilityReason || t.explore.officialNoModpack,
          type: 'error',
        });
        return;
      }
      setModpackModalTarget({
        title: slug,
        slugOrId: slug,
        loader: loader !== 'all' ? loader : undefined,
        gameVersion: mcVersionFilter !== 'all' ? mcVersionFilter : activeInstance?.gameVersion,
      });
      setIsModpackModalOpen(true);
      return;
    }

    setInstallingId(id);
    setStatusMessage(null);
    try {
      const targetLoader = activeInstance?.loader
        ? activeInstance.loader
        : (loader !== 'all' ? loader : undefined);
      const targetGameVersion = activeInstance?.gameVersion
        ? activeInstance.gameVersion
        : (mcVersionFilter !== 'all' ? mcVersionFilter : undefined);

      const res = await window.api.modrinth.install(slug, {
        type,
        loader: targetLoader,
        mcVersion: targetGameVersion,
      });

      if (res.success) {
        setInstalledMap((prev) => ({ ...prev, [id]: true, [slug]: true }));
        await fetchInstalledIndex();
        setStatusMessage({
          text: res.message ?? t.explore.installSuccess.replace('{name}', slug),
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.error ?? t.explore.installFailed.replace('{name}', slug),
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
    const pType = projectDetail.project_type || projectType;
    if (pType === 'modpack') {
      if (activeInstance?.capabilities && !activeInstance.capabilities.supportsModpack) {
        setStatusMessage({
          text: activeInstance.capabilities.incompatibilityReason || t.explore.officialNoModpack,
          type: 'error',
        });
        return;
      }
      setModpackModalTarget({
        title: projectDetail.title || projectDetail.slug,
        slugOrId: projectDetail.slug,
        versionId: v.id,
        versionNumber: v.version_number,
        loader: loader !== 'all' ? loader : undefined,
        gameVersion: activeInstance?.gameVersion,
      });
      setIsModpackModalOpen(true);
      return;
    }

    setInstallingId(v.id);
    setStatusMessage(null);
    try {
      const res = await window.api.modrinth.install(projectDetail.slug, {
        type: pType,
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
          text: res.message ?? t.explore.installVersionSuccess.replace('{version}', v.version_number),
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.error ?? t.explore.installVersionFailed.replace('{version}', v.version_number),
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
    if (activeInstance?.capabilities && !activeInstance.capabilities.supportsModpack) {
      setStatusMessage({
        text: activeInstance.capabilities.incompatibilityReason || t.explore.officialNoModpack,
        type: 'error',
      });
      return;
    }

    try {
      const filePath = await window.api.dialog.selectMrpack();
      if (!filePath) return;

      const baseName = filePath.split(/[/\\]/).pop()?.replace(/\.mrpack$/i, '') || 'Modpack';
      setModpackModalTarget({
        title: baseName,
        localFilePath: filePath,
        loader: loader !== 'all' ? loader : undefined,
        gameVersion: activeInstance?.gameVersion,
      });
      setIsModpackModalOpen(true);
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    }
  };

  if (selectedSlug) {
    const isInstalled = projectDetail ? checkIsInstalled(projectDetail) : false;
    const isInstalling = projectDetail ? installingId === (projectDetail.id || projectDetail.project_id) : false;

    return (
      <div className="flex flex-col h-full bg-obsidian-bg overflow-hidden">
        <div className="p-3.5 border-b border-obsidian-border bg-obsidian-surface flex items-center justify-between">
          <button
            onClick={() => setSelectedSlug(null)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-primary" />
            <span>{t.explore.backToExplore}</span>
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
                    <span>{t.explore.installingWithDeps}</span>
                  </>
                ) : isInstalled ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.explore.alreadyInstalled}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.explore.installThisProject}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

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

        <div className="flex-1 overflow-y-auto p-6">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3 text-nordic-muted text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
              <span>{t.explore.loadingDetails}</span>
            </div>
          ) : projectDetail ? (
            <div className="max-w-4xl mx-auto space-y-6">
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
                      <span>{t.explore.downloadsCount.replace('{count}', String(projectDetail.downloads ? projectDetail.downloads.toLocaleString() : 0))}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-nordic-muted" />
                      <span>{t.explore.followersCount.replace('{count}', String(projectDetail.followers || projectDetail.follows ? (projectDetail.followers || projectDetail.follows).toLocaleString() : 0))}</span>
                    </span>
                    {projectDetail.license?.name && (
                      <span className="flex items-center space-x-1">
                        <Shield className="w-3.5 h-3.5 text-nordic-muted" />
                        <span>{t.explore.license.replace('{license}', projectDetail.license.name)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {projectDetail.source_url && (
                  <a
                    href={projectDetail.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-surface border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{t.explore.sourceCode}</span>
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
                    <span>{t.explore.issues}</span>
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
                    <span>{t.explore.wiki}</span>
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
                    <span>{t.explore.discord}</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                  </a>
                )}
              </div>

              <div className="border-b border-obsidian-border flex items-center space-x-4">
                <button
                  onClick={() => setDetailTab('description')}
                  className={`pb-2.5 text-xs font-semibold cursor-pointer transition-colors border-b-2 ${
                    detailTab === 'description'
                      ? 'border-emerald-primary text-emerald-active'
                      : 'border-transparent text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  {t.explore.tabDescription}
                </button>
                <button
                  onClick={() => setDetailTab('versions')}
                  className={`pb-2.5 text-xs font-semibold cursor-pointer transition-colors border-b-2 ${
                    detailTab === 'versions'
                      ? 'border-emerald-primary text-emerald-active'
                      : 'border-transparent text-nordic-muted hover:text-nordic-text'
                  }`}
                >
                  {t.explore.tabVersions.replace('{count}', String(projectVersions.length))}
                </button>
              </div>

              {detailTab === 'description' ? (
                <div className="p-6 rounded border border-obsidian-border bg-obsidian-surface">
                  <MarkdownViewer content={projectDetail.body || projectDetail.description} />
                </div>
              ) : (
                <div className="rounded border border-obsidian-border bg-obsidian-surface overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-obsidian-card text-nordic-muted font-medium border-b border-obsidian-border">
                      <tr>
                        <th className="px-4 py-2.5">{t.explore.colVersion}</th>
                        <th className="px-4 py-2.5">{t.explore.colMinecraft}</th>
                        <th className="px-4 py-2.5">{t.explore.colLoaders}</th>
                        <th className="px-4 py-2.5">{t.explore.colChannel}</th>
                        <th className="px-4 py-2.5">{t.explore.colDate}</th>
                        <th className="px-4 py-2.5 text-right">{t.explore.colAction}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-obsidian-border">
                      {projectVersions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-nordic-muted">
                            {t.explore.noVersionsFiltered}
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
                                      title={t.explore.diffWarningTooltip.replace('{loader}', activeInstance?.loader?.toUpperCase() ?? '').replace('{gameVersion}', activeInstance?.gameVersion ?? '')}
                                    >
                                      <AlertCircle className="w-3 h-3 text-amber-400" />
                                      <span>{t.explore.diffWarning.replace('{diff}', !isLoaderMatch ? 'Loader' : 'MC')}</span>
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
                                    <span>{t.explore.verInstalled}</span>
                                  </span>
                                ) : (projectDetail?.project_type === 'modpack' || projectType === 'modpack') && activeInstance?.capabilities && !activeInstance.capabilities.supportsModpack ? (
                                  <span
                                    className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-amber-950/20 border border-amber-500/30 text-amber-400 text-[10px] font-mono cursor-not-allowed"
                                    title={activeInstance?.capabilities?.incompatibilityReason || t.explore.officialNoModpack}
                                  >
                                    <AlertCircle className="w-3 h-3 text-amber-400" />
                                    <span>{t.explore.modpackDisabled}</span>
                                  </span>
                                ) : !isCompatible ? (
                                  <button
                                    disabled
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card/40 border border-obsidian-border text-nordic-muted/40 text-[11px] font-semibold cursor-not-allowed"
                                    title={t.explore.verIncompatibleTooltip.replace('{loader}', activeInstance?.loader?.toUpperCase() ?? '').replace('{gameVersion}', activeInstance?.gameVersion ?? '')}
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>{t.explore.verIncompatible}</span>
                                  </button>
                                ) : isAnyVerInstalled ? (
                                  <button
                                    onClick={() => handleInstallVersion(v)}
                                    disabled={installingId === v.id}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 text-[11px] font-semibold transition-colors cursor-pointer"
                                    title={t.explore.verSwitchTooltip}
                                  >
                                    <RefreshCw className={`w-3 h-3 ${installingId === v.id ? 'animate-spin' : ''}`} />
                                    <span>{t.explore.verSwitch}</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleInstallVersion(v)}
                                    disabled={installingId === v.id}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-primary text-obsidian-bg text-[11px] font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
                                  >
                                    <Download className={`w-3 h-3 ${installingId === v.id ? 'animate-spin' : ''}`} />
                                    <span>{t.explore.verInstall}</span>
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
              {t.explore.detailsNotFound}
            </div>
          )}
        </div>

        <ModpackInstallModal
          isOpen={isModpackModalOpen}
          onClose={() => {
            setIsModpackModalOpen(false);
            setModpackModalTarget(null);
          }}
          targetInfo={modpackModalTarget}
          onConfirm={executeModpackInstall}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* 2-Tier Header Toolbar */}
      <div className="border-b border-obsidian-border bg-obsidian-surface divide-y divide-obsidian-border/50 shrink-0">
        {/* Tier 1: Pencarian & Pemilihan Tipe Aset */}
        <div className="p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 w-full md:max-w-xl flex-1">
            <form
              data-tour="explore-search-input"
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
                placeholder={t.explore.searchPlaceholder}
                className="w-full bg-obsidian-card border border-obsidian-border rounded pl-9 pr-20 py-1.5 text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-14 text-nordic-muted hover:text-nordic-text p-1 cursor-pointer transition-colors"
                  title={t.explore.clearSearch}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1 px-2.5 py-1 rounded bg-emerald-primary text-obsidian-bg text-[11px] font-semibold hover:bg-emerald-active transition-colors cursor-pointer"
              >
                {t.explore.searchBtn}
              </button>
            </form>

            {activeInstance?.capabilities?.supportsModpack !== false && (
              <button
                onClick={handleInstallLocalMrpack}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-emerald-primary hover:border-emerald-primary/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title={t.explore.installMrpackTooltip}
              >
                <FileArchive className="w-3.5 h-3.5" />
                <span>{t.explore.installMrpack}</span>
              </button>
            )}

            <button
              onClick={handleResetFilters}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-obsidian-card border border-obsidian-border text-xs text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={t.explore.resetTooltip}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.explore.resetFilters}</span>
            </button>
          </div>

          {/* Tipe Asset Selector Tabs */}
          <div data-tour="explore-type-filters" className="flex items-center bg-obsidian-card border border-obsidian-border rounded p-0.5 text-xs shrink-0 self-start md:self-auto">
            <button
              onClick={() => handleSelectProjectType('mod')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
                projectType === 'mod'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Package className="w-3 h-3" />
              <span>{t.explore.typeMod}</span>
            </button>
            {activeInstance?.capabilities?.supportsModpack !== false && (
              <button
                onClick={() => handleSelectProjectType('modpack')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
                  projectType === 'modpack'
                    ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                    : 'text-nordic-muted hover:text-nordic-text'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{t.explore.typeModpack}</span>
              </button>
            )}
            <button
              onClick={() => handleSelectProjectType('shader')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
                projectType === 'shader'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{t.explore.typeShader}</span>
            </button>
            <button
              onClick={() => handleSelectProjectType('resourcepack')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded cursor-pointer transition-colors whitespace-nowrap ${
                projectType === 'resourcepack'
                  ? 'bg-emerald-primary text-obsidian-bg font-semibold'
                  : 'text-nordic-muted hover:text-nordic-text'
              }`}
            >
              <Palette className="w-3 h-3" />
              <span>{t.explore.typeResourcepack}</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Bilah Filter & Pengurutan */}
        <div className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5 bg-obsidian-card/30 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 text-nordic-muted text-[11px] font-semibold uppercase font-mono mr-1">
              <Filter className="w-3 h-3 text-emerald-primary" />
              <span>Filter:</span>
            </div>

            {/* Kategori Dinamis per Tipe */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer shrink-0 max-w-[160px] truncate"
              title={t.explore.categoryFilterTooltip}
            >
              <option value="all">{t.explore.categoryAll}</option>
              {categoriesByType[projectType]?.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Loader Filter: HANYA jika bukan shader & bukan resourcepack */}
            {projectType !== 'shader' && projectType !== 'resourcepack' && (
              <select
                value={loader}
                onChange={(e) => setLoader(e.target.value as any)}
                className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer shrink-0"
                title={t.explore.loaderFilterTooltip}
              >
                <option value="all">{t.explore.loaderAll}</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
                <option value="quilt">Quilt</option>
              </select>
            )}

            {/* Minecraft Version Filter */}
            <select
              value={mcVersionFilter}
              onChange={(e) => setMcVersionFilter(e.target.value)}
              className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer shrink-0 max-w-[160px] truncate"
              title={t.explore.mcVersionFilterTooltip}
            >
              {activeInstance?.gameVersion && (
                <option value={activeInstance.gameVersion}>
                  {t.explore.mcVersionActive.replace('{version}', activeInstance.gameVersion)}
                </option>
              )}
              <option value="all">{t.explore.mcVersionAll}</option>
              {(availableVersions.length > 0
                ? availableVersions
                : [
                    '1.21.4',
                    '1.21.1',
                    '1.21',
                    '1.20.6',
                    '1.20.4',
                    '1.20.2',
                    '1.20.1',
                    '1.19.4',
                    '1.19.2',
                    '1.18.2',
                    '1.16.5',
                    '1.12.2',
                  ]
              )
                .filter((v) => v !== activeInstance?.gameVersion)
                .slice(0, 30)
                .map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
            </select>

            {/* Environment Filter (Client / Server / All) */}
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer shrink-0"
              title={t.explore.environmentFilterTooltip}
            >
              <option value="all">{t.explore.environmentAll}</option>
              <option value="client">{t.explore.envClient}</option>
              <option value="server">{t.explore.envServer}</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Sort Index Filter */}
            <select
              value={sortIndex}
              onChange={(e) => setSortIndex(e.target.value as any)}
              className="bg-obsidian-card border border-obsidian-border rounded px-2.5 py-1 text-xs text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer shrink-0"
              title={t.explore.sortOrderTooltip}
            >
              <option value="downloads">{t.explore.sortDownloads}</option>
              <option value="relevance">{t.explore.sortRelevance}</option>
              <option value="follows">{t.explore.sortFollows}</option>
              <option value="updated">{t.explore.sortUpdated}</option>
              <option value="newest">{t.explore.sortNewest}</option>
            </select>

            <button
              onClick={() => searchModrinth()}
              disabled={loading}
              className="p-1.5 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 transition-colors cursor-pointer shrink-0"
              title={t.explore.refreshTooltip}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3 text-nordic-muted text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-primary" />
            <span>{t.explore.loadingCatalogue}</span>
          </div>
        ) : hits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-2 text-nordic-muted text-xs">
            <Search className="w-8 h-8 opacity-40 text-emerald-primary" />
            <span>{t.explore.emptyResults}</span>
          </div>
        ) : (
          <div data-tour="explore-card-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
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
                            <span>{t.explore.installedBadge}</span>
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
                      <span>{t.explore.downloadsCount.replace('{count}', String(hit.downloads ? hit.downloads.toLocaleString() : 0))}</span>
                      <span className="truncate">{t.explore.byAuthor.replace('{author}', hit.author)}</span>
                    </div>

                    {hit.project_type === 'modpack' && activeInstance?.capabilities && !activeInstance.capabilities.supportsModpack ? (
                      <span
                        className="text-[10px] text-amber-400/80 font-mono italic px-2 py-0.5 rounded bg-amber-950/20 border border-amber-500/20 cursor-not-allowed"
                        title={activeInstance.capabilities.incompatibilityReason || t.explore.officialNoModpack}
                      >
                        {t.explore.modpackDisabled}
                      </span>
                    ) : (
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
                        title={isInstalled ? t.explore.installedTooltip : t.explore.installTooltip}
                      >
                        {isInstalling ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : isInstalled ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>
                          {isInstalling
                            ? t.explore.installingBtn
                            : isInstalled
                            ? t.explore.installedBtn
                            : t.explore.installBtn}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalHits > 0 && (
        <div className="px-4 py-2.5 border-t border-obsidian-border bg-obsidian-surface flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0 select-none">
          <div className="text-nordic-muted text-[11px]">
            {t.explore.paginationShowing
              .replace('{from}', String(Math.min((page - 1) * pageSize + 1, totalHits)))
              .replace('{to}', String(Math.min(page * pageSize, totalHits)))
              .replace('{total}', totalHits.toLocaleString())
              .replace('{page}', String(page))
              .replace('{pages}', String(Math.max(1, Math.ceil(totalHits / pageSize))))}
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={page <= 1 || loading}
              className="p-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={t.explore.paginationFirst}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={t.explore.paginationPrev}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {getPageNumbers(page, Math.max(1, Math.ceil(totalHits / pageSize))).map((pNum, idx) =>
              pNum === '...' ? (
                <span key={`dots-${idx}`} className="px-1.5 text-nordic-muted font-bold text-xs select-none">
                  ...
                </span>
              ) : (
                <button
                  key={pNum}
                  onClick={() => handlePageChange(Number(pNum))}
                  disabled={loading}
                  className={`min-w-[28px] h-7 px-2 rounded font-medium text-xs transition-colors cursor-pointer ${
                    page === pNum
                      ? 'bg-emerald-primary text-obsidian-bg font-bold'
                      : 'bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40'
                  }`}
                >
                  {pNum}
                </button>
              )
            )}

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= Math.max(1, Math.ceil(totalHits / pageSize)) || loading}
              className="p-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={t.explore.paginationNext}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(Math.max(1, Math.ceil(totalHits / pageSize)))}
              disabled={page >= Math.max(1, Math.ceil(totalHits / pageSize)) || loading}
              className="p-1 rounded bg-obsidian-card border border-obsidian-border text-nordic-muted hover:text-nordic-text hover:border-emerald-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={t.explore.paginationLast}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-nordic-muted">{t.explore.pageSizeLabel}</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-obsidian-card border border-obsidian-border rounded px-2 py-1 text-[11px] text-nordic-text focus:outline-none focus:border-emerald-primary cursor-pointer"
            >
              <option value={12}>12 {t.explore.paginationPerPage.replace('{count}', '').trim()}</option>
              <option value={24}>24 {t.explore.paginationPerPage.replace('{count}', '').trim()}</option>
              <option value={48}>48 {t.explore.paginationPerPage.replace('{count}', '').trim()}</option>
            </select>
          </div>
        </div>
      )}

      <ModpackInstallModal
        isOpen={isModpackModalOpen}
        onClose={() => {
          setIsModpackModalOpen(false);
          setModpackModalTarget(null);
        }}
        targetInfo={modpackModalTarget}
        onConfirm={executeModpackInstall}
      />
    </div>
  );
};
