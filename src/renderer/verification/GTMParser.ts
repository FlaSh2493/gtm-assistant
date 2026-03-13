export interface GTMGA4Tag {
  name: string;
  eventName: string;
  parameters: { key: string; value: string }[];
  firingTriggerIds: string[];
}

export interface GTMTrigger {
  triggerId: string;
  name: string;
  type: string;
  selector?: string;
  urlPattern?: string;
}

export const parseGTMGA4Tags = (gtmJson: any): GTMGA4Tag[] => {
  const tags = gtmJson.containerVersion?.tag || [];
  
  return tags
    .filter((tag: any) => tag.type === 'gaawc')
    .map((tag: any) => {
      const eventNameParam = tag.parameter?.find((p: any) => p.key === 'eventName');
      const paramsList = tag.parameter?.find((p: any) => p.key === 'eventParameters')?.list || [];
      
      const parameters = paramsList.map((p: any) => {
        const map = p.map || [];
        const key = map.find((m: any) => m.key === 'name')?.value;
        const value = map.find((m: any) => m.key === 'value')?.value;
        return { key, value };
      });

      return {
        name: tag.name,
        eventName: eventNameParam?.value || '',
        parameters,
        firingTriggerIds: tag.firingTriggerId || []
      };
    });
};

export const parseGTMTriggers = (gtmJson: any): Record<string, GTMTrigger> => {
  const triggers = gtmJson.containerVersion?.trigger || [];
  const triggerMap: Record<string, GTMTrigger> = {};

  triggers.forEach((t: any) => {
    let selector = '';
    let urlPattern = '';

    // Simple parsing for Example
    t.filter?.forEach((f: any) => {
      const arg0 = f.parameter?.find((p: any) => p.key === 'arg0')?.value;
      const arg1 = f.parameter?.find((p: any) => p.key === 'arg1')?.value;
      
      if (arg0 === '{{Click Element}}' || arg0 === '{{Page URL}}') {
        if (arg0.includes('Element')) selector = arg1;
        if (arg0.includes('URL')) urlPattern = arg1;
      }
    });

    triggerMap[t.triggerId] = {
      triggerId: t.triggerId,
      name: t.name,
      type: t.type,
      selector,
      urlPattern
    };
  });

  return triggerMap;
};
