import os from "node:os";
import path from "node:path";
import {readdir, readFile, stat} from "node:fs/promises";
import type {MinecraftInstance, LoaderType, LauncherType} from "../../types/instance.js";
import {
  findMinecraftDirs,
  instanceIdFromPath,
  listLocalDrives,
  normalizeForCompare,
  type DriveScanOptions,
  type DriveScanResult,
} from "./driveScanner.js";
import {getLegacyActiveVersion} from "../modpack/legacy/legacyStrategy.js";

export function deduplicateInstances(instances: MinecraftInstance[]): MinecraftInstance[] {
  const seenIds = new Set<string>();
  const seenRoots = new Set<string>();
  const seenMods = new Set<string>();
  const unique: MinecraftInstance[] = [];

  for (const inst of instances) {
    const idKey = inst.id.toLowerCase();
    const rootKey = normalizeForCompare(inst.rootDir);
    const modsKey = normalizeForCompare(inst.modsDir);

    if (seenIds.has(idKey) || seenRoots.has(rootKey) || seenMods.has(modsKey)) {
      continue;
    }

    seenIds.add(idKey);
    seenRoots.add(rootKey);
    seenMods.add(modsKey);
    unique.push(inst);
  }

  return unique;
}

export interface DetectedLauncherInfo {
  launcher: LauncherType;
  name: string;
  id: string;
  notes?: string;
}

export function detectLauncherFromPath(targetPath: string): DetectedLauncherInfo {
  const norm = path.resolve(targetPath);
  const isWindows = process.platform === "win32";
  const isDriveC = isWindows && /^[c][:]/i.test(norm);

  // 1. Jika di Local Disk C (analisis segmen setelah AppData/Roaming)
  if (isDriveC) {
    const roamingMatch = norm.match(/[\\/]AppData[\\/]Roaming[\\/](.+)$/i);
    if (roamingMatch) {
      const rel = roamingMatch[1].toLowerCase();

      // Legacy Launcher (.tlauncher/legacy/Minecraft/game atau files atau subfolder lainnya)
      if (
        rel.includes(".tlauncher\\legacy") ||
        rel.includes(".tlauncher/legacy") ||
        rel.includes("legacy\\minecraft") ||
        rel.includes("legacy/minecraft") ||
        rel.includes("legacylauncher")
      ) {
        const sub = path.basename(norm);
        return {
          launcher: "Legacy",
          name: `Legacy Launcher (${sub})`,
          id: `legacy-${sub.toLowerCase()}`,
        };
      }

      // TLauncher (.tlauncher biasa tanpa legacy)
      if (rel.includes(".tlauncher")) {
        return {
          launcher: "TLauncher",
          name: "TLauncher (Default)",
          id: "tlauncher-default",
        };
      }

      // SKLauncher (.sklauncher)
      if (rel.includes(".sklauncher")) {
        const sub = path.basename(norm);
        return {
          launcher: "SKLauncher",
          name: `SKLauncher (${sub})`,
          id: `sklauncher-${sub.toLowerCase()}`,
        };
      }

      // Prism Launcher
      if (rel.includes("prismlauncher")) {
        const sub = path.basename(norm);
        return {
          launcher: "Prism",
          name: `Prism (${sub})`,
          id: `prism-${sub.toLowerCase()}`,
        };
      }

      // MultiMC
      if (rel.includes("multimc")) {
        const sub = path.basename(norm);
        return {
          launcher: "MultiMC",
          name: `MultiMC (${sub})`,
          id: `multimc-${sub.toLowerCase()}`,
        };
      }

      // Modrinth App
      if (rel.includes("com.modrinth.theseus") || rel.includes("modrinthapp")) {
        const sub = path.basename(norm);
        return {
          launcher: "Modrinth",
          name: `Modrinth (${sub})`,
          id: `modrinth-${sub.toLowerCase()}`,
        };
      }

      // CurseForge
      if (rel.includes("curseforge")) {
        const sub = path.basename(norm);
        return {
          launcher: "CurseForge",
          name: `CurseForge (${sub})`,
          id: `cf-${sub.toLowerCase()}`,
        };
      }

      // Official Minecraft / Vanilla (.minecraft)
      if (rel.includes(".minecraft")) {
        return {
          launcher: "Vanilla",
          name: "Official Minecraft (Default)",
          id: "vanilla-default",
        };
      }
    }
  }

  // 2. Jika selain Local Disk C (D:, E:, portable, linux/mac) atau di Disk C di luar Roaming:
  // Analisis dari path awal / seluruh path
  const fullLower = norm.toLowerCase();

  // Prism Launcher
  if (fullLower.includes("prismlauncher") || fullLower.includes("prism")) {
    const sub = path.basename(norm);
    return {
      launcher: "Prism",
      name: `Prism (${sub})`,
      id: instanceIdFromPath(norm),
    };
  }

  // MultiMC
  if (fullLower.includes("multimc")) {
    const sub = path.basename(norm);
    return {
      launcher: "MultiMC",
      name: `MultiMC (${sub})`,
      id: instanceIdFromPath(norm),
    };
  }

  // Legacy Launcher (misal D:\Games\LegacyLauncher\... atau D:\.tlauncher\legacy\...)
  if (
    fullLower.includes("legacylauncher") ||
    fullLower.includes("legacy\\minecraft") ||
    fullLower.includes("legacy/minecraft") ||
    (fullLower.includes(".tlauncher") && fullLower.includes("legacy"))
  ) {
    const sub = path.basename(norm);
    return {
      launcher: "Legacy",
      name: `Legacy Launcher (${sub})`,
      id: instanceIdFromPath(norm),
    };
  }

  // TLauncher
  if (fullLower.includes(".tlauncher") || fullLower.includes("tlauncher")) {
    const sub = path.basename(norm);
    return {
      launcher: "TLauncher",
      name: `TLauncher (${sub})`,
      id: instanceIdFromPath(norm),
    };
  }

  // SKLauncher
  if (fullLower.includes("sklauncher")) {
    const sub = path.basename(norm);
    return {
      launcher: "SKLauncher",
      name: `SKLauncher (${sub})`,
      id: instanceIdFromPath(norm),
    };
  }

  // CurseForge
  if (fullLower.includes("curseforge")) {
    const sub = path.basename(norm);
    return {
      launcher: "CurseForge",
      name: `CurseForge (${sub})`,
      id: instanceIdFromPath(norm),
    };
  }

  // Modrinth
  if (fullLower.includes("modrinth")) {
    const sub = path.basename(norm);
    return {
      launcher: "Modrinth",
      name: `Modrinth (${sub})`,
      id: instanceIdFromPath(norm),
    };
  }

  // Official / Standard Minecraft
  if (fullLower.endsWith(".minecraft") || fullLower.endsWith("minecraft")) {
    const rootLetter = path.parse(norm).root.replace(/[\\/]+$/, "") || "/";
    return {
      launcher: "Vanilla",
      name: `Minecraft (${rootLetter})`,
      id: instanceIdFromPath(norm),
    };
  }

  // Fallback Kustom
  return {
    launcher: "Custom",
    name: `Custom (${path.basename(norm)})`,
    id: instanceIdFromPath(norm),
  };
}

export class InstanceDetector {
  private readonly home = os.homedir();
  private readonly isWin = process.platform === "win32";
  private readonly isMac = process.platform === "darwin";

  private get appData(): string {
    return process.env.APPDATA ?? path.join(this.home, "AppData", "Roaming");
  }

  async scanAll(): Promise<MinecraftInstance[]> {
    const results: MinecraftInstance[] = [];

    const [prism, modrinth, curseforge, vanilla, legacy, sklauncher] = await Promise.all([
      this.scanPrismAndMultiMC(),
      this.scanModrinthApp(),
      this.scanCurseForge(),
      this.scanVanilla(),
      this.scanLegacyLauncher(),
      this.scanSKLauncher(),
    ]);

    results.push(...prism, ...modrinth, ...curseforge, ...legacy, ...sklauncher);
    if (vanilla) results.push(vanilla);

    return deduplicateInstances(results);
  }

  private async scanPrismAndMultiMC(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const basePaths = [
      this.isWin
        ? path.join(this.appData, "PrismLauncher", "instances")
        : this.isMac
          ? path.join(this.home, "Library", "Application Support", "PrismLauncher", "instances")
          : path.join(this.home, ".local", "share", "PrismLauncher", "instances"),
      this.isWin
        ? path.join(this.home, "scoop", "persist", "prismlauncher", "instances")
        : "",
      !this.isWin && !this.isMac
        ? path.join(this.home, ".var", "app", "org.prismlauncher.PrismLauncher", "data", "PrismLauncher", "instances")
        : "",
      this.isWin
        ? path.join(this.appData, "MultiMC", "instances")
        : this.isMac
          ? path.join(this.home, "Library", "Application Support", "MultiMC", "instances")
          : path.join(this.home, ".local", "share", "MultiMC", "instances"),
    ].filter(Boolean);

    for (const instancesDir of basePaths) {
      try {
        const dirs = await readdir(instancesDir, {withFileTypes: true});
        for (const dir of dirs) {
          if (!dir.isDirectory()) continue;
          const rootDir = path.join(instancesDir, dir.name);
          const mmcPackPath = path.join(rootDir, "mmc-pack.json");

          let gameVersion: string | undefined;
          let loader: LoaderType | undefined;

          try {
            const mmc = JSON.parse(await readFile(mmcPackPath, "utf8"));
            const mcComp = mmc.components?.find((c: any) => c.uid === "net.minecraft");
            gameVersion = mcComp?.version;

            if (mmc.components?.some((c: any) => c.uid === "net.fabricmc.fabric-loader"))
              loader = "fabric";
            else if (mmc.components?.some((c: any) => c.uid === "net.minecraftforge"))
              loader = "forge";
            else if (mmc.components?.some((c: any) => c.uid === "net.neoforged"))
              loader = "neoforge";
            else if (mmc.components?.some((c: any) => c.uid === "org.quiltmc.quilt-loader"))
              loader = "quilt";
          } catch {}

          let modsDir = path.join(rootDir, ".minecraft", "mods");
          try {
            await stat(modsDir);
          } catch {
            const altModsDir = path.join(rootDir, "minecraft", "mods");
            try {
              const s = await stat(altModsDir);
              if (s.isDirectory()) modsDir = altModsDir;
            } catch {}
          }

          const isMultiMC = instancesDir.toLowerCase().includes("multimc");
          instances.push({
            id: `${isMultiMC ? "multimc" : "prism"}-${dir.name.toLowerCase()}`,
            name: dir.name,
            launcher: isMultiMC ? "MultiMC" : "Prism",
            rootDir,
            modsDir,
            gameVersion,
            loader,
          });
        }
      } catch {}
    }

    return instances;
  }

  private async scanModrinthApp(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const profilesDir = this.isWin
      ? path.join(this.appData, "com.modrinth.theseus", "profiles")
      : this.isMac
        ? path.join(this.home, "Library", "Application Support", "com.modrinth.theseus", "profiles")
        : path.join(this.home, ".config", "ModrinthApp", "profiles");

    try {
      const dirs = await readdir(profilesDir, {withFileTypes: true});
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const rootDir = path.join(profilesDir, dir.name);
        const profilePath = path.join(rootDir, "profile.json");

        try {
          const prof = JSON.parse(await readFile(profilePath, "utf8"));
          instances.push({
            id: `modrinth-${dir.name}`,
            name: prof.name ?? dir.name,
            launcher: "Modrinth",
            rootDir,
            modsDir: path.join(rootDir, "mods"),
            gameVersion: prof.game_version,
            loader: prof.loader?.toLowerCase(),
          });
        } catch {}
      }
    } catch {}

    return instances;
  }

  private async scanCurseForge(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const instancesDir = this.isWin
      ? path.join(this.home, "curseforge", "minecraft", "Instances")
      : path.join(this.home, "curseforge", "minecraft", "Instances");

    try {
      const dirs = await readdir(instancesDir, {withFileTypes: true});
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const rootDir = path.join(instancesDir, dir.name);
        const configPath = path.join(rootDir, "minecraftinstance.json");

        try {
          const cfg = JSON.parse(await readFile(configPath, "utf8"));
          let loader: LoaderType | undefined;
          const loaderName = cfg.baseModLoader?.name?.toLowerCase() ?? "";
          if (loaderName.includes("fabric")) loader = "fabric";
          else if (loaderName.includes("forge")) loader = "forge";
          else if (loaderName.includes("neoforge")) loader = "neoforge";

          instances.push({
            id: `cf-${dir.name}`,
            name: cfg.name ?? dir.name,
            launcher: "CurseForge",
            rootDir,
            modsDir: path.join(rootDir, "mods"),
            gameVersion: cfg.gameVersion,
            loader,
          });
        } catch {}
      }
    } catch {}

    return instances;
  }

  private async scanVanilla(): Promise<MinecraftInstance | null> {
    const mcDir = this.isWin
      ? path.join(this.appData, ".minecraft")
      : this.isMac
        ? path.join(this.home, "Library", "Application Support", "minecraft")
        : path.join(this.home, ".minecraft");

    try {
      await stat(mcDir);
    } catch {
      return null;
    }

    let isTLauncher = false;
    try {
      await stat(path.join(this.appData, ".tlauncher"));
      isTLauncher = true;
    } catch {}
    if (!isTLauncher) {
      try {
        await stat(path.join(mcDir, "tlauncher-2.0.properties"));
        isTLauncher = true;
      } catch {}
    }
    if (!isTLauncher) {
      try {
        await stat(path.join(mcDir, "tlauncher.properties"));
        isTLauncher = true;
      } catch {}
    }
    if (!isTLauncher) {
      try {
        await stat(path.join(mcDir, "TlauncherProfiles.json"));
        isTLauncher = true;
      } catch {}
    }
    if (!isTLauncher) {
      try {
        await stat(path.join(mcDir, "logs", "tlauncher"));
        isTLauncher = true;
      } catch {}
    }

    let isSKLauncher = false;
    if (!isTLauncher) {
      try {
        const skDir = this.isWin
          ? path.join(this.appData, ".sklauncher")
          : this.isMac
            ? path.join(this.home, "Library", "Application Support", "sklauncher")
            : path.join(this.home, ".sklauncher");
        await stat(skDir);
        isSKLauncher = true;
      } catch {}
    }

    let launcher: LauncherType = "Vanilla";
    let instanceId = "vanilla-default";
    let instanceName = "Official Minecraft (Default)";

    if (isTLauncher) {
      launcher = "TLauncher";
      instanceId = "tlauncher-default";
      instanceName = "TLauncher (Default)";
    } else if (isSKLauncher) {
      launcher = "SKLauncher";
      instanceId = "sklauncher-default";
      instanceName = "SKLauncher (Default)";
    }

    return this.inspectGameDir(mcDir, {
      id: instanceId,
      name: instanceName,
      launcher,
    });
  }

  private async scanLegacyLauncher(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const baseLegacyMinecraft = this.isWin
      ? path.join(this.appData, ".tlauncher", "legacy", "Minecraft")
      : this.isMac
        ? path.join(this.home, "Library", "Application Support", "tlauncher", "legacy", "Minecraft")
        : path.join(this.home, ".tlauncher", "legacy", "Minecraft");

    const candidatePaths = [
      path.join(baseLegacyMinecraft, "game"),
      path.join(baseLegacyMinecraft, "files"),
      this.isWin
        ? path.join(this.appData, "LegacyLauncher")
        : path.join(this.home, ".legacylauncher"),
    ];

    try {
      const entries = await readdir(baseLegacyMinecraft, {withFileTypes: true});
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subPath = path.join(baseLegacyMinecraft, entry.name);
        if (!candidatePaths.includes(subPath)) {
          candidatePaths.push(subPath);
        }
      }
    } catch {}

    for (const cPath of candidatePaths) {
      try {
        const s = await stat(cPath);
        if (s.isDirectory()) {
          const inst = await this.inspectGameDir(cPath, {
            id: "legacy-default",
            name: "Legacy Launcher",
            launcher: "Legacy",
          });

          // Periksa apakah ada folder home/<profile> yang aktif berdasarkan tl.properties
          const homeDir = path.join(cPath, "home");
          try {
            const hs = await stat(homeDir);
            if (hs.isDirectory()) {
              const activeVer = await getLegacyActiveVersion(cPath);
              if (activeVer) {
                const normActive = activeVer.replace(/\s+/g, "-");
                const activeModsCand = path.join(homeDir, normActive, "mods");
                try {
                  const ms = await stat(activeModsCand);
                  if (ms.isDirectory()) {
                    inst.modsDir = activeModsCand;
                  }
                } catch {}
              }
            }
          } catch {}

          instances.push(inst);
          break;
        }
      } catch {}
    }

    return instances;
  }

  private async scanSKLauncher(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const skDir = this.isWin
      ? path.join(this.appData, ".sklauncher")
      : this.isMac
        ? path.join(this.home, "Library", "Application Support", "sklauncher")
        : path.join(this.home, ".sklauncher");

    try {
      const s = await stat(skDir);
      if (s.isDirectory()) {
        const profilesDir = path.join(skDir, "profiles");
        try {
          const pEntries = await readdir(profilesDir, {withFileTypes: true});
          for (const p of pEntries) {
            if (!p.isDirectory()) continue;
            const pPath = path.join(profilesDir, p.name);
            instances.push(
              await this.inspectGameDir(pPath, {
                id: `sklauncher-${p.name.toLowerCase()}`,
                name: `SKLauncher: ${p.name}`,
                launcher: "SKLauncher",
              }),
            );
          }
        } catch {}
      }
    } catch {}

    return instances;
  }

  private async scanTLauncherModpacks(): Promise<MinecraftInstance[]> {
    const instances: MinecraftInstance[] = [];
    const mcDir = this.isWin
      ? path.join(this.appData, ".minecraft")
      : this.isMac
        ? path.join(this.home, "Library", "Application Support", "minecraft")
        : path.join(this.home, ".minecraft");

    const versionsDir = path.join(mcDir, "versions");
    try {
      const dirs = await readdir(versionsDir, {withFileTypes: true});
      for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const versionDir = path.join(versionsDir, d.name);
        const tlJsonPath = path.join(versionDir, "TLauncherAdditional.json");
        try {
          const raw = await readFile(tlJsonPath, "utf8");
          const tlJson = JSON.parse(raw);
          if (tlJson && typeof tlJson === "object" && tlJson.modpack) {
            const packName = tlJson.modpack.name ?? d.name;
            const mcVer = tlJson.modpack.version?.gameVersionDTO?.name;
            const loaderTypes = tlJson.modpack.version?.minecraftVersionTypes;
            let loader: LoaderType | undefined;
            if (Array.isArray(loaderTypes)) {
              for (const lt of loaderTypes) {
                const name = lt.name?.toLowerCase() ?? "";
                if (name.includes("fabric")) loader = "fabric";
                else if (name.includes("forge")) loader = "forge";
                else if (name.includes("neoforge")) loader = "neoforge";
                else if (name.includes("quilt")) loader = "quilt";
              }
            }

            instances.push({
              id: `tlauncher-${d.name.toLowerCase()}`,
              name: `TLauncher: ${packName}`,
              launcher: "TLauncher",
              rootDir: versionDir,
              modsDir: path.join(versionDir, "mods"),
              gameVersion: mcVer,
              loader,
            });
          }
        } catch {}
      }
    } catch {}

    return instances;
  }

  async scanOtherDrives(
    opts: DriveScanOptions & {
      includeSystemDrive?: boolean;
      roots?: string[];
      exclude?: string[];
    } = {},
  ): Promise<{instances: MinecraftInstance[]; drives: string[]; result: DriveScanResult}> {
    const drives = opts.roots ?? (await listLocalDrives({includeSystemDrive: opts.includeSystemDrive}));
    const result = await findMinecraftDirs(drives, opts);

    const known = new Set((opts.exclude ?? []).map(normalizeForCompare));
    const instances: MinecraftInstance[] = [];
    for (const dir of result.found) {
      const key = normalizeForCompare(dir);
      const parentKey = normalizeForCompare(path.dirname(dir));
      const candidateModsKey = normalizeForCompare(path.join(dir, "mods"));

      if (known.has(key) || known.has(parentKey) || known.has(candidateModsKey)) {
        continue;
      }

      known.add(key);
      known.add(parentKey);
      known.add(candidateModsKey);

      const detected = detectLauncherFromPath(dir);
      instances.push(
        await this.inspectGameDir(dir, {
          id: detected.id,
          name: detected.name,
          launcher: detected.launcher,
        }),
      );
    }

    return {instances: deduplicateInstances(instances), drives, result};
  }

  async inspectGameDir(
    mcDir: string,
    meta: Pick<MinecraftInstance, "id" | "name" | "launcher">,
  ): Promise<MinecraftInstance> {
    const modsDir = path.join(mcDir, "mods");

    let gameVersion: string | undefined;
    let loader: LoaderType | undefined;

    const versionsDir = path.join(mcDir, "versions");
    try {
      const vDirs = await readdir(versionsDir, {withFileTypes: true});
      for (const vd of vDirs) {
        if (!vd.isDirectory()) continue;
        const vJsonPath = path.join(versionsDir, vd.name, `${vd.name}.json`);
        try {
          const raw = await readFile(vJsonPath, "utf8");
          const vJson = JSON.parse(raw);
          const mainClass = vJson.mainClass ?? "";

          if (mainClass.includes("fabricmc") || vd.name.toLowerCase().includes("fabric")) {
            loader = "fabric";
          } else if (
            mainClass.includes("neoforged") ||
            vd.name.toLowerCase().includes("neoforge")
          ) {
            loader = "neoforge";
          } else if (
            mainClass.includes("minecraftforge") ||
            vd.name.toLowerCase().includes("forge")
          ) {
            loader = "forge";
          } else if (mainClass.includes("quiltmc") || vd.name.toLowerCase().includes("quilt")) {
            loader = "quilt";
          }

          if (vJson.inheritsFrom) {
            gameVersion = vJson.inheritsFrom;
          } else {
            const tlJsonPath = path.join(versionsDir, vd.name, "TLauncherAdditional.json");
            try {
              const tlRaw = await readFile(tlJsonPath, "utf8");
              const tlJson = JSON.parse(tlRaw);
              if (tlJson?.modpack?.version?.gameVersionDTO?.name) {
                gameVersion = tlJson.modpack.version.gameVersionDTO.name;
              }
              const lt = tlJson?.modpack?.version?.minecraftVersionTypes?.[0]?.name?.toLowerCase();
              if (lt?.includes("fabric")) loader = "fabric";
              else if (lt?.includes("forge")) loader = "forge";
              else if (lt?.includes("neoforge")) loader = "neoforge";
            } catch {}

            if (!gameVersion) {
              const stdMatch = vd.name.match(/(1\.\d+(?:\.\d+)?)/);
              const fallbackMatch = vd.name.match(/(\d+\.\d+(?:\.\d+)?|26\.\d+)/);
              if (stdMatch) gameVersion = stdMatch[1];
              else if (fallbackMatch) gameVersion = fallbackMatch[1];
            }
          }

          if (loader && gameVersion && gameVersion.startsWith("1.")) break;
        } catch {}
      }
    } catch {}

    if (!loader || !gameVersion) {
      try {
        const modFiles = await readdir(modsDir);
        for (const f of modFiles) {
          const lower = f.toLowerCase();
          if (!loader) {
            if (lower.includes("fabric")) loader = "fabric";
            else if (lower.includes("neoforge")) loader = "neoforge";
            else if (lower.includes("forge")) loader = "forge";
            else if (lower.includes("quilt")) loader = "quilt";
          }
          if (!gameVersion) {
            const m = f.match(
              /(?:mc|minecraft)[-_ ]?((?:1\.(?:1[2-9]|2[0-9])(?:\.[0-9]+)?)|26\.\d+)|[-_+](1\.(?:1[2-9]|2[0-9])(?:\.[0-9]+)?|26\.\d+)/i,
            );
            if (m) gameVersion = m[1] || m[2];
          }
          if (loader && gameVersion) break;
        }
      } catch {}
    }

    return {...meta, rootDir: mcDir, modsDir, gameVersion, loader};
  }
}

export const instanceDetector = new InstanceDetector();
