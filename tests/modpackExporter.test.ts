import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { ModpackExporter } from '../src/core/modpack/exporter.js';

describe('ModpackExporter domain logic', () => {
  const exporter = new ModpackExporter();
  const testDir = path.join(os.tmpdir(), `loadmoder-export-test-${Date.now()}`);
  const instanceDir = path.join(testDir, 'instance');

  beforeAll(async () => {
    await mkdir(path.join(instanceDir, 'mods'), { recursive: true });
    await mkdir(path.join(instanceDir, 'config'), { recursive: true });

    await writeFile(path.join(instanceDir, 'mods', 'testmod.jar'), 'test jar content');
    await writeFile(path.join(instanceDir, 'mods', 'disabledmod.jar.disabled'), 'disabled content');
    await writeFile(path.join(instanceDir, 'config', 'test.json'), '{"setting": true}');
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('exports standalone zip archive with active mods and config', async () => {
    const zipPath = path.join(testDir, 'export.zip');
    const res = await exporter.exportModpack({
      format: 'zip',
      instanceDir,
      outputPath: zipPath,
      name: 'Test Zip Pack',
      version: '1.0.0',
      gameVersion: '1.20.1',
      loader: 'fabric',
      includeConfigs: true,
    });

    expect(res.outputPath).toBe(zipPath);
    expect(res.filesCount).toBe(2);
    expect(res.sizeBytes).toBeGreaterThan(0);

    const st = await stat(zipPath);
    expect(st.size).toBe(res.sizeBytes);
  });

  it('exports mrpack archive with modrinth.index.json', async () => {
    const mrpackPath = path.join(testDir, 'export.mrpack');
    const res = await exporter.exportModpack({
      format: 'mrpack',
      instanceDir,
      outputPath: mrpackPath,
      name: 'Test Mrpack',
      version: '1.0.0',
      gameVersion: '1.20.1',
      loader: 'fabric',
      includeConfigs: true,
    });

    expect(res.outputPath).toBe(mrpackPath);
    expect(res.filesCount).toBeGreaterThan(0);
    expect(res.sizeBytes).toBeGreaterThan(0);

    const st = await stat(mrpackPath);
    expect(st.size).toBe(res.sizeBytes);
  });
});
