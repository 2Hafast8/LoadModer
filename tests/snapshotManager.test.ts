import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { mkdtemp, rm, mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import { ProfileSnapshotManager } from '../src/core/profile/snapshotManager.js';
import { InstanceConfigManager } from '../src/core/instance/config.js';
import { DependencyGraph } from '../src/core/dependency/graph.js';
import type { SavedInstanceConfig } from '../src/types/instance.js';

describe('ProfileSnapshotManager', () => {
  let tempDir: string;
  let modsDir: string;
  let manager: ProfileSnapshotManager;
  let testInstance: SavedInstanceConfig;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'loadmoder-snapshot-test-'));
    modsDir = path.join(tempDir, 'mods');
    await mkdir(modsDir, { recursive: true });

    manager = new ProfileSnapshotManager();
    testInstance = {
      name: 'Test Instance',
      launcher: 'Vanilla',
      rootDir: tempDir,
      modsDir,
      gameVersion: '26.2',
      loader: 'fabric',
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('harus memindahkan file jar ke arsip snapshot dan mencatat json manifest saat disimpan', async () => {
    // 1. Siapkan file mod palsu di modsDir
    await writeFile(path.join(modsDir, 'sodium-0.6.0.jar'), 'dummy-sodium-content');
    await writeFile(path.join(modsDir, 'iris-1.8.0.jar.disabled'), 'dummy-iris-content');

    // 2. Registrasi di lockfile
    const graph = new DependencyGraph(tempDir, '26.2', 'fabric');
    await graph.load();
    graph.registerMod('sodium', {
      projectId: 'AANobbMI',
      versionId: 'ver1',
      versionNumber: '0.6.0',
      filename: 'sodium-0.6.0.jar',
      sha512: 'fakehash',
      isRoot: true,
      dependencies: [],
    });
    await graph.save();

    // 3. Simpan snapshot
    const { snapshot, savedCount } = await manager.saveCurrentSnapshot('test-inst', testInstance);

    expect(savedCount).toBe(2);
    expect(snapshot.snapshotId).toBe('fabric-26.2');
    expect(snapshot.modsCount).toBe(2);

    // Folder mods harus kosong dari file jar sekarang
    const remainingMods = await readdir(modsDir);
    expect(remainingMods).toEqual([]);

    // File snapshot JSON harus tercipta
    const snapshotBase = manager.getSnapshotBaseDir(testInstance);
    const jsonExists = await readFile(path.join(snapshotBase, 'fabric-26.2.json'), 'utf8');
    expect(JSON.parse(jsonExists).modsCount).toBe(2);

    // File di folder arsip snapshot harus ada
    const archivedFiles = await readdir(path.join(snapshotBase, 'fabric-26.2', 'jars'));
    expect(archivedFiles).toContain('sodium-0.6.0.jar');
    expect(archivedFiles).toContain('iris-1.8.0.jar.disabled');
  });

  it('harus dapat memulihkan file jar dan lockfile ketika beralih kembali ke versi sebelumnya', async () => {
    // 1. Simpan mod awal versi 26.2 fabric
    await writeFile(path.join(modsDir, 'fabric-api-0.100.jar'), 'dummy-fapi');
    await manager.saveCurrentSnapshot('test-inst', testInstance);

    // Folder mods sekarang kosong
    expect(await readdir(modsDir)).toEqual([]);

    // 2. Sekarang simulasikan versi baru (1.21.1 neoforge)
    const restoreNeo = await manager.restoreSnapshot('test-inst', testInstance, 'neoforge', '1.21.1');
    expect(restoreNeo.restored).toBe(false); // Belum pernah ada snapshot untuk neoforge 1.21.1
    expect(restoreNeo.restoredCount).toBe(0);

    // Pasang mod baru untuk 1.21.1 di folder mods
    await writeFile(path.join(modsDir, 'jei-neoforge-1.21.1.jar'), 'dummy-jei');

    // 3. Simpan snapshot neoforge 1.21.1
    testInstance.loader = 'neoforge';
    testInstance.gameVersion = '1.21.1';
    await manager.saveCurrentSnapshot('test-inst', testInstance);

    expect(await readdir(modsDir)).toEqual([]);

    // 4. Beralih kembali ke fabric 26.2!
    const restoreFabric = await manager.restoreSnapshot('test-inst', testInstance, 'fabric', '26.2');
    expect(restoreFabric.restored).toBe(true);
    expect(restoreFabric.restoredCount).toBe(1);

    // Folder mods harus kembali berisi fabric-api
    const restoredFiles = await readdir(modsDir);
    expect(restoredFiles).toContain('fabric-api-0.100.jar');
    expect(restoredFiles).not.toContain('jei-neoforge-1.21.1.jar');

    // 5. Simpan fabric 26.2 dan beralih kembali ke neoforge 1.21.1 untuk memverifikasi mod tersimpan di json
    testInstance.loader = 'fabric';
    testInstance.gameVersion = '26.2';
    await manager.saveCurrentSnapshot('test-inst', testInstance);

    const restoreNeoAgain = await manager.restoreSnapshot('test-inst', testInstance, 'neoforge', '1.21.1');
    expect(restoreNeoAgain.restored).toBe(true);
    expect(restoreNeoAgain.restoredCount).toBe(1);

    const neoMods = await readdir(modsDir);
    expect(neoMods).toContain('jei-neoforge-1.21.1.jar');
    expect(neoMods).not.toContain('fabric-api-0.100.jar');
  });

  it('harus dapat melihat daftar snapshot yang tersimpan dan menghapus snapshot', async () => {
    await writeFile(path.join(modsDir, 'test-mod.jar'), 'content');
    await manager.saveCurrentSnapshot('test-inst', testInstance);

    const snapshots = await manager.listSnapshots(testInstance);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].snapshotId).toBe('fabric-26.2');

    const deleted = await manager.deleteSnapshot(testInstance, 'fabric-26.2');
    expect(deleted).toBe(true);

    const remainingSnapshots = await manager.listSnapshots(testInstance);
    expect(remainingSnapshots.length).toBe(0);
  });
});
