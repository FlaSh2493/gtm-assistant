import React, { useEffect, useState } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { useSelector } from '../hooks/useSelector';
import { EventParameter, EventSpec } from '../../types';
import { storage } from '../../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus, Trash2, CheckCircle } from 'lucide-react';

const SpecPopover: React.FC = () => {
  const { selectedElement, setSelectedElement, refreshSpecs, editingSpec, setEditingSpec, specs } = useGTMAssistant();
  const { generateSelector, isUnique } = useSelector();

  const [form, setForm] = useState<Partial<EventSpec>>({
    eventType: 'element',
    pageUrl: window.location.href,
    pageDescription: '',
    category: '',
    eventId: '',
    eventName: '',
    triggerDescription: '',
    selector: '',
    parameters: [{ key: '' }],
    note: '',
  });

  const [selectorValid, setSelectorValid] = useState(true);
  
  // For Multi-Event support
  const [relatedSpecs, setRelatedSpecs] = useState<EventSpec[]>([]);
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);

  // Initialize form when selectedElement or editingSpec changes
  useEffect(() => {
    if (editingSpec) {
      setForm(editingSpec);
      setActiveSpecId(editingSpec.id);
      
      // Find other specs for the same selector
      if (editingSpec.selector && editingSpec.selector !== 'document') {
        const related = specs.filter(s => s.selector === editingSpec.selector && s.id !== editingSpec.id);
        setRelatedSpecs([editingSpec, ...related]);
      } else if (editingSpec.selector === 'document') {
         // For page events, show all page events for this specific URL
         const related = specs.filter(s => s.eventType === 'page' && s.pageUrl === editingSpec.pageUrl);
         setRelatedSpecs(related);
      }
    } else if (selectedElement) {
      const selector = generateSelector(selectedElement);
      
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
          pageUrl: window.location.href,
          elementSnapshot: selectedElement.outerHTML.substring(0, 500),
          id: undefined,
          createdAt: undefined,
          eventId: '',
          eventName: '',
          triggerDescription: '',
          parameters: [{ key: '' }],
          note: '',
        });
      }
    }
  }, [selectedElement, editingSpec, generateSelector, specs]);

  useEffect(() => {
    if (form.selector && form.selector !== 'document') {
      setSelectorValid(isUnique(form.selector));
    } else {
      setSelectorValid(true);
    }
  }, [form.selector, isUnique]);

  const handleSwitchSpec = (id: string) => {
    const target = relatedSpecs.find(s => s.id === id);
    if (target) {
      setForm(target);
      setActiveSpecId(id);
    }
  };

  const handleAddNewEvent = () => {
    setActiveSpecId('new');
    setForm({
      id: undefined,
      eventType: form.eventType || 'element',
      selector: form.selector,
      pageUrl: window.location.href,
      elementSnapshot: form.elementSnapshot,
      eventId: '',
      eventName: '',
      triggerDescription: '',
      parameters: [{ key: '' }],
      note: '',
    });
  };

  const handleAddParam = () => {
    setForm(prev => ({
      ...prev,
      parameters: [...(prev.parameters || []), { key: '' }]
    }));
  };

  const handleRemoveParam = (index: number) => {
    setForm(prev => ({
      ...prev,
      parameters: (prev.parameters || []).filter((_, i) => i !== index)
    }));
  };

  const handleParamChange = (index: number, field: keyof EventParameter, value: string) => {
    const newParams = [...(form.parameters || [])];
    newParams[index][field] = value;
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

    await storage.saveSpec(window.location.hostname, spec);
    await refreshSpecs();
    handleClose();
  };

  const handleDelete = async () => {
    if (form.id && confirm('정말 삭제하시겠습니까?')) {
        await storage.deleteSpec(window.location.hostname, form.id);
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
        <div className={`event-type-badge ${form.eventType || 'element'}`}>
          {form.eventType === 'page' ? 'Page Event' : 'Element Click'}
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
            placeholder={form.eventType === 'page' ? '페이지 로드 시' : '상품 상세 페이지에서 장바구니 클릭 시'}
            value={form.triggerDescription} 
            onChange={e => setForm(prev => ({ ...prev, triggerDescription: e.target.value }))}
          />
        </div>

        {form.eventType !== 'page' && (
          <div className="form-group">
            <label>CSS Selector</label>
            <div className="selector-input-wrapper">
              <input 
                type="text" 
                className={selectorValid ? '' : 'invalid'}
                value={form.selector} 
                onChange={e => setForm(prev => ({ ...prev, selector: e.target.value }))}
              />
              {selectorValid && <CheckCircle size={16} className="valid-icon" />}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>매개변수 측정항목 (Event Parameters)</label>
          <div className="params-list">
            {(form.parameters || []).map((p, i) => (
                <div key={i} className="param-row">
                <input 
                    type="text" 
                    placeholder="parameter_key (예: item_id)" 
                    value={p.key} 
                    onChange={e => handleParamChange(i, 'key', e.target.value)}
                />
                <button className="remove-param-btn" onClick={() => handleRemoveParam(i)}>
                    <Trash2 size={14} />
                </button>
                </div>
            ))}
          </div>
          <button className="add-param-btn" onClick={handleAddParam}>
            <Plus size={14} /> 매개변수 추가
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
            gap: 6px;
            margin-bottom: 8px;
        }
        .param-row { display: flex; gap: 6px; }
        .param-row input { flex: 1; }
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
