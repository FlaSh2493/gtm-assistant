import React, { useState, useEffect } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Download, Eye, EyeOff, Settings, X } from 'lucide-react';
import SpecList from './SpecList';
import VerificationDrawer from '../verification/VerificationDrawer';

const Drawer: React.FC = () => {
  const { config, setMode, specs, updateConfig, showAllBadges, setShowAllBadges, webviewRef, isWebviewReady } = useGTMAssistant();
  const [isOpen, setIsOpen] = useState(false);
  
  const [pageInfo, setPageInfo] = useState({ title: 'Loading...', url: '' });

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const updateInfo = () => {
      if (!webview || !isWebviewReady) return;
      try {
        setPageInfo({
          title: webview.getTitle(),
          url: webview.getURL()
        });
      } catch (e) {
        console.warn('[Drawer] Failed to get webview info:', e);
      }
    };

    webview.addEventListener('did-stop-loading', updateInfo);
    webview.addEventListener('did-navigate', updateInfo);
    webview.addEventListener('did-navigate-in-page', updateInfo);
    
    // Only call if ready
    if (isWebviewReady) {
      updateInfo();
    }

    return () => {
      webview.removeEventListener('did-stop-loading', updateInfo);
      webview.removeEventListener('did-navigate', updateInfo);
      webview.removeEventListener('did-navigate-in-page', updateInfo);
    };
  }, [webviewRef, isWebviewReady]);

  return (
    <div 
      className="drawer-container"
      onMouseOver={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: 'absolute', // Relative to webview-container
        bottom: 0,
        right: 0,
        width: isOpen ? 400 : 80,
        height: isOpen ? '100%' : 80,
        pointerEvents: 'none',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
      }}
    >
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.button
            key="fab"
            className="fab-trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 20px 20px 0',
              pointerEvents: 'auto',
              fontSize: '24px',
            }}
          >
            🏷
          </motion.button>
        ) : (
          <motion.div 
            key="panel"
            className="drawer-panel"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              width: 400,
              height: '100%',
              background: 'white',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'auto',
              borderLeft: '1px solid #e5e7eb',
            }}
          >
            <div className="drawer-header">
              <div className="drawer-toolbar">
                <div className="toolbar-left">
                  <span className="logo">🏷</span>
                  <span className="title">GTM GA Assistant</span>
                </div>
                <button className="close-btn" onClick={() => setIsOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="mode-tabs">
                <button 
                  className={config.mode === 'spec' ? 'active' : ''} 
                  onClick={() => setMode('spec')}
                >
                  명세 작성
                </button>
                <button 
                  className={config.mode === 'verify' ? 'active' : ''} 
                  onClick={() => setMode('verify')}
                >
                  GTM 검수
                </button>
              </div>
              
              <div className="page-info-panel">
                <div className="info-row">
                  <span className="info-label">Title</span>
                  <span className="info-value" title={pageInfo.title}>{pageInfo.title}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">URL</span>
                  <span className="info-value" title={pageInfo.url}>{pageInfo.url}</span>
                </div>
              </div>

              <div className="drawer-controls">
                {config.mode === 'spec' && (
                  <div className="control-item">
                    <label>선택 호버 활성화</label>
                    <button 
                      className={`toggle-switch ${config.showHover ? 'on' : 'off'}`}
                      onClick={() => updateConfig({ showHover: !config.showHover })}
                    >
                      <div className="toggle-handle"></div>
                    </button>
                  </div>
                )}
                <div className="control-item">
                  <label>명세 외곽선 항상 표시</label>
                  <button 
                    className={`toggle-switch ${showAllBadges ? 'on' : 'off'}`}
                    onClick={() => setShowAllBadges(!showAllBadges)}
                  >
                    <div className="toggle-handle"></div>
                  </button>
                </div>
              </div>
            </div>

            <div className="drawer-content">
              {config.mode === 'spec' ? (
                <SpecList />
              ) : (
                <VerificationDrawer />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Drawer;
