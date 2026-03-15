import { EventSpec } from '../../../../shared/types';

// 기획된 CSV 명세 (Plan)
export const EXAMPLE_CSV_PLAN: Partial<EventSpec>[] = [
  {
    eventId: 'EVT-MATCH',
    eventName: 'match_event',
    triggerDescription: '일치 케이스 (성공)',
    eventType: 'element' as any,
    selector: '.ct67i5a4',
    parameters: [{ key: 'id', description: 'ID' }]
  },
  {
    eventId: 'EVT-MISMATCH',
    eventName: 'mismatch_event',
    triggerDescription: '불일치 케이스 (실패)',
    eventType: 'element' as any,
    selector: '.ct67i5a5',
    parameters: [
      { key: 'category', description: '카테고리' },
      { key: 'label', description: '라벨 (GTM에서 누락될 예정)' }
    ]
  },
  {
    eventId: 'EVT-PLAN-ONLY',
    eventName: 'plan_only_event',
    triggerDescription: '명세만 존재 (누락)',
    eventType: 'element' as any,
    selector: '.ct67i5b3',
    parameters: [{ key: 'id', description: 'ID' }]
  },
  {
    eventId: 'EVT-STACKED',
    eventName: 'double_stacked_event',
    triggerDescription: '중첩 뱃지 테스트용 (성공)',
    eventType: 'element' as any,
    selector: '.ct67i5a4',
    parameters: [{ key: 'type', description: '유형' }]
  },
  {
    eventId: 'EVT-FAIL-STACKED',
    eventName: 'triple_mismatch_event',
    triggerDescription: '중첩 뱃지 테스트용 (실패)',
    eventType: 'element' as any,
    selector: '.ct67i5a4',
    parameters: [{ key: 'missing_param', description: '누락된 파라미터' }]
  }
];

// 실제 GTM 컨테이너에서 추출한 형태의 예시 데이터 (Actual)
export const EXAMPLE_GTM_JSON = {
  "containerVersion": {
    "tag": [
      {
        "name": "GA4 - Match Event",
        "type": "gaawc",
        "parameter": [
          { "type": "template", "key": "eventName", "value": "match_event" },
          {
            "type": "list",
            "key": "eventParameters",
            "list": [
              { "type": "map", "map": [ { "key": "name", "value": "id" }, { "key": "value", "value": "123" } ] }
            ]
          }
        ],
        "firingTriggerId": ["100"]
      },
      {
        "name": "GA4 - Mismatch Event",
        "type": "gaawc",
        "parameter": [
          { "type": "template", "key": "eventName", "value": "mismatch_event" },
          {
            "type": "list",
            "key": "eventParameters",
            "list": [
              { "type": "map", "map": [ { "key": "name", "value": "category" }, { "key": "value", "value": "test" } ] }
              // label 파라미터 누락 유도
            ]
          }
        ],
        "firingTriggerId": ["101"]
      },
      {
        "name": "GA4 - GTM Only Event",
        "type": "gaawc",
        "parameter": [
          { "type": "template", "key": "eventName", "value": "gtm_only_event" }
        ],
        "firingTriggerId": ["200"]
      },
      {
        "name": "GA4 - Double Stacked Event",
        "type": "gaawc",
        "parameter": [
          { "type": "template", "key": "eventName", "value": "double_stacked_event" },
          {
            "type": "list",
            "key": "eventParameters",
            "list": [
              { "type": "map", "map": [ { "key": "name", "value": "type" }, { "key": "value", "value": "stacked" } ] }
            ]
          }
        ],
        "firingTriggerId": ["100"]
      },
      {
        "name": "GA4 - Triple Mismatch Event",
        "type": "gaawc",
        "parameter": [
          { "type": "template", "key": "eventName", "value": "triple_mismatch_event" }
          // missing_param 누락으로 실패 유도
        ],
        "firingTriggerId": ["100"]
      }
    ],
    "trigger": [
      {
        "triggerId": "100",
        "name": "Click - Success (A4)",
        "type": "CLICK",
        "filter": [
          { "type": "EQUALS", "parameter": [ { "key": "arg0", "value": "{{Click Element}}" }, { "key": "arg1", "value": ".ct67i5a4" } ] }
        ]
      },
      {
        "triggerId": "101",
        "name": "Click - Mismatch (A5)",
        "type": "CLICK",
        "filter": [
          { "type": "EQUALS", "parameter": [ { "key": "arg0", "value": "{{Click Element}}" }, { "key": "arg1", "value": ".ct67i5a5" } ] }
        ]
      },
      {
        "triggerId": "200",
        "name": "Click - Extra (64)",
        "type": "CLICK",
        "filter": [
          { "type": "EQUALS", "parameter": [ { "key": "arg0", "value": "{{Click Element}}" }, { "key": "arg1", "value": ".ct67i564" } ] }
        ]
      }
    ]
  }
};
