import React, { useEffect, useState } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { EventSpec } from '../../types';

interface GroupedSpec {
  selector: string;
  specs: EventSpec[];
  rect: DOMRect;
  element: HTMLElement;
}

const SpecOutline: React.FC = () => {
  const { specs, config, setEditingSpec, setSelectedElement, showAllBadges } = useGTMAssistant();
  const [groupedSpecs, setGroupedSpecs] = useState<GroupedSpec[]>([]);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (config.mode !== 'spec' || !showAllBadges) {
      setGroupedSpecs([]);
      return;
    }

    const updateRects = () => {
      const groupsMap = new Map<string, EventSpec[]>();
      
      specs.forEach(spec => {
        if (!spec.selector || spec.selector === 'document') return;
        const list = groupsMap.get(spec.selector) || [];
        list.push(spec);
        groupsMap.set(spec.selector, list);
      });

      const newGroups: GroupedSpec[] = [];
      groupsMap.forEach((specList, selector) => {
        try {
          const el = document.querySelector(selector) as HTMLElement;
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              newGroups.push({ selector, specs: specList, rect, element: el });
            }
          }
        } catch (e) {
          // Ignore invalid selectors
        }
      });
      setGroupedSpecs(newGroups);
    };

    updateRects();
    
    let timeoutId: number;
    const throttledUpdate = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(updateRects, 100);
    };

    window.addEventListener('scroll', throttledUpdate, { passive: true });
    window.addEventListener('resize', throttledUpdate);
    
    const observer = new MutationObserver(throttledUpdate);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      window.removeEventListener('scroll', throttledUpdate);
      window.removeEventListener('resize', throttledUpdate);
      if (timeoutId) window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [specs, config.mode, showAllBadges]);

  if (config.mode !== 'spec' || !showAllBadges || groupedSpecs.length === 0) return null;

  const handleEditClick = (e: React.MouseEvent, spec: EventSpec, element: HTMLElement) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingSpec(spec);
    setSelectedElement(element);
  };

  return (
    <>
      {groupedSpecs.map((group) => {
        const isHovered = hoveredGroupId === group.selector;
        const mainSpec = group.specs[0];
        const hasMultiple = group.specs.length > 1;

        // Smart positioning: if there's less than 30px space above, flip to bottom
        const isTopSpaceTight = group.rect.top < 30;

        return (
          <div
            key={group.selector}
            className="gtm-spec-group-outline"
            onMouseEnter={() => setHoveredGroupId(group.selector)}
            onMouseLeave={() => setHoveredGroupId(null)}
            style={{
              position: 'fixed',
              top: group.rect.top,
              left: group.rect.left,
              width: group.rect.width,
              height: group.rect.height,
              border: '2px dashed #10b981',
              backgroundColor: isHovered ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
              borderRadius: window.getComputedStyle(group.element).borderRadius || '4px',
              zIndex: 2147483645,
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'background-color 0.2s',
            }}
          >
            <div
              className={`gtm-spec-label-container ${isHovered ? 'expanded' : ''}`}
              style={{
                position: 'absolute',
                top: isHovered 
                  ? (isTopSpaceTight ? 'calc(100% + 4px)' : 'auto') 
                  : (isTopSpaceTight ? 'calc(100% + 2px)' : '-24px'),
                bottom: !isTopSpaceTight && isHovered ? 'calc(100% + 4px)' : 'auto',
                left: '-2px',
                display: 'flex',
                flexDirection: isTopSpaceTight ? 'column' : 'column-reverse',
                gap: '2px',
                zIndex: 2147483646,
              }}
            >
              {!isHovered ? (
                <div
                  className="gtm-spec-label-compact"
                  onClick={(e) => handleEditClick(e, mainSpec, group.element)}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {mainSpec.eventName}
                  {hasMultiple && (
                    <span style={{ 
                      background: 'white', 
                      color: '#059669', 
                      padding: '0 4px', 
                      borderRadius: '10px',
                      fontSize: '10px'
                    }}>
                      +{group.specs.length - 1}
                    </span>
                  )}
                </div>
              ) : (
                group.specs.map(spec => (
                  <div
                    key={spec.id}
                    className="gtm-spec-label-item"
                    onClick={(e) => handleEditClick(e, spec, group.element)}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      transition: 'transform 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {spec.eventName}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default SpecOutline;
