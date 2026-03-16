import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => func(...args));
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  // WebContentsView 마이그레이션을 위한 추가 API
  updateWebviewBounds: (bounds: any) => {
    ipcRenderer.send('update-webview-bounds', bounds);
  },
  updateUIBounds: (bounds: any[]) => {
    ipcRenderer.send('update-ui-bounds', bounds);
  },
  doWebviewAction: (action: string) => {

    ipcRenderer.send('webview-action', { action });
  },

  loadUrl: (url: string) => {
    ipcRenderer.send('webview-load-url', { url });
  },
  sendToWebview: (channel: string, ...args: any[]) => {
    ipcRenderer.send('send-to-webview', { channel, args });
  },
  relayMouseDown: (x: number, y: number, meta?: boolean) => {
    ipcRenderer.send('relay-mouse-down', { x, y, meta });
  },
  relayScroll: (x: number, y: number, deltaX: number, deltaY: number) => {
    ipcRenderer.send('relay-scroll', { x, y, deltaX, deltaY });
  },
  openUIDevTools: () => {
    ipcRenderer.send('open-ui-devtools');
  },
});

