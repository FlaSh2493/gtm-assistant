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
  isDrawerOpen: boolean;
  setIsDrawerOpen: (isOpen: boolean) => void;
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isCmdPressedRef = useRef(false);

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

    // spec 모드에서도 cmd를 누르기 전까지는 selection 비활성화 (view 모드처럼 동작)
    const isSelectionEnabled = config.enabled && config.mode === 'spec' && isCmdPressedRef.current;
    sendToWebview('set-selection-enabled', isSelectionEnabled);
  }, [config.enabled, config.mode, config.showHover, isWebviewReady]);

  // cmd 키 추적: renderer 포커스 + webview 포커스(IPC 경유) 모두 감지
  useEffect(() => {
    const activateCmd = () => {
      if (isCmdPressedRef.current) return;
      isCmdPressedRef.current = true;
      if (configRef.current.enabled && configRef.current.mode === 'spec') {
        try { webviewRef.current?.send('set-selection-enabled', true); } catch (_) {}
      }
    };

    const deactivateCmd = () => {
      if (!isCmdPressedRef.current) return;
      isCmdPressedRef.current = false;
      setHoveredElement(null);
      try { webviewRef.current?.send('set-selection-enabled', false); } catch (_) {}
    };

    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Meta') activateCmd(); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Meta') deactivateCmd(); };
    // webview 클릭으로 포커스 이동 시 cmd 상태 초기화
    const handleBlur = () => deactivateCmd();
    // webview 내부 키 이벤트 (App.tsx에서 CustomEvent로 relay)
    const handleWebviewCmd = (e: any) => {
      if (e.detail?.pressed) activateCmd();
      else deactivateCmd();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('webview-cmd-key', handleWebviewCmd);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('webview-cmd-key', handleWebviewCmd);
    };
  }, []);

  useEffect(() => {
    loadSpecs();

    const handleWebviewHover = (e: any) => {
      const currentConfig = configRef.current;
      if (!currentConfig.enabled || !currentConfig.showHover || currentConfig.mode !== 'spec') {
        setHoveredElement(null);
        return;
      }
      setHoveredElement(e.detail);
    };

    const handleWebviewClick = (e: any) => {
      const currentConfig = configRef.current;
      if (!currentConfig.enabled || currentConfig.mode !== 'spec') return;
      setSelectedElement(e.detail);
    };

    const handleDomReady = () => {
      setIsWebviewReady(true);
      const currentConfig = configRef.current;

      // Resend current state on DOM ready to ensure preload has latest mode
      const isSpecActive = currentConfig.enabled && (currentConfig.mode === 'spec' || currentConfig.mode === 'view');
      // spec 모드에서 cmd를 누르고 있을 때만 selection 활성화
      const isSelectionEnabled = currentConfig.enabled && currentConfig.mode === 'spec' && isCmdPressedRef.current;

      try {
        webviewRef.current?.send('set-spec-mode', isSpecActive);
        webviewRef.current?.send('set-selection-enabled', isSelectionEnabled);
      } catch (e) { /* ignore */ }
      
      // 페이지 로드 시 스펙 다시 불러오기 (URL이 이미 변경되었을 수 있음)
      loadSpecs();
    };

    const handleNavigate = (event: any) => {
      loadSpecs(event.url);
    };

    webviewRef.current?.addEventListener('did-navigate', handleNavigate);
    webviewRef.current?.addEventListener('did-navigate-in-page', handleNavigate);
    window.addEventListener('webview-element-hover', handleWebviewHover);
    window.addEventListener('webview-element-click', handleWebviewClick);
    window.addEventListener('webview-dom-ready', handleDomReady);

    return () => {
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
      currentUrl,
      isDrawerOpen,
      setIsDrawerOpen
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
