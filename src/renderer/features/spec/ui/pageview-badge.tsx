import React from 'react';
import { useGTMAssistant } from '../../../app/providers';
import { FileText } from 'lucide-react';
import '../../../shared/ui/pageview-badge.css';

const PageviewBadge: React.FC = () => {
  const { specs, currentUrl } = useGTMAssistant();

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
