import path from "node:path";
import {mkdir, readdir, readFile, copyFile, rm, stat} from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";
import pLimit from "p-limit";
import unzipper from "unzipper";
import {MrpackIndexSchema} from "../../types/mrpack.js";

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
  matchedLoader: "fabric" | "forge";
}

export interface ClientContainerInfo {
  containerName: string;
  containerDir: string;
  loader: "fabric" | "forge" | "neoforge" | "quilt";
  gameVersion: string;
  profilesCount: number;
  activeProfileName: string | null;
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

  static async discoverClientContainers(baseDir?: string): Promise<ClientContainerInfo[]> {
    let versionsDir: string | null = null;
    if (baseDir) {
      if (path.basename(path.dirname(baseDir)).toLowerCase() === "versions") {
        versionsDir = path.dirname(baseDir);
      } else {
        const candidate = path.join(baseDir, "versions");
        try {
          const s = await stat(candidate);
          if (s.isDirectory()) versionsDir = candidate;
        } catch {}
      }
    }

    if (!versionsDir) {
      const appData =
        process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Roaming");
      const defaultVersions = path.join(appData, ".minecraft", "versions");
      try {
        const s = await stat(defaultVersions);
        if (s.isDirectory()) versionsDir = defaultVersions;
      } catch {}
    }

    if (!versionsDir) return [];

    const containers: ClientContainerInfo[] = [];
    try {
      const entries = await readdir(versionsDir, {withFileTypes: true});
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const cName = entry.name;
        const lower = cName.toLowerCase();

        const cDir = path.join(versionsDir, cName);
        const tlJsonPath = path.join(cDir, "TLauncherAdditional.json");
        let isCandidate = lower.startsWith("mypack");
        let loader: "fabric" | "forge" | "neoforge" | "quilt" = lower.includes("fabric")
          ? "fabric"
          : "forge";

        let gameVersion = "1.20.1";

        try {
          const raw = await readFile(tlJsonPath, "utf8");
          const tlJson = JSON.parse(raw);
          if (tlJson?.modpack) {
            isCandidate = true;
            if (tlJson.modpack.version?.gameVersionDTO?.name) {
              gameVersion = tlJson.modpack.version.gameVersionDTO.name;
            }
            const loaderTypes = tlJson.modpack.version?.minecraftVersionTypes;
            if (Array.isArray(loaderTypes)) {
              for (const lt of loaderTypes) {
                const name = lt.name?.toLowerCase() ?? "";
                if (name.includes("fabric")) loader = "fabric";
                else if (name.includes("neoforge")) loader = "neoforge";
                else if (name.includes("forge")) loader = "forge";
                else if (name.includes("quilt")) loader = "quilt";
              }
            }
          }
        } catch {}

        if (gameVersion === "1.20.1") {
          try {
            const verRaw = await readFile(path.join(cDir, `${cName}.json`), "utf8");
            const verJson = JSON.parse(verRaw);
            if (verJson?.inheritsFrom) {
              gameVersion = verJson.inheritsFrom;
            }
          } catch {}
        }

        if (isCandidate) {
          await this.syncProfilesFromDownloads(cDir);
          const profiles = await this.listProfiles(cDir);
          const activeInfo = await this.getActiveProfile(cDir);

          containers.push({
            containerName: cName,
            containerDir: cDir,
            loader,
            gameVersion,
            profilesCount: profiles.length,
            activeProfileName: activeInfo?.name ?? activeInfo?.activeProfile ?? null,
          });
        }
      }
    } catch {}

    return containers.sort(
      (a, b) =>
        a.loader.localeCompare(b.loader) ||
        a.gameVersion.localeCompare(b.gameVersion) ||
        a.containerName.localeCompare(b.containerName),
    );
  }

  static async resolveContainerForLoader(
    baseInstanceDir: string,
    loader?: string,
    gameVersion?: string,
  ): Promise<ResolvedContainer> {
    const normLoader = (loader ?? "").toLowerCase();
    const isFabric = normLoader.includes("fabric") || normLoader.includes("quilt");
    const matchedLoader: "fabric" | "forge" = isFabric ? "fabric" : "forge";

    let versionsDir: string | null = null;
    const parentDir = path.dirname(baseInstanceDir);
    if (path.basename(parentDir).toLowerCase() === "versions") {
      versionsDir = parentDir;
    } else {
      const candidateVersions = path.join(baseInstanceDir, "versions");
      try {
        const s = await stat(candidateVersions);
        if (s.isDirectory()) {
          versionsDir = candidateVersions;
        }
      } catch {}
    }

    if (!versionsDir) {
      return {
        containerDir: baseInstanceDir,
        containerName: path.basename(baseInstanceDir),
        matchedLoader,
      };
    }

    let entries: string[] = [];
    try {
      const dirEntries = await readdir(versionsDir, {withFileTypes: true});
      entries = dirEntries.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {}

    let chosenContainerName: string | null = null;

    if (matchedLoader === "fabric") {
      const versionCandidate = gameVersion
        ? entries.find((e) => {
            const lower = e.toLowerCase();
            return lower.includes("mypack") && lower.includes("fabric") && lower.includes(gameVersion.toLowerCase());
          })
        : null;

      const baseCandidate = (!gameVersion || gameVersion === "1.20.1")
        ? entries.find((e) => {
            const lower = e.toLowerCase();
            return lower.includes("mypack") && lower.includes("fabric") && !/\d+\.\d+/.test(lower);
          })
        : null;

      const fabricCandidate = versionCandidate ?? baseCandidate;

      if (fabricCandidate) {
        chosenContainerName = fabricCandidate;
      } else {
        const usesParens = entries.some((e) => e.toLowerCase().includes("mypack("));
        const verSuffix = gameVersion && gameVersion !== "1.20.1" ? `-${gameVersion}` : "";
        chosenContainerName = usesParens ? `mypack(fabric${verSuffix})` : `mypack-fabric${verSuffix}`;
      }
    } else {
      const versionCandidate = gameVersion
        ? entries.find((e) => {
            const lower = e.toLowerCase();
            return (
              lower.includes("mypack") &&
              (lower.includes("forge") || lower === "mypack") &&
              lower.includes(gameVersion.toLowerCase())
            );
          })
        : null;

      const baseCandidate = (!gameVersion || gameVersion === "1.20.1")
        ? entries.find((e) => {
            const lower = e.toLowerCase();
            return (
              lower.includes("mypack") &&
              (lower.includes("forge") || lower === "mypack") &&
              !/\d+\.\d+/.test(lower)
            );
          })
        : null;

      const forgeCandidate = versionCandidate ?? baseCandidate;

      if (forgeCandidate) {
        chosenContainerName = forgeCandidate;
      } else {
        const usesParens = entries.some((e) => e.toLowerCase().includes("mypack("));
        const verSuffix = gameVersion && gameVersion !== "1.20.1" ? `-${gameVersion}` : "";
        chosenContainerName = usesParens ? `mypack(forge${verSuffix})` : `mypack${verSuffix}`;
      }
    }

    const targetContainerDir = path.join(versionsDir, chosenContainerName);
    await mkdir(targetContainerDir, {recursive: true});

    const tlJsonPath = path.join(targetContainerDir, "TLauncherAdditional.json");
    try {
      await stat(tlJsonPath);
    } catch {
      const defaultTlAdditional = {
        modpack: {
          name: chosenContainerName,
          version: {
            gameVersionDTO: {
              name: gameVersion ?? "1.20.1",
            },
            minecraftVersionTypes: [
              {
                name: matchedLoader,
              },
            ],
          },
        },
      };
      await writeFileAtomic(tlJsonPath, JSON.stringify(defaultTlAdditional, null, 2), "utf8");
    }

    const verJsonPath = path.join(targetContainerDir, `${chosenContainerName}.json`);
    try {
      await stat(verJsonPath);
    } catch {
      const defaultVerJson = {
        id: chosenContainerName,
        inheritsFrom: gameVersion ?? "1.20.1",
        type: "custom",
      };
      await writeFileAtomic(verJsonPath, JSON.stringify(defaultVerJson, null, 2), "utf8");
    }

    return {
      containerDir: targetContainerDir,
      containerName: chosenContainerName,
      matchedLoader,
    };
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
    const cName = path.basename(containerDir).toLowerCase();
    const lower = entryName.toLowerCase();

    if (lower === ".loadmoder" || lower === ".fabric" || lower === "logs") return true;
    if (lower === "tlauncheradditional.json") return true;
    if (lower === `${cName}.jar` || lower === `${cName}.json`) return true;
    if (lower.startsWith("mypack") && (lower.endsWith(".jar") || lower.endsWith(".json"))) return true;

    return false;
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

      for (const entry of entries) {
        if (this.isPreservedEngineItem(entry.name, containerDir)) continue;

        const srcPath = path.join(containerDir, entry.name);
        const destPath = path.resolve(filesDir, entry.name);

        if (entry.isDirectory()) {
          const collected = await this.collectFilesToCopy(srcPath, destPath);
          allFilesToCopy.push(...collected);
        } else if (entry.isFile()) {
          allFilesToCopy.push({src: srcPath, dest: destPath});
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
  ): Promise<Array<{containerName: string; containerDir: string; disabledProfile: string | null}>> {
    const containers = await this.discoverClientContainers(baseDir);
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
    if (activeInfo && activeInfo.activeProfile) {
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
