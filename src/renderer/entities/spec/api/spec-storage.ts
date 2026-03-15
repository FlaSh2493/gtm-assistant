import { EventSpec } from '../model/types';
import { electronStore } from '../../../shared/api/electron-store';

export const SPEC_STORAGE_KEYS = {
  SPECS_PREFIX: 'specs_',
};

export const getSpecStorageKey = (hostname: string) =>
  `${SPEC_STORAGE_KEYS.SPECS_PREFIX}${hostname}`;

export const specStorage = {
  getSpecs: async (hostname: string): Promise<EventSpec[]> => {
    const key = getSpecStorageKey(hostname);
    const specs = await electronStore.get(key);
    return specs || [];
  },

  saveSpec: async (hostname: string, spec: EventSpec): Promise<void> => {
    const specs = await specStorage.getSpecs(hostname);
    const existingIndex = specs.findIndex(s => s.id === spec.id);

    if (existingIndex > -1) {
      specs[existingIndex] = spec;
    } else {
      specs.push(spec);
    }

    const key = getSpecStorageKey(hostname);
    await electronStore.set(key, specs);
  },

  deleteSpec: async (hostname: string, specId: string): Promise<void> => {
    const specs = await specStorage.getSpecs(hostname);
    const filtered = specs.filter(s => s.id !== specId);
    const key = getSpecStorageKey(hostname);
    await electronStore.set(key, filtered);
  },
};
