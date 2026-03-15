import React, { useEffect, useState } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { EventSpec } from '../../types';
import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';

interface GroupedSpec {
  selector: string;
  specs: EventSpec[];
  rect: { top: number; left: number; width: number; height: number; borderRadius: string };
}

const SpecOutline: React.FC = () => {
  const { specs, config, setEditingSpec, setSelectedElement, showAllBadges, isWebviewReady, hoveredElement, sendToWebview } = useGTMAssistant();
  const [groupedSpecs, setGroupedSpecs] = useState<GroupedSpec[]>([]);
  const [badgeHoveredGroupId, setBadgeHoveredGroupId] = useState<string | null>(null);
  const hoveredGroupId = badgeHoveredGroupId ?? (config.mode === 'spec' ? (hoveredElement?.selector ?? null) : null);

  useEffect(() => {
    if (config.mode !== 'spec' || !showAllBadges || !isWebviewReady) {
      setGroupedSpecs([]);
      return;
    }

    const requestRects = () => {
      const selectors = specs
        .map(s => s.selector)
        .filter(s => s && s !== 'document');
      
      if (selectors.length > 0) {
        sendToWebview('get-rects', selectors);
      }
    };

    const handleRectsUpdate = (e: any) => {
      const rects = e.detail;
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

    const handleWebviewScroll = () => {
      requestRects();
    };

    // App.tsx에서 relay하는 custom event들 구독
    window.addEventListener('rects-update', handleRectsUpdate);
    window.addEventListener('webview-scrolling', handleWebviewScroll);

    // Initial request
    requestRects();

    const interval = setInterval(requestRects, 300);

    return () => {
      window.removeEventListener('rects-update', handleRectsUpdate);
      window.removeEventListener('webview-scrolling', handleWebviewScroll);
      clearInterval(interval);
    };
  }, [specs, config.mode, showAllBadges, isWebviewReady, sendToWebview]);

  if (config.mode !== 'spec' || !showAllBadges || groupedSpecs.length === 0) return null;

  const specLabelStyle: React.CSSProperties = {
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
  };

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
        
        // Horizontal repositioning logic
        const estimatedWidth = isHovered ? 200 : 120; // Expanded labels are wider
        const isRightSpaceTight = (group.rect.left + estimatedWidth) > window.innerWidth;

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
            style={{
              position: 'absolute',
              top: group.rect.top,
              left: group.rect.left,
              width: group.rect.width,
              height: group.rect.height,
              border: `2px solid ${isHovered ? '#ea580c' : 'rgba(234, 88, 12, 0.6)'}`,
              borderRadius: '8px',
              pointerEvents: 'none',
              cursor: 'default',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s, background-color 0.2s',
              zIndex: isHovered ? 12 : 10,
            }}
          >
            <div
              className={`gtm-spec-label-container ${isHovered ? 'expanded' : ''} ${isRightSpaceTight ? 'right-aligned' : ''}`}
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
                zIndex: 13,
                pointerEvents: 'auto', // Labels must always be interactive
              }}
              onMouseEnter={() => setBadgeHoveredGroupId(group.selector)}
              onMouseLeave={() => setBadgeHoveredGroupId(null)}
            >
              {!isHovered ? (
                <div
                  key="compact"
                  className="gtm-spec-label-compact"
                  onClick={(e) => handleEditClick(e, mainSpec, group.rect, group.selector)}
                  style={specLabelStyle}
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
                      style={specLabelStyle}
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
