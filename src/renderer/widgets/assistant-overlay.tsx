import React from 'react';
import { useGTMAssistant } from '../app/providers';
import HoverOutline from '../features/spec/ui/hover-outline';
import Popover from '../shared/ui/popover';
import SpecPopover from '../features/spec/ui/spec-popover';
import SpecOutline from '../features/spec/ui/spec-outline';
import PageviewBadge from '../features/spec/ui/pageview-badge';
import AssistantDrawer from './assistant-drawer';

const AssistantOverlay: React.FC = () => {
  const { config, selectedElement, setSelectedElement } = useGTMAssistant();

  if (!config.enabled) return null;

  return (
    <div className="gtm-assistant-inner" id="gtm-assistant-inner">
      <HoverOutline />
      <SpecOutline />
      <PageviewBadge />

      <Popover
        target={selectedElement}
        onClose={() => setSelectedElement(null)}
      >
        <SpecPopover />
      </Popover>

      <AssistantDrawer />
    </div>
  );
};

export default AssistantOverlay;
