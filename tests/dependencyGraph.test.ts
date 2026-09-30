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
});
