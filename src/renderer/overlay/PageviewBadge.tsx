import React from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { FileText } from 'lucide-react';

const PageviewBadge: React.FC = () => {
  const { specs, webviewRef } = useGTMAssistant();
  
  const currentUrl = webviewRef.current?.getURL() || '';
  const currentHostname = currentUrl ? new URL(currentUrl).hostname : '';
  const currentPathname = currentUrl ? new URL(currentUrl).pathname : '';
  const originPath = currentUrl ? new URL(currentUrl).origin + currentPathname : '';

  const pageSpecs = specs.filter(s => 
    s.eventType === 'page' && 
    (s.pageUrl === currentUrl || s.pageUrl === originPath)
  );

  if (pageSpecs.length === 0) return null;

  return (
    <div className="pageview-badge-container">
      <div className="pageview-badge">
        <FileText size={14} />
        <span className="count">{pageSpecs.length}</span>
      </div>
      
      <style>{`
        .pageview-badge-container {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 2147483646;
          pointer-events: none;
        }
        .pageview-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #92400e;
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border: 2px solid white;
        }
        .count {
          line-height: 1;
        }
      `}</style>
    </div>
  );
};

export default PageviewBadge;
