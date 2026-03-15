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
  setMode: (mode: 'spec' | 'verify') => void;
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
  isWebviewReady: boolean;
  externalSpecs: EventSpec[] | null;
  setExternalSpecs: (specs: EventSpec[] | null) => void;
  gtmJson: any | null;
  setGtmJson: (json: any | null) => void;
  currentUrl: string;
  currentTitle: string;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (isOpen: boolean) => void;
  sendToWebview: (channel: string, ...args: any[]) => void;
}

const GTMAssistantContext = createContext<GTMAssistantContextType | undefined>(undefined);

export const useGTMAssistant = () => {
  const context = useContext(GTMAssistantContext);
  if (!context) throw new Error('useGTMAssistant must be used within a GTMAssistantProvider');
  return context;
};

interface Props {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
}

const GTMAssistant: React.FC<Props> = ({ config, setConfig }) => {
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
  const [currentTitle, setCurrentTitle] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isCmdPressedRef = useRef(false);

  // Sync ref with prop for use in listeners
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const loadSpecsForUrl = async (url: string) => {
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
    if (!isWebviewReady) return;
    try {
      window.electronAPI.sendToWebview(channel, ...args);
    } catch (e) {
      console.warn(`[GTMAssistant] Failed to send to webview (${channel}):`, e);
    }
  };

  // config가 바뀔 때마다 webview preload에 spec 모드 활성 여부를 전달
  useEffect(() => {
    const isBlockActive = config.enabled && config.mode === 'spec';
    sendToWebview('set-spec-mode', isBlockActive);
    window.electronAPI.send('set-spec-mode-main', config.enabled && config.mode === 'spec');

    // spec 모드에서도 cmd를 누르기 전까지는 selection 비활성화 (view 모드처럼 동작)
    const isSelectionEnabled = config.enabled && config.mode === 'spec' && isCmdPressedRef.current;
    sendToWebview('set-selection-enabled', isSelectionEnabled);
  }, [config.enabled, config.mode, config.showHover, isWebviewReady]);

  // cmd 키 추적: renderer 포커스 + webview 포커스(IPC 경유) 모두 감지
  useEffect(() => {
    const activateCmd = () => {
      if (isCmdPressedRef.current) return;
      isCmdPressedRef.current = true;
      window.electronAPI.send('set-cmd-pressed', true);
      if (configRef.current.enabled && configRef.current.mode === 'spec') {
        sendToWebview('set-selection-enabled', true);
      }
    };

    const deactivateCmd = () => {
      if (!isCmdPressedRef.current) return;
      isCmdPressedRef.current = false;
      window.electronAPI.send('set-cmd-pressed', false);
      setHoveredElement(null);
      sendToWebview('set-selection-enabled', false);
    };

    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Meta') activateCmd(); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Meta') deactivateCmd(); };
    
    // Webview 내부 키 이벤트 릴레이 (Main Process -> App.tsx -> window event)
    const handleWebviewCmd = (e: any) => {
      if (e.detail?.pressed) activateCmd();
      else deactivateCmd();
    };

    // 마우스 이동 시 Cmd 키 상태 재검 + cmd 중이면 guestView로 좌표 relay
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (e.metaKey && !isCmdPressedRef.current) {
        activateCmd();
      } else if (!e.metaKey && isCmdPressedRef.current) {
        deactivateCmd();
      }

    };

    const handleGlobalMouseDown = (e: MouseEvent) => {
      // UI 요소(팝오버, 드로어 등) 위에 있으면 guestView에 inject하지 않음
      const target = e.target as HTMLElement;
      if (target.closest('.popover-overlay, .drawer-container, .spec-popover, .pageview-badge, .verification-overlay-content, .gtm-spec-label-container')) return;
      const container = document.querySelector('.webview-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        window.electronAPI.relayMouseDown(x, y, e.metaKey);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const container = document.querySelector('.webview-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        window.electronAPI.relayScroll(x, y, e.deltaX, e.deltaY);
      }
    };


    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mousedown', handleGlobalMouseDown);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('webview-cmd-key', handleWebviewCmd);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mousedown', handleGlobalMouseDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('webview-cmd-key', handleWebviewCmd);
    };

  }, [isWebviewReady]);

  useEffect(() => {
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
      const isSpecActive = currentConfig.enabled && currentConfig.mode === 'spec';
      const isSelectionEnabled = currentConfig.enabled && currentConfig.mode === 'spec' && isCmdPressedRef.current;

      sendToWebview('set-spec-mode', isSpecActive);
      sendToWebview('set-selection-enabled', isSelectionEnabled);
      window.electronAPI.send('set-spec-mode-main', currentConfig.enabled && currentConfig.mode === 'spec');
    };

    const handleWebviewTitle = (e: any) => {
      setCurrentTitle(e.detail);
    };

    const handleWebviewEvent = (e: any) => {
      const { channel, args } = e.detail || {};
      if (channel === 'did-navigate' || channel === 'did-navigate-in-page') {
        loadSpecsForUrl(args[0].url);
      }
    };

    // App.tsx에서 forward하는 custom event들 구독
    window.addEventListener('webview-element-hover', handleWebviewHover);
    window.addEventListener('webview-element-click', handleWebviewClick);
    window.addEventListener('webview-dom-ready', handleDomReady);
    window.addEventListener('webview-title-updated', handleWebviewTitle);
    window.addEventListener('webview-event-internal', handleWebviewEvent);

    return () => {
      window.removeEventListener('webview-element-hover', handleWebviewHover);
      window.removeEventListener('webview-element-click', handleWebviewClick);
      window.removeEventListener('webview-dom-ready', handleDomReady);
      window.removeEventListener('webview-title-updated', handleWebviewTitle);
      window.removeEventListener('webview-event-internal', handleWebviewEvent);
    };
  }, [isWebviewReady]);

  const setMode = async (mode: 'spec' | 'verify') => {
    const newConfig = { ...config, mode };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  const refreshSpecs = async () => {
    if (currentUrl) await loadSpecsForUrl(currentUrl);
  };

  const updateConfig = async (updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

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
      isWebviewReady,
      externalSpecs,
      setExternalSpecs,
      gtmJson,
      setGtmJson,
      currentUrl,
      currentTitle,
      isDrawerOpen,
      setIsDrawerOpen,
      sendToWebview
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
