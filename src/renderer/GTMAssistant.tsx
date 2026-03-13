import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppConfig, EventSpec } from '../types';
import { storage } from '../utils/storage';
import HoverOutline from './overlay/HoverOutline';
import Drawer from './drawer/drawer';
import Popover from './overlay/popover';
import SpecPopover from './overlay/SpecPopover';
import SpecOutline from './overlay/SpecOutline';
import PageviewBadge from './overlay/PageviewBadge';
import VerificationOverlay from './verification/VerificationOverlay';

interface WebviewElementInfo {
  tagName: string;
  className?: string;
  id?: string;
  rect: DOMRect;
  outerHTML?: string;
  selector?: string;
  recommendations?: string[];
}

interface GTMAssistantContextType {
  config: AppConfig;
  specs: EventSpec[];
  setMode: (mode: 'spec' | 'verify' | 'view') => void;
  refreshSpecs: () => Promise<void>;
  selectedElement: WebviewElementInfo | null;
  setSelectedElement: (el: WebviewElementInfo | null) => void;
  hoveredElement: WebviewElementInfo | null;
  setHoveredElement: (el: WebviewElementInfo | null) => void;
  showAllBadges: boolean;
  setShowAllBadges: (show: boolean) => void;
  editingSpec: EventSpec | null;
  setEditingSpec: (spec: EventSpec | null) => void;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  webviewRef: React.RefObject<any>;
  isWebviewReady: boolean;
  externalSpecs: EventSpec[] | null;
  setExternalSpecs: (specs: EventSpec[] | null) => void;
  gtmJson: any | null;
  setGtmJson: (json: any | null) => void;
  currentUrl: string;
}

const GTMAssistantContext = createContext<GTMAssistantContextType | undefined>(undefined);

export const useGTMAssistant = () => {
  const context = useContext(GTMAssistantContext);
  if (!context) throw new Error('useGTMAssistant must be used within a GTMAssistantProvider');
  return context;
};

interface Props {
  webviewRef: React.RefObject<any>;
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
}

const GTMAssistant: React.FC<Props> = ({ webviewRef, config, setConfig }) => {
  const configRef = useRef<AppConfig>(config);
  const [specs, setSpecs] = useState<EventSpec[]>([]);
  const [hoveredElement, setHoveredElement] = useState<WebviewElementInfo | null>(null);
  const [selectedElement, setSelectedElement] = useState<WebviewElementInfo | null>(null);
  const [showAllBadges, setShowAllBadges] = useState(true);
  const [editingSpec, setEditingSpec] = useState<EventSpec | null>(null);
  const [isWebviewReady, setIsWebviewReady] = useState(false);
  const [externalSpecs, setExternalSpecs] = useState<EventSpec[] | null>(null);
  const [gtmJson, setGtmJson] = useState<any | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  // Sync ref with prop for use in listeners
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const loadSpecs = async (forceUrl?: string) => {
    if (!webviewRef.current) return;
    
    // Fallback URL if we are forcing a load (e.g. during DOM ready or navigate)
    // or if the webview is not quite ready to return a URL yet.
    let url = '';
    try {
      url = forceUrl || webviewRef.current.getURL() || '';
    } catch (e) {
      console.warn('[GTMAssistant] Failed to get URL:', e);
    }
    
    if (!url || url === 'about:blank') return;
    setCurrentUrl(url);

    try {
      const hostname = new URL(url).hostname;
      const s = await storage.getSpecs(hostname);
      setSpecs(s);
    } catch (e) {
      console.warn('[GTMAssistant] loadSpecs failed:', e);
    }
  };

  const sendToWebview = (channel: string, ...args: any[]) => {
    if (!webviewRef.current || !isWebviewReady) return;
    try {
      webviewRef.current.send(channel, ...args);
    } catch (e) {
      console.warn(`[GTMAssistant] Failed to send to webview (${channel}):`, e);
    }
  };

  // config가 바뀔 때마다 webview preload에 spec 모드 활성 여부를 전달
  useEffect(() => {
    // spec 모드나 view 모드일 때 사이트의 기본 이벤트를 차단 (보안/안정성)
    const isBlockActive = config.enabled && (config.mode === 'spec' || config.mode === 'view');
    sendToWebview('set-spec-mode', isBlockActive);

    // 요소 선택(호버/클릭)은 오직 spec 모드에서만 활성화 (view 모드에서는 기존 오버레이만 상호작용)
    const isSelectionEnabled = config.enabled && config.mode === 'spec';
    sendToWebview('set-selection-enabled', isSelectionEnabled);
  }, [config.enabled, config.mode, config.showHover, isWebviewReady]);

  useEffect(() => {
    loadSpecs();

    const handleWebviewHover = (e: any) => {
      console.log('[GTMAssistant] Hover event received:', e.detail);
      const currentConfig = configRef.current;
      if (!currentConfig.enabled || !currentConfig.showHover || currentConfig.mode !== 'spec') {
        console.log('[GTMAssistant] Hover ignored (config or mode)');
        setHoveredElement(null);
        return;
      }
      setHoveredElement(e.detail);
    };

    const handleWebviewClick = (e: any) => {
      console.log('[GTMAssistant] Click event received:', e.detail);
      const currentConfig = configRef.current;
      if (!currentConfig.enabled || currentConfig.mode !== 'spec') {
        console.log('[GTMAssistant] Click ignored (config or mode)');
        return;
      }
      setSelectedElement(e.detail);
    };

    const handleDomReady = (event: any) => {
      console.log('[GTMAssistant] Webview DOM ready received');
      setIsWebviewReady(true);
      const currentConfig = configRef.current;
      const isSpecActive = currentConfig.enabled && currentConfig.mode === 'spec' && currentConfig.showHover;
      
      // 즉시 전송 시도
      try {
        webviewRef.current?.send('set-spec-mode', isSpecActive);
      } catch (e) { /* ignore */ }
      
      // 페이지 로드 시 스펙 다시 불러오기 (URL이 이미 변경되었을 수 있음)
      loadSpecs();
    };

    const handleNavigate = (event: any) => {
      console.log('[GTMAssistant] Navigation detected:', event.url);
      loadSpecs(event.url);
    };

    console.log('[GTMAssistant] Attaching webview event listeners');
    webviewRef.current?.addEventListener('did-navigate', handleNavigate);
    webviewRef.current?.addEventListener('did-navigate-in-page', handleNavigate);
    window.addEventListener('webview-element-hover', handleWebviewHover);
    window.addEventListener('webview-element-click', handleWebviewClick);
    window.addEventListener('webview-dom-ready', handleDomReady);

    return () => {
      console.log('[GTMAssistant] Detaching webview event listeners');
      webviewRef.current?.removeEventListener('did-navigate', handleNavigate);
      webviewRef.current?.removeEventListener('did-navigate-in-page', handleNavigate);
      window.removeEventListener('webview-element-hover', handleWebviewHover);
      window.removeEventListener('webview-element-click', handleWebviewClick);
      window.removeEventListener('webview-dom-ready', handleDomReady);
    };
  }, []);

  const setMode = async (mode: 'spec' | 'verify' | 'view') => {
    const newConfig = { ...config, mode };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  const refreshSpecs = async () => {
    await loadSpecs();
  };

  const updateConfig = async (updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  if (!config) return null;

  return (
    <GTMAssistantContext.Provider value={{
      config,
      specs,
      setMode,
      refreshSpecs,
      selectedElement,
      setSelectedElement,
      hoveredElement,
      setHoveredElement,
      showAllBadges,
      setShowAllBadges,
      editingSpec,
      setEditingSpec,
      updateConfig,
      webviewRef,
      isWebviewReady,
      externalSpecs,
      setExternalSpecs,
      gtmJson,
      setGtmJson,
      currentUrl
    }}>
      <div className="gtm-assistant-inner" id="gtm-assistant-inner">
        {config.enabled && (
          <>
            <HoverOutline />
            <SpecOutline />
            <PageviewBadge />
            <VerificationOverlay />
    
            <Popover 
              target={selectedElement} 
              onClose={() => setSelectedElement(null)}
            >
              <SpecPopover />
            </Popover>
            <Drawer />
          </>
        )}
      </div>
    </GTMAssistantContext.Provider>
  );
};

export default GTMAssistant;
