import React, { useState } from 'react';
import { useGTMAssistant } from '../../../app/providers';
import { Download, Upload, Settings, X, Eye } from 'lucide-react';
import { storage } from '../../../shared/api/storage';
import './spec-list.css';

import { useCSVExport } from '../hooks/use-csv-export';
import { useGtmExport } from '../hooks/use-gtm-export';
import { useGtmImport, ImportResult } from '../hooks/use-gtm-import';
import ImportMergeDialog, { MergeResolution } from './import-merge-dialog';

const SpecList: React.FC = () => {
  const { specs, refreshSpecs, setSelectedElement, setEditingSpec, config, currentUrl } = useGTMAssistant();
  const { exportCSV } = useCSVExport();
  const { exportGtmJson } = useGtmExport();
  const { importGtmJson } = useGtmImport();

  const [mergeResult, setMergeResult] = useState<ImportResult | null>(null);

  const currentHostname = currentUrl ? new URL(currentUrl).hostname : 'localhost';

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      // soft delete: deletedAt 마킹
      const spec = specs.find(s => s.id === id);
      if (!spec) return;
      await storage.saveSpec(currentHostname, { ...spec, deletedAt: new Date().toISOString() });
      await refreshSpecs();
    }
  };

  const handleImportGtmJson = async () => {
    try {
      const { result } = await importGtmJson(currentHostname, specs);

      if (result.needsReview.length > 0) {
        setMergeResult(result);
      } else {
        await applyImport(result, []);
        alert(`불러오기 완료\n신규 추가 ${result.autoAdded.length}개 · 동일 ${result.autoSkipped.length}개 스킵`);
      }
    } catch (err: any) {
      if (err.message !== '파일을 선택하지 않았습니다.') {
        alert(err.message || '불러오기에 실패했습니다.');
      }
    }
  };

  const applyImport = async (result: ImportResult, resolutions: MergeResolution[]) => {
    const updatedSpecs = [...specs];

    // 자동 추가
    result.autoAdded.forEach(spec => {
      if (!updatedSpecs.find(s => s.id === spec.id)) {
        updatedSpecs.push(spec);
      }
    });

    // 검토 항목 해결
    resolutions.forEach(({ item, choice }) => {
      const idx = updatedSpecs.findIndex(s => s.id === item.stored.id);
      if (idx === -1) return;

      if (choice === 'use-gtm' && item.imported) {
        // GTM 버전으로 교체 (id 유지)
        updatedSpecs[idx] = { ...item.imported, id: item.stored.id, deletedAt: undefined };
      } else if (choice === 'keep-mine') {
        // 내 것 유지, deletedAt 제거 (deleted-in-app 복원)
        updatedSpecs[idx] = { ...item.stored, deletedAt: undefined };
      } else if (choice === 'delete') {
        // 삭제 확정: deletedAt 유지 (export 후 hard delete됨)
        // 아무것도 안 함
      }
    });

    const key = `specs_${currentHostname}`;
    await window.electronAPI.invoke('store:set', key, updatedSpecs);
    await refreshSpecs();
    setMergeResult(null);
  };

  const handleMergeApply = async (resolutions: MergeResolution[]) => {
    if (!mergeResult) return;
    await applyImport(mergeResult, resolutions);
  };

  const handleExportGtmJson = async () => {
    const { hardDeleteIds } = exportGtmJson(specs, config?.measurementId);

    // export 완료 후 deletedAt 있는 것들 hard delete
    if (hardDeleteIds.length > 0) {
      const remaining = specs.filter(s => !hardDeleteIds.includes(s.id));
      const key = `specs_${currentHostname}`;
      await window.electronAPI.invoke('store:set', key, remaining);
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

  const handleEdit = (spec: any) => {
    setSelectedElement({
      tagName: 'ELEMENT',
      rect: { top: 100, left: 100, width: 0, height: 0 } as any,
      selector: spec.selector,
    });
    setEditingSpec(spec);
  };

  const activeSpecs = specs.filter(s => !s.deletedAt);

  return (
    <div className="spec-list">
      <div className="list-actions">
        <div className="stats">총 {activeSpecs.length}개 항목</div>
        <div className="btn-group">
          <button className="export-btn secondary" onClick={handleImportGtmJson}>
            <Upload size={14} /> 불러오기
          </button>
          <button className="export-btn secondary" onClick={handleExportCSV}>
            <Download size={14} /> CSV
          </button>
          <button className="export-btn gtm" onClick={handleExportGtmJson}>
            <Download size={14} /> GTM JSON
          </button>
        </div>
      </div>

      <div className="items">
        {activeSpecs.length === 0 ? (
          <div className="empty-state">등록된 명세가 없습니다.</div>
        ) : (
          activeSpecs.map(spec => (
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

      {mergeResult && (
        <ImportMergeDialog
          result={mergeResult}
          onApply={handleMergeApply}
          onCancel={() => setMergeResult(null)}
        />
      )}
    </div>
  );
};

export default SpecList;
