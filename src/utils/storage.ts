/// <reference path="../renderer/electron.d.ts" />
import { AppConfig, EventSpec } from '../types';


export const STORAGE_KEYS = {
  CONFIG: 'config',
  SPECS_PREFIX: 'specs_',
  LAST_URL: 'last_url',
};

export const getStorageKey = (hostname: string) => `${STORAGE_KEYS.SPECS_PREFIX}${hostname}`;

export const storage = {
  getConfig: async (): Promise<AppConfig> => {
    const config = await window.electronAPI.invoke('store:get', STORAGE_KEYS.CONFIG);
    return config || {
      enabled: true,
      mode: 'spec',
      selector: { dataAttributes: ['data-testid', 'data-cy', 'data-action'] },
      showHover: true
    };
  },

  setConfig: async (config: AppConfig): Promise<void> => {
    await window.electronAPI.invoke('store:set', STORAGE_KEYS.CONFIG, config);
  },

  getSpecs: async (hostname: string): Promise<EventSpec[]> => {
    const key = getStorageKey(hostname);
    const specs = await window.electronAPI.invoke('store:get', key);
    return specs || [];
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
    await window.electronAPI.invoke('store:set', key, specs);
  },

  deleteSpec: async (hostname: string, specId: string): Promise<void> => {
    const specs = await storage.getSpecs(hostname);
    const filtered = specs.filter(s => s.id !== specId);
    const key = getStorageKey(hostname);
    await window.electronAPI.invoke('store:set', key, filtered);
  },

  getLastUrl: async (): Promise<string> => {
    const url = await window.electronAPI.invoke('store:get', STORAGE_KEYS.LAST_URL);
    return url || 'https://www.google.com';
  },

  setLastUrl: async (url: string): Promise<void> => {
    await window.electronAPI.invoke('store:set', STORAGE_KEYS.LAST_URL, url);
  }
};
