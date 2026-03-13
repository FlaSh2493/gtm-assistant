import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { parseGTMGA4Tags, parseGTMTriggers } from './GTMParser';
import { EXAMPLE_CSV_PLAN, EXAMPLE_GTM_JSON } from './ExampleData';
import { verifySpecs, VerificationResult } from './VerificationService';
import { useGTMAssistant } from '../GTMAssistant';
import './verification.css';

const VerificationOverlay: React.FC = () => {
  const { config, hoveredElement, webviewRef, isWebviewReady } = useGTMAssistant();
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [hoveredSelector, setHoveredSelector] = useState<string | null>(null);
  const [elementRects, setElementRects] = useState<Record<string, any>>({});

  useEffect(() => {
    if (config.mode !== 'verify') return;

    const tags = parseGTMGA4Tags(EXAMPLE_GTM_JSON);
    const triggerMap = parseGTMTriggers(EXAMPLE_GTM_JSON);
    const verificationResults = verifySpecs(EXAMPLE_CSV_PLAN, tags, triggerMap);
    setResults(verificationResults);
  }, [config.mode]);

  useEffect(() => {
    if (config.mode !== 'verify' || !webviewRef.current || !isWebviewReady) return;

    const requestRects = () => {
      const selectors = results
        .map(r => r.selector)
        .filter(s => s && s !== 'document');
      
      if (selectors.length > 0 && webviewRef.current && isWebviewReady) {
        try {
          webviewRef.current.send('get-rects', selectors);
        } catch (e) {
          console.warn('[VerificationOverlay] Failed to send get-rects:', e);
        }
      }
    };

    const handleRectsUpdate = (event: any) => {
      if (event.channel !== 'rects-update') return;
      setElementRects(event.args[0]);
    };

    const webview = webviewRef.current;
    if (webview) {
      webview.addEventListener('ipc-message', handleRectsUpdate);
      const interval = setInterval(requestRects, 1000);
      requestRects();

      return () => {
        webview.removeEventListener('ipc-message', handleRectsUpdate);
        clearInterval(interval);
      };
    }
  }, [config.mode, results, webviewRef, isWebviewReady]);

  if (config.mode !== 'verify') return null;

  const groupedResults = results.reduce((acc, res) => {
    if (!res.selector || res.selector === 'document' || !elementRects[res.selector]) return acc;
    if (!acc[res.selector]) acc[res.selector] = [];
    acc[res.selector].push(res);
    return acc;
  }, {} as Record<string, VerificationResult[]>);

  const getStatusPriority = (status: VerificationResult['status']) => {
    switch (status) {
      case 'fail': return 4;
      case 'missing': return 3;
      case 'extra': return 2;
      case 'pass': return 1;
      default: return 0;
    }
  };

  const getStatusIcon = (status: VerificationResult['status'], size = 12) => {
    switch (status) {
      case 'pass': return <CheckCircle size={size} color="white" />;
      case 'fail': return <AlertCircle size={size} color="white" />;
      case 'missing': return <HelpCircle size={size} color="white" />;
      case 'extra': return <AlertCircle size={size} color="white" />;
      default: return null;
    }
  };

  const getStatusStyle = (status: VerificationResult['status']) => {
    switch (status) {
      case 'pass': return { color: '#10b981', gradient: 'linear-gradient(135deg, #34d399, #059669)', bg: 'rgba(16, 185, 129, 0.05)', hoverBg: 'rgba(16, 185, 129, 0.25)' };
      case 'fail': return { color: '#ef4444', gradient: 'linear-gradient(135deg, #f87171, #dc2626)', bg: 'rgba(239, 68, 68, 0.05)', hoverBg: 'rgba(239, 68, 68, 0.25)' };
      case 'missing': return { color: '#f59e0b', gradient: 'linear-gradient(135deg, #fbbf24, #d97706)', bg: 'rgba(245, 158, 11, 0.05)', hoverBg: 'rgba(245, 158, 11, 0.25)' };
      case 'extra': return { color: '#3b82f6', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)', bg: 'rgba(59, 130, 246, 0.05)', hoverBg: 'rgba(59, 130, 246, 0.25)' };
      default: return { color: '#9ca3af', gradient: 'linear-gradient(135deg, #9ca3af, #6b7280)', bg: 'transparent', hoverBg: 'rgba(156, 163, 175, 0.25)' };
    }
  };

  return (
    <>
      {Object.entries(groupedResults).map(([selector, groupResults]) => {
        const rect = elementRects[selector];
        if (!rect) return null;
        
        const isHovered = hoveredSelector === selector;
        const worstResult = groupResults.reduce((prev, curr) => 
          getStatusPriority(curr.status) > getStatusPriority(prev.status) ? curr : prev, 
          groupResults[0]
        );
        
        const worstResultStyle = getStatusStyle(worstResult.status);
        const borderColor = worstResultStyle.color;
        const hasMultiple = groupResults.length > 1;

        const estimatedHeight = isHovered ? (groupResults.length * 30 + 10) : 40;
        const isTopSpaceTight = rect.top < estimatedHeight;

        return (
          <motion.div 
            key={selector}
            className={`v-overlay-rect ${worstResult.status}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              backgroundColor: isHovered ? worstResultStyle.hoverBg : worstResultStyle.bg,
            }}
            transition={{ duration: 0.1 }}
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('gtm-assistant-focus-result', { 
                detail: { eventName: worstResult.eventName, status: worstResult.status } 
              }));
            }}
            onMouseEnter={() => setHoveredSelector(selector)}
            onMouseLeave={() => setHoveredSelector(null)}
            style={{
              position: 'absolute',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              border: `2px solid ${isHovered ? borderColor : borderColor + '99'}`,
              borderRadius: '8px',
              pointerEvents: 'auto',
              zIndex: 90,
              boxShadow: worstResult.status !== 'pass' ? `0 0 10px ${borderColor}80` : `0 0 5px ${borderColor}40`,
              transition: 'border-color 0.2s, background-color 0.2s',
              cursor: 'pointer',
              boxSizing: 'border-box'
            }}
          >
            <div 
              className={`v-label-container ${isHovered ? 'expanded' : ''}`}
              style={{
                position: 'absolute',
                top: isTopSpaceTight ? 'calc(100% + 6px)' : 'auto',
                bottom: !isTopSpaceTight ? 'calc(100% + 6px)' : 'auto',
                left: '-2px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: isTopSpaceTight ? 'flex-start' : 'flex-end',
                gap: '4px',
                zIndex: 91,
                pointerEvents: 'auto',
              }}
            >
              {!isHovered ? (
                <div
                  key="compact"
                  className="v-error-tooltip compact"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('gtm-assistant-focus-result', { 
                      detail: { eventName: worstResult.eventName, status: worstResult.status } 
                    }));
                  }}
                  style={{
                    borderRadius: '50%',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: worstResultStyle.gradient,
                    boxShadow: `0 4px 12px ${borderColor}40`,
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    width: '32px',
                    height: '32px',
                    boxSizing: 'border-box'
                  }}
                >
                  {getStatusIcon(worstResult.status, 16)}
                  {hasMultiple && (
                    <span style={{ 
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#111827', 
                      color: 'white', 
                      padding: '2px 4px', 
                      borderRadius: '10px',
                      fontSize: '9px',
                      fontWeight: 900,
                      border: '1px solid rgba(255,255,255,0.2)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {groupResults.length}
                    </span>
                  )}
                </div>
              ) : (
                groupResults.map((res, i) => {
                  const style = getStatusStyle(res.status);
                  return (
                    <div 
                      key={i}
                      className="v-error-tooltip expanded"
                      style={{ 
                        borderRadius: '50%',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: style.gradient,
                        boxShadow: `0 4px 12px ${style.color}40`,
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        width: '32px',
                        height: '32px',
                        boxSizing: 'border-box'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('gtm-assistant-focus-result', { 
                          detail: { eventName: res.eventName, status: res.status } 
                        }));
                      }}
                      title={res.eventName}
                    >
                      {getStatusIcon(res.status, 16)}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        );
      })}
    </>
  );
};

export default VerificationOverlay;
