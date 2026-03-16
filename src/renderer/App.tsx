import React, { useState, useEffect, useRef } from 'react';
import { GTMAssistantProvider } from './app/providers';
import AssistantOverlay from './widgets/assistant-overlay/ui/assistant-overlay';
import HomePage from './pages/home/ui/home-page';
import { configStorage } from './entities/config/api/config-storage';
import { AppConfig } from './entities/config/model/types';
import { Power, MousePointer2, Globe, ChevronLeft, ChevronRight, RotateCw, Home} from 'lucide-react';
import { resolveUrl } from './shared/lib/url-resolver';
import { INTERACTIVE_SELECTORS } from './shared/config/interactive-selectors';
import GtmLogo from './shared/ui/gtm-logo';

const App: React.FC = () => {
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showHome, setShowHome] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. 설정 로드
    configStorage.getConfig().then(setConfig);

    setInitialUrl('about:blank');
    setShowHome(true);
  }, []);

  useEffect(() => {
    window.electronAPI.send('set-show-home', showHome);
  }, [showHome]);

  // Webview 컨테이너 크기 모니터링 및 메인 프로세스로 전달
  useEffect(() => {
    if (showHome || !containerRef.current) return;

    const updateBounds = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const bounds = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
      window.electronAPI.updateWebviewBounds(bounds);
    };

    const observer = new ResizeObserver(() => {
      updateBounds();
    });

    observer.observe(containerRef.current);
    updateBounds(); // 초기 위치 설정

    // 창 리사이즈 이벤트도 대응
    window.addEventListener('resize', updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [showHome]);

  // 메인 프로세스로부터 오는 웹뷰 이벤트 처리
  useEffect(() => {
    const handleWebviewEvent = (data: { channel: string, args: any[] }) => {
      const { channel, args } = data;
      
      // Notify other components (like GTMAssistant)
      window.dispatchEvent(new CustomEvent('webview-event-internal', { detail: data }));

      switch (channel) {
        case 'did-navigate':
        case 'did-navigate-in-page': {
          const newUrl = args[0].url;
          if (!isEditingUrl) setInputUrl(newUrl);
          break;
        }
        case 'did-start-loading': setIsLoading(true); break;
        case 'did-stop-loading': setIsLoading(false); break;
        case 'dom-ready':
          window.dispatchEvent(new CustomEvent('webview-dom-ready'));
          break;
        case 'page-title-updated':
          window.dispatchEvent(new CustomEvent('webview-title-updated', { detail: args[0].title }));
          break;
        case 'did-fail-load':
          console.error('[App] Webview failed to load:', args[0]);
          break;
      }
    };

    const handleWebviewIpc = (data: { channel: string, args: any[] }) => {
      const { channel, args } = data;
      if (channel === 'webview-hover') {
        window.dispatchEvent(new CustomEvent('webview-element-hover', { detail: args[0] }));
      } else if (channel === 'webview-click') {
        window.dispatchEvent(new CustomEvent('webview-element-click', { detail: args[0] }));
      } else if (channel === 'webview-cmd-key') {
        window.dispatchEvent(new CustomEvent('webview-cmd-key', { detail: args[0] }));
      } else if (channel === 'webview-scrolling') {
        window.dispatchEvent(new CustomEvent('webview-scrolling', { detail: args[0] }));
      } else if (channel === 'rects-update') {
        window.dispatchEvent(new CustomEvent('rects-update', { detail: args[0] }));
      }
    };

    window.electronAPI.on('webview-event', handleWebviewEvent);
    window.electronAPI.on('webview-ipc-message', handleWebviewIpc);

    // Initial load if initialUrl exists and we are not home
    if (!showHome && initialUrl) {
      window.electronAPI.loadUrl(initialUrl);
    }
  }, [showHome]);

  const navigateTo = (url: string, mode?: 'spec' | 'verify') => {
    const targetUrl = resolveUrl(url);
    if (!targetUrl) return;
    setIsEditingUrl(false);
    setInitialUrl(targetUrl);
    setInputUrl(targetUrl);
    setShowHome(false);
    window.electronAPI.loadUrl(targetUrl);
    if (mode && config) updateConfigInAppOrAssist({ ...config, mode });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(inputUrl);
  };

  const handleGoHome = () => {
    setShowHome(true);
    setInputUrl('');
    // 홈으로 갈 때는 웹뷰를 화면 밖으로 치우거나 크기를 0으로 만듦
    window.electronAPI.updateWebviewBounds({ x: 0, y: 0, width: 0, height: 0 });
  };


  // 상호작용 영역(Bounds) 수집 및 메인 프로세스 전달
  useEffect(() => {
    if (showHome) return;

    const syncUIBounds = () => {
      const boundsList = INTERACTIVE_SELECTORS
        .flatMap(selector => {
          const elements = Array.from(document.querySelectorAll(selector));
          return elements.map(el => {
            const rect = el.getBoundingClientRect();
            // 해당 영역 내에 input이나 textarea가 있는지 확인
            const hasInput = el.querySelector('input, textarea, [contenteditable="true"]') !== null;
            return {
              x: Math.round(rect.left),
              y: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              isInput: hasInput
            };
          });
        })
        .filter(b => b.width > 0 && b.height > 0);

      window.electronAPI.updateUIBounds(boundsList);
    };

    const interval = setInterval(syncUIBounds, 500);
    syncUIBounds();

    return () => clearInterval(interval);
  }, [showHome]);



  const updateConfigInAppOrAssist = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    await configStorage.setConfig(newConfig);
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    const newEnabled = !config.enabled;
    const newConfig = { ...config, enabled: newEnabled };
    await updateConfigInAppOrAssist(newConfig);
  };

  const handleModeChange = async (mode: 'spec' | 'verify') => {
    if (!config) return;
    const newConfig = { ...config, mode };
    await updateConfigInAppOrAssist(newConfig);
  };

  const handleBack = () => window.electronAPI.doWebviewAction('goBack');
  const handleForward = () => window.electronAPI.doWebviewAction('goForward');
  const handleReload = () => window.electronAPI.doWebviewAction('reload');
  const handleOpenDevTools = () => window.electronAPI.openUIDevTools();

  // initialUrl이 준비되기 전까지 로딩 표시
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
            {/* <button
              className={config?.mode === 'verify' ? 'active' : ''}
              onClick={() => handleModeChange('verify')}
              title="명세 검증"
            >
              <CheckCircle2 size={18} />
            </button> */}
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
        {showHome && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <HomePage onNavigate={navigateTo} />
          </div>
        )}
        <div className="webview-container" ref={containerRef} style={{ visibility: showHome ? 'hidden' : 'visible' }}>
            {isLoading && !showHome && (
              <div className="webview-loading-overlay">
                <div className="webview-loading-spinner" />
              </div>
            )}
            {/* 실제 웹뷰는 메인 프로세스에서 이 영역 뒤에 배치됨 */}
            <GTMAssistantProvider config={config} setConfig={setConfig}>
              <AssistantOverlay />
            </GTMAssistantProvider>
          </div>
      </main>
    </div>
  );
};

export default App;
