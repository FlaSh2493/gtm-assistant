import { useCallback } from 'react';
import { EventSpec, EventParameter } from '../../../entities/spec/model/types';
import { v4 as uuidv4 } from 'uuid';

export type MergeItemType = 'modified' | 'deleted-in-app';

export interface MergeItem {
  type: MergeItemType;
  stored: EventSpec;     // 앱에 있는 것
  imported?: EventSpec;  // GTM에 있는 것 (modified 케이스)
  diffFields?: string[]; // 달라진 필드 목록 (modified 케이스)
}

export interface ImportResult {
  autoAdded: EventSpec[];    // GTM에만 있음 → 자동 추가
  autoSkipped: EventSpec[];  // 동일 → 스킵
  needsReview: MergeItem[];  // 사용자 검토 필요
}

// GTM에 저장/복원 가능한 필드만 비교 (pageUrl 등 GTM에 없는 필드 제외)
const DIFF_FIELDS: (keyof EventSpec)[] = [
  'eventName', 'category', 'triggerDescription', 'selector', 'note', 'parameters',
];

function getDiffFields(a: EventSpec, b: EventSpec): string[] {
  return DIFF_FIELDS.filter(f => {
    const aVal = JSON.stringify(a[f] ?? '');
    const bVal = JSON.stringify(b[f] ?? '');
    return aVal !== bVal;
  });
}

export const useGtmImport = () => {
  const parseGtmJson = useCallback((json: any): EventSpec[] => {
    const cv = json?.containerVersion;
    if (!cv) throw new Error('유효한 GTM 컨테이너 파일이 아닙니다.');

    const triggers: any[] = cv.trigger || [];
    const tags: any[] = cv.tag || [];
    const variables: any[] = cv.variable || [];
    const folders: any[] = cv.folder || [];

    const folderById = new Map<string, string>();
    folders.forEach((f: any) => folderById.set(f.folderId, f.name));

    const specs: EventSpec[] = [];

    triggers.forEach((trigger: any) => {
      if (trigger.type !== 'CUSTOM_EVENT') return;

      const eventName = trigger.customEventFilter?.[0]?.parameter?.find((p: any) => p.key === 'arg1')?.value
        || trigger.parameter?.find((p: any) => p.key === 'eventName')?.value || '';

      let selector = '';
      let triggerDescription = '';
      if (trigger.notes) {
        const selectorMatch = trigger.notes.match(/\[GTM AST Selector\] (.+)/);
        if (selectorMatch) selector = selectorMatch[1].trim();
        const descMatch = trigger.notes.match(/\[설명\] (.+)/);
        if (descMatch) triggerDescription = descMatch[1].trim();
      }

      const tag = tags.find((t: any) => t.firingTriggerId?.includes(trigger.triggerId));

      let id = uuidv4(); // [GTM AST ID] 없으면 새 UUID
      let eventId = '';
      let pageUrl = '';
      let note = '';
      let category = '';
      const parameters: EventParameter[] = [];

      if (tag) {
        // [GTM AST ID]로 UUID 복원 → 앱 스펙과 매칭 핵심
        const astIdMatch = (tag.notes || '').match(/\[GTM AST ID\] ([^\n]+)/);
        if (astIdMatch) id = astIdMatch[1].trim();

        const idMatch = tag.name?.match(/\(([^)]+)\)$/);
        if (idMatch) eventId = idMatch[1];

        const noteLines = (tag.notes || '').split('\n').filter((l: string) =>
          !l.startsWith('[GTM AST')
        );
        note = noteLines[0] || '';

        if (tag.parentFolderId) {
          const folderName = folderById.get(tag.parentFolderId) || '';
          category = folderName.replace(/^\[GTM AST\]\s*/, '').trim();
        }

        const settingsTable = tag.parameter?.find((p: any) => p.key === 'eventSettingsTable');
        if (settingsTable?.list) {
          settingsTable.list.forEach((entry: any) => {
            const paramKey = entry.map?.find((m: any) => m.key === 'parameter')?.value || '';
            const paramValueRef = entry.map?.find((m: any) => m.key === 'parameterValue')?.value || '';

            const varNameMatch = paramValueRef.match(/^\{\{(.+)\}\}$/);
            let paramType: EventParameter['type'] = 'dataLayer';
            let description = '';

            if (varNameMatch) {
              const varName = varNameMatch[1];
              const variable = variables.find((v: any) => v.name === varName);
              if (variable) {
                description = variable.notes?.split('\n').filter((l: string) => !l.startsWith('[GTM AST'))[0] || '';
                if (variable.type === 'v') paramType = 'dataLayer';
                else if (variable.type === 'jsm') paramType = 'storage';
                else if (variable.type === 'd') paramType = 'dom';
                else if (variable.type === 'c') paramType = 'cookie';
                else if (variable.type === 'js') paramType = 'js';
              }
            }

            if (paramKey) {
              parameters.push({ key: paramKey, type: paramType, description });
            }
          });
        }
      }

      specs.push({
        id,
        pageUrl,
        pageDescription: '',
        category,
        eventId,
        eventName,
        triggerDescription,
        selector,
        parameters,
        note,
        createdAt: new Date().toISOString(),
        visible: true,
      });
    });

    return specs;
  }, []);

  const analyzeImport = useCallback((
    importedSpecs: EventSpec[],
    existingSpecs: EventSpec[]
  ): ImportResult => {
    const now = new Date().toISOString();

    // UUID 기반 매칭
    const storedById = new Map(existingSpecs.map(s => [s.id, s]));

    const autoAdded: EventSpec[] = [];
    const autoSkipped: EventSpec[] = [];
    const needsReview: MergeItem[] = [];

    // GTM 항목 순회
    importedSpecs.forEach(imported => {
      const stored = storedById.get(imported.id);

      if (!stored) {
        // GTM에만 있음 → 자동 추가
        autoAdded.push({ ...imported, createdAt: now });
      } else if (stored.deletedAt) {
        // 앱에서 삭제했는데 GTM에 아직 있음 → 물어봄
        needsReview.push({ type: 'deleted-in-app', stored, imported });
      } else {
        const diffFields = getDiffFields(stored, imported);
        if (diffFields.length === 0) {
          autoSkipped.push(stored);
        } else {
          // 내용 다름 → 물어봄
          needsReview.push({ type: 'modified', stored, imported, diffFields });
        }
      }
    });

    // 앱에만 있는 것 (아직 export 안 했거나 GTM에서 삭제된 것)은 건드리지 않음

    return { autoAdded, autoSkipped, needsReview };
  }, []);

  const importGtmJson = useCallback((hostname: string, existingSpecs: EventSpec[] = []): Promise<{ result: ImportResult; rawJson: any }> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return reject(new Error('파일을 선택하지 않았습니다.'));

        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const json = JSON.parse(ev.target?.result as string);
            const importedSpecs = parseGtmJson(json);
            const result = analyzeImport(importedSpecs, existingSpecs);
            await window.electronAPI.invoke('store:set', `gtm_base_${hostname}`, json);
            resolve({ result, rawJson: json });
          } catch (err: any) {
            reject(new Error(err.message || '파일 파싱에 실패했습니다.'));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }, [parseGtmJson, analyzeImport]);

  return { importGtmJson, analyzeImport };
};
