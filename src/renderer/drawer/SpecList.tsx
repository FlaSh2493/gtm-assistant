import React from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { Plus, Download, FileJson, Settings, X, Eye } from 'lucide-react';
import { storage } from '../../utils/storage';
import './drawer.css';

import { useCSVExport } from '../hooks/useCSVExport';
import { useGtmExport } from '../hooks/useGtmExport';

const SpecList: React.FC = () => {
  const { specs, refreshSpecs, setSelectedElement, setEditingSpec, webviewRef, config } = useGTMAssistant();
  const { exportCSV } = useCSVExport();
  const { exportGtmJson } = useGtmExport();

  const currentUrl = webviewRef.current?.getURL() || '';
  const currentHostname = currentUrl ? new URL(currentUrl).hostname : 'localhost';

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await storage.deleteSpec(currentHostname, id);
      await refreshSpecs();
    }
  };

  const handleExportCSV = () => {
    const defaultColumns: any[] = [
      { id: '1', label: '페이지URL', field: 'pageUrl', enabled: true, order: 1 },
      { id: '2', label: '이벤트ID', field: 'eventId', enabled: true, order: 2 },
      { id: '3', label: '이벤트명', field: 'eventName', enabled: true, order: 3 },
      { id: '4', label: '트리거설명', field: 'triggerDescription', enabled: true, order: 4 },
      { id: '5', label: 'CSS Selector', field: 'selector', enabled: true, order: 5 },
      { id: '6', label: '비고', field: 'note', enabled: true, order: 6 },
      { id: '7', label: '파라미터', field: 'parameters', enabled: true, order: 7 },
    ];
    exportCSV(specs, defaultColumns);
  };

  const handleExportGTM = () => {
    exportGtmJson(specs);
  };

  const dummyElement: any = {
    tagName: 'BODY',
    rect: { top: 0, left: 0, width: 0, height: 0 },
    selector: 'document'
  };



  const handleEdit = (spec: any) => {
    // We don't have direct access to the element, but we can send the selector to the popover
    // The popover will try to get the rect from the webview if needed.
    setSelectedElement({
      tagName: 'ELEMENT',
      rect: { top: 100, left: 100, width: 0, height: 0 } as any, // Placeholder, popover will adjust
      selector: spec.selector
    });
    setEditingSpec(spec);
  };

  return (
    <div className="spec-list">
      <div className="list-actions">
        <div className="stats">총 {specs.length}개 항목</div>
        <div className="btn-group">

          <button className="export-btn secondary" onClick={handleExportCSV}>
            <Download size={14} /> CSV
          </button>
          <button className="export-btn gtm" onClick={handleExportGTM}>
           <Download size={14} /> GTM JSON
          </button>
        </div>
      </div>

      <div className="items">
        {specs.length === 0 ? (
          <div className="empty-state">등록된 명세가 없습니다.</div>
        ) : (
          specs.map(spec => (
            <div key={spec.id} className="spec-item">
              <div className="item-info">
                <div className="event-header-row">
                  <span className="event-type-badge custom">Event</span>
                  <span className="event-id">{spec.eventId}</span>
                </div>
                <div className="event-name">{spec.eventName}</div>
                <span className="page-url">{spec.pageUrl}</span>
              </div>
              <div className="item-actions">
                {config.mode === 'spec' ? (
                  <>
                    <button onClick={() => handleEdit(spec)} title="수정">
                      <Settings size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(spec.id)}
                      title="삭제"
                      className="delete-btn"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => handleEdit(spec)} title="상세보기">
                    <Eye size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SpecList;
