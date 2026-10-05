import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import {
  isMinecraftGameDir,
  normalizeUserPath,
  resolveManualMinecraftPath,
  findMinecraftDirs,
  listLocalDrives,
  instanceIdFromPath,
  normalizeForCompare,
  MINECRAFT_DIR_NAMES,
} from '../src/core/instance/driveScanner.js';
import { instanceDetector, deduplicateInstances } from '../src/core/instance/detector.js';

describe('driveScanner - Pure Domain Tests', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lm-drive-scan-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('MINECRAFT_DIR_NAMES & isMinecraftGameDir', () => {
    it('mencakup .minecraft dan minecraft', () => {
      expect(MINECRAFT_DIR_NAMES.has('.minecraft')).toBe(true);
      expect(MINECRAFT_DIR_NAMES.has('minecraft')).toBe(true);
      expect(MINECRAFT_DIR_NAMES.has('other')).toBe(false);
    });

    it('mengidentifikasi folder sebagai game dir jika memiliki marker resmi', async () => {
      const mcPath = path.join(tmpDir, '.minecraft');
      await mkdir(mcPath, { recursive: true });

      // Masih kosong, bukan game dir
      expect(await isMinecraftGameDir(mcPath)).toBe(false);

      // Tambahkan folder 'mods'
      await mkdir(path.join(mcPath, 'mods'), { recursive: true });
      expect(await isMinecraftGameDir(mcPath)).toBe(true);
    });

    it('mengenali options.txt atau versions sebagai marker game dir', async () => {
      const mcPath = path.join(tmpDir, 'minecraft');
      await mkdir(mcPath, { recursive: true });
      await writeFile(path.join(mcPath, 'options.txt'), 'fov:70');
      expect(await isMinecraftGameDir(mcPath)).toBe(true);
    });

    it('menolak folder tanpa marker game meskipun dinamai minecraft', async () => {
      const fakePath = path.join(tmpDir, 'minecraft');
      await mkdir(fakePath, { recursive: true });
      await writeFile(path.join(fakePath, 'random.txt'), 'hello');
      expect(await isMinecraftGameDir(fakePath)).toBe(false);
    });

    it('mengembalikan false untuk path yang tidak ada', async () => {
      expect(await isMinecraftGameDir(path.join(tmpDir, 'nonexistent'))).toBe(false);
    });
  });

  describe('normalizeUserPath', () => {
    const fakeHome = 'C:\\Users\\Gamer';
    const fakeEnv = {
      APPDATA: 'C:\\Users\\Gamer\\AppData\\Roaming',
      GAMES: 'D:\\Games',
    };

    it('menghapus tanda kutip dari hasil "Copy as path"', () => {
      expect(normalizeUserPath('"D:\\Games\\.minecraft"', fakeEnv, fakeHome)).toBe(
        path.resolve('D:\\Games\\.minecraft'),
      );
      expect(normalizeUserPath("'D:\\Games\\.minecraft'", fakeEnv, fakeHome)).toBe(
        path.resolve('D:\\Games\\.minecraft'),
      );
    });

    it('mengekspansi tilde (~) ke home directory', () => {
      const normalized = normalizeUserPath('~/Games/.minecraft', fakeEnv, fakeHome);
      expect(normalized).toBe(path.resolve(fakeHome, 'Games/.minecraft'));
    });

    it('mengekspansi environment variables %APPDATA% dan %GAMES%', () => {
      const normalized = normalizeUserPath('%APPDATA%\\.minecraft', fakeEnv, fakeHome);
      expect(normalized).toBe(path.resolve('C:\\Users\\Gamer\\AppData\\Roaming\\.minecraft'));

      const gamesNorm = normalizeUserPath('%GAMES%\\minecraft', fakeEnv, fakeHome);
      expect(gamesNorm).toBe(path.resolve('D:\\Games\\minecraft'));
    });

    it('menangani input drive root seperti D:', () => {
      const driveRoot = normalizeUserPath('D:', fakeEnv, fakeHome);
      expect(driveRoot.startsWith('D:\\') || driveRoot.startsWith('D:/')).toBe(true);
    });

    it('mengembalikan string kosong jika input kosong', () => {
      expect(normalizeUserPath('   ', fakeEnv, fakeHome)).toBe('');
    });
  });

  describe('resolveManualMinecraftPath', () => {
    it('mengembalikan error jika path kosong', async () => {
      const res = await resolveManualMinecraftPath('');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('empty');
    });

    it('mengembalikan not_found jika path tidak ada', async () => {
      const res = await resolveManualMinecraftPath(path.join(tmpDir, 'does-not-exist'));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('not_found');
    });

    it('mengembalikan not_directory jika path adalah berkas', async () => {
      const file = path.join(tmpDir, 'test.txt');
      await writeFile(file, 'dummy');
      const res = await resolveManualMinecraftPath(file);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('not_directory');
    });

    it('mengembalikan ok langsung jika target adalah folder game valid', async () => {
      const gameDir = path.join(tmpDir, '.minecraft');
      await mkdir(path.join(gameDir, 'mods'), { recursive: true });

      const res = await resolveManualMinecraftPath(gameDir);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.rootDir).toBe(gameDir);
        expect(res.adjusted).toBe(false);
      }
    });

    it('otomatis naik ke folder induk jika user menginputkan path folder mods', async () => {
      const gameDir = path.join(tmpDir, '.minecraft');
      const modsDir = path.join(gameDir, 'mods');
      await mkdir(modsDir, { recursive: true });

      const res = await resolveManualMinecraftPath(modsDir);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.rootDir).toBe(gameDir);
        expect(res.adjusted).toBe(true);
      }
    });

    it('otomatis masuk ke subfolder .minecraft jika user menginputkan folder induk', async () => {
      const parentDir = path.join(tmpDir, 'MyGames');
      const gameDir = path.join(parentDir, '.minecraft');
      await mkdir(path.join(gameDir, 'versions'), { recursive: true });

      const res = await resolveManualMinecraftPath(parentDir);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.rootDir).toBe(gameDir);
        expect(res.adjusted).toBe(true);
      }
    });

    it('mengembalikan not_game_dir jika folder ada tapi bukan folder minecraft', async () => {
      const randomDir = path.join(tmpDir, 'Documents');
      await mkdir(randomDir, { recursive: true });

      const res = await resolveManualMinecraftPath(randomDir);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('not_game_dir');
    });
  });

  describe('findMinecraftDirs (Drive Scan)', () => {
    it('menemukan folder .minecraft dan minecraft di dalam pohon folder', async () => {
      const games = path.join(tmpDir, 'Games');
      const mc1 = path.join(games, 'Launcher1', '.minecraft');
      const mc2 = path.join(games, 'Launcher2', 'minecraft');

      await mkdir(path.join(mc1, 'mods'), { recursive: true });
      await mkdir(mc2, { recursive: true });
      await writeFile(path.join(mc2, 'options.txt'), 'fov:70');

      const result = await findMinecraftDirs([tmpDir], { maxDepth: 4 });
      expect(result.found).toContain(mc1);
      expect(result.found).toContain(mc2);
      expect(result.timedOut).toBe(false);
      expect(result.aborted).toBe(false);
    });

    it('melewati direktori yang ada di daftar skip (mis. node_modules, $Recycle.Bin)', async () => {
      const skipped = path.join(tmpDir, 'node_modules', '.minecraft');
      await mkdir(path.join(skipped, 'mods'), { recursive: true });

      const result = await findMinecraftDirs([tmpDir], { maxDepth: 4 });
      expect(result.found).not.toContain(skipped);
    });

    it('menghormati maxDepth sehingga tidak memindai terlalu dalam', async () => {
      // Kedalaman 4 level di bawah tmpDir
      const deep = path.join(tmpDir, 'lvl1', 'lvl2', 'lvl3', 'lvl4', '.minecraft');
      await mkdir(path.join(deep, 'mods'), { recursive: true });

      const result = await findMinecraftDirs([tmpDir], { maxDepth: 2 });
      expect(result.found).not.toContain(deep);
    });

    it('dapat dibatalkan dengan AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await findMinecraftDirs([tmpDir], { signal: controller.signal });
      expect(result.aborted).toBe(true);
    });
  });

  describe('listLocalDrives', () => {
    it('mengembalikan array drive yang ada di platform aktif', async () => {
      const drives = await listLocalDrives({ includeSystemDrive: true });
      expect(Array.isArray(drives)).toBe(true);
      if (process.platform === 'win32') {
        expect(drives.length).toBeGreaterThan(0);
        expect(drives.some((d) => d.toUpperCase().startsWith('C:'))).toBe(true);
      }
    });
  });

  describe('instanceIdFromPath & normalizeForCompare', () => {
    it('menghasilkan ID deterministik dan unik berbasis path', () => {
      const id1 = instanceIdFromPath('D:\\Games\\.minecraft');
      const id2 = instanceIdFromPath('D:\\Games\\.minecraft');
      const id3 = instanceIdFromPath('E:\\Games\\.minecraft');

      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1.startsWith('local-')).toBe(true);
    });

    it('case-insensitive di Windows untuk normalizeForCompare', () => {
      if (process.platform === 'win32') {
        expect(normalizeForCompare('D:\\GAMES\\.minecraft')).toBe(
          normalizeForCompare('d:\\games\\.minecraft'),
        );
      }
    });
  });

  describe('instanceDetector.scanOtherDrives integration', () => {
    it('memindai custom roots dan menghasilkan MinecraftInstance yang valid', async () => {
      const customDrive = path.join(tmpDir, 'DriveD');
      const mcPath = path.join(customDrive, 'Games', '.minecraft');
      const modsPath = path.join(mcPath, 'mods');
      await mkdir(modsPath, { recursive: true });

      // Tambahkan mod bertipe fabric untuk menguji inspectGameDir
      await writeFile(path.join(modsPath, 'fabric-api-0.102.0+1.21.1.jar'), 'dummy');

      const { instances, result } = await instanceDetector.scanOtherDrives({
        roots: [customDrive],
        maxDepth: 3,
      });

      expect(result.found).toContain(mcPath);
      expect(instances.length).toBe(1);
      expect(instances[0].rootDir).toBe(mcPath);
      expect(instances[0].modsDir).toBe(modsPath);
      expect(instances[0].launcher).toBe('Vanilla');
      expect(instances[0].loader).toBe('fabric');
      expect(instances[0].gameVersion).toBe('1.21.1');
    });

    it('mengecualikan path yang ada di daftar exclude', async () => {
      const customDrive = path.join(tmpDir, 'DriveD');
      const mcPath = path.join(customDrive, '.minecraft');
      await mkdir(path.join(mcPath, 'mods'), { recursive: true });

      const { instances } = await instanceDetector.scanOtherDrives({
        roots: [customDrive],
        exclude: [mcPath],
      });

      expect(instances.length).toBe(0);
    });

    it('mengecualikan child .minecraft jika parent launcher folder ada di daftar exclude', async () => {
      const customDrive = path.join(tmpDir, 'DriveD');
      const launcherInstanceDir = path.join(customDrive, 'Prism', 'instances', 'MyInstance');
      const childMc = path.join(launcherInstanceDir, '.minecraft');
      await mkdir(path.join(childMc, 'mods'), { recursive: true });

      const { instances } = await instanceDetector.scanOtherDrives({
        roots: [customDrive],
        exclude: [launcherInstanceDir],
      });

      expect(instances.length).toBe(0);
    });

    it('mengecualikan folder jika candidate mods folder ada di daftar exclude', async () => {
      const customDrive = path.join(tmpDir, 'DriveD');
      const mcPath = path.join(customDrive, 'Game', '.minecraft');
      const modsPath = path.join(mcPath, 'mods');
      await mkdir(modsPath, { recursive: true });

      const { instances } = await instanceDetector.scanOtherDrives({
        roots: [customDrive],
        exclude: [modsPath],
      });

      expect(instances.length).toBe(0);
    });
  });

  describe('deduplicateInstances', () => {
    it('menghilangkan instance dengan id, rootDir, atau modsDir yang duplikat', () => {
      const list = [
        {
          id: 'prism-alpha',
          name: 'Alpha',
          launcher: 'Prism' as const,
          rootDir: path.join(tmpDir, 'Prism', 'Alpha'),
          modsDir: path.join(tmpDir, 'Prism', 'Alpha', '.minecraft', 'mods'),
        },
        {
          id: 'prism-alpha',
          name: 'Alpha Duplicate ID',
          launcher: 'Prism' as const,
          rootDir: path.join(tmpDir, 'Prism', 'Alpha2'),
          modsDir: path.join(tmpDir, 'Prism', 'Alpha2', 'mods'),
        },
        {
          id: 'vanilla-child',
          name: '.minecraft (C:)',
          launcher: 'Vanilla' as const,
          rootDir: path.join(tmpDir, 'Prism', 'Alpha', '.minecraft'),
          modsDir: path.join(tmpDir, 'Prism', 'Alpha', '.minecraft', 'mods'),
        },
        {
          id: 'unique-instance',
          name: 'Unique',
          launcher: 'MultiMC' as const,
          rootDir: path.join(tmpDir, 'MultiMC', 'Beta'),
          modsDir: path.join(tmpDir, 'MultiMC', 'Beta', '.minecraft', 'mods'),
        },
      ];

      const deduped = deduplicateInstances(list);
      expect(deduped.length).toBe(2);
      expect(deduped.map((i) => i.id)).toEqual(['prism-alpha', 'unique-instance']);
    });
  });
});

