import { storage } from '../utils/storage';
// Background script for GTM API calls and other cross-origin tasks
chrome.runtime.onInstalled.addListener(() => {
  console.log('GTM Tag Assistant Installed');
});

// Direct icon click toggle
chrome.action.onClicked.addListener(async () => {
  const config = await storage.getConfig();
  const newEnabled = !config.enabled;
  await storage.setConfig({ ...config, enabled: newEnabled });
  console.log('[GTM Assistant] Extension toggled to:', newEnabled);
});

// Listener for GTM API requests (Placeholder for Phase 8)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_GTM_DATA') {
    // Implement GTM API call here
    sendResponse({ success: false, message: 'API not implemented yet' });
  }
  return true;
});
