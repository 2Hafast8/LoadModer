import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { DependencyGraph } from '../src/core/dependency/graph.js';

describe('DependencyGraph', () => {
  let tempDir: string;
  let graph: DependencyGraph;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'loadmoder-test-'));
    graph = new DependencyGraph(tempDir, '1.21.1', 'fabric');
    await graph.load();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('harus dapat meregistrasi mod root dan dependensinya', async () => {
    graph.registerMod('sodium', {
      projectId: 'AANobbMI',
      versionId: 'ver1',
      versionNumber: '0.6.0',
      filename: 'sodium-0.6.0.jar',
      sha512: 'hash1',
      isRoot: true,
      dependencies: ['fabric-api'],
    });

    graph.registerMod('fabric-api', {
      projectId: 'P7dR8mSH',
      versionId: 'ver2',
      versionNumber: '0.102.0',
      filename: 'fabric-api-0.102.0.jar',
      sha512: 'hash2',
      isRoot: false,
      dependencies: [],
    });

    const sodium = graph.getMod('sodium');
    const fabricApi = graph.getMod('fabric-api');

    expect(sodium).toBeDefined();
    expect(sodium?.isRoot).toBe(true);
    expect(fabricApi?.isRoot).toBe(false);
    expect(fabricApi?.dependedBy).toContain('sodium');
  });

  it('harus mendeteksi dependensi yatim (orphan) ketika mod root dihapus', async () => {
    graph.registerMod('sodium', {
      projectId: 'AANobbMI',
      versionId: 'ver1',
      versionNumber: '0.6.0',
      filename: 'sodium-0.6.0.jar',
      sha512: 'hash1',
      isRoot: true,
      dependencies: ['fabric-api'],
    });

    graph.registerMod('fabric-api', {
      projectId: 'P7dR8mSH',
      versionId: 'ver2',
      versionNumber: '0.102.0',
      filename: 'fabric-api-0.102.0.jar',
      sha512: 'hash2',
      isRoot: false,
      dependencies: [],
    });

    const { removedMod, orphanedSlugs } = graph.removeMod('sodium');
    expect(removedMod).toBeDefined();
    expect(orphanedSlugs).toContain('fabric-api');
  });

  it('harus merekonsiliasi data lockfile jika berkas mod dihapus secara manual dari disk', async () => {
    const fs = await import('node:fs/promises');
    const modsDir = path.join(tempDir, 'mods');
    await fs.mkdir(modsDir, { recursive: true });

    // Registrasi 2 mod di graph
    graph.registerMod('sodium', {
      projectId: 'AANobbMI',
      versionId: 'ver1',
      versionNumber: '0.6.0',
      filename: 'sodium-0.6.0.jar',
      sha512: 'hash1',
      isRoot: true,
      dependencies: ['fabric-api'],
    });

    graph.registerMod('fabric-api', {
      projectId: 'P7dR8mSH',
      versionId: 'ver2',
      versionNumber: '0.102.0',
      filename: 'fabric-api-0.102.0.jar',
      sha512: 'hash2',
      isRoot: false,
      dependencies: [],
    });

    await graph.save();

    // Hanya buat berkas fabric-api di disk, sodium sengaja tidak dibuat (mensimulasikan pengguna menghapus sodium)
    await fs.writeFile(path.join(modsDir, 'fabric-api-0.102.0.jar'), 'dummy');

    const result = await graph.reconcileWithDisk(modsDir);

    expect(result.unregistered).toContain('sodium');
    expect(result.orphanedSlugs).toContain('fabric-api');
    expect(graph.getMod('sodium')).toBeUndefined();
  });
});
