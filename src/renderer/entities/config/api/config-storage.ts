import { AppConfig } from '../model/types';
import { electronStore } from '../../../shared/api/electron-store';

export const CONFIG_STORAGE_KEYS = {
  CONFIG: 'config',
  LAST_URL: 'last_url',
};

export const configStorage = {
  getConfig: async (): Promise<AppConfig> => {
    const config = await electronStore.get(CONFIG_STORAGE_KEYS.CONFIG);
    return config || {
      enabled: true,
      mode: 'spec',
      selector: { dataAttributes: ['data-testid', 'data-cy', 'data-action'] },
      showHover: true
    };
  },

  setConfig: async (config: AppConfig): Promise<void> => {
    await electronStore.set(CONFIG_STORAGE_KEYS.CONFIG, config);
  },

  getLastUrl: async (): Promise<string> => {
    const url = await electronStore.get(CONFIG_STORAGE_KEYS.LAST_URL);
    return url || 'https://www.google.com';
  },

  setLastUrl: async (url: string): Promise<void> => {
    await electronStore.set(CONFIG_STORAGE_KEYS.LAST_URL, url);
  }
};
