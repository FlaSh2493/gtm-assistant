import { EventSpec } from '../../../../shared/types';
import { GTMGA4Tag, GTMTrigger } from './gtm-parser';

export interface VerificationResult {
  type: 'match' | 'plan_only' | 'gtm_only';
  status: 'match' | 'issue' | 'unspec';
  eventName: string;
  planId?: string;
  tagName?: string;
  mismatches: string[];
  selector?: string;
  urlPattern?: string;
}

const isUrlMatch = (pattern: string | undefined, currentUrl: string): boolean => {
  if (!pattern || pattern === 'all' || pattern === '*') return true;
  // Simple "contains" matching for now. Can be upgraded to regex if needed.
  try {
    const url = new URL(currentUrl);
    const target = pattern.toLowerCase();
    return (
      url.href.toLowerCase().includes(target) ||
      url.pathname.toLowerCase().includes(target)
    );
  } catch (e) {
    return currentUrl.toLowerCase().includes(pattern.toLowerCase());
  }
};

export const verifySpecs = (
  plan: Partial<EventSpec>[],
  tags: GTMGA4Tag[],
  triggerMap: Record<string, GTMTrigger>,
  currentUrl?: string
): VerificationResult[] => {
  const results: VerificationResult[] = [];
  const matchedGtmTagNames = new Set<string>();

  // Use currentUrl if provided, otherwise show everything
  const filterByUrl = (url: string | undefined) => {
    if (!currentUrl || !url) return true;
    return isUrlMatch(url, currentUrl);
  };

  // 1. Filter Plan items by URL
  const relevantPlan = plan.filter(p => filterByUrl(p.pageUrl));

  // 2. Filter GTM Tags by URL triggers
  const relevantTags = currentUrl ? tags.filter(tag => {
    const gtmTriggers = tag.firingTriggerIds.map(id => triggerMap[id]).filter(Boolean);
    if (gtmTriggers.length === 0) return true; // Assume global if no triggers found (unlikely but safe)

    return gtmTriggers.some(t => {
      if (!t.urlPattern) return true; // "All Pages" or non-URL specific
      return isUrlMatch(t.urlPattern, currentUrl);
    });
  }) : tags;

  // 3. Compare relevant Plan items
  relevantPlan.forEach(planItem => {
    const matchingTag = relevantTags.find(tag => tag.eventName === planItem.eventName);

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
         const actualSelector = gtmTriggers.find(t => t.selector)?.selector;
         mismatches.push(`트리거 셀렉터 불일치: 명세(${planItem.selector}) vs 실제(${actualSelector || '없음'})`);
      }

      results.push({
        type: 'match',
        status: mismatches.length === 0 ? 'match' : 'issue',
        eventName: planItem.eventName || '',
        planId: planItem.eventId,
        tagName: matchingTag.name,
        mismatches,
        selector: planItem.selector,
        urlPattern: planItem.pageUrl
      });
    } else {
      results.push({
        type: 'plan_only',
        status: 'issue',
        eventName: planItem.eventName || '',
        planId: planItem.eventId,
        mismatches: ['GTM 컨테이너에 해당 이벤트가 구현되어 있지 않거나, 현재 페이지의 트리거 조건이 아닙니다.'],
        selector: planItem.selector,
        urlPattern: planItem.pageUrl
      });
    }
  });

  // 4. Check extra tags in GTM (that are relevant to this URL)
  relevantTags.forEach(tag => {
    if (!matchedGtmTagNames.has(tag.name)) {
      const gtmTriggers = tag.firingTriggerIds.map(id => triggerMap[id]).filter(Boolean);
      const selector = gtmTriggers.find(t => t.selector)?.selector;

      results.push({
        type: 'gtm_only',
        status: 'unspec',
        eventName: tag.eventName,
        tagName: tag.name,
        mismatches: ['명세서에 정의되지 않은 이벤트가 GTM에 구현되어 있습니다.'],
        selector,
        urlPattern: gtmTriggers.find(t => t.urlPattern)?.urlPattern
      });
    }
  });

  return results;
};
