import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { toggleModFile } from '../src/core/instance/modToggle.js';
import {
  LoadModerError,
  InstanceNotFoundError,
  CorruptStateError,
  ModpackError,
  BisectStateError,
} from '../src/types/errors.js';
import { renderMarkdownToTerminal } from '../src/ui/markdown.js';

describe('Architecture & Domain Layer Tests', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lm-arch-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('modToggle (toggleModFile)', () => {
    it('berhasil menonaktifkan mod (.jar -> .jar.disabled)', async () => {
      await writeFile(path.join(tmpDir, 'sodium-fabric-1.21.jar'), 'content');
      const renamed = await toggleModFile(tmpDir, 'sodium', false);
      expect(renamed).toBe('sodium-fabric-1.21.jar.disabled');

      const files = await readdir(tmpDir);
      expect(files).toContain('sodium-fabric-1.21.jar.disabled');
      expect(files).not.toContain('sodium-fabric-1.21.jar');
    });

    it('berhasil mengaktifkan kembali mod (.jar.disabled -> .jar)', async () => {
      await writeFile(path.join(tmpDir, 'sodium-fabric-1.21.jar.disabled'), 'content');
      const renamed = await toggleModFile(tmpDir, 'sodium', true);
      expect(renamed).toBe('sodium-fabric-1.21.jar');

      const files = await readdir(tmpDir);
      expect(files).toContain('sodium-fabric-1.21.jar');
      expect(files).not.toContain('sodium-fabric-1.21.jar.disabled');
    });

    it('melempar error jika berkas target tidak ada', async () => {
      await expect(toggleModFile(tmpDir, 'nonexistent', true)).rejects.toThrow(
        /tidak ditemukan/i,
      );
    });
  });

  describe('Domain Error Hierarchy', () => {
    it('semua domain error merupakan turunan dari LoadModerError dan Error', () => {
      const notFound = new InstanceNotFoundError('my-instance');
      expect(notFound).toBeInstanceOf(LoadModerError);
      expect(notFound).toBeInstanceOf(Error);
      expect(notFound.name).toBe('InstanceNotFoundError');
      expect(notFound.message).toContain('my-instance');

      const corrupt = new CorruptStateError('/path/to/file');
      expect(corrupt).toBeInstanceOf(LoadModerError);
      expect(corrupt.name).toBe('CorruptStateError');

      const modpackErr = new ModpackError('Invalid manifest');
      expect(modpackErr).toBeInstanceOf(LoadModerError);
      expect(modpackErr.name).toBe('ModpackError');

      const bisectErr = new BisectStateError('Session expired');
      expect(bisectErr).toBeInstanceOf(LoadModerError);
      expect(bisectErr.name).toBe('BisectStateError');
    });
  });

  describe('UI Markdown Renderer (renderMarkdownToTerminal)', () => {
    it('merender judul dan inline formatting dengan ANSI', () => {
      const md = '# Main Title\n\n**bold text** and `code text`\n- list item';
      const output = renderMarkdownToTerminal(md);
      expect(output).toContain('MAIN TITLE');
      expect(output).toContain('bold text');
      expect(output).toContain('code text');
    });

    it('mengembalikan teks placeholder jika konten kosong', () => {
      const output = renderMarkdownToTerminal('');
      expect(output).toContain('Tidak ada konten yang tersedia');
    });
  });
});
