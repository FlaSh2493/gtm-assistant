import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { parseGTMGA4Tags, parseGTMTriggers } from './GTMParser';
import { EXAMPLE_CSV_PLAN, EXAMPLE_GTM_JSON } from './ExampleData';
import { verifySpecs, VerificationResult } from './VerificationService';

const VerificationDrawer: React.FC = () => {
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerificationResult['status'] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tags = parseGTMGA4Tags(EXAMPLE_GTM_JSON);
    const triggerMap = parseGTMTriggers(EXAMPLE_GTM_JSON);
    const verificationResults = verifySpecs(EXAMPLE_CSV_PLAN, tags, triggerMap);
    setResults(verificationResults);
  }, []);

  useEffect(() => {
    const handleFocus = (e: any) => {
      const { eventName } = e.detail;
      if (!eventName) return;

      // Reset filter to show all so we can find the item
      setFilter(null);
      
      // Let React update the list first
      setTimeout(() => {
        setExpandedId(eventName);
        
        // Find element within our list container (Safe for Shadow DOM)
        const itemEl = listRef.current?.querySelector(`#v-item-${eventName}`) as HTMLElement;
        if (itemEl && listRef.current) {
          // Calculate offset relative to list container
          const targetOffset = itemEl.offsetTop - 20; // 20px padding/margin adjustment
          
          listRef.current.scrollTo({
            top: targetOffset,
            behavior: 'smooth'
          });

          // Visual highlight
          itemEl.style.backgroundColor = '#eff6ff';
          itemEl.style.transition = 'background-color 0.3s';
          setTimeout(() => { itemEl.style.backgroundColor = ''; }, 2000);
        }
      }, 150);
    };

    window.addEventListener('gtm-assistant-focus-result', handleFocus);
    return () => window.removeEventListener('gtm-assistant-focus-result', handleFocus);
  }, [results]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleFilter = (status: VerificationResult['status']) => {
    setFilter(filter === status ? null : status);
  };

  const getStatusIcon = (status: VerificationResult['status'], size = 14) => {
    switch (status) {
      case 'pass': return <CheckCircle size={size} color="#10b981" />;
      case 'fail': return <AlertCircle size={size} color="#ef4444" />;
      case 'missing': return <HelpCircle size={size} color="#f59e0b" />;
      case 'extra': return <AlertCircle size={size} color="#3b82f6" />;
      default: return null;
    }
  };

  const renderSection = (title: string, status: VerificationResult['status'], icon: React.ReactNode) => {
    let filtered = results.filter(r => r.status === status);
    
    // Apply status filter if active
    if (filter && filter !== status) {
        return null;
    }

    if (filtered.length === 0) return null;

    return (
      <div className="v-section">
        <div className="v-section-title">
          {icon} <span>{title}</span> <span className="v-count">({filtered.length})</span>
        </div>
        {filtered.map((res, i) => {
          const itemKey = res.eventName;
          const isExpanded = expandedId === itemKey;
          
          return (
            <div 
              key={itemKey} 
              id={`v-item-${res.eventName}`}
              className={`v-item ${res.status} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleExpand(itemKey)}
              style={{ cursor: 'pointer' }}
            >
              <div className="v-item-header">
                <span className="v-status-icon">
                  {getStatusIcon(res.status)}
                </span>
                <span className="v-event-name">{res.eventName}</span>
                {res.planId && <span className="v-event-id">{res.planId}</span>}
              </div>
              {res.tagName && <div className="v-tag-name">Tag: {res.tagName}</div>}
              
              {isExpanded && (
                <div className="v-details" onClick={(e) => e.stopPropagation()}>
                  {res.mismatches.length > 0 ? (
                    <div className="v-mismatches">
                      {res.mismatches.map((m, idx) => (
                        <div key={idx} className="v-mismatch-note">• {m}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="v-mismatch-note" style={{ color: '#10b981' }}>✓ 모든 요건이 기획과 일치합니다.</div>
                  )}
                  {res.selector && (
                    <div className="v-meta">
                      <strong>Selector:</strong> <code>{res.selector}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const filterConfigs: { status: VerificationResult['status']; label: string }[] = [
    { status: 'pass', label: '일치' },
    { status: 'fail', label: '불일치' },
    { status: 'missing', label: '구현 필요' },
    { status: 'extra', label: '명세 확인' },
  ];

  return (
    <div className="verification-drawer">
      <div className="v-header">
        <h3>검수 결과 리스트</h3>
        <p className="v-subtitle">명세서와 GTM 컨테이너 구현을 비교합니다.</p>
        
        <div className="v-filter-bar">
          {filterConfigs.map(cfg => {
            const count = results.filter(r => r.status === cfg.status).length;
            if (count === 0 && !filter) return null;
            
            return (
              <button 
                key={cfg.status}
                className={`v-filter-chip ${cfg.status} ${filter === cfg.status ? 'active' : ''}`}
                onClick={() => toggleFilter(cfg.status)}
              >
                {getStatusIcon(cfg.status, 12)}
                <span className="chip-label">{cfg.label}</span>
                <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="v-results-list" ref={listRef}>
        {renderSection('기획대로 구현됨 (성공)', 'pass', <CheckCircle size={16} color="#10b981" />)}
        {renderSection('상세 요건 불일치 (실패)', 'fail', <AlertCircle size={16} color="#ef4444" />)}
        {renderSection('GTM 구현 필요 (미구현)', 'missing', <HelpCircle size={16} color="#f59e0b" />)}
        {renderSection('명세 확인 필요 (미정의)', 'extra', <AlertCircle size={16} color="#3b82f6" />)}
        
        {filter && results.filter(r => r.status === filter).length === 0 && (
           <div className="v-empty-filter">
             선택한 필터에 해당하는 결과가 없습니다.
           </div>
        )}
      </div>

      <style>{`
        .verification-drawer { display: flex; flex-direction: column; height: 100%; background: #fdfdfd; }
        .v-header { padding: 16px; border-bottom: 1px solid #f3f4f6; background: white; }
        .v-header h3 { margin: 0; font-size: 15px; font-weight: 700; color: #111827; }
        .v-subtitle { margin: 4px 0 12px; font-size: 12px; color: #6b7280; }
        
        .v-filter-bar { display: flex; flex-wrap: wrap; gap: 6px; }
        .v-filter-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 11px;
          color: #4b5563;
          font-weight: 600;
        }
        .v-filter-chip:hover { border-color: #d1d5db; background: #f3f4f6; }
        .v-filter-chip.active { background: white; border-color: #3b82f6; color: #2563eb; ring: 2px solid #3b82f6; }
        .v-filter-chip.pass.active { border-color: #10b981; color: #059669; }
        .v-filter-chip.fail.active { border-color: #ef4444; color: #dc2626; }
        .v-filter-chip.missing.active { border-color: #f59e0b; color: #d97706; }
        .v-filter-chip.extra.active { border-color: #3b82f6; color: #2563eb; }
        
        .chip-count { font-size: 10px; opacity: 0.6; }

        .v-results-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 20px; }
        .v-section { display: flex; flex-direction: column; gap: 8px; }
        .v-section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #374151; padding: 0 4px; }
        .v-count { font-weight: 400; color: #9ca3af; font-size: 11px; }
        
        .v-item { border-radius: 8px; border: 1px solid #e5e7eb; background: white; padding: 12px; transition: all 0.2s; }
        .v-item:hover { background: #f9fafb; border-color: #d1d5db; }
        .v-item.expanded { border-color: #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .v-item.pass { border-left: 4px solid #10b981; }
        .v-item.fail { border-left: 4px solid #ef4444; }
        .v-item.missing { border-left: 4px solid #f59e0b; }
        .v-item.extra { border-left: 4px solid #3b82f6; }
        
        .v-item-header { display: flex; align-items: center; gap: 6px; }
        .v-event-name { font-weight: 600; font-size: 13px; color: #374151; flex: 1; overflow: hidden; text-overflow: ellipsis; }
        .v-event-id { font-weight: 700; color: #3b82f6; font-size: 10px; background: #eff6ff; padding: 1px 4px; border-radius: 3px; }
        .v-tag-name { font-size: 10px; color: #6b7280; margin-top: 2px; }
        
        .v-details { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6; }
        .v-mismatches { display: flex; flex-direction: column; gap: 4px; }
        .v-mismatch-note { font-size: 11px; color: #ef4444; font-weight: 500; line-height: 1.4; }
        .v-meta { margin-top: 6px; font-size: 10px; color: #6b7280; }
        .v-meta code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
        
        .v-empty-filter { padding: 40px 20px; text-align: center; color: #9ca3af; font-size: 13px; }
      `}</style>
    </div>
  );
};

export default VerificationDrawer;
