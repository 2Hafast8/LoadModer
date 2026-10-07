import type {LauncherType} from "../../types/instance.js";

export interface LauncherCapabilities {
  launcher: LauncherType | string;
  supportsModpack: boolean;
  supportsContainers: boolean;
  supportsModeSwitch: boolean;
  modpackStrategy: "tlauncher" | "legacy" | "instance" | "none";
  notes?: string;
  incompatibilityReason?: string;
}

export function getLauncherCapabilities(launcherName?: string): LauncherCapabilities {
  const norm = (launcherName ?? "").toLowerCase().trim();

  // 1. Legacy Launcher (TL Legacy di .tlauncher/legacy/Minecraft/game atau home)
  if (norm.includes("legacy")) {
    return {
      launcher: "Legacy",
      supportsModpack: true,
      supportsContainers: true,
      supportsModeSwitch: true,
      modpackStrategy: "legacy",
      notes: "Legacy Launcher menggunakan arsitektur dual-path (versions/ engine & home/ wadah profil)",
    };
  }

  // 2. TLauncher (Wadah versi terisolasi di versions/<mypack>)
  if (norm.includes("tlauncher")) {
    return {
      launcher: "TLauncher",
      supportsModpack: true,
      supportsContainers: true,
      supportsModeSwitch: true,
      modpackStrategy: "tlauncher",
      notes: "Mendukung wadah modpack versi terisolasi di versions/<mypack>",
    };
  }

  // 3. Official Minecraft / Vanilla (Tidak mendukung isolasi modpack .mrpack pihak ketiga)
  if (norm.includes("official") || norm.includes("vanilla")) {
    return {
      launcher: "Official Minecraft",
      supportsModpack: false,
      supportsContainers: false,
      supportsModeSwitch: false,
      modpackStrategy: "none",
      incompatibilityReason:
        "Minecraft Launcher Resmi (Official) tidak mendukung format .mrpack secara langsung karena tidak memiliki mesin isolasi instance pihak ketiga.",
      notes: "Hanya mendukung mod individual (.jar), shader pack, dan resource pack",
    };
  }

  // 4. Prism Launcher (Instance terisolasi per-folder)
  if (norm.includes("prism")) {
    return {
      launcher: "Prism",
      supportsModpack: false, // Menunggu implementasi spesifik Prism
      supportsContainers: false,
      supportsModeSwitch: false,
      modpackStrategy: "instance",
      notes: "Prism Launcher menggunakan direktori instance per-folder",
    };
  }

  // 5. MultiMC (Instance terisolasi per-folder portable)
  if (norm.includes("multimc")) {
    return {
      launcher: "MultiMC",
      supportsModpack: false, // Menunggu implementasi spesifik MultiMC
      supportsContainers: false,
      supportsModeSwitch: false,
      modpackStrategy: "instance",
      notes: "MultiMC menggunakan direktori instance per-folder portable",
    };
  }

  // 6. SKLauncher (Folder game standar .minecraft)
  if (norm.includes("sklauncher")) {
    return {
      launcher: "SKLauncher",
      supportsModpack: false,
      supportsContainers: false,
      supportsModeSwitch: false,
      modpackStrategy: "none",
      notes: "SKLauncher menggunakan folder game standar .minecraft",
    };
  }

  // Instance Kustom / Default
  return {
    launcher: launcherName ?? "Custom",
    supportsModpack: false,
    supportsContainers: false,
    supportsModeSwitch: false,
    modpackStrategy: "none",
    notes: "Instance kustom",
  };
}

