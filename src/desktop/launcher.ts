import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

export async function launchDesktop(): Promise<void> {
  const require = createRequire(import.meta.url);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  let electronExe: string | undefined;
  try {
    electronExe = require('electron');
  } catch {
    const candidates = [
      path.resolve(process.cwd(), 'node_modules/electron/dist/electron.exe'),
      path.resolve(__dirname, '../../node_modules/electron/dist/electron.exe'),
      path.resolve(__dirname, '../node_modules/electron/dist/electron.exe'),
    ];
    electronExe = candidates.find((p) => existsSync(p));
  }

  if (!electronExe || !existsSync(electronExe)) {
    console.error('\x1b[31m❌ Binary Electron tidak ditemukan. Jalankan "npm install" terlebih dahulu.\x1b[0m');
    return;
  }

  // Resolve path to dist-desktop/main.js
  const candidate1 = path.resolve(__dirname, '../../dist-desktop/main.js');
  const candidate2 = path.resolve(__dirname, '../dist-desktop/main.js');
  const candidate3 = path.resolve(process.cwd(), 'dist-desktop/main.js');

  const mainScript = [candidate1, candidate2, candidate3].find((p) => existsSync(p));

  if (!mainScript) {
    console.error('\x1b[33m▲ Bundle desktop belum dikompilasi. Jalankan "npm run desktop:build" terlebih dahulu.\x1b[0m');
    return;
  }

  console.log('\x1b[32m✔ Meluncurkan antarmuka desktop LoadModer (Windows GUI)...\x1b[0m');

  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start', '""', electronExe, mainScript], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } else {
    const child = spawn(electronExe, [mainScript], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }
}
