import path from "node:path";
import {readdir, readFile, stat, mkdir, rename, copyFile, unlink, rm} from "node:fs/promises";
import writeFileAtomic from "write-file-atomic";
import {GLOBAL_CONFIG_DIR} from "../../constants.js";
import type {SavedInstanceConfig} from "../../types/instance.js";
import type {ProfileSnapshot, SnapshotModItem, SwitchProfileResult} from "../../types/snapshot.js";
import {DependencyGraph} from "../dependency/graph.js";
import {instanceConfig} from "../instance/config.js";

export class ProfileSnapshotManager {
  getSnapshotBaseDir(instance: SavedInstanceConfig): string {
    if (instance.rootDir) {
      return path.join(instance.rootDir, ".loadmoder", "snapshots");
    }
    const safeName = (instance.name || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(GLOBAL_CONFIG_DIR, "snapshots", safeName);
  }

  buildSnapshotId(loader: string, gameVersion: string): string {
    const cleanLoader = loader
      .trim()
      .toLowerCase()
      .replace(/\.{2,}/g, "_")
      .replace(/[^a-zA-Z0-9.-]/g, "_");
    const cleanVersion = gameVersion
      .trim()
      .toLowerCase()
      .replace(/\.{2,}/g, "_")
      .replace(/[^a-zA-Z0-9.-]/g, "_");
    return `${cleanLoader}-${cleanVersion}`;
  }

  private async safeMoveFile(src: string, dest: string): Promise<void> {
    await mkdir(path.dirname(dest), {recursive: true});
    try {
      await rename(src, dest);
    } catch (err: any) {
      await copyFile(src, dest);
      await unlink(src);
    }
  }

  async saveCurrentSnapshot(
    instanceKey: string,
    instance: SavedInstanceConfig,
  ): Promise<{snapshot: ProfileSnapshot; savedCount: number}> {
    await instanceConfig.load();
    const cfg = instanceConfig.get();
    const freshInstance = cfg.instances[instanceKey] ?? instance;
    const baseDir = this.getSnapshotBaseDir(freshInstance);
    await mkdir(baseDir, {recursive: true});

    const currentLoader = freshInstance.loader || "unknown";
    const currentVersion = freshInstance.gameVersion || "unknown";
    const snapshotId = this.buildSnapshotId(currentLoader, currentVersion);
    const archiveJarDir = path.join(baseDir, snapshotId, "jars");
    await mkdir(archiveJarDir, {recursive: true});

    const instanceDir = freshInstance.rootDir ?? path.dirname(freshInstance.modsDir);
    const graph = new DependencyGraph(instanceDir, currentVersion, currentLoader);
    await graph.load();

    let files: string[] = [];
    try {
      files = await readdir(freshInstance.modsDir);
    } catch {
      await mkdir(freshInstance.modsDir, {recursive: true});
    }

    const modFiles = files.filter((f) => f.endsWith(".jar") || f.endsWith(".jar.disabled"));
    const jsonPath = path.join(baseDir, `${snapshotId}.json`);

    if (modFiles.length === 0) {
      try {
        const existingData: ProfileSnapshot = JSON.parse(await readFile(jsonPath, "utf8"));
        const archivedFiles = await readdir(archiveJarDir);
        if (
          existingData.modsCount > 0 &&
          archivedFiles.some((f) => f.endsWith(".jar") || f.endsWith(".jar.disabled"))
        ) {
          return {snapshot: existingData, savedCount: 0};
        }
      } catch {}
    }

    const items: SnapshotModItem[] = [];

    let createdAt = new Date().toISOString();
    try {
      const existingData = JSON.parse(await readFile(jsonPath, "utf8"));
      if (existingData.createdAt) createdAt = existingData.createdAt;
    } catch {}

    for (const filename of modFiles) {
      const fullSrcPath = path.join(freshInstance.modsDir, filename);
      const fullDestPath = path.join(archiveJarDir, filename);

      let fileSizeBytes = 0;
      try {
        const fileStat = await stat(fullSrcPath);
        fileSizeBytes = fileStat.size;
      } catch {}

      const isDisabled = filename.endsWith(".disabled");
      const cleanFilename = isDisabled ? filename.replace(".disabled", "") : filename;

      const lockEntry = Object.entries(graph.data.mods).find(
        ([slug, entry]) =>
          entry.filename === filename ||
          entry.filename === cleanFilename ||
          slug.toLowerCase() === cleanFilename.replace(".jar", "").toLowerCase(),
      );

      const modItem: SnapshotModItem = {
        filename,
        disabled: isDisabled,
        fileSizeBytes,
      };

      if (lockEntry) {
        const [slug, entry] = lockEntry;
        modItem.slug = slug;
        modItem.projectId = entry.projectId;
        modItem.versionId = entry.versionId;
        modItem.versionNumber = entry.versionNumber;
        modItem.sha512 = entry.sha512;
        modItem.isRoot = entry.isRoot;
        modItem.dependencies = entry.dependencies;
        modItem.installedAt = entry.installedAt;
      }

      items.push(modItem);

      await this.safeMoveFile(fullSrcPath, fullDestPath);
    }

    const snapshot: ProfileSnapshot = {
      snapshotId,
      instanceKey,
      instanceName: freshInstance.name,
      gameVersion: currentVersion,
      loader: currentLoader,
      createdAt,
      updatedAt: new Date().toISOString(),
      modsCount: items.length,
      activeCount: items.filter((m) => !m.disabled).length,
      lockfileData: {...graph.data},
      mods: items,
    };

    await writeFileAtomic(jsonPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

    graph.data.mods = {};
    await graph.save();

    return {snapshot, savedCount: items.length};
  }

  async restoreSnapshot(
    instanceKey: string,
    instance: SavedInstanceConfig,
    targetLoader: string,
    targetVersion: string,
  ): Promise<{restored: boolean; snapshot?: ProfileSnapshot; restoredCount: number}> {
    await instanceConfig.load();
    const cfg = instanceConfig.get();
    const freshInstance = cfg.instances[instanceKey] ?? instance;
    const baseDir = this.getSnapshotBaseDir(freshInstance);
    const snapshotId = this.buildSnapshotId(targetLoader, targetVersion);
    const jsonPath = path.join(baseDir, `${snapshotId}.json`);
    const archiveJarDir = path.join(baseDir, snapshotId, "jars");

    const instanceDir = freshInstance.rootDir ?? path.dirname(freshInstance.modsDir);
    const graph = new DependencyGraph(instanceDir, targetVersion, targetLoader);
    await graph.load();

    await mkdir(freshInstance.modsDir, {recursive: true});

    let snapshotData: ProfileSnapshot | null = null;
    try {
      const content = await readFile(jsonPath, "utf8");
      snapshotData = JSON.parse(content);
    } catch {
      graph.data.gameVersion = targetVersion;
      graph.data.loader = targetLoader;
      graph.data.mods = {};
      await graph.save();
      return {restored: false, restoredCount: 0};
    }

    if (!snapshotData) {
      graph.data.gameVersion = targetVersion;
      graph.data.loader = targetLoader;
      graph.data.mods = {};
      await graph.save();
      return {restored: false, restoredCount: 0};
    }

    let restoredFilesCount = 0;
    try {
      const archivedFiles = await readdir(archiveJarDir);
      for (const file of archivedFiles) {
        if (file.endsWith(".jar") || file.endsWith(".jar.disabled")) {
          const src = path.join(archiveJarDir, file);
          const dest = path.join(freshInstance.modsDir, file);
          await this.safeMoveFile(src, dest);
          restoredFilesCount++;
        }
      }
    } catch {}

    if (snapshotData.lockfileData) {
      graph.data = {
        ...snapshotData.lockfileData,
        gameVersion: targetVersion,
        loader: targetLoader,
        updatedAt: new Date().toISOString(),
      };
    } else {
      graph.data.gameVersion = targetVersion;
      graph.data.loader = targetLoader;
      graph.data.mods = {};
      for (const mod of snapshotData.mods) {
        if (mod.slug && mod.projectId && mod.versionId) {
          graph.registerMod(mod.slug, {
            projectId: mod.projectId,
            versionId: mod.versionId,
            versionNumber: mod.versionNumber || "",
            filename: mod.filename,
            sha512: mod.sha512 || "",
            isRoot: mod.isRoot ?? true,
            dependencies: mod.dependencies || [],
          });
        }
      }
    }

    await graph.save();
    await graph.reconcileWithDisk(freshInstance.modsDir);

    return {
      restored: true,
      snapshot: snapshotData,
      restoredCount: restoredFilesCount,
    };
  }

  async switchProfile(
    instanceKey: string,
    newLoader: string,
    newVersion: string,
  ): Promise<SwitchProfileResult> {
    await instanceConfig.load();
    const cfg = instanceConfig.get();
    const instance = cfg.instances[instanceKey];

    if (!instance) {
      throw new Error(`Instance "${instanceKey}" tidak ditemukan.`);
    }

    const currentLoader = instance.loader || "";
    const currentVersion = instance.gameVersion || "";

    if (
      currentLoader.toLowerCase() === newLoader.toLowerCase() &&
      currentVersion.toLowerCase() === newVersion.toLowerCase()
    ) {
      return {
        savedCount: 0,
        restoredCount: 0,
        isNewProfile: false,
      };
    }

    let savedCount = 0;
    let prevSnapshot: ProfileSnapshot | undefined;

    if (currentLoader && currentVersion) {
      const saveRes = await this.saveCurrentSnapshot(instanceKey, instance);
      savedCount = saveRes.savedCount;
      prevSnapshot = saveRes.snapshot;
    }

    instance.loader = newLoader;
    instance.gameVersion = newVersion;
    instanceConfig.saveInstance(instanceKey, instance, true);
    await instanceConfig.save();

    const restoreRes = await this.restoreSnapshot(instanceKey, instance, newLoader, newVersion);

    return {
      previousSnapshot: prevSnapshot,
      restoredSnapshot: restoreRes.snapshot,
      savedCount,
      restoredCount: restoreRes.restoredCount,
      isNewProfile: !restoreRes.restored,
    };
  }

  async listSnapshots(instance: SavedInstanceConfig): Promise<ProfileSnapshot[]> {
    const baseDir = this.getSnapshotBaseDir(instance);
    const snapshots: ProfileSnapshot[] = [];

    try {
      const files = await readdir(baseDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      for (const file of jsonFiles) {
        try {
          const content = await readFile(path.join(baseDir, file), "utf8");
          const data: ProfileSnapshot = JSON.parse(content);
          snapshots.push(data);
        } catch {}
      }
    } catch {}

    snapshots.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return snapshots;
  }

  async deleteSnapshot(instance: SavedInstanceConfig, snapshotId: string): Promise<boolean> {
    const baseDir = this.getSnapshotBaseDir(instance);
    const rootBaseDir = path.resolve(baseDir);
    const cleanId = snapshotId.replace(/\.{2,}/g, "_").replace(/[^a-zA-Z0-9.-]/g, "_");
    const jsonPath = path.resolve(baseDir, `${cleanId}.json`);
    const archiveJarDir = path.resolve(baseDir, cleanId);

    if (
      !jsonPath.startsWith(rootBaseDir + path.sep) ||
      !archiveJarDir.startsWith(rootBaseDir + path.sep)
    ) {
      return false;
    }

    try {
      await unlink(jsonPath);
      await rm(archiveJarDir, {recursive: true, force: true});
      return true;
    } catch {
      return false;
    }
  }
}

export const profileSnapshotManager = new ProfileSnapshotManager();
