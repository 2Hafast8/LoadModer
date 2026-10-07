import path from "node:path";
import {mkdir, readdir, readFile, stat} from "node:fs/promises";
import {isLegacyPreservedItem} from "./preservedItems.js";
import type {ClientContainerInfo, ResolvedContainer} from "../profileManager.js";

export {isLegacyPreservedItem};

/**
 * Membaca properti login.version dari tl.properties Legacy Launcher jika tersedia.
 */
export async function getLegacyActiveVersion(gameDir: string): Promise<string | null> {
  const candidatePaths = [
    path.join(gameDir, "..", "tl.properties"),
    path.join(gameDir, "tl.properties"),
  ];

  for (const p of candidatePaths) {
    try {
      const raw = await readFile(p, "utf8");
      const match = raw.match(/^login\.version\s*=\s*(.+)$/m);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {}
  }

  return null;
}

/**
 * Menemukan seluruh wadah profil versi di folder home milik Legacy Launcher (game/home).
 */
export async function discoverLegacyContainers(
  baseDir?: string,
  syncProfilesFromDownloads?: (containerDir: string) => Promise<unknown>,
  listProfiles?: (containerDir: string) => Promise<unknown[]>,
  getActiveProfile?: (containerDir: string) => Promise<{name?: string; activeProfile?: string | null} | null>,
): Promise<ClientContainerInfo[]> {
  let gameDir: string | null = null;

  if (baseDir) {
    const norm = path.resolve(baseDir);
    const bName = path.basename(norm).toLowerCase();
    const parentName = path.basename(path.dirname(norm)).toLowerCase();

    if (bName === "game" || (bName === "files" && norm.toLowerCase().includes("legacy"))) {
      gameDir = norm;
    } else if (bName === "home") {
      gameDir = path.dirname(norm);
    } else if (parentName === "home") {
      gameDir = path.dirname(path.dirname(norm));
    } else {
      const candHome = path.join(norm, "home");
      try {
        const s = await stat(candHome);
        if (s.isDirectory()) gameDir = norm;
      } catch {}
    }
  }

  if (!gameDir && !baseDir) {
    const appData =
      process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Roaming");
    const defaultGame = path.join(appData, ".tlauncher", "legacy", "Minecraft", "game");
    try {
      const s = await stat(defaultGame);
      if (s.isDirectory()) gameDir = defaultGame;
    } catch {}
  }

  if (!gameDir) return [];

  const homeDir = path.join(gameDir, "home");
  const versionsDir = path.join(gameDir, "versions");

  try {
    const s = await stat(homeDir);
    if (!s.isDirectory()) return [];
  } catch {
    return [];
  }

  const activeLoginVersion = await getLegacyActiveVersion(gameDir);
  const normalizedActiveLogin = activeLoginVersion
    ? activeLoginVersion.toLowerCase().replace(/\s+/g, "-")
    : null;

  const containers: ClientContainerInfo[] = [];

  try {
    const entries = await readdir(homeDir, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const cName = entry.name;
      const lower = cName.toLowerCase();
      const cDir = path.join(homeDir, cName);

      let loader: "fabric" | "forge" | "neoforge" | "quilt" = "fabric";
      if (lower.includes("neoforge")) loader = "neoforge";
      else if (lower.includes("forge")) loader = "forge";
      else if (lower.includes("quilt")) loader = "quilt";

      let gameVersion = "1.20.1";

      // Coba cocokkan dengan metadata di folder versions/
      const possibleVerNames = [
        cName,
        cName.replace(/-/g, " "),
        cName.replace(/_/g, " "),
      ];

      for (const vName of possibleVerNames) {
        const vJsonPath = path.join(versionsDir, vName, `${vName}.json`);
        try {
          const raw = await readFile(vJsonPath, "utf8");
          const vJson = JSON.parse(raw);
          if (vJson.inheritsFrom) {
            gameVersion = vJson.inheritsFrom;
          } else if (vJson.id) {
            gameVersion = vJson.id;
          }

          const mainClass = (vJson.mainClass ?? "").toLowerCase();
          if (mainClass.includes("fabric")) loader = "fabric";
          else if (mainClass.includes("neoforge")) loader = "neoforge";
          else if (mainClass.includes("forge")) loader = "forge";
          else if (mainClass.includes("quilt")) loader = "quilt";
          break;
        } catch {}
      }

      if (syncProfilesFromDownloads) {
        try {
          await syncProfilesFromDownloads(cDir);
        } catch {}
      }

      let profilesCount = 0;
      if (listProfiles) {
        try {
          const list = await listProfiles(cDir);
          profilesCount = list.length;
        } catch {}
      }

      let activeProfileName: string | null = null;
      if (getActiveProfile) {
        try {
          const info = await getActiveProfile(cDir);
          activeProfileName = info?.activeProfile ? (info.name ?? info.activeProfile) : null;
        } catch {}
      }

      // Jika wadah ini cocok dengan login.version aktif di Legacy Launcher
      const isCurrentlyActiveInLauncher = Boolean(
        normalizedActiveLogin &&
          (lower === normalizedActiveLogin || lower.replace(/\s+/g, "-") === normalizedActiveLogin),
      );

      containers.push({
        containerName: cName,
        containerDir: cDir,
        loader,
        gameVersion,
        profilesCount,
        activeProfileName: isCurrentlyActiveInLauncher
          ? (activeProfileName ?? "Legacy Active")
          : activeProfileName,
      });
    }
  } catch {}

  return containers;
}

/**
 * Menyelesaikan atau memilih wadah Legacy Launcher di folder home/<profile>
 * yang sesuai dengan mod loader yang diminta.
 */
export async function resolveLegacyContainerForLoader(
  gameDir: string,
  targetLoader: "fabric" | "forge" | "neoforge" | "quilt",
  targetGameVersion?: string,
): Promise<ResolvedContainer | null> {
  const containers = await discoverLegacyContainers(gameDir);

  // 1. Cari wadah yang cocok loader dan game version
  const exactMatch = containers.find(
    (c) =>
      c.loader === targetLoader &&
      (!targetGameVersion || c.gameVersion === targetGameVersion),
  );
  if (exactMatch) {
    return {
      containerDir: exactMatch.containerDir,
      containerName: exactMatch.containerName,
      matchedLoader: exactMatch.loader === "forge" ? "forge" : "fabric",
    };
  }

  // 2. Cari wadah yang cocok dengan loader
  const loaderMatch = containers.find((c) => c.loader === targetLoader);
  if (loaderMatch) {
    return {
      containerDir: loaderMatch.containerDir,
      containerName: loaderMatch.containerName,
      matchedLoader: loaderMatch.loader === "forge" ? "forge" : "fabric",
    };
  }

  // 3. Jika belum ada, buat wadah baru di home/<loader>-<version>
  const homeDir = path.join(gameDir, "home");
  const folderName = `${targetLoader.charAt(0).toUpperCase() + targetLoader.slice(1)}-${targetGameVersion ?? "Profile"}`;
  const newContainerDir = path.join(homeDir, folderName);

  await mkdir(path.join(newContainerDir, "mods"), {recursive: true});

  return {
    containerDir: newContainerDir,
    containerName: folderName,
    matchedLoader: targetLoader === "forge" ? "forge" : "fabric",
  };
}
