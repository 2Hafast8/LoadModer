import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipcHandlers.js';

import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Determine preload script location
  // When compiled to CJS in type:module, tsup outputs preload.cjs
  const cjsPath = path.resolve(__dirname, 'preload.cjs');
  const preloadPath = existsSync(cjsPath) ? cjsPath : path.resolve(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1140,
    height: 740,
    minWidth: 880,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#090D0B',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.resolve(__dirname, 'renderer', 'index.html');
    mainWindow.loadFile(indexPath).catch(() => {
      // Fallback if renderer is in dist-desktop/renderer
      mainWindow?.loadFile(path.resolve(__dirname, '../dist-desktop/renderer/index.html'));
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
