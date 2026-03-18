import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { EventSpec } from '../../../entities/spec/model/types';
import { MergeItem, ImportResult } from '../hooks/use-gtm-import';

interface Props {
  result: ImportResult;
  onApply: (resolutions: MergeResolution[]) => void;
  onCancel: () => void;
}

export interface MergeResolution {
  item: MergeItem;
  choice: 'use-gtm' | 'keep-mine' | 'delete';
}

const FIELD_LABELS: Record<string, string> = {
  eventName: 'GA4 이벤트명',
  category: '카테고리',
  triggerDescription: '태그 설명',
  selector: 'CSS Selector',
  pageUrl: '페이지 URL',
  note: '비고',
  parameters: '매개변수',
};

const ImportMergeDialog: React.FC<Props> = ({ result, onApply, onCancel }) => {
  const [resolutions, setResolutions] = useState<Record<string, 'use-gtm' | 'keep-mine' | 'delete'>>(() => {
    const defaults: Record<string, 'use-gtm' | 'keep-mine' | 'delete'> = {};
    result.needsReview.forEach(item => {
      defaults[item.stored.id] = item.type === 'deleted-in-app' ? 'delete' : 'keep-mine';
    });
    return defaults;
  });

  const [expandedId, setExpandedId] = useState<string | null>(
    result.needsReview[0]?.stored.id ?? null
  );

  const setChoice = (id: string, choice: 'use-gtm' | 'keep-mine' | 'delete') => {
    setResolutions(prev => ({ ...prev, [id]: choice }));
  };

  const setAll = (choice: 'use-gtm' | 'keep-mine') => {
    const next: Record<string, 'use-gtm' | 'keep-mine' | 'delete'> = {};
    result.needsReview.forEach(item => {
      next[item.stored.id] = item.type === 'deleted-in-app'
        ? (choice === 'use-gtm' ? 'delete' : 'keep-mine')
        : choice;
    });
    setResolutions(next);
  };

  const handleApply = () => {
    const resolved: MergeResolution[] = result.needsReview.map(item => ({
      item,
      choice: resolutions[item.stored.id],
    }));
    onApply(resolved);
  };

  const hasReview = result.needsReview.length > 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          padding: '24px 28px', width: 540,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>불러오기 결과</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        {/* 자동 처리 요약 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
          {result.autoAdded.length > 0 && <span>✅ 신규 추가 {result.autoAdded.length}개</span>}
          {result.autoSkipped.length > 0 && <span>⏭ 동일 {result.autoSkipped.length}개 스킵</span>}
          {result.needsReview.length > 0 && <span>⚠️ 검토 필요 {result.needsReview.length}개</span>}
        </div>

        {hasReview && (
          <>
            {/* 전체 일괄 선택 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center', marginRight: 4 }}>전체:</span>
              <button onClick={() => setAll('use-gtm')} style={allBtn}>GTM으로</button>
              <button onClick={() => setAll('keep-mine')} style={allBtn}>내 것 유지</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.needsReview.map(item => {
                const { stored, imported, type, diffFields } = item;
                const isExpanded = expandedId === stored.id;
                const choice = resolutions[stored.id];

                return (
                  <div
                    key={stored.id}
                    style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}
                  >
                    {/* 항목 헤더 */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', cursor: 'pointer',
                        background: isExpanded ? '#f9fafb' : '#fff',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : stored.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{stored.eventName}</span>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 10,
                          background: type === 'modified' ? '#fef3c7' : '#fee2e2',
                          color: type === 'modified' ? '#92400e' : '#991b1b',
                        }}>
                          {type === 'modified' ? '수정됨' : '앱에서 삭제됨'}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>

                    {/* 펼쳐진 diff + 선택 */}
                    {isExpanded && (
                      <div style={{ padding: '0 14px 12px' }}>
                        {type === 'modified' && diffFields && imported && (
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 10 }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6' }}>
                                <th style={thStyle}>필드</th>
                                <th style={thStyle}>내 것</th>
                                <th style={thStyle}>GTM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diffFields.map(field => (
                                <tr key={field} style={{ background: '#fffbeb' }}>
                                  <td style={tdStyle}>{FIELD_LABELS[field] ?? field}</td>
                                  <td style={tdStyle}>{formatValue(stored[field as keyof EventSpec])}</td>
                                  <td style={tdStyle}>{formatValue(imported[field as keyof EventSpec])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {type === 'deleted-in-app' && (
                          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                            앱에서 삭제했지만 GTM에 아직 남아있습니다.
                          </p>
                        )}

                        {/* 선택 버튼 */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {type === 'modified' && (
                            <>
                              <ChoiceButton label="내 것 유지" active={choice === 'keep-mine'} onClick={() => setChoice(stored.id, 'keep-mine')} />
                              <ChoiceButton label="GTM으로 교체" active={choice === 'use-gtm'} onClick={() => setChoice(stored.id, 'use-gtm')} />
                            </>
                          )}
                          {type === 'deleted-in-app' && (
                            <>
                              <ChoiceButton label="삭제 확정" active={choice === 'delete'} onClick={() => setChoice(stored.id, 'delete')} />
                              <ChoiceButton label="복원 (GTM 기준)" active={choice === 'keep-mine'} onClick={() => setChoice(stored.id, 'keep-mine')} />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={secondaryBtn}>취소</button>
          <button onClick={handleApply} style={primaryBtn}>적용</button>
        </div>
      </motion.div>
    </div>
  );
};

function formatValue(val: any): string {
  if (val === undefined || val === null || val === '') return '—';
  if (Array.isArray(val)) return val.map((p: any) => p.key).filter(Boolean).join(', ') || '—';
  return String(val);
}

const ChoiceButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 12, cursor: 'pointer',
      border: `1.5px solid ${active ? '#2563eb' : '#e5e7eb'}`,
      background: active ? '#eff6ff' : '#fff',
      color: active ? '#1d4ed8' : '#374151',
      fontWeight: active ? 600 : 400,
    }}
  >
    {label}
  </button>
);

const thStyle: React.CSSProperties = { padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' };
const tdStyle: React.CSSProperties = { padding: '5px 8px', borderTop: '1px solid #f3f4f6', color: '#374151', wordBreak: 'break-all' };
const allBtn: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 11, cursor: 'pointer', color: '#374151' };
const primaryBtn: React.CSSProperties = { padding: '7px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const secondaryBtn: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 13, cursor: 'pointer' };

export default ImportMergeDialog;
