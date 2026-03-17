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

export interface ExportResult {
  hardDeleteIds: string[]; // deletedAt 있는 것들 → export 후 hard delete 대상
}

export const useGtmExport = () => {
  const exportGtmJson = useCallback((specs: EventSpec[], measurementId?: string): ExportResult => {
    const now = new Date();
    const timestamp = now.toISOString();

    // deletedAt 있는 것은 export 제외, 나중에 hard delete
    const hardDeleteIds = specs.filter(s => s.deletedAt).map(s => s.id);
    const exportableSpecs = specs.filter(s => !s.deletedAt);

    const container: GtmContainer = {
      exportFormatVersion: 2,
      exportTime: timestamp,
      containerVersion: {
        path: `accounts/0/containers/0/versions/0`,
        accountId: "0",
        containerId: "0",
        containerVersionId: "0",
        container: {
          accountId: "0",
          containerId: "0",
          name: `GTM GA Assistant Export`,
          usageContext: ["WEB"]
        },
        name: `GTM GA Assistant Export ${new Date().toLocaleDateString()}`,
        tag: [],
        trigger: [],
        variable: [],
        builtInVariable: [
          { accountId: "0", containerId: "0", type: "EVENT", name: "Event" },
          { accountId: "0", containerId: "0", type: "PAGE_URL", name: "Page URL" },
          { accountId: "0", containerId: "0", type: "PAGE_HOSTNAME", name: "Page Hostname" },
          { accountId: "0", containerId: "0", type: "PAGE_PATH", name: "Page Path" },
          { accountId: "0", containerId: "0", type: "REFERRER", name: "Referrer" }
        ]
      }
    };

    const variableMap = new Map<string, string>(); // key: param key, value: gtm variable name
    let idCounter = 1;

    exportableSpecs.forEach((spec) => {
      // 1. Trigger 생성
      const triggerId = String(idCounter++);
      const trigger: any = {
        accountId: "0",
        containerId: "0",
        triggerId: triggerId,
        name: `[GTM AST] ${spec.eventName} - ${spec.eventId}`,
        type: "CUSTOM_EVENT",
        customEventFilter: [
          {
            type: "EQUALS",
            parameter: [
              { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
              { type: "TEMPLATE", key: "arg1", value: spec.eventName }
            ]
          }
        ],
        autoEventFilter: [],
        filter: []
      };

      // 트리거 notes에 UUID + 셀렉터 + 설명 보존
      const triggerNotes = [
        `[GTM AST ID] ${spec.id}`,
        spec.triggerDescription ? `[설명] ${spec.triggerDescription}` : '',
        spec.selector ? `[GTM AST Selector] ${spec.selector}` : ''
      ].filter(Boolean).join('\n');

      trigger.notes = triggerNotes;
      container.containerVersion.trigger.push(trigger);

      // 2. Variables 생성
      const tagParams: any[] = [
        { type: "TEMPLATE", key: "eventName", value: spec.eventName },
        { type: "TEMPLATE", key: "measurementIdOverride", value: measurementId || "G-XXXXXXXXXX" }
      ];
      const eventSettingsParams: any[] = [];

      (spec.parameters || []).forEach((param) => {
        if (!param.key) return;

        let variableName = `[GTM AST] ${param.key}`;
        if (variableMap.has(param.key)) {
          variableName = variableMap.get(param.key)!;
        } else {
          const variable: any = {
            accountId: "0",
            containerId: "0",
            variableId: String(idCounter++),
            name: variableName,
            parameter: [],
            notes: `[GTM AST ID] ${spec.id}${param.description ? '\n' + param.description : ''}`
          };

          const paramType = param.type || 'dataLayer';
          const technicalKey = param.key;

          if (paramType === 'dataLayer') {
            variable.type = "v";
            variable.parameter.push(
              { type: "TEMPLATE", key: "name", value: technicalKey },
              { type: "INTEGER", key: "dataLayerVersion", value: "2" }
            );
          } else if (paramType === 'storage') {
            variable.type = "jsm";
            const storageType = technicalKey.toLowerCase().includes('session') ? 'sessionStorage' : 'localStorage';
            variable.parameter.push({
              type: "TEMPLATE",
              key: "javascript",
              value: `function() { try { return ${storageType}.getItem('${technicalKey}'); } catch(e) { return undefined; } }`
            });
          } else if (paramType === 'dom') {
            variable.type = "d";
            variable.parameter.push(
              { type: "TEMPLATE", key: "elementId", value: spec.selector },
              { type: "TEMPLATE", key: "attributeName", value: technicalKey === 'textContent' ? '' : technicalKey },
              { type: "TEMPLATE", key: "selectorType", value: "css" }
            );
          } else if (paramType === 'cookie') {
            variable.type = "c";
            variable.parameter.push({ type: "TEMPLATE", key: "name", value: technicalKey });
          } else if (paramType === 'js') {
            variable.type = "js";
            variable.parameter.push({ type: "TEMPLATE", key: "name", value: technicalKey });
          } else {
            variable.type = "v";
            variable.parameter.push(
              { type: "TEMPLATE", key: "name", value: technicalKey },
              { type: "INTEGER", key: "dataLayerVersion", value: "2" }
            );
          }

          container.containerVersion.variable.push(variable);
          variableMap.set(param.key, variableName);
        }

        eventSettingsParams.push({
          type: "MAP",
          map: [
            { type: "TEMPLATE", key: "parameter", value: param.key },
            { type: "TEMPLATE", key: "parameterValue", value: `{{${variableName}}}` }
          ]
        });
      });

      if (eventSettingsParams.length > 0) {
        tagParams.push({
          type: "LIST",
          key: "eventSettingsTable",
          list: eventSettingsParams
        });
      }

      // 3. Tag 생성 - notes에 UUID 저장 (import 시 매칭 핵심)
      const tagNotes = [
        `[GTM AST ID] ${spec.id}`,
        spec.note
      ].filter(Boolean).join('\n');

      const tag: any = {
        accountId: "0",
        containerId: "0",
        tagId: String(idCounter++),
        name: `[GTM AST] GA4 Event - ${spec.eventName} (${spec.eventId})`,
        type: "gaawe",
        parameter: tagParams,
        firingTriggerId: [triggerId],
        tagFiringOption: "ONCE_PER_EVENT",
        notes: tagNotes
      };

      container.containerVersion.tag.push(tag);
    });

    // 파일 다운로드
    const jsonString = JSON.stringify(container, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gtm-recipe-${timestamp.split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { hardDeleteIds };
  }, []);

  return { exportGtmJson };
};
