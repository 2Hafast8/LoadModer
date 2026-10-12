import {describe, it, expect, beforeEach, afterEach} from "vitest";
import path from "node:path";
import {mkdtemp, rm, mkdir, writeFile, readdir, readFile} from "node:fs/promises";
import os from "node:os";
import {ProfileSnapshotManager} from "../src/core/profile/snapshotManager.js";
import {InstanceConfigManager} from "../src/core/instance/config.js";
import {DependencyGraph} from "../src/core/dependency/graph.js";
import type {SavedInstanceConfig} from "../src/types/instance.js";

describe("ProfileSnapshotManager", () => {
  let tempDir: string;
  let modsDir: string;
  let manager: ProfileSnapshotManager;
  let testInstance: SavedInstanceConfig;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "loadmoder-snapshot-test-"));
    modsDir = path.join(tempDir, "mods");
    await mkdir(modsDir, {recursive: true});

    manager = new ProfileSnapshotManager();
    testInstance = {
      name: "Test Instance",
      launcher: "Vanilla",
      rootDir: tempDir,
      modsDir,
      gameVersion: "26.2",
      loader: "fabric",
    };
  });

  afterEach(async () => {
    await rm(tempDir, {recursive: true, force: true});
  });

  it("harus memindahkan file jar ke arsip snapshot dan mencatat json manifest saat disimpan", async () => {
    await writeFile(path.join(modsDir, "sodium-0.6.0.jar"), "dummy-sodium-content");
    await writeFile(path.join(modsDir, "iris-1.8.0.jar.disabled"), "dummy-iris-content");

    const graph = new DependencyGraph(tempDir, "26.2", "fabric");
    await graph.load();
    graph.registerMod("sodium", {
      projectId: "AANobbMI",
      versionId: "ver1",
      versionNumber: "0.6.0",
      filename: "sodium-0.6.0.jar",
      sha512: "fakehash",
      isRoot: true,
      dependencies: [],
    });
    await graph.save();

    const {snapshot, savedCount} = await manager.saveCurrentSnapshot("test-inst", testInstance);

    expect(savedCount).toBe(2);
    expect(snapshot.snapshotId).toBe("fabric-26.2");
    expect(snapshot.modsCount).toBe(2);

    const remainingMods = await readdir(modsDir);
    expect(remainingMods).toEqual([]);

    const snapshotBase = manager.getSnapshotBaseDir(testInstance);
    const jsonExists = await readFile(path.join(snapshotBase, "fabric-26.2.json"), "utf8");
    expect(JSON.parse(jsonExists).modsCount).toBe(2);

    const archivedFiles = await readdir(path.join(snapshotBase, "fabric-26.2", "jars"));
    expect(archivedFiles).toContain("sodium-0.6.0.jar");
    expect(archivedFiles).toContain("iris-1.8.0.jar.disabled");
  });

  it("harus dapat memulihkan file jar dan lockfile ketika beralih kembali ke versi sebelumnya", async () => {
    await writeFile(path.join(modsDir, "fabric-api-0.100.jar"), "dummy-fapi");
    await manager.saveCurrentSnapshot("test-inst", testInstance);

    expect(await readdir(modsDir)).toEqual([]);

    const restoreNeo = await manager.restoreSnapshot(
      "test-inst",
      testInstance,
      "neoforge",
      "1.21.1",
    );
    expect(restoreNeo.restored).toBe(false);
    expect(restoreNeo.restoredCount).toBe(0);

    await writeFile(path.join(modsDir, "jei-neoforge-1.21.1.jar"), "dummy-jei");

    testInstance.loader = "neoforge";
    testInstance.gameVersion = "1.21.1";
    await manager.saveCurrentSnapshot("test-inst", testInstance);

    expect(await readdir(modsDir)).toEqual([]);

    const restoreFabric = await manager.restoreSnapshot(
      "test-inst",
      testInstance,
      "fabric",
      "26.2",
    );
    expect(restoreFabric.restored).toBe(true);
    expect(restoreFabric.restoredCount).toBe(1);

    const restoredFiles = await readdir(modsDir);
    expect(restoredFiles).toContain("fabric-api-0.100.jar");
    expect(restoredFiles).not.toContain("jei-neoforge-1.21.1.jar");

    testInstance.loader = "fabric";
    testInstance.gameVersion = "26.2";
    await manager.saveCurrentSnapshot("test-inst", testInstance);

    const restoreNeoAgain = await manager.restoreSnapshot(
      "test-inst",
      testInstance,
      "neoforge",
      "1.21.1",
    );
    expect(restoreNeoAgain.restored).toBe(true);
    expect(restoreNeoAgain.restoredCount).toBe(1);

    const neoMods = await readdir(modsDir);
    expect(neoMods).toContain("jei-neoforge-1.21.1.jar");
    expect(neoMods).not.toContain("fabric-api-0.100.jar");
  });

  it("harus dapat melihat daftar snapshot yang tersimpan dan menghapus snapshot", async () => {
    await writeFile(path.join(modsDir, "test-mod.jar"), "content");
    await manager.saveCurrentSnapshot("test-inst", testInstance);

    const snapshots = await manager.listSnapshots(testInstance);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].snapshotId).toBe("fabric-26.2");

    const deleted = await manager.deleteSnapshot(testInstance, "fabric-26.2");
    expect(deleted).toBe(true);

    const remainingSnapshots = await manager.listSnapshots(testInstance);
    expect(remainingSnapshots.length).toBe(0);
  });

  it("dapat membuat cadangan backup point tanpa menghapus mod aktif dan memulihkannya", async () => {
    await writeFile(path.join(modsDir, "active-mod.jar"), "active content");

    const backup = await manager.createBackupPoint("test-inst", testInstance, "Sebelum update besar");
    expect(backup.snapshotId).toContain("backup-");
    expect(backup.note).toBe("Sebelum update besar");
    expect(backup.modsCount).toBe(1);

    const activeModsBefore = await readdir(modsDir);
    expect(activeModsBefore).toContain("active-mod.jar");

    await writeFile(path.join(modsDir, "new-mod.jar"), "new mod content");

    const restoreRes = await manager.restoreBackupPoint("test-inst", testInstance, backup.snapshotId);
    expect(restoreRes.restored).toBe(true);
    expect(restoreRes.restoredCount).toBe(1);

    const activeModsAfter = await readdir(modsDir);
    expect(activeModsAfter).toContain("active-mod.jar");
    expect(activeModsAfter).not.toContain("new-mod.jar");
  });

  it("saveCurrentSnapshot dengan preserveLiveFiles: true mempertahankan file di modsDir", async () => {
    await writeFile(path.join(modsDir, "preserved-mod.jar"), "live content");

    const res = await manager.saveCurrentSnapshot("test-inst", testInstance, {
      preserveLiveFiles: true,
    });

    expect(res.savedCount).toBe(1);
    expect(res.snapshot.modsCount).toBe(1);

    // Live mods directory must still contain the file!
    const liveMods = await readdir(modsDir);
    expect(liveMods).toContain("preserved-mod.jar");

    // Archive folder must also have the file
    const snapshotBase = manager.getSnapshotBaseDir(testInstance);
    const archived = await readdir(path.join(snapshotBase, res.snapshot.snapshotId, "jars"));
    expect(archived).toContain("preserved-mod.jar");
  });

  it("archiveJarDir harus membersihkan berkas yang sudah dihapus dari mods live (pruning)", async () => {
    await writeFile(path.join(modsDir, "mod-keep.jar"), "content keep");
    await writeFile(path.join(modsDir, "mod-delete.jar"), "content delete");

    await manager.saveCurrentSnapshot("test-inst", testInstance, { preserveLiveFiles: true });

    const snapshotBase = manager.getSnapshotBaseDir(testInstance);
    const archiveJarDir = path.join(snapshotBase, "fabric-26.2", "jars");
    let archived = await readdir(archiveJarDir);
    expect(archived).toContain("mod-keep.jar");
    expect(archived).toContain("mod-delete.jar");

    // Hapus mod-delete.jar dari folder live
    await rm(path.join(modsDir, "mod-delete.jar"));

    // Simpan ulang (atau sync)
    const res = await manager.saveCurrentSnapshot("test-inst", testInstance, { preserveLiveFiles: true });
    expect(res.snapshot.modsCount).toBe(1);

    archived = await readdir(archiveJarDir);
    expect(archived).toContain("mod-keep.jar");
    expect(archived).not.toContain("mod-delete.jar");
  });

  it("hasLiveChanges mendeteksi penambahan, penghapusan, dan pengubahan status disabled", async () => {
    await writeFile(path.join(modsDir, "mod-alpha.jar"), "content alpha");
    await manager.saveCurrentSnapshot("test-inst", testInstance, { preserveLiveFiles: true });

    // Ketika live files sama persis dengan snapshot
    let changed = await manager.hasLiveChanges("test-inst", testInstance);
    expect(changed).toBe(false);

    // Ketika mod dinonaktifkan (rename ke .disabled)
    await rm(path.join(modsDir, "mod-alpha.jar"));
    await writeFile(path.join(modsDir, "mod-alpha.jar.disabled"), "content alpha");

    changed = await manager.hasLiveChanges("test-inst", testInstance);
    expect(changed).toBe(true);

    // Setelah disinkronkan, hasLiveChanges kembali false
    await manager.saveCurrentSnapshot("test-inst", testInstance, { preserveLiveFiles: true });
    changed = await manager.hasLiveChanges("test-inst", testInstance);
    expect(changed).toBe(false);

    // Ketika mod baru ditambahkan
    await writeFile(path.join(modsDir, "mod-beta.jar"), "content beta");
    changed = await manager.hasLiveChanges("test-inst", testInstance);
    expect(changed).toBe(true);
  });
});
