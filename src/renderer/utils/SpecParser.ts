import { EventSpec } from '../../types';

/**
 * Parses a CSV string into an array of EventSpec objects.
 * Expected columns: Event Name, Event ID, Selector, Page URL, Parameters, etc.
 */
export const parseCSVToSpecs = (csvText: string): EventSpec[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const specs: EventSpec[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < headers.length) continue;

    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });

    // Mapping common Korean/English headers to EventSpec fields
    const spec: Partial<EventSpec> = {
      id: `ext-${Date.now()}-${i}`,
      eventName: row['이벤트명'] || row['event name'] || row['event_name'] || '',
      eventId: row['이벤트id'] || row['event id'] || row['event_id'] || '',
      selector: row['css selector'] || row['selector'] || row['셀렉터'] || '',
      pageUrl: row['페이지url'] || row['page url'] || row['page_url'] || '',
      triggerDescription: row['트리거설명'] || row['description'] || row['설명'] || '',
      note: row['비고'] || row['note'] || '',
      eventType: 'custom' as any,
      parameters: [],
      createdAt: new Date().toISOString()
    };

    // Parse parameters: key1:desc1, key2:desc2
    const paramsStr = row['파라미터'] || row['parameters'] || '';
    if (paramsStr) {
      spec.parameters = paramsStr.split(';').map((p: string) => {
        const [key, description] = p.split(':').map(s => s.trim());
        return { key: key || '', description: description || '' };
      }).filter((p: any) => p.key);
    }

    if (spec.eventName) {
      specs.push(spec as EventSpec);
    }
  }

  return specs;
};

/**
 * Parses a JSON string into an array of EventSpec objects.
 */
export const parseJSONToSpecs = (jsonText: string): EventSpec[] => {
  try {
    const data = JSON.parse(jsonText);
    if (Array.isArray(data)) {
      return data.map((item, idx) => ({
        ...item,
        id: item.id || `ext-json-${Date.now()}-${idx}`,
        parameters: Array.isArray(item.parameters) ? item.parameters : []
      } as EventSpec));
    }
    return [];
  } catch (e) {
    console.error('[SpecParser] JSON parse error:', e);
    return [];
  }
};
