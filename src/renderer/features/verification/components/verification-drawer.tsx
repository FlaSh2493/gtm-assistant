import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, HelpCircle, Database, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { parseGTMGA4Tags, parseGTMTriggers } from '../services/gtm-parser';
import { EXAMPLE_GTM_JSON } from '../services/example-data';
import { verifySpecs, VerificationResult } from '../services/verification-service';
import { useGTMAssistant } from '../../../context/gtm-assistant';
import { parseCSVToSpecs, parseJSONToSpecs } from '../../../utils/spec-parser';

const VerificationDrawer: React.FC = () => {
  const { specs, externalSpecs, setExternalSpecs, gtmJson, setGtmJson, currentUrl } = useGTMAssistant();
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerificationResult['status'] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const specInputRef = useRef<HTMLInputElement>(null);
  const gtmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentSpecs = externalSpecs || specs;
    const currentGtm = gtmJson || EXAMPLE_GTM_JSON;

    const tags = parseGTMGA4Tags(currentGtm);
    const triggerMap = parseGTMTriggers(currentGtm);
    const verificationResults = verifySpecs(currentSpecs, tags, triggerMap, currentUrl);
    setResults(verificationResults);
  }, [specs, externalSpecs, gtmJson, currentUrl]);

  const handleSpecUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (file.name.endsWith('.json')) {
        setExternalSpecs(parseJSONToSpecs(text));
      } else {
        setExternalSpecs(parseCSVToSpecs(text));
      }
    };
    reader.readAsText(file);
  };

  const handleGTMUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setGtmJson(json);
      } catch (err) {
        alert('올바른 GTM JSON 형식이 아닙니다.');
      }
    };
    reader.readAsText(file);
  };

  const resetUploads = () => {
    setExternalSpecs(null);
    setGtmJson(null);
  };

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
      case 'match': return <CheckCircle size={size} color="#10b981" />;
      case 'issue': return <AlertCircle size={size} color="#ef4444" />;
      case 'unspec': return <HelpCircle size={size} color="#64748b" />;
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
              <div className="item-info" style={{ width: '100%' }}>
                <div className="event-header-row">
                  <span className="v-status-icon" style={{ display: 'flex', alignItems: 'center' }}>
                    {getStatusIcon(res.status, 14)}
                  </span>
                  {res.tagName ? (
                    <span className="event-type-badge element" title={res.tagName}>{res.tagName}</span>
                  ) : (
                    <span className="event-type-badge custom">Event</span>
                  )}
                  {res.planId && <span className="event-id">{res.planId}</span>}
                </div>
                <div className="event-name">{res.eventName}</div>
                {res.selector && res.selector !== 'document' && (
                  <span className="page-url" title={res.selector}>{res.selector}</span>
                )}
              </div>

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
    { status: 'match', label: '일치' },
    { status: 'issue', label: '조치 필요' },
    { status: 'unspec', label: '명세 외' },
  ];

  return (
    <div className="verification-drawer">
      <div className="v-header">
        <h3>검수 결과 리스트</h3>
        <p className="v-subtitle">설치 명세서와 GTM 구현을 비교합니다.</p>

        <div className="v-upload-zone">
          <div className="upload-group">
            <div className={`upload-item ${externalSpecs ? 'success' : ''}`} onClick={() => specInputRef.current?.click()}>
              <FileSpreadsheet size={16} />
              <div className="upload-info">
                <span className="label">명세서 (CSV/JSON)</span>
                <span className="file-name">{externalSpecs ? `업로드됨 (${externalSpecs.length}개)` : '파일 선택'}</span>
              </div>
              <input
                type="file"
                ref={specInputRef}
                accept=".csv,.json"
                onChange={handleSpecUpload}
                style={{ display: 'none' }}
              />
            </div>
            <div className={`upload-item ${gtmJson ? 'success' : ''}`} onClick={() => gtmInputRef.current?.click()}>
              <Database size={16} />
              <div className="upload-info">
                <span className="label">GTM 컨테이너 (JSON)</span>
                <span className="file-name">{gtmJson ? '업로드됨' : '파일 선택'}</span>
              </div>
              <input
                type="file"
                ref={gtmInputRef}
                accept=".json"
                onChange={handleGTMUpload}
                style={{ display: 'none' }}
              />
            </div>
            {(externalSpecs || gtmJson) && (
              <button className="v-reset-btn" onClick={resetUploads} title="초기화">
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>

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
        {renderSection('기획대로 구현됨 (일치)', 'match', <CheckCircle size={16} color="#10b981" />)}
        {renderSection('수정이 필요한 태그 (조치 필요)', 'issue', <AlertCircle size={16} color="#ef4444" />)}
        {renderSection('GTM에는 있으나 명세에는 없음 (명세 외)', 'unspec', <HelpCircle size={16} color="#64748b" />)}

        {filter && results.filter(r => r.status === filter).length === 0 && (
           <div className="v-empty-filter">
             선택한 필터에 해당하는 결과가 없습니다.
           </div>
        )}
      </div>
    </div>
  );
};

export default VerificationDrawer;
