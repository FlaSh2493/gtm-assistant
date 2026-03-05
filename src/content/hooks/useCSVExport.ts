import { useCallback } from 'react';
import { EventSpec, CSVColumn } from '../../types';

export const useCSVExport = () => {
  const exportCSV = useCallback((specs: EventSpec[], columns: CSVColumn[]) => {
    const enabledColumns = columns
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);

    const maxParams = Math.max(0, ...specs.map(s => s.parameters.length));

    // Headers
    const headers = enabledColumns.flatMap(col => {
      if (col.field === 'parameters') {
        return Array.from({ length: maxParams }, (_, i) => [
          `매개변수${i + 1}`
        ]).flat();
      }
      return [col.label];
    });

    // Rows
    const rows = specs.map(spec =>
      enabledColumns.flatMap(col => {
        if (col.field === 'parameters') {
          const params = spec.parameters || [];
          const paddedParams = Array.from({ length: maxParams }, (_, i) => 
            params[i] ? [params[i].key] : ['']
          ).flat();
          return paddedParams;
        }
        return [String((spec as any)[col.field] ?? '')];
      })
    );

    // BOM + UTF-8 for Excel compatibility
    const bom = '\uFEFF';
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Use chrome.downloads if available, fallback to link click
    if (chrome?.downloads?.download) {
      chrome.downloads.download({
        url: url,
        filename: `gtm-spec-${window.location.hostname}-${Date.now()}.csv`,
        saveAs: true
      });
    } else {
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `gtm-spec-${window.location.hostname}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  return { exportCSV };
};
