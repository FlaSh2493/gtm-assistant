import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { parseGTMGA4Tags, parseGTMTriggers } from '../services/gtm-parser';
import { verifySpecs, VerificationResult } from '../services/verification-service';
import { useGTMAssistant } from '../../../app/providers';
import { EXAMPLE_GTM_JSON } from '../services/example-data';
import './verification-overlay.css';

const VerificationOverlay: React.FC = () => {
  const { config, isWebviewReady, specs, externalSpecs, gtmJson, currentUrl, setIsDrawerOpen, sendToWebview } = useGTMAssistant();
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [hoveredSelector, setHoveredSelector] = useState<string | null>(null);
  const [elementRects, setElementRects] = useState<Record<string, any>>({});

  useEffect(() => {
    if (config.mode !== 'verify') return;

    const currentSpecs = externalSpecs || specs;
    const currentGtm = gtmJson || EXAMPLE_GTM_JSON;

    const tags = parseGTMGA4Tags(currentGtm);
    const triggerMap = parseGTMTriggers(currentGtm);
    const verificationResults = verifySpecs(currentSpecs, tags, triggerMap, currentUrl);
    setResults(verificationResults);
  }, [config.mode, specs, externalSpecs, gtmJson, currentUrl]);

  useEffect(() => {
    if (config.mode !== 'verify' || !isWebviewReady) return;

    const requestRects = () => {
      const selectors = results
        .map(r => r.selector)
        .filter(s => s && s !== 'document');

      if (selectors.length > 0 && isWebviewReady) {
        sendToWebview('get-rects', selectors);
      }
    };

    const handleRectsUpdate = (e: any) => {
      setElementRects(e.detail);
    };

    window.addEventListener('rects-update', handleRectsUpdate);
    window.addEventListener('webview-scrolling', requestRects);
    window.addEventListener('webview-dom-mutation', requestRects);

    requestRects();

    return () => {
      window.removeEventListener('rects-update', handleRectsUpdate);
      window.removeEventListener('webview-scrolling', requestRects);
      window.removeEventListener('webview-dom-mutation', requestRects);
    };
  }, [config.mode, results, isWebviewReady, sendToWebview]);

  if (config.mode !== 'verify') return null;

  const groupedResults = results.reduce((acc, res) => {
    if (!res.selector || res.selector === 'document' || !elementRects[res.selector]) return acc;
    if (!acc[res.selector]) acc[res.selector] = [];
    acc[res.selector].push(res);
    return acc;
  }, {} as Record<string, VerificationResult[]>);

  const getStatusPriority = (status: VerificationResult['status']) => {
    switch (status) {
      case 'issue': return 3;
      case 'unspec': return 2;
      case 'match': return 1;
      default: return 0;
    }
  };

  const getStatusIcon = (status: VerificationResult['status'], size = 12) => {
    switch (status) {
      case 'match': return <CheckCircle size={size} color="white" />;
      case 'issue': return <AlertCircle size={size} color="white" />;
      case 'unspec': return <HelpCircle size={size} color="white" />;
      default: return null;
    }
  };

  const getStatusStyle = (status: VerificationResult['status']) => {
    switch (status) {
      case 'match': return { color: '#10b981', gradient: 'linear-gradient(135deg, #34d399, #059669)', bg: 'rgba(16, 185, 129, 0.05)', hoverBg: 'rgba(16, 185, 129, 0.25)' };
      case 'issue': return { color: '#ef4444', gradient: 'linear-gradient(135deg, #f87171, #dc2626)', bg: 'rgba(239, 68, 68, 0.05)', hoverBg: 'rgba(239, 68, 68, 0.25)' };
      case 'unspec': return { color: '#64748b', gradient: 'linear-gradient(135deg, #94a3b8, #475569)', bg: 'rgba(100, 116, 139, 0.05)', hoverBg: 'rgba(100, 116, 139, 0.25)' };
      default: return { color: '#9ca3af', gradient: 'linear-gradient(135deg, #9ca3af, #6b7280)', bg: 'transparent', hoverBg: 'rgba(156, 163, 175, 0.25)' };
    }
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 90 }}>
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

        // Horizontal repositioning logic
        const estimatedWidth = isHovered ? 120 : 50;
        const isRightSpaceTight = (rect.left + estimatedWidth) > window.innerWidth;

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
              setIsDrawerOpen(true);
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
              zIndex: isHovered ? 92 : 90,
              boxShadow: worstResult.status !== 'match' ? `0 0 10px ${borderColor}80` : `0 0 5px ${borderColor}40`,
              transition: 'border-color 0.2s, background-color 0.2s',
              cursor: 'pointer',
              boxSizing: 'border-box'
            }}
          >
            <div
              className={`v-label-container ${isHovered ? 'expanded' : ''} ${isRightSpaceTight ? 'right-aligned' : ''}`}
              style={{
                position: 'absolute',
                top: isTopSpaceTight ? '100%' : 'auto',
                bottom: !isTopSpaceTight ? '100%' : 'auto',
                paddingTop: isTopSpaceTight ? '6px' : '0',
                paddingBottom: !isTopSpaceTight ? '6px' : '0',
                left: isRightSpaceTight ? 'auto' : '-2px',
                right: isRightSpaceTight ? '-2px' : 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isRightSpaceTight ? 'flex-end' : 'flex-start',
                justifyContent: isTopSpaceTight ? 'flex-start' : 'flex-end',
                gap: '4px',
                zIndex: 93,
                pointerEvents: 'auto',
              }}
              onMouseEnter={() => setHoveredSelector(selector)}
              onMouseLeave={() => setHoveredSelector(null)}
            >
              {!isHovered ? (
                <div
                  key="compact"
                  className="v-error-tooltip compact"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDrawerOpen(true);
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
                        setIsDrawerOpen(true);
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
    </div>
  );
};

export default VerificationOverlay;
