import React from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { Download, Eye, EyeOff, Trash2, Edit, Plus } from 'lucide-react';
import { storage } from '../../utils/storage';

import { useCSVExport } from '../hooks/useCSVExport';

const SpecList: React.FC = () => {
  const { specs, refreshSpecs, setSelectedElement, setEditingSpec } = useGTMAssistant();
  const { exportCSV } = useCSVExport();

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await storage.deleteSpec(window.location.hostname, id);
      await refreshSpecs();
    }
  };

  const handleExport = () => {
    const defaultColumns: any[] = [
      { id: '1', label: '페이지URL', field: 'pageUrl', enabled: true, order: 1 },
      { id: '2', label: '이벤트ID', field: 'eventId', enabled: true, order: 2 },
      { id: '3', label: '이벤트명', field: 'eventName', enabled: true, order: 3 },
      { id: '4', label: '트리거설명', field: 'triggerDescription', enabled: true, order: 4 },
      { id: '5', label: 'CSS Selector', field: 'selector', enabled: true, order: 5 },
      { id: '6', label: '파라미터', field: 'parameters', enabled: true, order: 6 },
    ];
    exportCSV(specs, defaultColumns);
  };

  const handleAddPageSpec = () => {
    // Open popover with 'page' type and placeholder selector
    setSelectedElement(document.body); // Use body as dummy target
    setEditingSpec({
      id: '', // Will be generated in Popover
      eventType: 'page',
      selector: 'document',
      pageUrl: window.location.href,
      pageDescription: '',
      category: '',
      eventId: '',
      eventName: '',
      triggerDescription: 'Page View',
      parameters: [{ key: '', value: '' }],
      visible: true,
      createdAt: '',
    } as any);
  };

  const handleEdit = (spec: any) => {
    // Try to find the element on the page to position the popover
    let targetEl = null;
    if (spec.selector === 'document') {
      targetEl = document.body;
    } else if (spec.selector) {
      try {
        targetEl = document.querySelector(spec.selector) as HTMLElement;
      } catch (e) {
        // Ignore invalid selectors
      }
    }
    
    // Fallback to body if element not found, so popover still opens
    setSelectedElement(targetEl || document.body); 
    setEditingSpec(spec);
  };

  return (
    <div className="spec-list">
      <div className="list-actions">
        <div className="stats">총 {specs.length}개 항목</div>
        <div className="btn-group">
          <button className="add-page-btn" onClick={handleAddPageSpec}>
            <Plus size={14} /> 페이지 이벤트 추가
          </button>
          <button className="export-btn" onClick={handleExport}>
            <Download size={14} /> CSV 내보내기
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
                  <span className={`event-type-badge ${spec.eventType || 'element'}`}>
                    {spec.eventType === 'page' ? 'Page' : 'Elem'}
                  </span>
                  <span className="event-id">{spec.eventId}</span>
                </div>
                <span className="event-name">{spec.eventName}</span>
                <span className="page-url">{spec.pageUrl}</span>
              </div>
              <div className="item-actions">
                <button onClick={() => handleEdit(spec)} title="수정"><Edit size={16} /></button>
                <button onClick={() => handleDelete(spec.id)} title="삭제"><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .spec-list {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .list-actions {
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f3f4f6;
          background: #f9fafb;
        }
        .stats { color: #6b7280; font-weight: 500; }
        .export-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #3b82f6;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
        }
        .items {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .empty-state {
          padding: 40px;
          text-align: center;
          color: #9ca3af;
        }
        .spec-item {
          padding: 10px 12px;
          border: 1px solid #f3f4f6;
          border-radius: 8px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.2s;
        }
        .spec-item:hover {
          background: #f9fafb;
        }
        .item-info {
           display: flex;
           flex-direction: column;
           gap: 2px;
        }
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
