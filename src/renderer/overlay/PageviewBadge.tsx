import React from 'react';
import { useGTMAssistant } from '../GTMAssistant';
import { FileText } from 'lucide-react';
import './overlay.css';

const PageviewBadge: React.FC = () => {
  const { specs, webviewRef, isWebviewReady } = useGTMAssistant();
  
  // Safe URL fetching
  let currentUrl = '';
  if (isWebviewReady && webviewRef.current) {
    try {
      currentUrl = webviewRef.current.getURL() || '';
    } catch (e) {
      console.warn('[PageviewBadge] Failed to get URL:', e);
    }
  }

  if (!currentUrl || currentUrl === 'about:blank') return null;

  let originPath = '';
  try {
    const urlObj = new URL(currentUrl);
    originPath = urlObj.origin + urlObj.pathname;
  } catch (e) {
    return null;
  }

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
