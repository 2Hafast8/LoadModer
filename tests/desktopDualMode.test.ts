import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { launchDesktop } from '../src/desktop/launcher.js';

describe('Desktop Dual-Mode Architecture', () => {
  it('harus menyediakan fungsi launchDesktop dari modul launcher', () => {
    expect(typeof launchDesktop).toBe('function');
  });

  it('harus menghasilkan bundle distribusi desktop main.js dan preload.cjs di dist-desktop/', () => {
    const mainPath = path.resolve(process.cwd(), 'dist-desktop/main.js');
    const preloadCjsPath = path.resolve(process.cwd(), 'dist-desktop/preload.cjs');
    const preloadJsPath = path.resolve(process.cwd(), 'dist-desktop/preload.js');

    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(preloadCjsPath) || existsSync(preloadJsPath)).toBe(true);

    const mainContent = readFileSync(mainPath, 'utf8');
    expect(mainContent.length).toBeGreaterThan(1000);
  });

  it('harus menghasilkan output bundle renderer HTML, CSS, dan JS di dist-desktop/renderer/', () => {
    const htmlPath = path.resolve(process.cwd(), 'dist-desktop/renderer/index.html');
    expect(existsSync(htmlPath)).toBe(true);

    const htmlContent = readFileSync(htmlPath, 'utf8');
    expect(htmlContent).toContain('LoadModer');
  });

  it('harus memiliki konfigurasi Tailwind palet Obsidian Emerald', () => {
    const tailwindConfigPath = path.resolve(process.cwd(), 'tailwind.config.desktop.js');
    expect(existsSync(tailwindConfigPath)).toBe(true);

    const content = readFileSync(tailwindConfigPath, 'utf8');
    expect(content).toContain('#090D0B'); // Obsidian BG
    expect(content).toContain('#10B981'); // Emerald Primary
  });

  it('harus memuat registrasi IPC handlers tanpa exception', async () => {
    const { registerIpcHandlers } = await import('../src/desktop/main/ipcHandlers.js');
    expect(typeof registerIpcHandlers).toBe('function');
  });
});
