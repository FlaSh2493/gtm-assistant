import React, { useEffect, useState } from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { EventParameter, EventSpec } from '../../types';
import { storage } from '../../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus, Trash2, Settings, Sparkles, Copy, Check } from 'lucide-react';


const SpecPopover: React.FC = () => {
  const { selectedElement, setSelectedElement, refreshSpecs, editingSpec, setEditingSpec, specs, config, currentUrl } = useGTMAssistant();
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

  // For Multi-Event support
  const [relatedSpecs, setRelatedSpecs] = useState<EventSpec[]>([]);
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    if (form.pageUrl) {
      navigator.clipboard.writeText(form.pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };



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
        const currentUrlVal = currentUrl || '';
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
            pageUrl: currentUrlVal,
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
  }, [selectedElement, editingSpec, specs, currentUrl]);

  const handleSwitchSpec = (id: string) => {
    const target = relatedSpecs.find(s => s.id === id);
    if (target) {
      setForm(target);
      setActiveSpecId(id);
    }
  };

  const currentHostname = currentUrl ? new URL(currentUrl).hostname : 'localhost';

  const handleAddNewEvent = () => {
    setActiveSpecId('new');
    setForm({
      id: undefined,
      eventType: 'custom',
      selector: form.selector,
      pageUrl: currentUrl || '',
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
          <div className="input-with-action">
            <input 
              type="text" 
              value={form.pageUrl} 
              onChange={e => setForm(prev => ({ ...prev, pageUrl: e.target.value }))}
                          />
            <button 
              type="button" 
              className="action-icon-btn" 
              onClick={handleCopyUrl}
              title="URL 복사"
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            </button>
          </div>
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
          <label>태그 설명</label>
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
              <label>대상 요소 위치 (Selector)</label>
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
                value={form.selector}
                onChange={e => setForm(prev => ({ ...prev, selector: e.target.value }))}
                placeholder="CSS Selector"
                              />
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
    </div>
  );
};

export default SpecPopover;
