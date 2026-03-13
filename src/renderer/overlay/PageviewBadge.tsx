import React from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { FileText } from 'lucide-react';
import './overlay.css';

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
    </div>
  );
};

export default PageviewBadge;
