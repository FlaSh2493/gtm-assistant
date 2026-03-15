import { useCallback } from 'react';
import { EventSpec, EventParameter } from '../../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export const useGtmImport = () => {
  const parseGtmJson = useCallback((json: any): EventSpec[] => {
    const cv = json?.containerVersion;
    if (!cv) throw new Error('유효한 GTM 컨테이너 파일이 아닙니다.');

    const triggers: any[] = cv.trigger || [];
    const tags: any[] = cv.tag || [];
    const variables: any[] = cv.variable || [];

    // variable ID → EventParameter 역변환
    const variableById = new Map<string, any>();
    variables.forEach((v: any) => variableById.set(v.variableId, v));

    const specs: EventSpec[] = [];

    triggers.forEach((trigger: any) => {
      if (trigger.type !== 'custom_event') return;

      const eventName = trigger.parameter?.find((p: any) => p.key === 'eventName')?.value || '';

      // trigger notes에서 selector, triggerDescription 추출
      let selector = '';
      let triggerDescription = '';
      if (trigger.notes) {
        const selectorMatch = trigger.notes.match(/\[GTM AST Selector\] (.+)/);
        if (selectorMatch) selector = selectorMatch[1].trim();
        const descMatch = trigger.notes.match(/\[설명\] (.+)/);
        if (descMatch) triggerDescription = descMatch[1].trim();
      }

      // 연결된 tag 찾기
      const tag = tags.find((t: any) => t.firingTriggerId?.includes(trigger.triggerId));

      // eventId 추출: tag name에서 "(EVT-xxx)" 패턴
      let eventId = '';
      let pageUrl = '';
      let note = '';
      const parameters: EventParameter[] = [];

      if (tag) {
        const idMatch = tag.name?.match(/\(([^)]+)\)$/);
        if (idMatch) eventId = idMatch[1];

        const notes: string[] = (tag.notes || '').split('\n').filter(Boolean);
        note = notes[0] || '';

        // parameters 추출: eventSettingsTable list
        const settingsTable = tag.parameter?.find((p: any) => p.key === 'eventSettingsTable');
        if (settingsTable?.list) {
          settingsTable.list.forEach((entry: any) => {
            const paramKey = entry.map?.find((m: any) => m.key === 'parameter')?.value || '';
            const paramValueRef = entry.map?.find((m: any) => m.key === 'parameterValue')?.value || '';

            // {{[GTM AST] varName}} → varName 추출 후 변수에서 타입 역변환
            const varNameMatch = paramValueRef.match(/^\{\{(.+)\}\}$/);
            let paramType: EventParameter['type'] = 'dataLayer';
            let description = '';

            if (varNameMatch) {
              const varName = varNameMatch[1];
              const variable = variables.find((v: any) => v.name === varName);
              if (variable) {
                description = variable.notes || '';
                if (variable.type === 'dlv') paramType = 'dataLayer';
                else if (variable.type === 'jsm') paramType = 'storage';
                else if (variable.type === 'v') paramType = 'dom';
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
        id: uuidv4(),
        pageUrl,
        pageDescription: '',
        category: '',
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

  const importGtmJson = useCallback((): Promise<EventSpec[]> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return reject(new Error('파일을 선택하지 않았습니다.'));

        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const json = JSON.parse(ev.target?.result as string);
            const specs = parseGtmJson(json);
            resolve(specs);
          } catch (err: any) {
            reject(new Error(err.message || '파일 파싱에 실패했습니다.'));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }, [parseGtmJson]);

  return { importGtmJson };
};
