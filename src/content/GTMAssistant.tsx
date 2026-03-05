import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppConfig, EventSpec } from '../types';
import { storage, getStorageKey } from '../utils/storage';
import HoverOutline from './overlay/HoverOutline';
import Drawer from './drawer/Drawer';
import Popover from './overlay/Popover';
import SpecPopover from './overlay/SpecPopover';
import SpecOutline from './overlay/SpecOutline';
import PageviewBadge from './overlay/PageviewBadge';
import VerificationOverlay from './verification/VerificationOverlay';

interface GTMAssistantContextType {
  config: AppConfig;
  specs: EventSpec[];
  setMode: (mode: 'spec' | 'verify') => void;
  refreshSpecs: () => Promise<void>;
  selectedElement: HTMLElement | null;
  setSelectedElement: (el: HTMLElement | null) => void;
  hoveredElement: HTMLElement | null;
  setHoveredElement: (el: HTMLElement | null) => void;
  showAllBadges: boolean;
  setShowAllBadges: (show: boolean) => void;
  editingSpec: EventSpec | null;
  setEditingSpec: (spec: EventSpec | null) => void;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
}

const GTMAssistantContext = createContext<GTMAssistantContextType | undefined>(undefined);

export const useGTMAssistant = () => {
  const context = useContext(GTMAssistantContext);
  if (!context) throw new Error('useGTMAssistant must be used within a GTMAssistantProvider');
  return context;
};

const GTMAssistant: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const configRef = React.useRef<AppConfig | null>(null);
  const [specs, setSpecs] = useState<EventSpec[]>([]);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [showAllBadges, setShowAllBadges] = useState(true);
  const [editingSpec, setEditingSpec] = useState<EventSpec | null>(null);

  console.log('[GTM Assistant] GTMAssistant mounting, config:', config);

  const loadData = async () => {
    const [c, s] = await Promise.all([
      storage.getConfig(),
      storage.getSpecs(window.location.hostname)
    ]);
    setConfig(c);
    configRef.current = c;
    setSpecs(s);
  };

  useEffect(() => {
    loadData();

    const isAssistantUI = (e: Event) => {
      const path = e.composedPath();
      return path.some(el => {
        if (el instanceof HTMLElement && (el.id === 'gtm-assistant-host' || el.id === 'gtm-assistant-inner')) return true;
        if (el instanceof ShadowRoot) return true;
        return false;
      });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const currentConfig = configRef.current;
      // ONLY allow hover selection in 'spec' mode
      if (!currentConfig?.enabled || !currentConfig?.showHover || currentConfig.mode !== 'spec') {
        setHoveredElement(null);
        return;
      }
      
      if (isAssistantUI(e)) {
        setHoveredElement(null);
        return;
      }
      
      const target = e.target as HTMLElement;
      setHoveredElement(target);
    };

    const handleInteraction = (e: MouseEvent | PointerEvent) => {
      const currentConfig = configRef.current;
      if (!currentConfig?.enabled) return;
      
      if (isAssistantUI(e)) return;

      // Only block interactions and show popover if in 'spec' mode AND 'showHover' is enabled
      if (currentConfig.mode === 'spec' && currentConfig.showHover) {
        const target = e.target as HTMLElement;
        
        // Prevent event from reaching other listeners on the same element or the page
        e.stopImmediatePropagation();
        
        // Prevent default browser actions (like navigation or focusing)
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
        }

        // Only set the selected element on actual click (or mouseup) to avoid multiple sets
        if (e.type === 'click') {
          setSelectedElement(target);
        }
      }
    };

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      console.log('[GTM Assistant] Storage changed:', changes);
      if (changes.config) {
        setConfig(changes.config.newValue);
        configRef.current = changes.config.newValue;
      }
      const specKey = getStorageKey(window.location.hostname);
      if (changes[specKey]) {
          setSpecs(changes[specKey].newValue || []);
      }
    };

    window.addEventListener('mouseover', handleMouseOver);
    // Bind all pointer interaction types to the same handler to block them
    window.addEventListener('click', handleInteraction, true);
    window.addEventListener('mousedown', handleInteraction, true);
    window.addEventListener('mouseup', handleInteraction, true);
    window.addEventListener('pointerdown', handleInteraction, true);
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('click', handleInteraction, true);
      window.removeEventListener('mousedown', handleInteraction, true);
      window.removeEventListener('mouseup', handleInteraction, true);
      window.removeEventListener('pointerdown', handleInteraction, true);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const setMode = async (mode: 'spec' | 'verify') => {
    if (!config) return;
    const newConfig = { ...config, mode };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  const refreshSpecs = async () => {
    const s = await storage.getSpecs(window.location.hostname);
    setSpecs(s);
  };

  const updateConfig = async (updates: Partial<AppConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    configRef.current = newConfig;
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
      updateConfig
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
