import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdir, writeFile, rm, stat } from 'node:fs/promises';
import unzipper from 'unzipper';
import { ModpackExporter } from '../src/core/modpack/exporter.js';
import { MrpackIndexSchema } from '../src/types/mrpack.js';

describe('ModpackExporter domain logic', () => {
  const exporter = new ModpackExporter();
  const testDir = path.join(os.tmpdir(), `loadmoder-export-test-${Date.now()}`);
  const instanceDir = path.join(testDir, 'instance');
  const customModsDir = path.join(testDir, 'launcher-subfolder', 'home', 'Forge-1.20', 'mods');

  beforeAll(async () => {
    // 1. Setup standard instanceDir structure
    await mkdir(path.join(instanceDir, 'mods'), { recursive: true });
    await mkdir(path.join(instanceDir, 'config'), { recursive: true });
    await mkdir(path.join(instanceDir, 'resourcepacks'), { recursive: true });
    await mkdir(path.join(instanceDir, 'shaderpacks'), { recursive: true });

    // Mod files
    await writeFile(path.join(instanceDir, 'mods', 'sodium-fabric-0.5.8.jar'), 'sodium binary mock data');
    await writeFile(path.join(instanceDir, 'mods', 'local-custom-mod.jar'), 'local custom mod binary data');
    await writeFile(path.join(instanceDir, 'mods', 'disabledmod.jar.disabled'), 'disabled content');
    
    // Config and extra files
    await writeFile(path.join(instanceDir, 'config', 'sodium-options.json'), '{"graphics": "fast"}');
    await writeFile(path.join(instanceDir, 'resourcepacks', 'faithful32.zip'), 'mock resource pack');
    await writeFile(path.join(instanceDir, 'shaderpacks', 'bsl-v8.zip'), 'mock shader pack');

    // Create lockfile with sodium indexed
    const lockfileContent = {
      version: 1,
      gameVersion: '1.20.1',
      loader: 'fabric',
      environment: 'client',
      updatedAt: new Date().toISOString(),
      mods: {
        'sodium': {
          projectId: 'AANobbMI',
          versionId: '12345678',
          versionNumber: '0.5.8',
          filename: 'sodium-fabric-0.5.8.jar',
          sha512: 'mocksha512hex',
          isRoot: true,
          dependencies: [],
          dependedBy: [],
          installedAt: new Date().toISOString(),
        },
      },
      resourcepacks: {},
      shaderpacks: {},
    };
    await writeFile(path.join(instanceDir, 'loadmoder.lock.json'), JSON.stringify(lockfileContent, null, 2));

    // 2. Setup custom launcher subfolder structure (e.g. Legacy / TLauncher)
    await mkdir(customModsDir, { recursive: true });
    await writeFile(path.join(customModsDir, 'jei-forge-1.20.jar'), 'mock jei jar content');
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
      includeResourcepacks: true,
      includeShaderpacks: true,
    });

    expect(res.outputPath).toBe(zipPath);
    expect(res.filesCount).toBeGreaterThan(2);
    expect(res.sizeBytes).toBeGreaterThan(0);

    const st = await stat(zipPath);
    expect(st.size).toBe(res.sizeBytes);

    // Verify zip contents using unzipper
    const zip = await unzipper.Open.file(zipPath);
    const filePaths = zip.files.map((f) => f.path);
    
    expect(filePaths).toContain('modpack.json');
    expect(filePaths).toContain('mods/sodium-fabric-0.5.8.jar');
    expect(filePaths).toContain('mods/local-custom-mod.jar');
    expect(filePaths).not.toContain('mods/disabledmod.jar.disabled');
    expect(filePaths).toContain('config/sodium-options.json');
    expect(filePaths).toContain('resourcepacks/faithful32.zip');
    expect(filePaths).toContain('shaderpacks/bsl-v8.zip');

    // Inspect modpack.json metadata
    const manifestEntry = zip.files.find((f) => f.path === 'modpack.json');
    const manifestBuffer = await manifestEntry!.buffer();
    const manifest = JSON.parse(manifestBuffer.toString('utf8'));
    expect(manifest.name).toBe('Test Zip Pack');
    expect(manifest.gameVersion).toBe('1.20.1');
    expect(manifest.loader).toBe('fabric');
  });

  it('exports .mrpack archive adhering to Modrinth v2 specifications', async () => {
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

    // Verify mrpack contents and modrinth.index.json
    const zip = await unzipper.Open.file(mrpackPath);
    const filePaths = zip.files.map((f) => f.path);

    expect(filePaths).toContain('modrinth.index.json');
    // Local unindexed mod must be placed under overrides/mods/
    expect(filePaths).toContain('overrides/mods/local-custom-mod.jar');
    // Config files under overrides/config/
    expect(filePaths).toContain('overrides/config/sodium-options.json');

    // Read index and validate schema
    const indexEntry = zip.files.find((f) => f.path === 'modrinth.index.json');
    const indexBuffer = await indexEntry!.buffer();
    const rawIndex = JSON.parse(indexBuffer.toString('utf8'));
    
    // Validate with official MrpackIndexSchema
    const parsedIndex = MrpackIndexSchema.parse(rawIndex);
    expect(parsedIndex.formatVersion).toBe(1);
    expect(parsedIndex.game).toBe('minecraft');
    expect(parsedIndex.name).toBe('Test Mrpack');
    expect(parsedIndex.dependencies['minecraft']).toBe('1.20.1');
    expect(parsedIndex.dependencies['fabric-loader']).toBeDefined();

    // Verify indexed file has valid download URL and hashes
    const indexedSodium = parsedIndex.files.find((f) => f.path === 'mods/sodium-fabric-0.5.8.jar');
    expect(indexedSodium).toBeDefined();
    expect(indexedSodium!.downloads.length).toBeGreaterThan(0);
    expect(indexedSodium!.downloads[0]).toContain('cdn.modrinth.com');
    expect(indexedSodium!.hashes.sha1).toBeDefined();
    expect(indexedSodium!.hashes.sha512).toBeDefined();
  });

  it('supports custom modsDir from specialized launcher container structure', async () => {
    const customZipPath = path.join(testDir, 'custom-launcher.zip');
    const res = await exporter.exportModpack({
      format: 'zip',
      instanceDir: testDir,
      modsDir: customModsDir,
      outputPath: customZipPath,
      name: 'Custom Launcher Pack',
      version: '2.0.0',
      gameVersion: '1.20.1',
      loader: 'forge',
    });

    expect(res.filesCount).toBeGreaterThan(0);
    const zip = await unzipper.Open.file(customZipPath);
    const filePaths = zip.files.map((f) => f.path);
    expect(filePaths).toContain('mods/jei-forge-1.20.jar');
  });

  it('supports exporting from saved profile directory', async () => {
    // Create saved profile dir
    const profileDir = path.join(testDir, 'profiles', 'saved-profile-1');
    await mkdir(path.join(profileDir, 'mods'), { recursive: true });
    await writeFile(path.join(profileDir, 'mods', 'profile-mod.jar'), 'profile mod content');

    const profileMrpackPath = path.join(testDir, 'profile-export.mrpack');
    const res = await exporter.exportModpack({
      format: 'mrpack',
      instanceDir,
      sourceProfileDir: profileDir,
      outputPath: profileMrpackPath,
      name: 'From Profile Pack',
      version: '1.0.0',
      gameVersion: '1.20.1',
      loader: 'fabric',
    });

    expect(res.filesCount).toBeGreaterThan(0);
    const zip = await unzipper.Open.file(profileMrpackPath);
    const filePaths = zip.files.map((f) => f.path);
    expect(filePaths).toContain('overrides/mods/profile-mod.jar');
  });
});
