import React from 'react';
import { createRoot } from 'react-dom/client';
import GTMAssistant from './GTMAssistant';
import { injectStylesIntoShadow } from './style-injector';
// @ts-ignore - Global process shim for libraries that expect it
if (typeof process === 'undefined') {
  (window as any).process = { env: { NODE_ENV: 'production' } };
}

import { storage } from '../utils/storage';
import './index.css';

const init = () => {
  console.log('🚀 [GTM Assistant] Content script starting...');
  // Check if already initialized
  if (document.getElementById('gtm-assistant-host')) return;

  // Remove debug markers
  const container = document.createElement('div');
  container.id = 'gtm-assistant-host';
  
  // Host must be full screen to avoid clipping, but pointer-events: none
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;overflow:visible;display:block !important;';
  
  const shadow = container.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  mountPoint.className = 'gtm-assistant-mount';
  mountPoint.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
  shadow.appendChild(mountPoint);
  
  document.body.appendChild(container);

  // Expose debug tools
  (window as any).__GTM_ASSISTANT_DEBUG__ = {
    getConfig: () => storage.getConfig(),
    getSpecs: () => storage.getSpecs(window.location.hostname),
    container,
    shadow,
  };

  // Inject styles into the shadow root
  injectStylesIntoShadow(shadow);
  
  const root = createRoot(mountPoint);
  root.render(<GTMAssistant />);
};

// Ensure body exists before mounting
if (document.body) {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
