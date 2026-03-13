import React from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { Plus, Download, FileJson, Settings, X } from 'lucide-react';
import { storage } from '../../utils/storage';

import { useCSVExport } from '../hooks/useCSVExport';
import { useGtmExport } from '../hooks/useGtmExport';

const SpecList: React.FC = () => {
  const { specs, refreshSpecs, setSelectedElement, setEditingSpec, webviewRef } = useGTMAssistant();
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

  const handleAddPageSpec = () => {
    setSelectedElement(dummyElement);
    setEditingSpec({
      id: '',
      eventType: 'custom',
      selector: 'document',
      pageUrl: currentUrl,
      pageDescription: '',
      category: '',
      eventId: '',
      eventName: 'page_view',
      triggerDescription: 'Page View',
      parameters: [{ key: '', value: '' }],
      visible: true,
      createdAt: '',
    } as any);
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
          <button className="add-page-btn" onClick={handleAddPageSpec}>
            <Plus size={14} /> 페이지 추가
          </button>
          <button className="export-btn secondary" onClick={handleExportCSV}>
            <Download size={14} /> CSV
          </button>
          <button className="export-btn gtm" onClick={handleExportGTM}>
            <FileJson size={14} /> GTM JSON
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
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .spec-list {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .list-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stats {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }
        .btn-group {
          display: flex;
          gap: 6px;
        }
        .add-page-btn, .export-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .add-page-btn {
          background: #f3f4f6;
          color: #374151;
        }
        .add-page-btn:hover { background: #e5e7eb; }
        
        .export-btn.secondary {
          background: #f3f4f6;
          color: #374151;
        }
        .export-btn.gtm {
          background: #2563eb;
          color: white;
        }
        .export-btn:hover { opacity: 0.9; }

        .items {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .empty-state {
          padding: 40px;
          text-align: center;
          color: #9ca3af;
        }
        .spec-item {
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          transition: all 0.2s;
        }
        .spec-item:hover {
          border-color: #2563eb;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.05);
        }

        .item-info {
           display: flex;
           flex-direction: column;
           gap: 2px;
        }
        .event-header-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .event-type-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .event-type-badge.element { background: #ebf5ff; color: #2563eb; }
        .event-type-badge.page { background: #fef2f2; color: #dc2626; }
        .event-type-badge.custom { background: #f0fdf4; color: #16a34a; }
        .event-id { font-weight: 600; color: #3b82f6; font-size: 11px; }
        .event-name { font-weight: 600; font-size: 13px; }
        .page-url { font-size: 11px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; max-width: 250px; white-space: nowrap; }
        
        .item-actions button {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        .item-actions button:hover {
          background: #fee2e2;
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};

export default SpecList;
