import { EventSpec } from '../../types';
import { GTMGA4Tag, GTMTrigger } from './GTMParser';

export interface VerificationResult {
  type: 'match' | 'plan_only' | 'gtm_only';
  status: 'pass' | 'fail' | 'missing' | 'extra';
  eventName: string;
  planId?: string;
  tagName?: string;
  mismatches: string[];
  selector?: string;
  urlPattern?: string;
}

export const verifySpecs = (
  plan: Partial<EventSpec>[],
  tags: GTMGA4Tag[],
  triggerMap: Record<string, GTMTrigger>
): VerificationResult[] => {
  const results: VerificationResult[] = [];
  const matchedGtmTagNames = new Set<string>();

  // 1. Check Plan items (Match or Plan Only)
  plan.forEach(planItem => {
    const matchingTag = tags.find(tag => tag.eventName === planItem.eventName);
    
    if (matchingTag) {
      matchedGtmTagNames.add(matchingTag.name);
      const mismatches: string[] = [];

      // Check Parameters
      planItem.parameters?.forEach(p => {
        const gtmParam = matchingTag.parameters.find(gp => gp.key === p.key);
        if (!gtmParam) {
          mismatches.push(`매개변수 누락: ${p.key} (${p.description || ''})`);
        }
      });

      // Check Triggers
      const gtmTriggers = matchingTag.firingTriggerIds.map(id => triggerMap[id]).filter(Boolean);
      const selectorMatch = gtmTriggers.some(t => t.selector === planItem.selector);
      
      if (planItem.selector && planItem.selector !== 'document' && !selectorMatch) {
         // Optionally find what selector it actually uses
         const actualSelector = gtmTriggers.find(t => t.selector)?.selector;
         mismatches.push(`트리거 셀렉터 불일치: 기획(${planItem.selector}) vs 실제(${actualSelector || '없음'})`);
      }

      results.push({
        type: 'match',
        status: mismatches.length === 0 ? 'pass' : 'fail',
        eventName: planItem.eventName || '',
        planId: planItem.eventId,
        tagName: matchingTag.name,
        mismatches,
        selector: planItem.selector,
        urlPattern: planItem.pageUrl
      });
    } else {
      // Plan Only (Missing in GTM)
      results.push({
        type: 'plan_only',
        status: 'missing',
        eventName: planItem.eventName || '',
        planId: planItem.eventId,
        mismatches: ['GTM 컨테이너에 해당 이벤트가 구현되어 있지 않습니다.'],
        selector: planItem.selector,
        urlPattern: planItem.pageUrl
      });
    }
  });

  // 2. Check GTM tags not in Plan (GTM Only)
  tags.forEach(tag => {
    if (!matchedGtmTagNames.has(tag.name)) {
      const gtmTriggers = tag.firingTriggerIds.map(id => triggerMap[id]).filter(Boolean);
      const selector = gtmTriggers.find(t => t.selector)?.selector;

      results.push({
        type: 'gtm_only',
        status: 'extra',
        eventName: tag.eventName,
        tagName: tag.name,
        mismatches: ['명세서(CSV)에 정의되지 않은 이벤트가 GTM에 구현되어 있습니다.'],
        selector,
        urlPattern: gtmTriggers.find(t => t.urlPattern)?.urlPattern
      });
    }
  });

  return results;
};
