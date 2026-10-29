import React, { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  FolderOpen,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  Sliders,
  Sparkles,
  ChevronRight,
  Layers,
  Wrench,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface LauncherGuide {
  id: string;
  name: string;
  type: 'Official' | 'Third-Party';
  badge: string;
  defaultPath: string;
  configPath: string;
  notes: string;
  structure: string;
}

const LAUNCHER_GUIDES: LauncherGuide[] = [
  {
    id: 'official',
    name: 'Official Minecraft (Mojang/Microsoft)',
    type: 'Official',
    badge: 'Official / First-Party',
    defaultPath: '%appdata%\\.minecraft',
    configPath: '%appdata%\\.minecraft\\launcher_profiles.json',
    notes: 'Default instance utama di LoadModer. Tidak memiliki isolasi wadah bawaan; folder mods/ langsung di root .minecraft.',
    structure: `.minecraft/
├── versions/              # Jar dan JSON binary versi Minecraft
├── mods/                  # Mod (.jar) game
├── resourcepacks/         # Paket tekstur
├── shaderpacks/           # Paket shader (Iris/OptiFine)
├── config/                # Konfigurasi mod
├── saves/                 # Dunia permainan (world)
├── options.txt            # Pengaturan grafis, kontrol, FOV
└── launcher_profiles.json # Profil launcher resmi`,
  },
  {
    id: 'tlauncher',
    name: 'TLauncher',
    type: 'Third-Party',
    badge: 'Third-Party (Shared / Versions Containers)',
    defaultPath: '%appdata%\\.minecraft',
    configPath: '%appdata%\\.tlauncher\\tlauncher-2.0.properties',
    notes: 'Mendukung wadah modpack versi terisolasi di folder versions/<nama_versi>/. Setiap modpack memiliki folder mods/ mandiri di dalam versions/.',
    structure: `%appdata%/
├── .minecraft/
│   ├── versions/
│   │   └── <nama_modpack>/
│   │       ├── mods/                  # Folder mods khusus modpack ini
│   │       ├── config/                # Konfigurasi khusus modpack
│   │       ├── <nama_modpack>.json    # Metadata versi
│   │       └── TLauncherAdditional.json # Metadata modpack TLauncher
│   ├── mods/                          # Folder mods default root
│   ├── resourcepacks/
│   ├── shaderpacks/
│   └── TlauncherProfiles.json
└── .tlauncher/
    └── tlauncher-2.0.properties`,
  },
  {
    id: 'legacy',
    name: 'Legacy Launcher (Dulu TL Legacy)',
    type: 'Third-Party',
    badge: 'Third-Party (Dual-Path Engine & Container)',
    defaultPath: '%appdata%\\.tlauncher\\legacy\\Minecraft\\game',
    configPath: '%appdata%\\.tlauncher\\legacy\\Minecraft\\tl.properties',
    notes: 'Arsitektur Dual-Path unik: folder game/versions/ hanya berisi core engine, sedangkan modpack dan mods pengguna berada di game/home/<profile>/mods.',
    structure: `%appdata%/.tlauncher/legacy/Minecraft/
├── tl.properties              # Menentukan login.version aktif
└── game/
    ├── versions/              # Engine binary (read-only/shared)
    └── home/
        └── <profile>/         # Wadah profil kerja pengguna
            ├── mods/          # Mod (.jar) per profil
            ├── config/        # Konfigurasi per profil
            ├── resourcepacks/ # Paket tekstur
            ├── shaderpacks/   # Shader pack
            └── options.txt    # Pengaturan grafis per profil`,
  },
  {
    id: 'prism',
    name: 'Prism Launcher',
    type: 'Third-Party',
    badge: 'Third-Party (Multi-Instance Isolated)',
    defaultPath: '%appdata%\\PrismLauncher\\instances',
    configPath: '%appdata%\\PrismLauncher\\prismlauncher.cfg',
    notes: 'Setiap instance terisolasi penuh di dalam subfolder instances/<nama_instance>/. Folder game berada di dalam .minecraft/ atau minecraft/.',
    structure: `PrismLauncher/
├── prismlauncher.cfg          # Pengaturan global
├── accounts.json
└── instances/                 # Seluruh profil/instance terisolasi
    └── <NamaInstance>/
        ├── instance.cfg       # Konfigurasi instance (RAM, Java)
        ├── mmc-pack.json      # Komponen loader & versi
        └── .minecraft/        # Folder game terisolasi
            ├── mods/
            ├── config/
            └── options.txt`,
  },
  {
    id: 'modrinth',
    name: 'Modrinth App',
    type: 'Third-Party',
    badge: 'Third-Party (Profile Isolated)',
    defaultPath: '%appdata%\\com.modrinth.theseus\\profiles',
    configPath: '%appdata%\\com.modrinth.theseus\\profiles.json',
    notes: 'Setiap profil memiliki direktori terisolasi di dalam profiles/<profile_id>/. LoadModer dapat mendeteksi profil ini langsung.',
    structure: `com.modrinth.theseus/
├── profiles.json
└── profiles/
    └── <profile_id>/
        ├── profile.json
        ├── mods/
        ├── config/
        ├── resourcepacks/
        └── shaderpacks/`,
  },
  {
    id: 'atlauncher',
    name: 'ATLauncher',
    type: 'Third-Party',
    badge: 'Third-Party (Instances Folder)',
    defaultPath: '%appdata%\\ATLauncher\\instances',
    configPath: '%appdata%\\ATLauncher\\configs',
    notes: 'Instance tersimpan di dalam direktori instances/. Setiap instance memiliki folder mods, config, dan saves sendiri.',
    structure: `ATLauncher/
└── instances/
    └── <InstanceName>/
        ├── instance.json
        ├── mods/
        ├── config/
        └── saves/`,
  },
];

interface FAQItem {
  id: string;
  category: 'crash' | 'mods' | 'launcher' | 'antivirus';
  title: string;
  summary: string;
  solution: string;
  tags: string[];
}

const FAQ_LIST: FAQItem[] = [
  {
    id: 'crash-oom',
    category: 'crash',
    title: 'Game Crash: OutOfMemoryError (Java heap space)',
    summary: 'Minecraft kehabisan alokasi memori RAM saat memuat banyak mod atau shader berat.',
    solution: 'Buka pengaturan launcher Minecraft Anda (misal: Launcher Profil / Java Settings), naikkan alokasi RAM minimal ke 4096 MB (4 GB) atau 6144 MB (6 GB) menggunakan argumen -Xmx4G atau -Xmx6G.',
    tags: ['crash', 'ram', 'memory', 'oom', 'heap'],
  },
  {
    id: 'crash-java-version',
    category: 'crash',
    title: 'Crash: UnsupportedClassVersionError (Java Version Mismatch)',
    summary: 'Versi Java yang dijalankan di launcher tidak sesuai dengan persyaratan versi Minecraft atau Loader.',
    solution: 'Pastikan versi Java launcher Anda cocok: Minecraft 1.16 kebawah membutuhkan Java 8; Minecraft 1.17 - 1.20.4 membutuhkan Java 17; Minecraft 1.20.5+ membutuhkan Java 21.',
    tags: ['java', 'version', 'class', 'incompatible'],
  },
  {
    id: 'crash-missing-dep',
    category: 'crash',
    title: 'Crash: ClassNotFoundException / Missing Dependency',
    summary: 'Ada mod yang memerlukan library atau API pendukung yang belum terpasang (contoh: Fabric API, Cloth Config, Architecture API).',
    solution: 'Buka tab Diagnostics di LoadModer, periksa nama library yang hilang pada Crash Analyzer, lalu cari dan unduh mod dependensi tersebut di tab Explore Mods.',
    tags: ['dependency', 'fabric api', 'cloth config', 'library'],
  },
  {
    id: 'antivirus-false-positive',
    category: 'antivirus',
    title: 'Pembaruan Terblokir atau File .exe Hilang (Antivirus / SmartScreen)',
    summary: 'Windows Defender atau antivirus pihak ketiga menandai installer LoadModer sebagai unknown binary atau false positive.',
    solution: 'Ketika muncul popup "Windows protected your PC", klik "More info" ➔ "Run anyway". Tambahkan folder %LOCALAPPDATA%\\Programs\\loadmoder atau folder instalasi ke daftar pengecualian (whitelist) antivirus Anda.',
    tags: ['antivirus', 'smartscreen', 'defender', 'update', 'blocked'],
  },
  {
    id: 'mods-drag-drop',
    category: 'mods',
    title: 'Cara Pasang Mod, Shader, atau Resourcepack Lewat Drag & Drop',
    summary: 'LoadModer mendukung pemasangan cepat hanya dengan menyeret berkas ke jendela aplikasi.',
    solution: 'Tarik berkas .jar (mod), .zip (shader / resourcepack), atau .mrpack langsung dari File Explorer dan lepaskan ke tab Mods atau Explore. LoadModer akan otomatis mendeteksi tipe berkas dan menempatkannya ke direktori yang tepat.',
    tags: ['drag', 'drop', 'install', 'shader', 'resourcepack'],
  },
  {
    id: 'launcher-mode-difference',
    category: 'launcher',
    title: 'Perbedaan Mode Standar (.minecraft) vs Mode Wadah Modpack',
    summary: 'Kapan harus menggunakan mode default dan kapan harus menggunakan mode wadah client.',
    solution: 'Mode Standar menggunakan folder root .minecraft/mods langsung (cocok untuk game harian). Mode Wadah Modpack mengisolasi mod dan shader ke profil versi mandiri (contoh: versions/MyPack/) agar mod tidak tercampur saat berganti modpack.',
    tags: ['mode', 'container', 'default', 'profile', 'isolation'],
  },
];

interface HelpViewProps {
  onStartTour?: () => void;
}

export const HelpView: React.FC<HelpViewProps> = ({ onStartTour }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'faq' | 'launcher' | 'quicktools'>('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLauncherId, setSelectedLauncherId] = useState<string>('official');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('crash-oom');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeLauncher = LAUNCHER_GUIDES.find((l) => l.id === selectedLauncherId) || LAUNCHER_GUIDES[0];

  const filteredFaq = FAQ_LIST.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.solution.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.includes(q))
    );
  });

  const handleOpenActiveFolder = async () => {
    try {
      const res = await window.api.instances.openFolder();
      if (res.success) {
        showNotice('Direktori game aktif berhasil dibuka.');
      } else {
        showNotice(res.error || 'Gagal membuka direktori game.');
      }
    } catch (err: any) {
      showNotice(err.message || 'Terjadi kesalahan.');
    }
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-bg">
      {/* Header Bar */}
      <div className="p-4 border-b border-obsidian-border bg-obsidian-surface flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-emerald-primary" />
            <h2 className="text-xs font-semibold text-nordic-text uppercase tracking-wider">
              {t.help?.title || 'Pusat Bantuan & Dokumentasi'}
            </h2>
          </div>
          <p className="text-[11px] text-nordic-muted">
            {t.help?.subtitle || 'Panduan solusi masalah, struktur direktori launcher, dan alat darurat'}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-nordic-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.help?.searchPlaceholder || 'Cari solusi kendala & panduan...'}
            className="pl-8 pr-3 py-1.5 bg-obsidian-card border border-obsidian-border rounded text-xs text-nordic-text placeholder-nordic-muted focus:outline-none focus:border-emerald-primary/60 w-64 transition-colors"
          />
        </div>
      </div>

      {/* Notice Banner */}
      {actionNotice && (
        <div className="px-4 py-2 text-xs flex items-center space-x-2 bg-emerald-dark/30 border-b border-emerald-primary text-emerald-active animate-fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="px-4 pt-3 border-b border-obsidian-border bg-obsidian-surface/60 flex items-center space-x-2">
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'faq'
              ? 'border-emerald-primary text-emerald-active'
              : 'border-transparent text-nordic-muted hover:text-nordic-text'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t.help?.tabFaq || 'Solusi & Tanya Jawab (FAQ)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('launcher')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'launcher'
              ? 'border-emerald-primary text-emerald-active'
              : 'border-transparent text-nordic-muted hover:text-nordic-text'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{t.help?.tabLauncherGuide || 'Panduan Struktur Launcher'}</span>
        </button>

        <button
          onClick={() => setActiveTab('quicktools')}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'quicktools'
              ? 'border-emerald-primary text-emerald-active'
              : 'border-transparent text-nordic-muted hover:text-nordic-text'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>{t.help?.tabTools || 'Alat Cepat & Pintasan'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: FAQ & Troubleshooting */}
        {activeTab === 'faq' && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono text-nordic-muted flex items-center justify-between">
              <span>Menampilkan {filteredFaq.length} solusi permasalahan umum</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-emerald-primary hover:underline cursor-pointer"
                >
                  Reset Pencarian
                </button>
              )}
            </div>

            {filteredFaq.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-obsidian-border rounded-lg text-xs text-nordic-muted">
                Tidak ada topik solusi yang cocok dengan kata kunci &quot;{searchQuery}&quot;.
              </div>
            ) : (
              filteredFaq.map((item) => {
                const isExpanded = expandedFaqId === item.id;
                return (
                  <div
                    key={item.id}
                    className="border border-obsidian-border bg-obsidian-card rounded-lg overflow-hidden transition-all shadow-sm"
                  >
                    <button
                      onClick={() => setExpandedFaqId(isExpanded ? null : item.id)}
                      className="w-full p-3.5 text-left flex items-start justify-between gap-3 hover:bg-obsidian-hover transition-colors cursor-pointer"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                            {item.category}
                          </span>
                          <h3 className="text-xs font-bold text-nordic-text">{item.title}</h3>
                        </div>
                        <p className="text-[11px] text-nordic-muted leading-relaxed">
                          {item.summary}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-nordic-muted shrink-0 mt-1 transition-transform ${
                          isExpanded ? 'rotate-90 text-emerald-primary' : ''
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-obsidian-border/60 bg-obsidian-surface/60 space-y-2.5 animate-fade-in">
                        <div className="text-[11px] font-bold text-emerald-primary uppercase tracking-wider">
                          Langkah Solusi Rekomendasi:
                        </div>
                        <div className="p-3 rounded bg-obsidian-bg border border-emerald-500/20 text-xs text-nordic-text leading-relaxed">
                          {item.solution}
                        </div>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-1 pt-1">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-obsidian-surface text-nordic-muted border border-obsidian-border"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: Launcher Structure Guide */}
        {activeTab === 'launcher' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sidebar Daftar Launcher */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-nordic-muted uppercase tracking-wider px-1">
                Pilih Launcher Minecraft
              </div>
              <div className="space-y-1">
                {LAUNCHER_GUIDES.map((launcher) => {
                  const isSelected = selectedLauncherId === launcher.id;
                  return (
                    <button
                      key={launcher.id}
                      onClick={() => setSelectedLauncherId(launcher.id)}
                      className={`w-full text-left p-3 rounded border text-xs transition-colors cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-dark/20 border-emerald-primary/70 text-emerald-active font-semibold shadow-sm'
                          : 'bg-obsidian-card border-obsidian-border text-nordic-muted hover:border-emerald-primary/40 hover:text-nordic-text'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <div className="truncate">{launcher.name}</div>
                        <div className="text-[10px] font-mono opacity-70 truncate">{launcher.badge}</div>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-primary' : 'text-nordic-muted'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail Struktur Direktori Launcher */}
            <div className="md:col-span-2 border border-obsidian-border bg-obsidian-card rounded-lg p-4 space-y-4 shadow-sm">
              <div className="border-b border-obsidian-border pb-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-nordic-text">{activeLauncher.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                    {activeLauncher.badge}
                  </span>
                </div>
                <p className="text-xs text-nordic-muted leading-relaxed">
                  {activeLauncher.notes}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-nordic-muted text-[11px] block">Jalur Direktori Standar:</span>
                  <code className="text-emerald-primary font-mono text-xs break-all bg-obsidian-bg px-2 py-1 rounded block mt-0.5 border border-obsidian-border">
                    {activeLauncher.defaultPath}
                  </code>
                </div>
                <div>
                  <span className="text-nordic-muted text-[11px] block">Berkas Konfigurasi Utama:</span>
                  <code className="text-nordic-text font-mono text-xs break-all bg-obsidian-bg px-2 py-1 rounded block mt-0.5 border border-obsidian-border">
                    {activeLauncher.configPath}
                  </code>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-nordic-muted uppercase tracking-wider block mb-1.5">
                  Hierarki Arsitektur Berkas:
                </span>
                <pre className="p-3.5 rounded bg-obsidian-bg border border-obsidian-border text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto select-text">
                  {activeLauncher.structure}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Quick Tools & Emergency Actions */}
        {activeTab === 'quicktools' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-lg bg-obsidian-card border border-obsidian-border space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-primary font-bold text-xs">
                  <FolderOpen className="w-4 h-4" />
                  <span>Buka Direktori Game Aktif</span>
                </div>
                <p className="text-[11px] text-nordic-muted leading-relaxed">
                  Buka folder direktori instalasi Minecraft yang sedang dikelola saat ini di File Explorer.
                </p>
              </div>
              <button
                onClick={handleOpenActiveFolder}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded bg-obsidian-surface border border-obsidian-border hover:border-emerald-primary/40 text-xs font-semibold text-nordic-text hover:text-emerald-primary transition-colors cursor-pointer"
              >
                <span>Buka di Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 rounded-lg bg-obsidian-card border border-obsidian-border space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-primary font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Mulai Ulang Tur Interaktif</span>
                </div>
                <p className="text-[11px] text-nordic-muted leading-relaxed">
                  Jalankan ulang tur panduan interaktif spotlight untuk mempelajari fungsi setiap fitur aplikasi.
                </p>
              </div>
              <button
                onClick={() => {
                  if (onStartTour) {
                    onStartTour();
                    showNotice('Tur interaktif dimulai.');
                  }
                }}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded bg-emerald-500/15 border border-emerald-500/40 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mulai Tur Aplikasi</span>
              </button>
            </div>

            <div className="p-4 rounded-lg bg-obsidian-card border border-obsidian-border space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Pusat Diagnostik & Analisis</span>
                </div>
                <p className="text-[11px] text-nordic-muted leading-relaxed">
                  Periksa file crash report terbaru dan jalankan binary search bisect untuk menemukan mod bermasalah.
                </p>
              </div>
              <a
                href="#diagnostics"
                onClick={(e) => {
                  e.preventDefault();
                  // Bisa dinavigasikan lewat App.tsx jika dibutuhkan
                  showNotice('Gunakan tab Diagnostics di navigasi utama untuk analisis crash mendalam.');
                }}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded bg-obsidian-surface border border-obsidian-border hover:border-amber-500/40 text-xs font-semibold text-nordic-text hover:text-amber-400 transition-colors cursor-pointer"
              >
                <span>Buka Tab Diagnostics</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

