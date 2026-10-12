import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'node:fs';
import { installLocalFiles } from '../src/core/instance/localInstaller.js';

describe('Local File Installer domain logic', () => {
  const testDir = path.join(os.tmpdir(), `loadmoder-install-test-${Date.now()}`);
  const instanceDir = path.join(testDir, 'instance');
  const modsDir = path.join(instanceDir, 'mods');

  beforeAll(async () => {
    await mkdir(instanceDir, { recursive: true });
    await mkdir(modsDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('installs .jar mod file directly into mods directory', async () => {
    const jarPath = path.join(testDir, 'sodium-fabric-0.5.8.jar');
    await writeFile(jarPath, 'dummy jar content');

    const results = await installLocalFiles([jarPath], instanceDir, modsDir);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].type).toBe('mod');
    expect(results[0].fileName).toBe('sodium-fabric-0.5.8.jar');

    const installedStat = await stat(path.join(modsDir, 'sodium-fabric-0.5.8.jar'));
    expect(installedStat.isFile()).toBe(true);
  });

  it('detects and installs .zip shaderpack into shaderpacks directory', async () => {
    const zipPath = path.join(testDir, 'ComplementaryReimagined.zip');

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 1 } });
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.pipe(output);
      archive.append('/* shader code */', { name: 'shaders/composite.vsh' });
      archive.finalize();
    });

    const results = await installLocalFiles([zipPath], instanceDir, modsDir);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].type).toBe('shader');

    const installedStat = await stat(path.join(instanceDir, 'shaderpacks', 'ComplementaryReimagined.zip'));
    expect(installedStat.isFile()).toBe(true);
  });

  it('detects and installs .zip resourcepack into resourcepacks directory', async () => {
    const zipPath = path.join(testDir, 'Faithful32x.zip');

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 1 } });
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.pipe(output);
      archive.append('{"pack":{"pack_format":15,"description":"Faithful"}}', { name: 'pack.mcmeta' });
      archive.finalize();
    });

    const results = await installLocalFiles([zipPath], instanceDir, modsDir);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].type).toBe('resourcepack');

    const installedStat = await stat(path.join(instanceDir, 'resourcepacks', 'Faithful32x.zip'));
    expect(installedStat.isFile()).toBe(true);
  });

  it('rejects unsupported file formats', async () => {
    const textPath = path.join(testDir, 'readme.txt');
    await writeFile(textPath, 'hello world');

    const results = await installLocalFiles([textPath], instanceDir, modsDir);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].type).toBe('unknown');
    expect(results[0].error).toContain('tidak didukung');
  });

  it('rejects .mrpack on official launcher which does not support modpack containers', async () => {
    const mrpackPath = path.join(testDir, 'test-pack.mrpack');
    await writeFile(mrpackPath, 'dummy mrpack');

    const results = await installLocalFiles([mrpackPath], instanceDir, modsDir, undefined, {
      launcher: 'Official Minecraft',
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].type).toBe('mrpack');
    expect(results[0].error).toContain('tidak mendukung format .mrpack');
  });

  it('installs .mrpack to isolated container without writing into .minecraft root', async () => {
    const { InstanceConfigManager } = await import('../src/core/instance/config.js');
    const testConfig = new InstanceConfigManager(path.join(testDir, 'test-config.json'));
    await testConfig.load();
    testConfig.saveInstance('test-tl', {
      name: 'TLauncher Test',
      rootDir: instanceDir,
      modsDir: modsDir,
      launcher: 'TLauncher',
      mode: 'default',
      gameVersion: '1.20.1',
      loader: 'fabric',
    });

    const mrpackPath = path.join(testDir, 'fabulously-optimized.mrpack');
    await writeFile(mrpackPath, 'dummy mrpack bytes');

    const mockUnpacker: any = {
      inspect: async () => ({
        name: 'Fabulously Optimized',
        versionId: '1.0.0',
        dependencies: {
          minecraft: '1.20.1',
          'fabric-loader': '0.15.0',
        },
        files: [
          {
            path: 'mods/sodium.jar',
            hashes: { sha512: 'dummyhash1' },
          },
        ],
      }),
      install: async (_packPath: string, opts: any) => {
        // Mock unpacking into container
        const targetMods = path.join(opts.instanceDir, 'mods');
        await mkdir(targetMods, { recursive: true });
        await writeFile(path.join(targetMods, 'sodium.jar'), 'dummy-sodium');
        return {
          index: {
            name: 'Fabulously Optimized',
            versionId: '1.0.0',
            files: [{ path: 'mods/sodium.jar', hashes: { sha512: 'dummyhash1' } }],
          },
          installedFiles: ['mods/sodium.jar'],
        };
      },
    };

    const results = await installLocalFiles([mrpackPath], instanceDir, modsDir, mockUnpacker, {
      launcher: 'TLauncher',
      configManager: testConfig,
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].type).toBe('mrpack');

    // Instance config must switch to modpack mode
    const updated = testConfig.getActiveInstance();
    expect(updated?.mode).toBe('modpack');
    expect(updated?.activeContainer).toContain('mypack-fabric');
    expect(updated?.modsDir).toContain(path.join('versions', 'mypack-fabric', 'mods'));

    // Mods must NOT be in the root instanceDir/mods
    const rootModExists = await stat(path.join(modsDir, 'sodium.jar')).catch(() => null);
    expect(rootModExists).toBeNull();

    // Mods must be in the isolated container
    const containerModExists = await stat(path.join(instanceDir, 'versions', 'mypack-fabric', 'mods', 'sodium.jar')).catch(() => null);
    expect(containerModExists).not.toBeNull();
  });
});

