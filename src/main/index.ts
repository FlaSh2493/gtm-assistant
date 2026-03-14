import { app, BrowserWindow, ipcMain, shell, webContents } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize electron-store
const store = new Store() as any;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../dist-preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for ESM preload scripts
      webviewTag: true,
    },
  });

  // In development, load from vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist-renderer/index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Webview URL 로딩을 main process에서 처리 (renderer 블록 방지)
ipcMain.on('webview-load-url', (_event, { webContentsId, url }) => {
  const wc = webContents.fromId(webContentsId);
  if (wc && !wc.isDestroyed()) {
    wc.loadURL(url);
  }
});

// IPC Handlers for Storage (Replacement for chrome.storage)
ipcMain.handle('store:get', (_event, key) => {
  return store.get(key);
});

ipcMain.handle('store:set', (_event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('store:delete', (_event, key) => {
  store.delete(key as string);
});

// IPC Handler for CSV Export (Replacement for chrome.downloads)
ipcMain.handle('file:save-csv', async (_event, { content, filename }) => {
  const { dialog } = await import('electron');
  const { writeFile } = await import('fs/promises');
  
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (filePath) {
    await writeFile(filePath, content, 'utf-8');
    return { success: true, filePath };
  }
  return { success: false };
});
