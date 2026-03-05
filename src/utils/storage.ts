import { AppConfig, EventSpec } from '../types';

export const STORAGE_KEYS = {
  CONFIG: 'config',
  SPECS_PREFIX: 'specs_',
};

export const getStorageKey = (hostname: string) => `${STORAGE_KEYS.SPECS_PREFIX}${hostname}`;

export const storage = {
  getConfig: async (): Promise<AppConfig> => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CONFIG);
    return result[STORAGE_KEYS.CONFIG] || {
      enabled: false,
      mode: 'spec',
      selector: { dataAttributes: ['data-testid', 'data-cy', 'data-action'] },
      showHover: true
    };
  },

  setConfig: async (config: AppConfig): Promise<void> => {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
  },

  getSpecs: async (hostname: string): Promise<EventSpec[]> => {
    const key = getStorageKey(hostname);
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
  },

  saveSpec: async (hostname: string, spec: EventSpec): Promise<void> => {
    const specs = await storage.getSpecs(hostname);
    const existingIndex = specs.findIndex(s => s.id === spec.id);
    
    if (existingIndex > -1) {
      specs[existingIndex] = spec;
    } else {
      specs.push(spec);
    }
    
    const key = getStorageKey(hostname);
    await chrome.storage.local.set({ [key]: specs });
  },

  deleteSpec: async (hostname: string, specId: string): Promise<void> => {
    const specs = await storage.getSpecs(hostname);
    const filtered = specs.filter(s => s.id !== specId);
    const key = getStorageKey(hostname);
    await chrome.storage.local.set({ [key]: filtered });
  }
};
