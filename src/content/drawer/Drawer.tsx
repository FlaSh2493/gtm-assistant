import React, { useState } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Download, Eye, EyeOff, Settings, X } from 'lucide-react';
import SpecList from './SpecList';
import VerificationDrawer from '../verification/VerificationDrawer';

const Drawer: React.FC = () => {
  const { config, setMode, specs, updateConfig, showAllBadges, setShowAllBadges } = useGTMAssistant();
  const [isOpen, setIsOpen] = useState(false);

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
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: isOpen ? 400 : 80,
        height: isOpen ? '100vh' : 80,
        pointerEvents: 'none',
        zIndex: 2147483647,
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
              height: '100vh',
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
                  <span className="title">GTM Assistant</span>
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
                  <span className="info-value" title={document.title}>{document.title}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">URL</span>
                  <span className="info-value" title={window.location.href}>{window.location.href}</span>
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

      <style>{`
        .drawer-container {
          font-family: Inter, system-ui, sans-serif;
        }
        .drawer-header {
          background: #f9fafb;
          border-bottom: 1px solid #f3f4f6;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .drawer-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .toolbar-left .logo { font-size: 20px; }
        .toolbar-left .title { font-weight: 700; font-size: 16px; color: #111827; }
        
        .close-btn {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .close-btn:hover { background: #f3f4f6; color: #4b5563; }

        .mode-tabs {
          display: flex;
          background: #f3f4f6;
          padding: 3px;
          border-radius: 10px;
        }
        .mode-tabs button {
          flex: 1;
          padding: 8px;
          border: none;
          background: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s;
        }
        .mode-tabs button.active {
          background: white;
          color: #2563eb;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .page-info-panel {
          font-size: 11px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .info-row {
          display: flex;
          gap: 8px;
        }
        .info-label { font-weight: 600; color: #9ca3af; width: 32px; flex-shrink: 0; }
        .info-value { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .drawer-controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }
        .control-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .control-item label {
          font-size: 12px;
          font-weight: 600;
          color: #4b5563;
        }
        .toggle-switch {
          width: 36px;
          height: 20px;
          background: #d1d5db;
          border-radius: 10px;
          border: none;
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
        }
        .toggle-switch.on { background: #2563eb; }
        .toggle-handle {
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .toggle-switch.on .toggle-handle { left: 18px; }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          background: white;
        }
      `}</style>
    </div>
  );
};

export default Drawer;
