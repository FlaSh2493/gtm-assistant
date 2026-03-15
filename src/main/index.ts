import { app, BaseWindow, WebContentsView, ipcMain, shell, screen } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const store = new Store() as any;

let mainWindow: BaseWindow | null = null;
let uiView: WebContentsView | null = null;
let guestView: WebContentsView | null = null;
let isCmdPressed = false;
let isSpecModeActive = false;
let isShowingHome = true;
let lastGuestX = -1;
let lastGuestY = -1;

function createWindow() {
  // 단일 OS 윈도우
  mainWindow = new BaseWindow({
    width: 1280,
    height: 800,
    title: 'GTM GA Assistant',
  });

  // 1. 게스트 뷰 (웹사이트) - 아래 레이어
  guestView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../dist-preload/webview-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  mainWindow.contentView.addChildView(guestView);

  // 2. UI 뷰 (React 앱) - 위 레이어
  uiView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../dist-preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  uiView.setBackgroundColor('#00000000');
  mainWindow.contentView.addChildView(uiView);

  const syncLayout = () => {
    if (!mainWindow || !uiView) return;
    const bounds = mainWindow.getContentBounds();
    uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
  };

  mainWindow.on('resize', syncLayout);
  mainWindow.on('move', syncLayout);
  syncLayout();

  if (process.env.VITE_DEV_SERVER_URL) {
    uiView.webContents.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    uiView.webContents.loadFile(join(__dirname, '../dist-renderer/index.html'));
  }

  uiView.webContents.on('destroyed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });

  const forwardEvent = (channel: string, ...args: any[]) => {
    uiView?.webContents.send('webview-event', { channel, args });
  };

  guestView.webContents.on('did-navigate', (_e, url) => forwardEvent('did-navigate', { url }));
  guestView.webContents.on('did-navigate-in-page', (_e, url) => forwardEvent('did-navigate-in-page', { url }));
  guestView.webContents.on('did-start-loading', () => forwardEvent('did-start-loading'));
  guestView.webContents.on('did-stop-loading', () => forwardEvent('did-stop-loading'));
  guestView.webContents.on('dom-ready', () => {
    // 페이지 로드/이동 시 현재 spec 모드 상태를 즉시 재전송
    guestView?.webContents.mainFrame.send('set-spec-mode', isSpecModeActive);
    forwardEvent('dom-ready');
  });
  guestView.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) =>
    forwardEvent('did-fail-load', { errorCode, errorDescription, validatedURL })
  );
  guestView.webContents.on('page-title-updated', (_e, title) => forwardEvent('page-title-updated', { title }));

  guestView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Cmd 키 이벤트를 UI 뷰로 릴레이
  const relayCmdKey = (_event: Electron.Event, input: Electron.Input) => {
    if (input.key === 'Meta') {
      uiView?.webContents.send('webview-ipc-message', {
        channel: 'webview-cmd-key',
        args: [{ pressed: input.type === 'keyDown' }],
      });
    }
  };
  guestView.webContents.on('before-input-event', relayCmdKey);
  uiView.webContents.on('before-input-event', relayCmdKey);

  ipcMain.on('webview-ipc-relay', (event, channel, ...args) => {
    if (guestView && event.sender === guestView.webContents) {
      uiView?.webContents.send('webview-ipc-message', { channel, args });
    }
  });

  // mousemove를 guestView로 relay (hover 효과 등)
  const mouseTrackerInterval = setInterval(() => {
    if (!mainWindow || !guestView || !uiView) return;

    const cursorPoint = screen.getCursorScreenPoint();
    const winBounds = mainWindow.getContentBounds();

    const localX = cursorPoint.x - winBounds.x;
    const localY = cursorPoint.y - winBounds.y;

    const guestBounds = guestView.getBounds();
    const guestX = Math.round(localX - guestBounds.x);
    const guestY = Math.round(localY - guestBounds.y);

    if (guestX >= 0 && guestY >= 0 && guestX <= guestBounds.width && guestY <= guestBounds.height) {
      if (guestX !== lastGuestX || guestY !== lastGuestY) {
        lastGuestX = guestX;
        lastGuestY = guestY;
        guestView.webContents.sendInputEvent({
          type: 'mouseMove',
          x: guestX,
          y: guestY,
          modifiers: isCmdPressed ? ['meta'] : [] as any,
        });
      }
    }
  }, 16);

  mainWindow.on('closed', () => {
    clearInterval(mouseTrackerInterval);
    mainWindow = null;
    uiView = null;
    guestView = null;
  });

  // guestView 클릭 relay 후 포커스 전달 (모달 등 즉시 동작)
  mainWindow.on('focus', () => {
    if (!isShowingHome && guestView && !guestView.webContents.isDestroyed()) {
      guestView.webContents.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC 핸들러 ---

ipcMain.on('update-ui-bounds', () => {
  // uiView는 단일 윈도우이므로 별도 bounds 관리 불필요, 호환성 유지용
});

ipcMain.on('update-webview-bounds', (_event, bounds) => {
  if (guestView) {
    guestView.setBounds(bounds);
  }
});

ipcMain.on('webview-load-url', (_event, { url }) => {
  if (guestView) {
    guestView.webContents.loadURL(url);
  }
});

ipcMain.on('webview-action', (_event, { action }) => {
  if (!guestView) return;
  switch (action) {
    case 'goBack': guestView.webContents.navigationHistory.goBack(); break;
    case 'goForward': guestView.webContents.navigationHistory.goForward(); break;
    case 'reload': guestView.webContents.reload(); break;
    case 'openDevTools': guestView.webContents.openDevTools({ mode: 'detach' }); break;
  }
});

ipcMain.on('set-cmd-pressed', (_event, pressed: boolean) => {
  isCmdPressed = pressed;
});

ipcMain.on('relay-mouse-down', (_event, { x, y, meta }: { x: number; y: number; meta?: boolean }) => {
  if (!guestView) return;
  const modifiers: any = meta ? ['meta'] : [];
  guestView.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, modifiers });
  guestView.webContents.sendInputEvent({ type: 'mouseUp',   x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, modifiers });
  // 클릭 후 guestView 포커스 (모달 등 즉시 동작)
  guestView.webContents.focus();
});

ipcMain.on('set-show-home', (_event, value: boolean) => {
  isShowingHome = value;
  if (!value && guestView && !guestView.webContents.isDestroyed()) {
    guestView.webContents.focus();
  }
});

ipcMain.on('set-spec-mode-main', (_event, active: boolean) => {
  isSpecModeActive = active;
  try {
    guestView?.webContents.mainFrame.send('set-spec-mode', active);
  } catch (e) {}
});

ipcMain.on('relay-scroll', (_event, { x, y, deltaX, deltaY }: { x: number; y: number; deltaX: number; deltaY: number }) => {
  if (!guestView) return;
  guestView.webContents.sendInputEvent({
    type: 'mouseWheel', x: Math.round(x), y: Math.round(y),
    deltaX: -Math.round(deltaX), deltaY: -Math.round(deltaY),
    wheelTicksX: -Math.round(deltaX / 100), wheelTicksY: -Math.round(deltaY / 100),
  } as any);
});

ipcMain.on('send-to-webview', (_event, { channel, args }) => {
  if (guestView) {
    const sendToAllFrames = (frame: any) => {
      frame.send(channel, ...args);
      if (frame.frames) {
        frame.frames.forEach((child: any) => sendToAllFrames(child));
      }
    };
    sendToAllFrames(guestView.webContents.mainFrame);
  }
});

ipcMain.handle('store:get', (_event, key) => store.get(key));
ipcMain.handle('store:set', (_event, key, value) => store.set(key, value));
ipcMain.handle('store:delete', (_event, key) => store.delete(key as string));

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
