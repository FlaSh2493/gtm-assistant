import React from 'react';
import { useGTMAssistant } from '../../../app/providers';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import SpecList from '../../../features/spec/ui/spec-list';
import VerificationDrawer from '../../../features/verification/ui/verification-drawer';

const AssistantDrawer: React.FC = () => {
  const { config, setMode, currentUrl, currentTitle, isDrawerOpen, setIsDrawerOpen } = useGTMAssistant();

  const pageInfo = { title: currentTitle || 'Loading...', url: currentUrl || '' };

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
        width: 400,
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
      }}
    >
      <AnimatePresence mode="wait">
        {!isDrawerOpen ? (
          <motion.button
            key="fab"
            className="fab-trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsDrawerOpen(true)}
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
                <button className="close-btn" onClick={() => setIsDrawerOpen(false)}>
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
                {/* <button
                  className={config.mode === 'verify' ? 'active' : ''}
                  onClick={() => setMode('verify')}
                >
                  GTM 검수
                </button> */}
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

export default AssistantDrawer;
