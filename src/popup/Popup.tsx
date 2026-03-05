import React, { useEffect, useState } from 'react';
import { AppConfig } from '../types';
import { storage } from '../utils/storage';
import { Settings, MousePointer2, ClipboardCheck, Trash2, Plus, Power } from 'lucide-react';

const Popup: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [newAttr, setNewAttr] = useState('');

  useEffect(() => {
    storage.getConfig().then(setConfig);
  }, []);

  const handleToggleEnabled = async () => {
    if (!config) return;
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  const handleModeChange = async (mode: 'spec' | 'verify') => {
    if (!config) return;
    const newConfig = { ...config, mode };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  const handleAddAttr = async () => {
    if (!config || !newAttr) return;
    const newConfig = { 
      ...config, 
      selector: { 
        dataAttributes: [...config.selector.dataAttributes, newAttr] 
      } 
    };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
    setNewAttr('');
  };

  const handleRemoveAttr = async (attr: string) => {
    if (!config) return;
    const newConfig = { 
      ...config, 
      selector: { 
        dataAttributes: config.selector.dataAttributes.filter(a => a !== attr) 
      } 
    };
    setConfig(newConfig);
    await storage.setConfig(newConfig);
  };

  if (!config) return <div className="loading">로드 중...</div>;

  return (
    <div className="popup-container">
      <header>
        <div className="logo">🏷</div>
        <h1>GTM Tag Assistant</h1>
        <button 
          className={`enable-toggle ${config.enabled ? 'on' : 'off'}`}
          onClick={handleToggleEnabled}
          title={config.enabled ? '끄기' : '켜기'}
        >
          <Power size={18} />
        </button>
      </header>

      <section className="mode-section">
        <label>실행 모드</label>
        <div className="mode-toggle">
          <button 
            className={config.mode === 'spec' ? 'active' : ''} 
            onClick={() => handleModeChange('spec')}
          >
            <MousePointer2 size={16} /> 명세 작성
          </button>
          <button 
            className={config.mode === 'verify' ? 'active' : ''} 
            onClick={() => handleModeChange('verify')}
          >
            <ClipboardCheck size={16} /> GTM 검수
          </button>
        </div>
      </section>

      <section className="config-section">
        <label><Settings size={14} /> Selector 우선순위</label>
        <div className="attr-list">
          {config.selector.dataAttributes.map(attr => (
            <div key={attr} className="attr-item">
              <span>{attr}</span>
              <button onClick={() => handleRemoveAttr(attr)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
        <div className="add-attr">
          <input 
            type="text" 
            placeholder="data-testid" 
            value={newAttr}
            onChange={e => setNewAttr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddAttr()}
          />
          <button onClick={handleAddAttr}><Plus size={16} /></button>
        </div>
      </section>

      <footer className="popup-footer">
        <span className="version">v2.0.0</span>
      </footer>

      <style>{`
        body { margin: 0; padding: 0; width: 320px; font-family: sans-serif; }
        .popup-container { padding: 16px; background: white; color: #1f2937; }
        header { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        header .logo { font-size: 24px; }
        header h1 { font-size: 18px; margin: 0; font-weight: 700; color: #111827; flex: 1; }
        
        .enable-toggle {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            transition: all 0.2s;
        }
        .enable-toggle.on { color: #10b981; background: #ecfdf5; }
        .enable-toggle.off { color: #ef4444; background: #fef2f2; }
        .enable-toggle:hover { transform: scale(1.1); }

        section label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; }

        .mode-toggle { display: flex; gap: 8px; }
        .mode-toggle button {
            flex: 1;
            padding: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            border: 1px solid #e5e7eb;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #4b5563;
            transition: all 0.2s;
        }
        .mode-toggle button.active {
            background: #3b82f6;
            border-color: #3b82f6;
            color: white;
            box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
        }

        .attr-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .attr-item {
            background: #f3f4f6;
            padding: 4px 8px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: #374151;
        }
        .attr-item button {
            background: none;
            border: none;
            color: #9ca3af;
            cursor: pointer;
            padding: 0;
            display: flex;
        }
        
        .add-attr { display: flex; gap: 4px; }
        .add-attr input {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 12px;
        }
        .add-attr button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 6px;
            border-radius: 6px;
            cursor: pointer;
        }

        .popup-footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid #f3f4f6; text-align: center; }
        .version { font-size: 10px; color: #9ca3af; }
      `}</style>
    </div>
  );
};

export default Popup;
