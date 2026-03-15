interface Window {
  electronAPI: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
updateWebviewBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
    updateUIBounds: (bounds: { x: number; y: number; width: number; height: number; isInput?: boolean }[]) => void;
    setFocusable: (focusable: boolean) => void;
    doWebviewAction: (action: 'goBack' | 'goForward' | 'reload' | 'openDevTools') => void;
    loadUrl: (url: string) => void;
    sendToWebview: (channel: string, ...args: any[]) => void;
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
    relayMouseDown: (x: number, y: number, meta?: boolean) => void;
    relayScroll: (x: number, y: number, deltaX: number, deltaY: number) => void;

  };
}
