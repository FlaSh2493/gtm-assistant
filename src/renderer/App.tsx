import React, { useState, useEffect, useRef, useCallback } from 'react';
import GTMAssistant from './GTMAssistant';
import { storage } from '../utils/storage';
import { AppConfig } from '../types';
import { Power, MousePointer2, ClipboardCheck, Settings, Globe, ChevronLeft, ChevronRight, RotateCw, Eye, CheckCircle2, Home } from 'lucide-react';
import HomeScreen from './HomeScreen';
import { resolveUrl } from './utils/UrlResolver';
import GtmLogo from './GtmLogo';

const App: React.FC = () => {
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showHome, setShowHome] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  
  const webviewRef = useRef<any>(null);
  const webviewContentsIdRef = useRef<number | null>(null);
  const [preloadPath] = useState(() =>
    window.electronAPI?.getPreloadPath?.('webview-preload.cjs') ?? ''
  );

  useEffect(() => {
    // 1. 설정 로드
    storage.getConfig().then(setConfig);
    
    // 2. 마지막 URL 로드 및 초기 로딩 주소 설정
    storage.getLastUrl().then(lastUrl => {
      if (lastUrl) {
        setInitialUrl(lastUrl);
        setInputUrl(lastUrl);
      } else {
        setInitialUrl('about:blank');
      }
      // Always show home initially
      setShowHome(true);
    });
  }, []);
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = resolveUrl(inputUrl);
    if (!targetUrl) return;

    setIsEditingUrl(false);
    
    // Always set initialUrl so the webview src is in sync with our intent
    setInitialUrl(targetUrl);
    setInputUrl(targetUrl);
    setShowHome(false);

    if (webviewRef.current) {
      try {
        const id = webviewRef.current.getWebContentsId();
        window.electronAPI.send('webview-load-url', { webContentsId: id, url: targetUrl });
      } catch (err) {
        console.warn('[App] Webview not ready:', err);
      }
    }
  };

  const handleGoHome = () => {
    setShowHome(true);
    setInputUrl('');
  };

  const updateConfigInAppOrAssist = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    const newEnabled = !config.enabled;
    const newConfig = { ...config, enabled: newEnabled };
    await updateConfigInAppOrAssist(newConfig);
  };

  const handleModeChange = async (mode: 'spec' | 'verify' | 'view') => {
    if (!config) return;
    const newConfig = { ...config, mode };
    await updateConfigInAppOrAssist(newConfig);
  };

  const handleBack = () => webviewRef.current?.goBack();
  const handleForward = () => webviewRef.current?.goForward();
  const handleReload = () => webviewRef.current?.reload();

  // Use a ref callback so listeners are attached as soon as webview mounts
  const webviewCallbackRef = useCallback((node: any) => {
    if (!node) {
      webviewRef.current = null;
      return;
    }
    webviewRef.current = node;

    const handleWebviewMessage = (event: any) => {
      if (event.channel === 'webview-hover') {
        window.dispatchEvent(new CustomEvent('webview-element-hover', { detail: event.args[0] }));
      } else if (event.channel === 'webview-click') {
        window.dispatchEvent(new CustomEvent('webview-element-click', { detail: event.args[0] }));
      } else if (event.channel === 'webview-cmd-key') {
        window.dispatchEvent(new CustomEvent('webview-cmd-key', { detail: event.args[0] }));
      }
    };

    const handleNavigate = (event: any) => {
      const newUrl = event.url;
      if (!isEditingUrl) {
        setInputUrl(newUrl);
      }
      
      if (newUrl && newUrl !== 'about:blank') {
        storage.setLastUrl(newUrl);
      }
    };

    const handleFailLoad = (event: any) => {
      console.error('[App] Webview failed to load:', event.errorCode, event.errorDescription, event.validatedURL);
    };

    const handleDomReady = () => {
      // webContentsId 캐싱 (getWebContentsId는 동기 블로킹이므로 최초 1회만)
      if (webviewContentsIdRef.current === null) {
        try { webviewContentsIdRef.current = node.getWebContentsId(); } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('webview-dom-ready'));
    };

    const handlePreloadError = (event: any) => {
      console.error('[App] Webview preload error:', event);
    };

    node.addEventListener('ipc-message', handleWebviewMessage);
    node.addEventListener('did-navigate', handleNavigate);
    node.addEventListener('did-navigate-in-page', handleNavigate);
    node.addEventListener('did-fail-load', handleFailLoad);
    node.addEventListener('dom-ready', handleDomReady);
    node.addEventListener('preload-error', handlePreloadError);
    node.addEventListener('did-start-loading', () => setIsLoading(true));
    node.addEventListener('did-stop-loading', () => setIsLoading(false));
  }, []);

  // initialUrl이 준비되기 전까지 로딩 표시 (웹뷰 초기 로드 시 리셋 방지)
  if (!initialUrl || !config) return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="brand-logo">
            <GtmLogo size={32} />
          </div>
          <div className="brand-text">
            <span className="brand-main">GTM</span>
            <span className="brand-sub">GA Assistant</span>
          </div>
        </div>
        
        <div className="nav-controls">
          <button onClick={handleGoHome} title="홈으로"><Home size={18} /></button>
          <button onClick={handleBack} title="뒤로 가기"><ChevronLeft size={20} /></button>
          <button onClick={handleForward} title="앞으로 가기"><ChevronRight size={20} /></button>
          <button onClick={handleReload} title="새로고침"><RotateCw size={18} /></button>
        </div>

        <form className="url-bar" onSubmit={handleUrlSubmit}>
          <Globe size={16} className="url-icon" />
          <input 
            type="text" 
            value={inputUrl} 
            onChange={(e) => {
              setInputUrl(e.target.value);
              setIsEditingUrl(true);
            }}
            onBlur={() => {
              // Optionally revert to actual URL if not submitted, 
              // but let's keep it for now as user might still want to submit
            }}
            placeholder="Enter URL to audit..."
          />
        </form>

        <div className="header-actions">
          <div className="mode-toggle-group">
            <button 
              className={config?.mode === 'spec' ? 'active' : ''} 
              onClick={() => handleModeChange('spec')}
              title="명세 작성"
            >
              <MousePointer2 size={18} />
            </button>
            <button 
              className={config?.mode === 'view' ? 'active' : ''} 
              onClick={() => handleModeChange('view')}
              title="보기 전용"
            >
              <Eye size={18} />
            </button>
            <button 
              className={config?.mode === 'verify' ? 'active' : ''} 
              onClick={() => handleModeChange('verify')}
              title="명세 검증"
            >
              <CheckCircle2 size={18} />
            </button>
          </div>
          
          <button 
            className={`power-btn ${config?.enabled ? 'on' : 'off'}`}
            onClick={handleToggleEnabled}
          >
            <Power size={18} />
          </button>
        </div>
      </header>

      <main className="app-main">
        <div style={{ position: 'absolute', inset: 0, zIndex: showHome ? 1 : -1, visibility: showHome ? 'visible' : 'hidden' }}>
          <HomeScreen 
            url={inputUrl}
            onUrlChange={(val) => {
              setInputUrl(val);
              setIsEditingUrl(true);
            }}
            lastUrl={initialUrl !== 'about:blank' ? initialUrl : null}
            onNavigate={(url, mode) => {
              const targetUrl = resolveUrl(url);
              if (!targetUrl) return;
              
              setInputUrl(targetUrl);
              setInitialUrl(targetUrl); 
              setIsEditingUrl(false);
              setShowHome(false);

              if (webviewRef.current) {
                try {
                  const id = webviewRef.current.getWebContentsId();
                  window.electronAPI.send('webview-load-url', { webContentsId: id, url: targetUrl });
                } catch (err) {
                  console.warn('[App] Webview not ready:', err);
                }
              }
              
              if (mode && config) {
                updateConfigInAppOrAssist({ ...config, mode });
              }
            }} 
          />
        </div>
        <div className="webview-container" style={{ visibility: showHome ? 'hidden' : 'visible' }}>
            {isLoading && !showHome && (
              <div className="webview-loading-overlay">
                <div className="webview-loading-spinner" />
              </div>
            )}
            <webview
              {...({
                ref: (node: any) => {
                  webviewCallbackRef(node);
                  if (node && initialUrl && !node.src) {
                    node.src = initialUrl;
                  }
                },
                preload: preloadPath,
                style: { width: '100%', height: '100%' },
                webpreferences: "contextIsolation=no, nodeIntegration=yes",
                nodeintegrationinsubframes: "true",
                allowpopups: "true"
              } as any)}
            />
            {/* Overlay will be rendered here, positioned matching webview content */}
            <GTMAssistant 
              webviewRef={webviewRef} 
              config={config} 
              setConfig={setConfig} 
            />
          </div>
      </main>
    </div>
  );
};

export default App;
