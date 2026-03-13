import React, { useEffect, useState } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { EventSpec } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag } from 'lucide-react';

interface GroupedSpec {
  selector: string;
  specs: EventSpec[];
  rect: { top: number; left: number; width: number; height: number; borderRadius: string };
}

const SpecOutline: React.FC = () => {
  const { specs, config, setEditingSpec, setSelectedElement, showAllBadges, webviewRef, isWebviewReady, hoveredElement } = useGTMAssistant();
  const [groupedSpecs, setGroupedSpecs] = useState<GroupedSpec[]>([]);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Passive hover detection: Expand labels if the hovered element matches a spec's selector
  useEffect(() => {
    if (config.mode === 'spec' && hoveredElement?.selector) {
      setHoveredGroupId(hoveredElement.selector);
    } else if (config.mode === 'spec') {
      setHoveredGroupId(null);
    }
  }, [hoveredElement, config.mode]);

  useEffect(() => {
    if ((config.mode !== 'spec' && config.mode !== 'view') || !showAllBadges || !webviewRef.current || !isWebviewReady) {
      setGroupedSpecs([]);
      return;
    }

    const requestRects = () => {
      const selectors = specs
        .map(s => s.selector)
        .filter(s => s && s !== 'document');
      
      if (selectors.length > 0) {
        webviewRef.current.send('get-rects', selectors);
      }
    };

    const handleRectsUpdate = (event: any) => {
      if (event.channel !== 'rects-update') return;
      
      const rects = event.args[0];
      const groupsMap = new Map<string, EventSpec[]>();
      
      specs.forEach(spec => {
        if (!spec.selector || spec.selector === 'document' || !rects[spec.selector]) return;
        const list = groupsMap.get(spec.selector) || [];
        list.push(spec);
        groupsMap.set(spec.selector, list);
      });

      const newGroups: GroupedSpec[] = [];
      groupsMap.forEach((specList, selector) => {
        newGroups.push({ selector, specs: specList, rect: rects[selector] });
      });
      
      // Sort in descending area order so smaller elements render on top of larger ones
      newGroups.sort((a, b) => {
        const areaA = a.rect.width * a.rect.height;
        const areaB = b.rect.width * b.rect.height;
        return areaB - areaA;
      });

      setGroupedSpecs(newGroups);
    };

    const webview = webviewRef.current;
    if (webview) {
      webview.addEventListener('ipc-message', handleRectsUpdate);
      
      // Initial request
      requestRects();

      // Poll or listen for scroll/resize if possible 
      // (Simplified for now, we can add more robust sync in next step)
      const interval = setInterval(requestRects, 1000);
      
      return () => {
        webview.removeEventListener('ipc-message', handleRectsUpdate);
        clearInterval(interval);
      };
    }
  }, [specs, config.mode, showAllBadges, webviewRef, isWebviewReady]);

  if ((config.mode !== 'spec' && config.mode !== 'view') || !showAllBadges || groupedSpecs.length === 0) return null;

  const handleEditClick = (e: React.MouseEvent, spec: EventSpec, rect: any, selector: string) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingSpec(spec);
    setSelectedElement({ 
      tagName: 'ELEMENT', 
      rect: rect as DOMRect, 
      selector 
    });
  };

  return (
    <div className="gtm-spec-outlines-layer" style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
      {groupedSpecs.map((group) => {
        const isHovered = hoveredGroupId === group.selector;
        const mainSpec = group.specs[0];
        const hasMultiple = group.specs.length > 1;

        // Dynamic height calculation to prevent overflow
        const estimatedHeight = isHovered ? (group.specs.length * 30 + 10) : 40;
        const isTopSpaceTight = group.rect.top < estimatedHeight;

        return (
          <motion.div
            key={group.selector}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              backgroundColor: isHovered ? 'rgba(234, 88, 12, 0.25)' : 'rgba(234, 88, 12, 0.05)',
            }}
            transition={{ duration: 0.1 }}
            className="gtm-spec-group-outline"
            onClick={(e) => {
              // Only handle click in View mode (to open popover via border area)
              // In Spec mode, we want clicks to pass through to elements underneath
              if (config.mode === 'view') {
                handleEditClick(e, mainSpec, group.rect, group.selector);
              }
            }}
            onMouseEnter={() => {
              if (config.mode === 'view') setHoveredGroupId(group.selector);
            }}
            onMouseLeave={() => {
              if (config.mode === 'view') setHoveredGroupId(null);
            }}
            style={{
              position: 'absolute',
              top: group.rect.top,
              left: group.rect.left,
              width: group.rect.width,
              height: group.rect.height,
              border: `2px solid ${(isHovered && config.mode !== 'view') ? '#ea580c' : 'rgba(234, 88, 12, 0.6)'}`,
              borderRadius: '8px',
              // pointerEvents: 'none' in Spec mode allows tagging nested elements
              // pointerEvents: 'auto' in View mode allows clicking the border to see details
              pointerEvents: config.mode === 'spec' ? 'none' : 'auto',
              cursor: config.mode === 'view' ? 'pointer' : 'default',
              boxSizing: 'border-box',
              backdropFilter: (isHovered && config.mode !== 'view') ? 'blur(1.5px)' : 'none',
              transition: 'border-color 0.2s, background-color 0.2s',
              zIndex: (isHovered && config.mode !== 'view') ? 12 : 10,
            }}
          >
            <div
              className={`gtm-spec-label-container ${isHovered ? 'expanded' : ''}`}
              style={{
                position: 'absolute',
                top: isTopSpaceTight ? '100%' : 'auto',
                bottom: !isTopSpaceTight ? '100%' : 'auto',
                paddingTop: isTopSpaceTight ? '6px' : '0',
                paddingBottom: !isTopSpaceTight ? '6px' : '0',
                left: '-2px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: isTopSpaceTight ? 'flex-start' : 'flex-end',
                gap: '4px',
                zIndex: 13,
                pointerEvents: 'auto', // Labels must always be interactive
              }}
              onMouseEnter={() => {
                if (config.mode === 'spec') setHoveredGroupId(group.selector);
              }}
              onMouseLeave={() => {
                if (config.mode === 'spec') setHoveredGroupId(null);
              }}
            >
              {!isHovered ? (
                <div
                  key="compact"
                  className="gtm-spec-label-compact"
                  onClick={(e) => handleEditClick(e, mainSpec, group.rect, group.selector)}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <Tag size={12} fill="white" />
                  {mainSpec.eventName}
                  {hasMultiple && (
                    <span style={{ 
                      background: 'rgba(255, 255, 255, 0.2)', 
                      color: 'white', 
                      padding: '1px 5px', 
                      borderRadius: '10px',
                      fontSize: '9px',
                      fontWeight: 900
                    }}>
                      +{group.specs.length - 1}
                    </span>
                  )}
                </div>
              ) : (
                <div 
                  key="expanded"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {group.specs.map(spec => (
                    <div
                      key={spec.id}
                      className="gtm-spec-label-item"
                      onClick={(e) => handleEditClick(e, spec, group.rect, group.selector)}
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <Tag size={12} fill="white" />
                      {spec.eventName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default SpecOutline;
