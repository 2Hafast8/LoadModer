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
});
