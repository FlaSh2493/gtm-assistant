import { app, BrowserWindow, ipcMain, shell, WebContentsView, screen } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize electron-store
const store = new Store() as any;

let mainWindow: BrowserWindow | null = null;
let uiWindow: BrowserWindow | null = null;
let guestView: WebContentsView | null = null;
let uiInteractiveBounds: { x: number; y: number; width: number; height: number; isInput?: boolean }[] = [];
let isCmdPressed = false;
let isSpecMode = false;
let lastGuestX = -1;
let lastGuestY = -1;

function createWindow() {
  // 1. 메인 윈도우 (웹사이트 호스트)
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'GTM GA Assistant',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // 2. 게스트 뷰 (웹사이트)
  guestView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../dist-preload/webview-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  mainWindow.contentView.addChildView(guestView);

  // 3. UI 윈도우 (오버레이 - 자식 창)
  uiWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    parent: mainWindow, 
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false, // 기본적으로 포커스를 가져가지 않음 (웹사이트 포커스 유지)
    acceptFirstMouse: true, // 포커스 없는 상태에서도 첫 클릭을 즉시 전달
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../dist-preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  uiWindow.setBackgroundColor('#00000000');

  const syncLayout = () => {
    if (!mainWindow || !uiWindow || !guestView) return;
    const bounds = mainWindow.getContentBounds();
    uiWindow.setBounds(bounds);
  };

  mainWindow.on('resize', syncLayout);
  mainWindow.on('move', syncLayout);
  syncLayout();

  if (process.env.VITE_DEV_SERVER_URL) {
    uiWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    uiWindow.loadFile(join(__dirname, '../dist-renderer/index.html'));
  }

  uiWindow.on('closed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });

  const forwardEvent = (channel: string, ...args: any[]) => {
    uiWindow?.webContents.send('webview-event', { channel, args });
  };

  guestView.webContents.on('did-navigate', (_e, url) => forwardEvent('did-navigate', { url }));
  guestView.webContents.on('did-navigate-in-page', (_e, url) => forwardEvent('did-navigate-in-page', { url }));
  guestView.webContents.on('did-start-loading', () => forwardEvent('did-start-loading'));
  guestView.webContents.on('did-stop-loading', () => forwardEvent('did-stop-loading'));
  guestView.webContents.on('dom-ready', () => forwardEvent('dom-ready'));
  guestView.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => 
    forwardEvent('did-fail-load', { errorCode, errorDescription, validatedURL })
  );
  guestView.webContents.on('page-title-updated', (_e, title) => forwardEvent('page-title-updated', { title }));

  guestView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 메인 창의 키 이벤트를 UI 창으로 릴레이 (Cmd 키 인식 개선)
  const relayCmdKey = (_event: Electron.Event, input: Electron.Input) => {
    if (input.key === 'Meta') {
      uiWindow?.webContents.send('webview-ipc-message', { 
        channel: 'webview-cmd-key', 
        args: [{ pressed: input.type === 'keyDown' }] 
      });
    }
  };

  mainWindow.webContents.on('before-input-event', relayCmdKey);
  guestView.webContents.on('before-input-event', relayCmdKey);
  uiWindow.webContents.on('before-input-event', relayCmdKey);

  ipcMain.on('webview-ipc-relay', (event, channel, ...args) => {
    if (guestView && event.sender === guestView.webContents) {
      uiWindow?.webContents.send('webview-ipc-message', { channel, args });
    }
  });

  // --- 글로벌 마우스 트래커 (Focus-Visible Logic) ---
  let lastIsOverUI = false;

  const updateIgnoreMouseEvents = (isOverUI: boolean) => {
    if (!uiWindow || uiWindow.isDestroyed()) return;
    if (isOverUI) {
      uiWindow.setIgnoreMouseEvents(false);
      uiWindow.setFocusable(true);
    } else {
      // spec 모드에서는 forward: false로 클릭을 inject로만 처리 (double-event 방지)
      uiWindow.setIgnoreMouseEvents(true, { forward: !isSpecMode });
      if (!uiWindow.isFocused()) uiWindow.setFocusable(false);
    }
  };

  const mouseTrackerInterval = setInterval(() => {
    if (!mainWindow || !uiWindow || !guestView || uiWindow.isDestroyed()) return;

    const cursorPoint = screen.getCursorScreenPoint();
    const uiBounds = uiWindow.getBounds();

    const localX = cursorPoint.x - uiBounds.x;
    const localY = cursorPoint.y - uiBounds.y;

    // UI 인터랙티브 영역 체크
    let isOverUI = false;
    for (const b of uiInteractiveBounds) {
      if (localX >= b.x && localX <= b.x + b.width &&
          localY >= b.y && localY <= b.y + b.height) {
        isOverUI = true;
        break;
      }
    }

    if (isOverUI !== lastIsOverUI) {
      lastIsOverUI = isOverUI;
      updateIgnoreMouseEvents(isOverUI);
    }

    // guestView 좌표 계산 후 mousemove 직접 주입 (앱 포커스 상태와 무관하게 동작)
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

  uiWindow.on('blur', () => {
    if (!lastIsOverUI && uiWindow) {
      uiWindow.setFocusable(false);
    }
  });

  mainWindow.on('closed', () => {
    clearInterval(mouseTrackerInterval);
    mainWindow = null;
    uiWindow = null;
    guestView = null;
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

// --- IPC 핸들러 ---

ipcMain.on('update-ui-bounds', (_event, bounds) => {
  uiInteractiveBounds = bounds;
});

ipcMain.on('set-focusable', (event, focusable) => {
  if (uiWindow && event.sender === uiWindow.webContents) {
    uiWindow.setFocusable(focusable);
    if (focusable) uiWindow.focus();
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  if (uiWindow && event.sender === uiWindow.webContents) {
    uiWindow.setIgnoreMouseEvents(ignore, options);
  }
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
});

ipcMain.on('set-spec-mode-main', (_event, active: boolean) => {
  isSpecMode = active;
});

ipcMain.on('relay-scroll', (_event, { x, y, deltaX, deltaY }: { x: number; y: number; deltaX: number; deltaY: number }) => {
  if (!guestView) return;
  // Electron sendInputEvent의 wheel delta는 브라우저 WheelEvent와 부호가 반대
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
