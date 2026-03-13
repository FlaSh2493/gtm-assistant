import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseGTMGA4Tags, parseGTMTriggers } from './GTMParser';
import { EXAMPLE_CSV_PLAN, EXAMPLE_GTM_JSON } from './ExampleData';
import { verifySpecs, VerificationResult } from './VerificationService';
import { useGTMAssistant } from '../GTMAssistant';

const VerificationOverlay: React.FC = () => {
  const { config, hoveredElement, webviewRef } = useGTMAssistant();
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
    if (config.mode !== 'verify' || !webviewRef.current) return;

    const requestRects = () => {
      const selectors = results
        .map(r => r.selector)
        .filter(s => s && s !== 'document');
      
      if (selectors.length > 0) {
        webviewRef.current?.send('get-rects', selectors);
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
  }, [config.mode, results, webviewRef]);

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

  const getStatusStyle = (status: VerificationResult['status']) => {
    switch (status) {
      case 'pass': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' };
      case 'fail': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)' };
      case 'missing': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' };
      case 'extra': return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' };
      default: return { color: '#9ca3af', bg: 'transparent' };
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
        
        const { color: borderColor, bg: bgColor } = getStatusStyle(worstResult.status);
        const hasMultiple = groupResults.length > 1;

        const estimatedHeight = isHovered ? (groupResults.length * 30 + 10) : 40;
        const isTopSpaceTight = rect.top < estimatedHeight;
        
        // Horizontal check (simplified)
        const isRightSpaceTight = rect.left + 200 > 1000; // Assume 1000px webview width for now

        return (
          <div 
            key={selector}
            className={`v-overlay-rect ${worstResult.status}`}
            onMouseEnter={() => setHoveredSelector(selector)}
            onMouseLeave={() => setHoveredSelector(null)}
            style={{
              position: 'absolute',
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
              border: `3px dashed ${borderColor}`,
              backgroundColor: isHovered ? `${borderColor}22` : bgColor,
              borderRadius: rect.borderRadius || '4px',
              pointerEvents: 'auto',
              zIndex: 90,
              boxShadow: worstResult.status !== 'pass' ? `0 0 10px ${borderColor}80` : `0 0 5px ${borderColor}40`,
              transition: 'background-color 0.1s',
              cursor: 'pointer'
            }}
          >
            <div 
              className={`v-label-container ${isHovered ? 'expanded' : ''}`}
              style={{
                position: 'absolute',
                top: isHovered 
                  ? (isTopSpaceTight ? 'calc(100% + 4px)' : 'auto') 
                  : (isTopSpaceTight ? 'calc(100% + 2px)' : '-24px'),
                bottom: !isTopSpaceTight && isHovered ? 'calc(100% + 4px)' : 'auto',
                left: isRightSpaceTight ? 'auto' : '-2px',
                right: isRightSpaceTight ? '-2px' : 'auto',
                display: 'flex',
                flexDirection: isTopSpaceTight ? 'column' : 'column-reverse',
                alignItems: isRightSpaceTight ? 'flex-end' : 'flex-start',
                gap: '2px',
                zIndex: 91,
              }}
            >
              {!isHovered ? (
                <div
                  className="v-error-tooltip compact"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('gtm-assistant-focus-result', { 
                      detail: { eventName: worstResult.eventName, status: worstResult.status } 
                    }));
                  }}
                  style={{
                    background: borderColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <div className="v-tooltip-label">{worstResult.eventName}</div>
                  {hasMultiple && (
                    <span style={{ 
                      background: 'white', 
                      color: borderColor, 
                      padding: '0 4px', 
                      borderRadius: '10px',
                      fontSize: '10px'
                    }}>
                      +{groupResults.length - 1}
                    </span>
                  )}
                </div>
              ) : (
                groupResults.map((res, i) => {
                  const { color } = getStatusStyle(res.status);
                  return (
                    <div 
                      key={i}
                      className="v-error-tooltip expanded" 
                      style={{ 
                        background: color,
                        padding: '4px 10px',
                        transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('gtm-assistant-focus-result', { 
                          detail: { eventName: res.eventName, status: res.status } 
                        }));
                      }}
                    >
                      <div className="v-tooltip-label">{res.eventName}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      <style>{`
        .v-overlay-rect.fail { background: rgba(239, 68, 68, 0.05); }
        .v-overlay-rect.pass { background: rgba(16, 185, 129, 0.05); }
        
        .v-error-tooltip {
          background: #ef4444;
          color: white;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          pointer-events: auto;
        }
        .v-tooltip-label { font-size: 11px; font-weight: 700; white-space: nowrap; }
      `}</style>
    </>
  );
};

export default VerificationOverlay;
