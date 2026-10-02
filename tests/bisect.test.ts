import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { BisectRunner } from '../src/core/troubleshoot/bisect.js';

describe('BisectRunner', () => {
  let tmpDir: string;
  let runner: BisectRunner;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lm-bisect-test-'));
    runner = new BisectRunner(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('toggleMod', () => {
    it('harus menonaktifkan mod aktif (.jar -> .jar.disabled)', async () => {
      await writeFile(path.join(tmpDir, 'sodium-mc1.21.jar'), 'dummy');

      const result = await runner.toggleMod('sodium', false);

      expect(result).toBe('sodium-mc1.21.jar.disabled');
      const files = await readdir(tmpDir);
      expect(files).toContain('sodium-mc1.21.jar.disabled');
      expect(files).not.toContain('sodium-mc1.21.jar');
    });

    it('harus mengaktifkan mod yang dinonaktifkan (.jar.disabled -> .jar)', async () => {
      await writeFile(path.join(tmpDir, 'iris-mc1.21.jar.disabled'), 'dummy');

      const result = await runner.toggleMod('iris', true);

      expect(result).toBe('iris-mc1.21.jar');
      const files = await readdir(tmpDir);
      expect(files).toContain('iris-mc1.21.jar');
      expect(files).not.toContain('iris-mc1.21.jar.disabled');
    });

    it('harus melempar error jika mod dengan status yang diminta tidak ditemukan', async () => {
      await writeFile(path.join(tmpDir, 'fabric-api.jar'), 'dummy');

      await expect(runner.toggleMod('fabric', true)).rejects.toThrow(
        /dengan status nonaktif tidak ditemukan/i
      );
    });
  });

  describe('bisect session flow', () => {
    it('harus membagi dua mod aktif saat sesi dimulai', async () => {
      await writeFile(path.join(tmpDir, 'mod-a.jar'), 'a');
      await writeFile(path.join(tmpDir, 'mod-b.jar'), 'b');
      await writeFile(path.join(tmpDir, 'mod-c.jar'), 'c');
      await writeFile(path.join(tmpDir, 'mod-d.jar'), 'd');

      const { totalMods, testingCount } = await runner.start();

      expect(totalMods).toBe(4);
      expect(testingCount).toBe(2);

      const files = await readdir(tmpDir);
      const disabled = files.filter((f) => f.endsWith('.disabled'));
      expect(disabled.length).toBe(2);
    });

    it('harus melempar error jika mod aktif kurang dari 2', async () => {
      await writeFile(path.join(tmpDir, 'mod-single.jar'), '1');

      await expect(runner.start()).rejects.toThrow(/minimal harus ada 2 mod aktif/i);
    });

    it('harus dapat mereset seluruh mod kembali aktif', async () => {
      await writeFile(path.join(tmpDir, 'mod-a.jar.disabled'), 'a');
      await writeFile(path.join(tmpDir, 'mod-b.jar.disabled'), 'b');

      await runner.reset();

      const files = await readdir(tmpDir);
      expect(files).toContain('mod-a.jar');
      expect(files).toContain('mod-b.jar');
      expect(files.filter((f) => f.endsWith('.disabled')).length).toBe(0);
    });
  });
});
