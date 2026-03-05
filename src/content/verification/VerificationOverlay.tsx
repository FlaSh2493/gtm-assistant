import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseGTMGA4Tags, parseGTMTriggers } from './GTMParser';
import { EXAMPLE_CSV_PLAN, EXAMPLE_GTM_JSON } from './ExampleData';
import { verifySpecs, VerificationResult } from './VerificationService';
import { useGTMAssistant } from '../GTMAssistant';
import { isElementVisible } from '../../utils/dom';

const VerificationOverlay: React.FC = () => {
  const { config, hoveredElement } = useGTMAssistant();
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [hoveredSelector, setHoveredSelector] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (config.mode !== 'verify') return;

    const tags = parseGTMGA4Tags(EXAMPLE_GTM_JSON);
    const triggerMap = parseGTMTriggers(EXAMPLE_GTM_JSON);
    const verificationResults = verifySpecs(EXAMPLE_CSV_PLAN, tags, triggerMap);
    setResults(verificationResults);
  }, [config.mode]);

  useEffect(() => {
    if (config.mode !== 'verify') return;

    // 스크롤, 리사이즈 발생 시 강제 리렌더링 (위치 재계산 및 가시성 체크 용도)
    const handleUpdate = () => setTick(t => t + 1);
    
    window.addEventListener('scroll', handleUpdate, { capture: true, passive: true });
    window.addEventListener('resize', handleUpdate);
    
    // 주기적으로(60fps) 업데이트하여 애니메이션이나 동적 DOM 변경 대응
    let rafId: number;
    const updateLoop = () => {
      setTick(t => t + 1);
      rafId = requestAnimationFrame(updateLoop);
    };
    rafId = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener('scroll', handleUpdate, { capture: true });
      window.removeEventListener('resize', handleUpdate);
      cancelAnimationFrame(rafId);
    };
  }, [config.mode]);

  if (config.mode !== 'verify') return null;

  // Group results by selector to handle multiple tags on one element
  const groupedResults = results.reduce((acc, res) => {
    if (!res.selector || res.selector === 'document') return acc;
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
        try {
          const el = document.querySelector(selector) as HTMLElement;
          if (!el || !isElementVisible(el)) return null;
          
          const rect = el.getBoundingClientRect();
          const isHovered = hoveredSelector === selector;
          
          // Determine the worst status for the border color
          const worstResult = groupResults.reduce((prev, curr) => 
            getStatusPriority(curr.status) > getStatusPriority(prev.status) ? curr : prev, 
            groupResults[0]
          );
          
          const { color: borderColor, bg: bgColor } = getStatusStyle(worstResult.status);
          const hasMultiple = groupResults.length > 1;

          // Smart positioning: calculate if it should flip based on available space
          // A single badge is ~24px high, expanded items are ~30px each.
          const estimatedHeight = isHovered ? (groupResults.length * 30 + 10) : 40;
          const isTopSpaceTight = rect.top < estimatedHeight;
          const isBottomSpaceTight = (window.innerHeight - rect.bottom) < estimatedHeight;
          
          // Default to top if enough space, otherwise flip to bottom
          const showAtBottom = isTopSpaceTight && (!isBottomSpaceTight || (window.innerHeight - rect.bottom > rect.top));
          
          // Horizontal flip: Check if any part of the badge would go off-screen
          // We assume a max badge width of ~200px for safety.
          const isRightSpaceTight = rect.left + 200 > window.innerWidth;
          const isLeftSpaceTight = rect.left < 10;

          return (
            <div 
              key={selector}
              className={`v-overlay-rect ${worstResult.status}`}
              onMouseEnter={() => setHoveredSelector(selector)}
              onMouseLeave={() => setHoveredSelector(null)}
              style={{
                position: 'fixed',
                top: rect.top - 4,
                left: rect.left - 4,
                width: rect.width + 8,
                height: rect.height + 8,
                border: `3px dashed ${borderColor}`,
                backgroundColor: isHovered ? `${borderColor}22` : bgColor,
                borderRadius: '4px',
                pointerEvents: 'auto',
                zIndex: 9999990,
                boxShadow: worstResult.status !== 'pass' ? `0 0 10px ${borderColor}80` : `0 0 5px ${borderColor}40`,
                transition: 'background-color 0.2s',
                cursor: 'pointer'
              }}
            >
              {/* Badge Container */}
              <div 
                className={`v-label-container ${isHovered ? 'expanded' : ''}`}
                style={{
                  position: 'absolute',
                  top: isHovered 
                    ? (showAtBottom ? 'calc(100% + 4px)' : 'auto') 
                    : (showAtBottom ? 'calc(100% + 2px)' : '-24px'),
                  bottom: !showAtBottom && isHovered ? 'calc(100% + 4px)' : 'auto',
                  // If right is tight, align to right. If left is tight, or by default, align to left.
                  left: isRightSpaceTight ? 'auto' : (isLeftSpaceTight ? '4px' : '-2px'),
                  right: isRightSpaceTight ? (isLeftSpaceTight ? 'auto' : '-2px') : 'auto',
                  display: 'flex',
                  flexDirection: showAtBottom ? 'column' : 'column-reverse',
                  alignItems: isRightSpaceTight ? 'flex-end' : 'flex-start',
                  gap: '2px',
                  zIndex: 9999991,
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
        } catch (e) {
          return null;
        }
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
