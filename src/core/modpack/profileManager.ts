import path from "node:path";
import {mkdir, readdir, readFile, copyFile, rm, stat} from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";
import pLimit from "p-limit";
import unzipper from "unzipper";
import {MrpackIndexSchema} from "../../types/mrpack.js";
import {isTLauncherPreservedEngineItem} from "./tlauncher/preservedItems.js";
import {
  discoverTLauncherContainers,
  resolveTLauncherContainerForLoader,
  isTLModsModpackFolder,
} from "./tlauncher/tlauncherStrategy.js";
import {isLegacyPreservedItem} from "./legacy/preservedItems.js";
import {discoverLegacyContainers, resolveLegacyContainerForLoader} from "./legacy/legacyStrategy.js";
import {BaselineManager} from "./baselineManager.js";
import {isLoadModerModpackContainerName} from "../instance/capabilities.js";

export {
  isTLauncherPreservedEngineItem,
  discoverTLauncherContainers,
  resolveTLauncherContainerForLoader,
  isTLModsModpackFolder,
  isLegacyPreservedItem,
  discoverLegacyContainers,
  resolveLegacyContainerForLoader,
  BaselineManager,
};

export interface ProfileSaveOptions {
  onProgress?: (copied: number, total: number, file: string) => void;
}

export interface ActiveProfileInfo {
  activeProfile: string | null;
  name?: string;
  versionId?: string;
  loader?: string;
  gameVersion?: string;
  updatedAt: string;
}

export interface ModpackProfileSummary {
  id: string;
  name: string;
  versionId: string;
  loader?: string;
  gameVersion?: string;
  createdAt: string;
  updatedAt: string;
  filesCount: number;
  isActive: boolean;
}

export interface ProfileManifest {
  id: string;
  name: string;
  versionId: string;
  loader?: string;
  gameVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedContainer {
  containerDir: string;
  containerName: string;
  matchedLoader: "fabric" | "forge" | "neoforge" | "quilt";
}

export interface ClientContainerInfo {
  containerName: string;
  containerDir: string;
  loader: "fabric" | "forge" | "neoforge" | "quilt";
  gameVersion: string;
  profilesCount: number;
  activeProfileName: string | null;
  isLoadModerContainer?: boolean;
  isTLMods?: boolean;
}

export class ModpackProfileManager {
  static getStorageDir(containerDir: string): string {
    return path.join(containerDir, ".loadmoder");
  }

  static getDownloadsDir(containerDir: string): string {
    return path.join(this.getStorageDir(containerDir), "downloads");
  }

  static async syncProfilesFromDownloads(containerDir: string): Promise<ModpackProfileSummary[]> {
    const downloadsDir = this.getDownloadsDir(containerDir);
    let downloadedFiles: string[] = [];
    try {
      const entries = await readdir(downloadsDir, {withFileTypes: true});
      downloadedFiles = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".mrpack"))
        .map((e) => e.name);
    } catch {
      return this.listProfiles(containerDir);
    }

    const currentProfiles = await this.listProfiles(containerDir);
    const existingIds = new Set(currentProfiles.map((p) => p.id));
    const activeInfo = await this.getActiveProfile(containerDir);

    for (const filename of downloadedFiles) {
      const mrpackPath = path.join(downloadsDir, filename);
      const profileId = path
        .basename(filename, path.extname(filename))
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-") || "modpack";

      if (!existingIds.has(profileId)) {
        try {
          const zip = await unzipper.Open.file(mrpackPath);
          const indexEntry = zip.files.find((f: any) => f.path === "modrinth.index.json");
          if (indexEntry) {
            const buffer = await indexEntry.buffer();
            const index = MrpackIndexSchema.parse(JSON.parse(buffer.toString("utf8")));

            let detectedLoader = "fabric";
            let detectedGameVer = "1.20.1";
            for (const [dep, ver] of Object.entries(index.dependencies)) {
              const lower = dep.toLowerCase();
              if (lower.includes("fabric")) detectedLoader = "fabric";
              else if (lower.includes("neoforge")) detectedLoader = "neoforge";
              else if (lower.includes("forge")) detectedLoader = "forge";
              else if (lower.includes("quilt")) detectedLoader = "quilt";
              if (lower === "minecraft" && typeof ver === "string") detectedGameVer = ver;
            }

            await this.createProfileAfterInstall(containerDir, {
              id: profileId,
              name: index.name,
              versionId: index.versionId,
              loader: detectedLoader,
              gameVersion: detectedGameVer,
            });

            if (!activeInfo?.activeProfile) {
              const modsDir = path.join(containerDir, "mods");
              try {
                const modsEntries = await readdir(modsDir);
                if (modsEntries.some((f) => f.endsWith(".jar") || f.endsWith(".disabled"))) {
                  await this.setActiveProfileInfo(containerDir, {
                    activeProfile: profileId,
                    name: index.name,
                    versionId: index.versionId,
                    loader: detectedLoader,
                    gameVersion: detectedGameVer,
                    updatedAt: new Date().toISOString(),
                  });
                }
              } catch {}
            }
          }
        } catch {}
      }
    }

    return this.listProfiles(containerDir);
  }

  static async discoverClientContainers(
    baseDir?: string,
    launcher?: string,
  ): Promise<ClientContainerInfo[]> {
    const lName = (launcher ?? "").toLowerCase();

    // 1. Jika secara eksplisit launcher TLauncher (dan bukan legacy)
    if (lName.includes("tlauncher") && !lName.includes("legacy")) {
      return discoverTLauncherContainers(
        baseDir,
        (d) => this.syncProfilesFromDownloads(d),
        (d) => this.listProfiles(d),
        (d) => this.getActiveProfile(d),
      );
    }

    // 2. Jika secara eksplisit launcher Legacy
    if (lName.includes("legacy")) {
      return discoverLegacyContainers(
        baseDir,
        (d) => this.syncProfilesFromDownloads(d),
        (d) => this.listProfiles(d),
        (d) => this.getActiveProfile(d),
      );
    }

    // 3. Fallback deteksi dari struktur folder disk spesifik Legacy
    if (baseDir) {
      const norm = baseDir.toLowerCase();
      const isLegacyPath =
        norm.includes(".tlauncher\\legacy") ||
        norm.includes(".tlauncher/legacy") ||
        norm.includes("legacy\\minecraft") ||
        norm.includes("legacy/minecraft") ||
        norm.includes("legacylauncher");

      if (isLegacyPath) {
        return discoverLegacyContainers(
          baseDir,
          (d) => this.syncProfilesFromDownloads(d),
          (d) => this.listProfiles(d),
          (d) => this.getActiveProfile(d),
        );
      }
    }

    return discoverTLauncherContainers(
      baseDir,
      (d) => this.syncProfilesFromDownloads(d),
      (d) => this.listProfiles(d),
      (d) => this.getActiveProfile(d),
      (d) => this.ensureTLModsProfile(d),
    );
  }

  static async resolveContainerForLoader(
    baseInstanceDir: string,
    loader?: string,
    gameVersion?: string,
    launcher?: string,
  ): Promise<ResolvedContainer> {
    const lName = (launcher ?? "").toLowerCase();
    const norm = baseInstanceDir.toLowerCase();
    const isLegacy =
      lName.includes("legacy") ||
      norm.includes(".tlauncher\\legacy") ||
      norm.includes(".tlauncher/legacy") ||
      norm.includes("legacy\\minecraft") ||
      norm.includes("legacy/minecraft") ||
      norm.includes("legacylauncher");

    if (isLegacy) {
      const res = await resolveLegacyContainerForLoader(
        baseInstanceDir,
        (loader as any) ?? "fabric",
        gameVersion,
      );
      if (res) return res;
    }

    return resolveTLauncherContainerForLoader(baseInstanceDir, loader, gameVersion);
  }

  static getProfilesDir(containerDir: string): string {
    return path.join(this.getStorageDir(containerDir), "profiles");
  }

  static getActiveProfileFile(containerDir: string): string {
    return path.join(this.getStorageDir(containerDir), "active-profile.json");
  }

  static async getActiveProfile(containerDir: string): Promise<ActiveProfileInfo | null> {
    try {
      const filePath = this.getActiveProfileFile(containerDir);
      const data = await readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static async setActiveProfileInfo(
    containerDir: string,
    info: ActiveProfileInfo,
  ): Promise<void> {
    const storageDir = this.getStorageDir(containerDir);
    await mkdir(storageDir, {recursive: true});
    const filePath = this.getActiveProfileFile(containerDir);
    await writeFileAtomic(filePath, JSON.stringify(info, null, 2), "utf8");
  }

  static async listProfiles(containerDir: string): Promise<ModpackProfileSummary[]> {
    const profilesDir = this.getProfilesDir(containerDir);
    const activeInfo = await this.getActiveProfile(containerDir);
    const activeId = activeInfo?.activeProfile ?? null;

    const list: ModpackProfileSummary[] = [];

    try {
      const entries = await readdir(profilesDir, {withFileTypes: true});
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(profilesDir, entry.name, "manifest.json");
        try {
          const raw = await readFile(manifestPath, "utf8");
          const manifest: ProfileManifest = JSON.parse(raw);

          let filesCount = 0;
          try {
            const filesDir = path.join(profilesDir, entry.name, "files");
            const countDir = async (dir: string): Promise<number> => {
              let count = 0;
              const items = await readdir(dir, {withFileTypes: true});
              for (const item of items) {
                if (item.isDirectory()) {
                  count += await countDir(path.join(dir, item.name));
                } else if (item.isFile()) {
                  count++;
                }
              }
              return count;
            };
            filesCount = await countDir(filesDir);
          } catch {}

          list.push({
            id: manifest.id,
            name: manifest.name,
            versionId: manifest.versionId,
            loader: manifest.loader,
            gameVersion: manifest.gameVersion,
            createdAt: manifest.createdAt,
            updatedAt: manifest.updatedAt,
            filesCount,
            isActive: manifest.id === activeId,
          });
        } catch {}
      }
    } catch {}

    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  static isPreservedEngineItem(entryName: string, containerDir: string): boolean {
    const norm = containerDir.toLowerCase();
    if (norm.includes("legacy") || norm.includes("home")) {
      return isLegacyPreservedItem(entryName, containerDir);
    }
    return isTLauncherPreservedEngineItem(entryName, containerDir);
  }

  /**
   * Menentukan apakah suatu file/folder harus dilewati saat menyimpan isi wadah ke profil modpack.
   * Untuk modpack bawaan TL-Mods, seluruh file disimpan tanpa terkecuali (termasuk TLauncherAdditional.json, config, options, shaders, dll.)
   */
  static shouldSkipFromProfileSave(entryName: string, containerDir: string): boolean {
    const lower = entryName.toLowerCase();
    if (lower === ".loadmoder" || lower === ".fabric" || lower === "logs") return true;

    const cName = path.basename(containerDir).toLowerCase();
    const isMypack = isLoadModerModpackContainerName(cName);

    if (isMypack) {
      if (lower === `${cName}.jar` || lower === `${cName}.json`) return true;
      if (lower.startsWith("mypack") && (lower.endsWith(".jar") || lower.endsWith(".json"))) return true;
      if (lower === "tlauncheradditional.json") return true;
    }

    // Untuk wadah modpack TL-Mods: simpan SEMUANYA tanpa terkecuali (mods, config, options, shader, TLauncherAdditional.json)
    // Hanya lewati file .jar engine versi root jika merupakan Minecraft client jar
    if (lower === `${cName}.jar`) return true;

    return false;
  }

  /**
   * Mendeteksi dan memastikan modpack bawaan TL-Mods TLauncher otomatis memiliki profil LoadModer
   * dan seluruh file modpack-nya tersimpan rapi tanpa terkecuali.
   */
  static async ensureTLModsProfile(containerDir: string): Promise<ModpackProfileSummary | null> {
    const cName = path.basename(containerDir);
    if (isLoadModerModpackContainerName(cName)) {
      return null;
    }

    const tlJsonPath = path.join(containerDir, "TLauncherAdditional.json");
    let tlJson: any = null;
    try {
      const raw = await readFile(tlJsonPath, "utf8");
      tlJson = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!tlJson?.modpack) {
      return null;
    }

    const modpackName =
      (typeof tlJson.modpack.name === "string" && tlJson.modpack.name.trim()) ||
      cName;
    const versionId =
      tlJson.modpack.version?.name ||
      (tlJson.modpack.version?.id ? String(tlJson.modpack.version.id) : null) ||
      "1.0.0";
    let gameVersion = tlJson.modpack.version?.gameVersionDTO?.name || "1.20.1";

    let loader: "fabric" | "forge" | "neoforge" | "quilt" = "forge";
    const loaderTypes = tlJson.modpack.version?.minecraftVersionTypes;
    if (Array.isArray(loaderTypes)) {
      for (const lt of loaderTypes) {
        const name = (lt.name ?? "").toLowerCase();
        if (name.includes("fabric")) loader = "fabric";
        else if (name.includes("neoforge")) loader = "neoforge";
        else if (name.includes("forge")) loader = "forge";
        else if (name.includes("quilt")) loader = "quilt";
      }
    } else {
      const lower = cName.toLowerCase();
      if (lower.includes("fabric")) loader = "fabric";
      else if (lower.includes("neoforge")) loader = "neoforge";
      else if (lower.includes("quilt")) loader = "quilt";
    }

    const cleanId =
      "tlmods-" +
      cName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    const existingProfiles = await this.listProfiles(containerDir);
    let matched = existingProfiles.find(
      (p) => p.id === cleanId || p.name.toLowerCase() === modpackName.toLowerCase()
    );

    const activeInfo = await this.getActiveProfile(containerDir);

    // Cek apakah di folder live container benar-benar ada berkas mod fisik (.jar / .disabled)
    const modsDir = path.join(containerDir, "mods");
    let hasLiveMods = false;
    try {
      const entries = await readdir(modsDir);
      hasLiveMods = entries.some((f) => f.endsWith(".jar") || f.endsWith(".disabled"));
    } catch {}

    if (!matched) {
      await this.createProfileAfterInstall(containerDir, {
        id: cleanId,
        name: modpackName,
        versionId: String(versionId),
        loader,
        gameVersion,
      });

      if (hasLiveMods) {
        await this.saveActiveToProfile(containerDir);
      } else {
        await this.setActiveProfileInfo(containerDir, {
          activeProfile: null,
          updatedAt: new Date().toISOString(),
        });
      }

      const updated = await this.listProfiles(containerDir);
      matched = updated.find((p) => p.id === cleanId);
    } else {
      if (!activeInfo?.activeProfile && hasLiveMods) {
        await this.setActiveProfileInfo(containerDir, {
          activeProfile: matched.id,
          name: matched.name,
          versionId: matched.versionId,
          loader: matched.loader,
          gameVersion: matched.gameVersion,
          updatedAt: new Date().toISOString(),
        });
      } else if (activeInfo?.activeProfile && !hasLiveMods) {
        // Auto-heal: wadah dalam keadaan bersih fisik (misal dinonaktifkan / beralih ke default),
        // maka status activeProfile wajib disetel ke null agar tidak aktif palsu
        await this.setActiveProfileInfo(containerDir, {
          activeProfile: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return matched ?? null;
  }

  /**
   * Menyimpan profil modpack TL-Mods TLauncher secara manual.
   * Fungsi ini KHUSUS dan DIBATASI HANYA untuk wadah modpack TL-Mods.
   * Akan melempar error jika dipanggil pada wadah modpack reguler LoadModer (mypack) atau folder non-TL-Mods.
   */
  static async manualSaveTLModsProfile(
    containerDir: string,
    opts?: ProfileSaveOptions,
  ): Promise<{
    profile: ModpackProfileSummary;
    filesCount: number;
  }> {
    const isTLMods = await isTLModsModpackFolder(containerDir);
    if (!isTLMods) {
      throw new Error(
        "Operasi Simpan Profil Manual hanya diperuntukkan bagi modpack bawaan TL-Mods TLauncher.",
      );
    }

    // Pastikan entitas profil TL-Mods telah terinisialisasi
    await this.ensureTLModsProfile(containerDir);

    const active = await this.getActiveProfile(containerDir);
    if (!active || !active.activeProfile) {
      throw new Error("Tidak ada profil TL-Mods aktif yang dapat disimpan.");
    }

    // Simpan seluruh berkas aktif ke arsip profil tanpa terkecuali
    await this.saveActiveToProfile(containerDir, opts);

    const profiles = await this.listProfiles(containerDir);
    const matched = profiles.find((p) => p.id === active.activeProfile);

    return {
      profile: matched ?? {
        id: active.activeProfile,
        name: active.name ?? path.basename(containerDir),
        versionId: active.versionId ?? "1.0.0",
        loader: active.loader,
        gameVersion: active.gameVersion,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        filesCount: 0,
        isActive: true,
      },
      filesCount: matched?.filesCount ?? 0,
    };
  }

  static async saveActiveToProfile(
    containerDir: string,
    opts?: ProfileSaveOptions,
  ): Promise<void> {
    const activeInfo = await this.getActiveProfile(containerDir);
    if (!activeInfo || !activeInfo.activeProfile) return;

    const profileId = activeInfo.activeProfile;
    const profileDir = path.join(this.getProfilesDir(containerDir), profileId);
    const filesDir = path.join(profileDir, "files");

    await mkdir(filesDir, {recursive: true});

    try {
      const entries = await readdir(containerDir, {withFileTypes: true});
      const allFilesToCopy: Array<{src: string; dest: string}> = [];
      const liveRelativePaths = new Set<string>();

      for (const entry of entries) {
        if (this.shouldSkipFromProfileSave(entry.name, containerDir)) continue;

        const srcPath = path.join(containerDir, entry.name);
        const destPath = path.resolve(filesDir, entry.name);

        if (entry.isDirectory()) {
          const collected = await this.collectFilesToCopy(srcPath, destPath);
          for (const item of collected) {
            allFilesToCopy.push(item);
            const rel = path.relative(filesDir, item.dest).replace(/\\/g, "/");
            liveRelativePaths.add(rel);
          }
        } else if (entry.isFile()) {
          allFilesToCopy.push({src: srcPath, dest: destPath});
          const rel = path.relative(filesDir, destPath).replace(/\\/g, "/");
          liveRelativePaths.add(rel);
        }
      }

      if (allFilesToCopy.length > 0) {
        const limit = pLimit(8);
        let copied = 0;
        const total = allFilesToCopy.length;

        await Promise.all(
          allFilesToCopy.map((item) =>
            limit(async () => {
              await mkdir(path.dirname(item.dest), {recursive: true});
              await copyFile(item.src, item.dest);
              copied++;
              opts?.onProgress?.(copied, total, item.src);
            }),
          ),
        );
      }

      // Bersihkan berkas yatim piatu di arsip profil yang sudah dihapus oleh pengguna di wadah aktif
      await this.pruneOrphanFiles(filesDir, liveRelativePaths);
    } catch {}

    const manifestPath = path.join(profileDir, "manifest.json");
    let manifest: ProfileManifest = {
      id: profileId,
      name: activeInfo.name ?? profileId,
      versionId: activeInfo.versionId ?? "1.0.0",
      loader: activeInfo.loader,
      gameVersion: activeInfo.gameVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const raw = await readFile(manifestPath, "utf8");
      manifest = {...JSON.parse(raw), updatedAt: new Date().toISOString()};
    } catch {}

    await writeFileAtomic(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }

  private static async pruneOrphanFiles(
    filesDir: string,
    liveRelativePaths: Set<string>,
  ): Promise<void> {
    const scanDir = async (dir: string): Promise<boolean> => {
      let isEmpty = true;
      let entries: any[] = [];
      try {
        entries = await readdir(dir, {withFileTypes: true});
      } catch {
        return true;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(filesDir, fullPath).replace(/\\/g, "/");

        if (entry.isDirectory()) {
          const dirEmpty = await scanDir(fullPath);
          if (dirEmpty) {
            try {
              await rm(fullPath, {recursive: true, force: true});
            } catch {}
          } else {
            isEmpty = false;
          }
        } else if (entry.isFile()) {
          if (!liveRelativePaths.has(relPath)) {
            try {
              await rm(fullPath, {force: true});
            } catch {}
          } else {
            isEmpty = false;
          }
        }
      }
      return isEmpty;
    };

    await scanDir(filesDir);
  }

  static async clearContainerLiveFiles(containerDir: string): Promise<void> {
    const rootResolved = path.resolve(containerDir);

    try {
      const entries = await readdir(containerDir, {withFileTypes: true});
      for (const entry of entries) {
        if (this.isPreservedEngineItem(entry.name, containerDir)) continue;

        const target = path.resolve(containerDir, entry.name);
        if (!target.startsWith(rootResolved + path.sep)) continue;

        try {
          await rm(target, {recursive: true, force: true});
        } catch {}
      }
    } catch {}
  }

  static async disableAllModpackContainers(
    baseDir?: string,
    launcher?: string,
  ): Promise<Array<{containerName: string; containerDir: string; disabledProfile: string | null}>> {
    const containers = await this.discoverClientContainers(baseDir, launcher);
    const results: Array<{containerName: string; containerDir: string; disabledProfile: string | null}> = [];

    for (const c of containers) {
      const disabled = await this.disableProfile(c.containerDir);
      results.push({
        containerName: c.containerName,
        containerDir: c.containerDir,
        disabledProfile: disabled,
      });
    }

    return results;
  }

  static async activateProfile(
    containerDir: string,
    profileId: string,
  ): Promise<ModpackProfileSummary> {
    const profiles = await this.listProfiles(containerDir);
    const targetProfile = profiles.find((p) => p.id === profileId);
    if (!targetProfile) {
      throw new Error(`Profil modpack dengan ID "${profileId}" tidak ditemukan.`);
    }

    const activeInfo = await this.getActiveProfile(containerDir);
    if (activeInfo && activeInfo.activeProfile && activeInfo.activeProfile !== profileId) {
      await this.saveActiveToProfile(containerDir);
    }

    await this.clearContainerLiveFiles(containerDir);

    const profileDir = path.join(this.getProfilesDir(containerDir), profileId);
    const filesDir = path.join(profileDir, "files");
    const rootResolved = path.resolve(containerDir);

    try {
      const entries = await readdir(filesDir, {withFileTypes: true});
      const allFilesToRestore: Array<{src: string; dest: string}> = [];

      for (const entry of entries) {
        const srcPath = path.join(filesDir, entry.name);
        const destPath = path.resolve(containerDir, entry.name);
        if (!destPath.startsWith(rootResolved + path.sep)) continue;

        if (entry.isDirectory()) {
          const collected = await this.collectFilesToCopy(srcPath, destPath);
          for (const item of collected) {
            if (item.dest.startsWith(rootResolved + path.sep)) {
              allFilesToRestore.push(item);
            }
          }
        } else if (entry.isFile()) {
          allFilesToRestore.push({src: srcPath, dest: destPath});
        }
      }

      if (allFilesToRestore.length > 0) {
        const limit = pLimit(8);
        await Promise.all(
          allFilesToRestore.map((item) =>
            limit(async () => {
              await mkdir(path.dirname(item.dest), {recursive: true});
              await copyFile(item.src, item.dest);
            }),
          ),
        );
      }
    } catch {}

    await this.setActiveProfileInfo(containerDir, {
      activeProfile: profileId,
      name: targetProfile.name,
      versionId: targetProfile.versionId,
      loader: targetProfile.loader,
      gameVersion: targetProfile.gameVersion,
      updatedAt: new Date().toISOString(),
    });

    targetProfile.isActive = true;
    return targetProfile;
  }

  static async disableProfile(containerDir: string): Promise<string | null> {
    const activeInfo = await this.getActiveProfile(containerDir);
    const disabledName = activeInfo?.name ?? activeInfo?.activeProfile ?? null;

    if (activeInfo && activeInfo.activeProfile) {
      await this.saveActiveToProfile(containerDir);
    }

    await this.clearContainerLiveFiles(containerDir);
    await BaselineManager.restoreBaseline(containerDir);

    await this.setActiveProfileInfo(containerDir, {
      activeProfile: null,
      updatedAt: new Date().toISOString(),
    });

    return disabledName;
  }

  static async createProfileAfterInstall(
    containerDir: string,
    profileData: {
      id: string;
      name: string;
      versionId: string;
      loader?: string;
      gameVersion?: string;
    },
  ): Promise<void> {
    const profileDir = path.join(this.getProfilesDir(containerDir), profileData.id);
    await mkdir(profileDir, {recursive: true});

    const manifest: ProfileManifest = {
      id: profileData.id,
      name: profileData.name,
      versionId: profileData.versionId,
      loader: profileData.loader,
      gameVersion: profileData.gameVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const manifestPath = path.join(profileDir, "manifest.json");
    await writeFileAtomic(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    await this.setActiveProfileInfo(containerDir, {
      activeProfile: profileData.id,
      name: profileData.name,
      versionId: profileData.versionId,
      loader: profileData.loader,
      gameVersion: profileData.gameVersion,
      updatedAt: new Date().toISOString(),
    });
  }

  static async removeProfile(containerDir: string, profileId: string): Promise<void> {
    const activeInfo = await this.getActiveProfile(containerDir);
    if (activeInfo?.activeProfile === profileId) {
      await this.disableProfile(containerDir);
    }

    const profileDir = path.join(this.getProfilesDir(containerDir), profileId);
    try {
      await rm(profileDir, {recursive: true, force: true});
    } catch {}
  }

  private static async collectFilesToCopy(
    srcDir: string,
    destDir: string,
  ): Promise<Array<{src: string; dest: string}>> {
    const list: Array<{src: string; dest: string}> = [];
    try {
      const entries = await readdir(srcDir, {withFileTypes: true});
      for (const entry of entries) {
        const srcItem = path.join(srcDir, entry.name);
        const destItem = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
          const sub = await this.collectFilesToCopy(srcItem, destItem);
          list.push(...sub);
        } else if (entry.isFile()) {
          list.push({src: srcItem, dest: destItem});
        }
      }
    } catch {}
    return list;
  }

  private static async copyDirRecursive(
    srcDir: string,
    destDir: string,
    rootResolved: string,
  ): Promise<void> {
    await mkdir(destDir, {recursive: true});
    const entries = await readdir(srcDir, {withFileTypes: true});
    for (const entry of entries) {
      const srcItem = path.join(srcDir, entry.name);
      const destItem = path.resolve(destDir, entry.name);
      if (!destItem.startsWith(rootResolved + path.sep) && destItem !== rootResolved) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.copyDirRecursive(srcItem, destItem, rootResolved);
      } else if (entry.isFile()) {
        await mkdir(path.dirname(destItem), {recursive: true});
        await copyFile(srcItem, destItem);
      }
    }
  }
}
