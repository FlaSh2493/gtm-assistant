import { useCallback } from 'react';
import { EventSpec } from '../../../entities/spec/model/types';

interface GtmContainer {
  exportFormatVersion: number;
  exportTime: string;
  containerVersion: {
    path: string;
    accountId: string;
    containerId: string;
    containerVersionId: string;
    name: string;
    tag: any[];
    trigger: any[];
    variable: any[];
    builtInVariable: any[];
  };
}

export const useGtmExport = () => {
  const exportGtmJson = useCallback((specs: EventSpec[]) => {
    const timestamp = new Date().toISOString();
    const container: GtmContainer = {
      exportFormatVersion: 2,
      exportTime: timestamp,
      containerVersion: {
        path: `accounts/0/containers/0/versions/0`,
        accountId: "0",
        containerId: "0",
        containerVersionId: "0",
        name: `GTM GA Assistant Export ${new Date().toLocaleDateString()}`,
        tag: [],
        trigger: [],
        variable: [],
        builtInVariable: [
          { type: "v", name: "Page URL" },
          { type: "v", name: "Click Element" },
          { type: "v", name: "Click Classes" },
          { type: "v", name: "Click ID" },
          { type: "v", name: "Click Target" },
          { type: "v", name: "Click URL" },
          { type: "v", name: "Click Text" }
        ]
      }
    };

    const variableMap = new Map<string, string>(); // key: identifier, value: gtm-variable-name

    specs.forEach((spec, specIdx) => {
      // 1. Trigger 생성
      const triggerId = `trigger_${spec.id || specIdx}`;
      const trigger: any = {
        accountId: "0",
        containerId: "0",
        triggerId: triggerId,
        name: `[GTM AST] ${spec.eventName} - ${spec.eventId}`,
        autoEventFilter: [],
        filter: []
      };

      // 모든 이벤트를 Custom Event 트리거로 단일화
      trigger.type = "custom_event";
      trigger.parameter = [
        { type: "template", key: "eventName", value: spec.eventName }
      ];

      // 셀렉터 정보 및 설명 보존 (GTM 트리거의 '메모' 필드에 기록)
      const triggerNotes = [
        spec.triggerDescription ? `[설명] ${spec.triggerDescription}` : '',
        spec.selector ? `[GTM AST Selector] ${spec.selector}` : ''
      ].filter(Boolean).join('\n');

      if (triggerNotes) {
        trigger.notes = triggerNotes;
      }

      container.containerVersion.trigger.push(trigger);

      // 2. Variables 생성 및 Tag 연동용 파라미터 구성
      const tagParams: any[] = [
        { type: "template", key: "eventName", value: spec.eventName }
      ];

      const eventSettingsParams: any[] = [];

      (spec.parameters || []).forEach((param, paramIdx) => {
        if (!param.key) return;

        let variableName = `[GTM AST] ${param.key}`;
        // 중복 방지 (키값이 같으면 동일 변수로 간주)
        if (variableMap.has(param.key)) {
          variableName = variableMap.get(param.key)!;
        } else {
          // 새 변수 생성
          const variable: any = {
            accountId: "0",
            containerId: "0",
            variableId: `var_${spec.id}_${paramIdx}`,
            name: variableName,
            parameter: []
          };

          const paramType = param.type || 'dataLayer';
          const technicalKey = param.key; // functional data identifier
          const desc = param.description || ''; // strictly for documentation metadata

          // 변수 설명(Notes)에 기획 의도 기록
          if (desc) {
            variable.notes = desc;
          }

          if (paramType === 'dataLayer') {
            // Data Layer Variable: Always use technicalKey from the Key field
            variable.type = "dlv";
            variable.parameter.push(
              { type: "template", key: "name", value: technicalKey },
              { type: "integer", key: "dataLayerVersion", value: "2" }
            );
          } else if (paramType === 'storage') {
            // Custom JS Variable for Storage
            variable.type = "jsm";
            const storageType = technicalKey.toLowerCase().includes('session') ? 'sessionStorage' : 'localStorage';
            variable.parameter.push({
              type: "template",
              key: "javascript",
              value: `function() { try { return ${storageType}.getItem('${technicalKey}'); } catch(e) { return undefined; } }`
            });
          } else if (paramType === 'dom') {
            // DOM Element Variable
            variable.type = "v";
            let attrName = technicalKey;
            if (technicalKey === 'textContent') {
              attrName = ''; // set to text
            }

            variable.parameter.push(
              { type: "template", key: "elementId", value: spec.selector },
              { type: "template", key: "attributeName", value: attrName },
              { type: "template", key: "selectorType", value: "css" }
            );
          } else if (paramType === 'cookie') {
            // First Party Cookie
            variable.type = "c";
            variable.parameter.push({ type: "template", key: "name", value: technicalKey });
          } else if (paramType === 'js') {
            // JavaScript Variable
            variable.type = "js";
            variable.parameter.push({ type: "template", key: "name", value: technicalKey });
          } else {
            // Default: Data Layer Variable
            variable.type = "dlv";
            variable.parameter.push(
              { type: "template", key: "name", value: technicalKey },
              { type: "integer", key: "dataLayerVersion", value: "2" }
            );
          }

          container.containerVersion.variable.push(variable);
          variableMap.set(param.key, variableName);
        }

        eventSettingsParams.push({
          type: "map",
          map: [
            { type: "template", key: "parameter", value: param.key },
            { type: "template", key: "parameterValue", value: `{{${variableName}}}` }
          ]
        });
      });

      if (eventSettingsParams.length > 0) {
        tagParams.push({
          type: "list",
          key: "eventSettingsTable",
          list: eventSettingsParams
        });
      }

      // 3. Tag 생성
      const tagId = `tag_${spec.id || specIdx}`;
      const tag: any = {
        accountId: "0",
        containerId: "0",
        tagId: tagId,
        name: `[GTM AST] GA4 Event - ${spec.eventName} (${spec.eventId})`,
        type: "ga4e", // GA4 Event
        parameter: tagParams,
        firingTriggerId: [triggerId],
        tagFiringOption: "oncePerEvent",
        notes: [spec.triggerDescription, spec.note].filter(Boolean).join('\n')
      };
      // GA4 Configuration Tag reference (Placeholder or dummy)
      tagParams.push({ type: "template", key: "measurementId", value: "G-XXXXXXXXXX" });

      container.containerVersion.tag.push(tag);
    });

    // File Download
    const jsonString = JSON.stringify(container, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gtm-recipe-${timestamp.split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return { exportGtmJson };
};
