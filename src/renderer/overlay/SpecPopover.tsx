import React, { useEffect, useState, useCallback } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { EventParameter, EventSpec } from '../../types';
import { storage } from '../../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus, Trash2, CheckCircle, Settings, Sparkles } from 'lucide-react';


const SpecPopover: React.FC = () => {
  const { selectedElement, setSelectedElement, refreshSpecs, editingSpec, setEditingSpec, specs, webviewRef } = useGTMAssistant();
  const [form, setForm] = useState<Partial<EventSpec>>({
    eventType: 'element',
    pageUrl: '',
    pageDescription: '',
    category: '',
    eventId: '',
    eventName: '',
    selector: '',
    parameters: [{ key: '', type: 'dataLayer' }],
    note: '',
  });

  const [selectorValid, setSelectorValid] = useState(true);
  
  // For Multi-Event support
  const [relatedSpecs, setRelatedSpecs] = useState<EventSpec[]>([]);
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);



  // Initialize form when selectedElement or editingSpec changes
  useEffect(() => {
    const initForm = async () => {
      if (editingSpec) {
        setForm(editingSpec);
        setActiveSpecId(editingSpec.id);
        
        // Find other specs for the same selector
        if (editingSpec.selector && editingSpec.selector !== 'document') {
          const related = specs.filter(s => s.selector === editingSpec.selector);
          // Sort by creation date to keep tab order consistent (#1, #2, #3...)
          const sorted = [...related].sort((a, b) => 
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          );
          setRelatedSpecs(sorted);
        } else if (editingSpec.selector === 'document') {
           // For page events, show all page events for this specific URL
           const related = specs.filter(s => s.eventType === 'page' && s.pageUrl === editingSpec.pageUrl);
           const sorted = [...related].sort((a, b) => 
             new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
           );
           setRelatedSpecs(sorted);
        }
      } else if (selectedElement) {
        // Since we can't directly use selector logic here, we'd ideally have it in preload
        // OR we send a message to webview to generate it for us.
        // For now, let's assume 'selector' might be in selectedElement if pre-calculated, 
        // or we just use a placeholder.
        const currentUrl = webviewRef.current?.getURL() || '';
        const selector = selectedElement.selector || 'pending...';
        
        // Check for existing specs on this selector
        const existing = specs.filter(s => s.selector === selector);
        
        if (existing.length > 0) {
          setRelatedSpecs(existing);
          setForm(existing[0]);
          setActiveSpecId(existing[0].id);
        } else {
          setRelatedSpecs([]);
          setActiveSpecId(null);
          setForm({ 
            eventType: 'element',
            selector,
            pageUrl: currentUrl,
            elementSnapshot: selectedElement.outerHTML?.substring(0, 500),
            id: undefined,
            createdAt: undefined,
            eventId: '',
            eventName: '',
            parameters: [{ key: '', type: 'dataLayer' }],
            note: '',
          });
        }
      }
    };

    initForm();
  }, [selectedElement, editingSpec, specs, webviewRef]);

  // Selector validation is tricky in webview - omit for now or Implement via IPC
  useEffect(() => {
    setSelectorValid(true);
  }, [form.selector]);

  const handleSwitchSpec = (id: string) => {
    const target = relatedSpecs.find(s => s.id === id);
    if (target) {
      setForm(target);
      setActiveSpecId(id);
    }
  };

  const currentHostname = webviewRef.current ? new URL(webviewRef.current.getURL()).hostname : 'localhost';

  const handleAddNewEvent = () => {
    setActiveSpecId('new');
    setForm({
      id: undefined,
      eventType: 'custom',
      selector: form.selector,
      pageUrl: webviewRef.current?.getURL() || '',
      elementSnapshot: form.elementSnapshot,
      eventId: '',
      eventName: '',
      parameters: [{ key: '', type: 'dataLayer' }],
      note: '',
    });
  };

  const handleAddParam = () => {
    setForm(prev => ({
      ...prev,
      parameters: [...(prev.parameters || []), { key: '', type: 'dataLayer' }]
    }));
  };

  const handleRemoveParam = (index: number) => {
    setForm(prev => ({
      ...prev,
      parameters: (prev.parameters || []).filter((_, i) => i !== index)
    }));
  };

  const handleParamChange = (index: number, field: keyof EventParameter, value: any) => {
    const newParams = [...(form.parameters || [])];
    newParams[index] = { ...newParams[index], [field]: value };
    setForm(prev => ({ ...prev, parameters: newParams }));
  };

  const handleClose = () => {
    setSelectedElement(null);
    setEditingSpec(null);
  };

  const handleSave = async () => {
    const spec: EventSpec = {
      ...(form as EventSpec),
      id: (activeSpecId === 'new' || !form.id) ? uuidv4() : form.id,
      createdAt: form.createdAt || new Date().toISOString(),
      visible: true,
      parameters: form.parameters?.filter(p => p.key) || [],
    };

    await storage.saveSpec(currentHostname, spec);
    await refreshSpecs();
    handleClose();
  };

  const handleDelete = async () => {
    if (form.id && confirm('정말 삭제하시겠습니까?')) {
        await storage.deleteSpec(currentHostname, form.id);
        await refreshSpecs();
        handleClose();
    }
  };

  if (!selectedElement && !editingSpec) return null;

  return (
    <div className="spec-popover">
      <div className="popover-header">
        <div className="header-title-area">
            <h3>{editingSpec || (activeSpecId && activeSpecId !== 'new') ? '이벤트 명세 수정' : '이벤트 명세 작성'}</h3>
            {relatedSpecs.length > 0 && form.selector !== 'document' && (
                <div className="multi-event-tabs">
                    {relatedSpecs.map((s, idx) => (
                        <button 
                            key={s.id} 
                            className={`event-tab ${activeSpecId === s.id ? 'active' : ''}`}
                            onClick={() => handleSwitchSpec(s.id)}
                        >
                            #{idx + 1}
                        </button>
                    ))}
                    <button 
                        className={`event-tab add ${activeSpecId === 'new' ? 'active' : ''}`}
                        onClick={handleAddNewEvent}
                        title="다른 이벤트 추가"
                    >
                        <Plus size={12} />
                    </button>
                </div>
            )}
        </div>
        <button className="close-btn" onClick={handleClose}><X size={18} /></button>
      </div>
      
      <div className="popover-body">
        <div className="form-info-tip">
          🎯 모든 이벤트는 <strong>맞춤 이벤트(Custom Event)</strong>로 생성됩니다.
        </div>
        
        <div className="form-group">
          <label>페이지 URL</label>
          <input 
            type="text" 
            value={form.pageUrl} 
            onChange={e => setForm(prev => ({ ...prev, pageUrl: e.target.value }))}
          />
        </div>
        
        <div className="form-row">
            <div className="form-group">
                <label>이벤트 ID</label>
                <input 
                    type="text" 
                    placeholder="EVT-001"
                    value={form.eventId} 
                    onChange={e => setForm(prev => ({ ...prev, eventId: e.target.value }))}
                />
            </div>
            <div className="form-group">
                <label>GA4 이벤트명</label>
                <input 
                    type="text" 
                    placeholder="click_button"
                    value={form.eventName} 
                    onChange={e => setForm(prev => ({ ...prev, eventName: e.target.value }))}
                />
            </div>
        </div>
        
        <div className="form-group">
          <label>트리거 설명</label>
          <input 
            type="text" 
            placeholder={form.eventType === 'page' ? '페이지 로드 시' : '상품 상세 페이지 혹은 버튼 클릭 시'}
            value={form.triggerDescription || ''} 
            onChange={e => setForm(prev => ({ ...prev, triggerDescription: e.target.value }))}
          />
        </div>


        {form.eventType !== 'page' && (
          <div className="form-group">
            <div className="label-with-badge">
              <label>CSS Selector (화면 표시/메모용)</label>
              <button 
                type="button"
                className={`recommend-toggle-badge ${showRecommendations ? 'active' : ''}`}
                onClick={() => setShowRecommendations(!showRecommendations)}
              >
                <Sparkles size={11} /> 추천
              </button>
            </div>
            <div className="selector-input-wrapper">
              <input 
                type="text" 
                className={selectorValid ? '' : 'invalid'}
                value={form.selector} 
                onChange={e => setForm(prev => ({ ...prev, selector: e.target.value }))}
                placeholder="CSS Selector"
              />
              {selectorValid && <CheckCircle size={16} className="valid-icon" />}
            </div>

            {showRecommendations && (
              <div className="selector-recommendations">
                <span className="recommend-label">유니크 셀렉터 제안:</span>
                <div className="recommend-list">
                  {selectedElement?.recommendations && selectedElement.recommendations.length > 0 ? (
                    selectedElement.recommendations.map((rec, i) => (
                      <button 
                        key={i} 
                        type="button"
                        className={`recommend-btn ${form.selector === rec ? 'active' : ''}`}
                        onClick={() => {
                          setForm(prev => ({ ...prev, selector: rec }));
                          setShowRecommendations(false);
                        }}
                        title={rec}
                      >
                        {rec}
                      </button>
                    ))
                  ) : (
                    <span className="no-recommend-msg">추천할 유니크 셀렉터가 없습니다.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <div className="param-label-row">
            <label>매개변수 측정항목 (Event Parameters)</label>
          </div>


          <div className="params-list">
            {(form.parameters || []).map((p, i) => (
                <div key={i} className="param-row">
                  <input
                      type="text"
                      className="param-key-input"
                      placeholder="키 (아이템ID)"
                      value={p.key}
                      onChange={e => handleParamChange(i, 'key', e.target.value)}
                  />
                  <input
                      type="text"
                      className="param-value-input"
                      placeholder="설명"
                      value={p.description || ''}
                      onChange={e => handleParamChange(i, 'description', e.target.value)}
                  />
                  <div className="param-actions">
                    <button className="remove-param-btn" onClick={() => handleRemoveParam(i)}>
                        <Trash2 size={14} />
                    </button>
                  </div>
                </div>
            ))}
          </div>
          <button className="add-param-btn" onClick={handleAddParam}>
            <Plus size={14} /> 매개변수 직접 추가
          </button>
        </div>
      </div>

      <div className="popover-footer">
        {form.id && (
            <button className="delete-btn" onClick={handleDelete}>
                <Trash2 size={14} /> 삭제
            </button>
        )}
        <div style={{ flex: 1 }}></div>
        <button className="cancel-btn" onClick={handleClose}>취소</button>
        <button className="save-btn" onClick={handleSave}>저장</button>
      </div>

      <style>{`
        .spec-popover {
          display: flex;
          flex-direction: column;
          font-size: 13px;
          color: #1f2937;
        }
        .form-info-tip {
          font-size: 11px;
          background: #f0fdf4;
          color: #16a34a;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          border: 1px solid #bbf7d0;
        }

        .popover-header {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-title-area {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .multi-event-tabs {
            display: flex;
            gap: 4px;
        }
        .event-tab {
            width: 24px;
            height: 24px;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            font-size: 10px;
            font-weight: 700;
            color: #6b7280;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .event-tab:hover { background: #f3f4f6; }
        .event-tab.active {
            background: #2563eb;
            color: white;
            border-color: #2563eb;
        }
        .event-tab.add { color: #2563eb; border-style: dashed; }
        .event-tab.add:hover { background: #eff6ff; }
        
        .popover-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
        }
        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          padding: 4px;
          display: flex;
        }
        .popover-body {
          padding: 16px;
          max-height: 450px;
          overflow-y: auto;
        }
        .form-group { margin-bottom: 16px; }
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
          color: #374151;
          font-size: 12px;
        }
        .form-group input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          box-sizing: border-box;
          font-size: 13px;
        }
        .form-group input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .form-row { display: flex; gap: 12px; }
        .form-row .form-group { flex: 1; }
        .label-with-badge {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .label-with-badge label { margin-bottom: 0 !important; }
        .recommend-toggle-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        .recommend-toggle-badge:hover {
          background: #e5e7eb;
          color: #374151;
        }
        .recommend-toggle-badge.active {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #2563eb;
        }
        .selector-input-wrapper { position: relative; }
        .valid-icon {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #10b981;
        }
        input.invalid {
          border-color: #ef4444;
          background-color: #fef2f2;
        }
        
        .params-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
        }
        .param-row { 
            display: flex; 
            gap: 6px; 
            align-items: center;
        }
        .param-key-input { flex: 1.2; font-family: monospace; }
        .param-value-input { flex: 1.8; color: #6b7280; }
        .param-actions { display: flex; align-items: center; gap: 4px; }
        
        .selector-recommendations {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .recommend-label {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
        }
        .recommend-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .recommend-btn {
          font-family: monospace;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #4b5563;
          cursor: pointer;
          transition: all 0.2s;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .recommend-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }
        .recommend-btn.active {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #1d4ed8;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.1);
        }
        .no-recommend-msg {
          font-size: 11px;
          color: #9ca3af;
          font-style: italic;
        }
        
        .remove-param-btn {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          border-radius: 4px;
        }
        .remove-param-btn:hover { background: #fee2e2; color: #ef4444; }
        
        .add-param-btn {
          background: white;
          border: 1px dashed #d1d5db;
          width: 100%;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #6b7280;
          font-weight: 500;
          font-size: 12px;
          transition: all 0.2s;
        }
        .add-param-btn:hover { background: #f9fafb; border-color: #9ca3af; color: #374151; }


        .popover-footer {
          padding: 12px 16px;
          border-top: 1px solid #f3f4f6;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          background: #f9fafb;
        }
        .popover-footer button {
          padding: 8px 20px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        }
        .cancel-btn { background: white; border: 1px solid #d1d5db; color: #374151; }
        .delete-btn { 
            background: white; 
            border: 1px solid #fee2e2; 
            color: #ef4444; 
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .delete-btn:hover { background: #fee2e2; }
        .save-btn { background: #2563eb; border: none; color: white; }
        .save-btn:hover { background: #1d4ed8; }
        
        .event-type-badge {
          display: inline-block;
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 800;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .event-type-badge.element { background: #dcfce7; color: #15803d; }
        .event-type-badge.page { background: #fef3c7; color: #92400e; }
      `}</style>
    </div>
  );
};

export default SpecPopover;
