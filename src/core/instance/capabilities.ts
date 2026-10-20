import path from "node:path";
import type {LauncherType} from "../../types/instance.js";

export interface InstanceContext {
  rootDir?: string;
  mode?: string;
  activeContainer?: string;
  containerDir?: string;
  isTLMods?: boolean;
}

export interface LauncherCapabilities {
  launcher: LauncherType | string;
  supportsModpack: boolean;
  supportsContainers: boolean;
  supportsModeSwitch: boolean;
  modpackStrategy: "tlauncher" | "legacy" | "instance" | "none";
  isLoadModerContainer?: boolean;
  isTLMods?: boolean;
  notes?: string;
  incompatibilityReason?: string;
}

export function isLoadModerModpackContainerName(containerName: string): boolean {
  const name = path.basename(containerName).trim().toLowerCase();
  return name.startsWith("mypack");
}

export function getLauncherCapabilities(
  launcherName?: string,
  context?: InstanceContext,
): LauncherCapabilities {
  const norm = (launcherName ?? "").toLowerCase().trim();

  // 1. Legacy Launcher (TL Legacy di .tlauncher/legacy/Minecraft/game atau home)
  if (norm.includes("legacy")) {
    return {
      launcher: "Legacy",
      supportsModpack: true,
      supportsContainers: true,
      supportsModeSwitch: true,
      modpackStrategy: "legacy",
      isLoadModerContainer: true,
      isTLMods: false,
      notes: "Legacy Launcher menggunakan arsitektur dual-path (versions/ engine & home/ wadah profil)",
    };
  }

  // 2. TLauncher (Wadah versi terisolasi di versions/<mypack>)
  if (norm.includes("tlauncher")) {
    // Evaluasi apakah target saat ini adalah modpack TL-Mods atau bukan wadah modpack LoadModer
    const isExplicitTLMods = context?.isTLMods === true;
    const isNonMypackContainer =
      context?.mode === "modpack" &&
      context?.activeContainer &&
      !isLoadModerModpackContainerName(context.activeContainer);
    const isDirectVersionFolder =
      Boolean(context?.rootDir) &&
      path.basename(path.dirname(context!.rootDir!)).toLowerCase() === "versions" &&
      !isLoadModerModpackContainerName(path.basename(context!.rootDir!));

    if (isExplicitTLMods || isNonMypackContainer || isDirectVersionFolder) {
      return {
        launcher: "TLauncher",
        supportsModpack: false,
        supportsContainers: true,
        supportsModeSwitch: true,
        modpackStrategy: "tlauncher",
        isLoadModerContainer: false,
        isTLMods: true,
        incompatibilityReason:
          "Folder ini terdeteksi sebagai modpack bawaan TL-Mods dan bukan wadah modpack LoadModer. Unduh modpack dinonaktifkan untuk folder ini agar tidak merusak modpack yang sudah ada.",
        notes: "Modpack eksternal TL-Mods terdeteksi. Hanya mendukung pengelolaan mod lokal, profil, dan backup.",
      };
    }

    return {
      launcher: "TLauncher",
      supportsModpack: true,
      supportsContainers: true,
      supportsModeSwitch: true,
      modpackStrategy: "tlauncher",
      isLoadModerContainer: true,
      isTLMods: false,
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

