import React, { useState } from 'react';
import { BookOpen, X, ChevronRight, Layers, ShieldCheck, ExternalLink, Folder } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.js';

interface LauncherStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
            ├── resourcepacks/
            └── shaderpacks/`,
  },
  {
    id: 'multimc',
    name: 'MultiMC',
    type: 'Third-Party',
    badge: 'Third-Party (Portable Multi-Instance)',
    defaultPath: '<folder_aplikasi_multimc>\\instances',
    configPath: '<folder_aplikasi_multimc>\\multimc.cfg',
    notes: 'Launcher portabel; letak instance berada tepat di sebelah berkas MultiMC.exe dalam folder instances/.',
    structure: `MultiMC/
├── MultiMC.exe
├── multimc.cfg
└── instances/
    └── <NamaInstance>/
        ├── instance.cfg
        ├── mmc-pack.json
        └── .minecraft/
            ├── mods/
            └── resourcepacks/`,
  },
  {
    id: 'modrinth',
    name: 'Modrinth App',
    type: 'Third-Party',
    badge: 'Third-Party (App Profiles)',
    defaultPath: '%appdata%\\com.modrinth.theseus\\profiles',
    configPath: '%appdata%\\com.modrinth.theseus\\profiles\\<profile>\\profile.json',
    notes: 'Setiap instance modpack memiliki profile.json dan subfolder mods/ mandiri di dalam folder profiles.',
    structure: `com.modrinth.theseus/
└── profiles/
    └── <ProfileName>/
        ├── profile.json       # Metadata game version & loader
        ├── mods/              # Folder mods instance
        ├── config/
        └── resourcepacks/`,
  },
  {
    id: 'curseforge',
    name: 'CurseForge App',
    type: 'Third-Party',
    badge: 'Third-Party (App Instances)',
    defaultPath: '%userprofile%\\curseforge\\minecraft\\Instances',
    configPath: '%userprofile%\\curseforge\\minecraft\\Instances\\<instance>\\minecraftinstance.json',
    notes: 'Setiap modpack memiliki minecraftinstance.json dengan basis mod loader dan folder mods/ mandiri.',
    structure: `curseforge/minecraft/Instances/
└── <ModpackName>/
    ├── minecraftinstance.json # Konfigurasi loader & versi
    ├── mods/
    ├── config/
    └── resourcepacks/`,
  },
  {
    id: 'sklauncher',
    name: 'SKLauncher',
    type: 'Third-Party',
    badge: 'Third-Party (Custom / Standard Directory)',
    defaultPath: '%appdata%\\.minecraft',
    configPath: '%appdata%\\.minecraft (atau argumen --workDir)',
    notes: 'Secara default berbagi direktori .minecraft standar, dan mendukung direktori kerja kustom via argumen kerja.',
    structure: `.minecraft/
├── mods/
├── resourcepacks/
├── shaderpacks/
└── versions/`,
  },
];

export const LauncherStructureModal: React.FC<LauncherStructureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('official');

  if (!isOpen) return null;

  const currentGuide = LAUNCHER_GUIDES.find((g) => g.id === activeTab) ?? LAUNCHER_GUIDES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-bg/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-obsidian-card border border-obsidian-border rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-obsidian-border bg-obsidian-surface/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-dark/30 border border-emerald-primary/40 flex items-center justify-center text-emerald-primary">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-nordic-text">
                {t.instances.structureGuide}
              </h2>
              <p className="text-[11px] text-nordic-muted">
                {t.instances.structureGuideTooltip} (docs/struktur-folder-launcaher-minecraft.md)
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

        {/* Modal Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Launcher Navigation Sidebar */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-obsidian-border bg-obsidian-surface/30 p-2 overflow-y-auto space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold text-emerald-primary uppercase tracking-wider">
              {t.help?.selectLauncher || 'Daftar Launcher'}
            </div>
            {LAUNCHER_GUIDES.map((g) => {
              const selected = g.id === activeTab;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveTab(g.id)}
                  className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    selected
                      ? 'bg-emerald-dark/30 text-emerald-active font-semibold border border-emerald-primary/40'
                      : 'text-nordic-muted hover:text-nordic-text hover:bg-obsidian-hover'
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${selected ? 'text-emerald-primary' : 'opacity-40'}`} />
                </button>
              );
            })}
          </div>

          {/* Details & Architecture View */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-obsidian-border">
              <div>
                <h3 className="text-base font-bold text-nordic-text">
                  {currentGuide.name}
                </h3>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-obsidian-surface border border-obsidian-border text-emerald-primary">
                  {currentGuide.badge}
                </span>
              </div>
            </div>

            {/* Path Details */}
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="p-3 rounded bg-obsidian-surface border border-obsidian-border space-y-1">
                <span className="text-[10px] uppercase font-semibold text-nordic-muted">
                  {t.help?.standardPath || 'Lokasi Data Standar:'}
                </span>
                <div className="font-mono text-emerald-active text-[11px] break-all select-all">
                  {currentGuide.defaultPath}
                </div>
              </div>

              <div className="p-3 rounded bg-obsidian-surface border border-obsidian-border space-y-1">
                <span className="text-[10px] uppercase font-semibold text-nordic-muted">
                  {t.help?.mainConfig || 'Berkas Konfigurasi / Identitas:'}
                </span>
                <div className="font-mono text-nordic-text text-[11px] break-all select-all">
                  {currentGuide.configPath}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="p-3 rounded bg-emerald-dark/15 border border-emerald-primary/30 text-xs text-nordic-text flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
              <span>{currentGuide.notes}</span>
            </div>

            {/* Directory Tree */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-nordic-muted uppercase tracking-wider">
                {t.help?.directoryHierarchy || 'Struktur Pohon Berkas (File Tree):'}
              </span>
              <pre className="p-3.5 rounded bg-obsidian-bg border border-obsidian-border text-emerald-primary font-mono text-[11px] leading-relaxed overflow-x-auto select-all">
                {currentGuide.structure}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-obsidian-border bg-obsidian-surface/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-semibold bg-obsidian-hover hover:bg-obsidian-border text-nordic-text transition-colors cursor-pointer"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};

