import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { registerIpcHandlers } from './ipcHandlers.js';

app.name = 'LoadModer';

app.setPath('userData', path.join(app.getPath('appData'), 'loadmoder-desktop'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow(): void {
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

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (url !== mainWindow?.webContents.getURL()) {
        event.preventDefault();
        if (url.startsWith('https:') || url.startsWith('http:')) {
          shell.openExternal(url);
        }
      }
    });

    mainWindow.webContents.on('will-attach-webview', (e) => {
      e.preventDefault();
    });

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      mainWindow.loadURL(devServerUrl);
    } else {
      const indexPath = path.resolve(__dirname, 'renderer', 'index.html');
      mainWindow.loadFile(indexPath).catch(() => {
        mainWindow?.loadFile(path.resolve(__dirname, '../dist-desktop/renderer/index.html'));
      });
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    registerIpcHandlers(() => mainWindow);
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
}
