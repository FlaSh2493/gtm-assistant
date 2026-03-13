import React, { useState, useEffect, useRef, useCallback } from 'react';
import GTMAssistant from './GTMAssistant';
import { storage } from '../utils/storage';
import { AppConfig } from '../types';
import { Power, MousePointer2, ClipboardCheck, Settings, Globe, ChevronLeft, ChevronRight, RotateCw, Eye, CheckCircle2, Home, Tag } from 'lucide-react';
import HomeScreen from './HomeScreen';
import { resolveUrl } from './utils/UrlResolver';

const App: React.FC = () => {
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showHome, setShowHome] = useState(true);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  
  const webviewRef = useRef<any>(null);
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
    setShowHome(false);
    
    // Always set initialUrl so the webview src is in sync with our intent
    setInitialUrl(targetUrl);
    setInputUrl(targetUrl);

    if (webviewRef.current) {
      if (webviewRef.current.getURL() !== targetUrl) {
        webviewRef.current.loadURL(targetUrl);
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
    if (!node) return;
    webviewRef.current = node;

    const handleWebviewMessage = (event: any) => {
      console.log('[App] Received ipc-message from webview:', event.channel, event.args);
      if (event.channel === 'webview-hover') {
        window.dispatchEvent(new CustomEvent('webview-element-hover', { detail: event.args[0] }));
      } else if (event.channel === 'webview-click') {
        window.dispatchEvent(new CustomEvent('webview-element-click', { detail: event.args[0] }));
      }
    };

    const handleNavigate = (event: any) => {
      const newUrl = event.url;
      console.log('[App] Webview navigated to:', newUrl);
      
      // Update initialUrl so React doesn't revert the src on re-renders
      setInitialUrl(newUrl);
      
      // Only update the input if the user is not actively typing
      if (!isEditingUrl) {
        setInputUrl(newUrl);
      }
      
      // Save to storage
      if (newUrl && newUrl !== 'about:blank') {
        storage.setLastUrl(newUrl);
      }
    };

    const handleFailLoad = (event: any) => {
      console.error('[App] Webview failed to load:', event.errorCode, event.errorDescription, event.validatedURL);
    };

    const handleDomReady = () => {
      console.log('[App] Webview DOM ready');
      // 페이지 로드마다 preload가 재초기화되므로 현재 모드를 다시 동기화
      window.dispatchEvent(new CustomEvent('webview-dom-ready'));
    };

    const handlePreloadError = (event: any) => {
      console.error('[App] Webview preload error:', event);
    };

    const handleWebviewConsole = (event: any) => {
      console.log(`[Webview Console] ${event.message}`, event.sourceId, event.line);
    };

    node.addEventListener('ipc-message', handleWebviewMessage);
    node.addEventListener('did-navigate', handleNavigate);
    node.addEventListener('did-navigate-in-page', handleNavigate);
    node.addEventListener('did-fail-load', handleFailLoad);
    node.addEventListener('dom-ready', handleDomReady);
    node.addEventListener('preload-error', handlePreloadError);
    node.addEventListener('console-message', handleWebviewConsole);
  }, []);

  // initialUrl이 준비되기 전까지 로딩 표시 (웹뷰 초기 로드 시 리셋 방지)
  if (!initialUrl || !config) return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="brand-icon">
            <Tag size={20} strokeWidth={2.5} />
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
        {showHome ? (
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
              setInitialUrl(targetUrl); // Ensure initialUrl is set BEFORE webview mounts
              setIsEditingUrl(false);
              setShowHome(false);
              
              if (webviewRef.current) {
                if (webviewRef.current.getURL() !== targetUrl) {
                  webviewRef.current.loadURL(targetUrl);
                }
              }
              
              if (mode && config) {
                updateConfigInAppOrAssist({ ...config, mode });
              }
            }} 
          />
        ) : (
          <div className="webview-container">
            <webview
              {...({
                ref: webviewCallbackRef,
                src: initialUrl,
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
        )}
      </main>
    </div>
  );
};

export default App;
