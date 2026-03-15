/**
 * Low-level electron-store abstraction
 * Wraps window.electronAPI.invoke for store:get and store:set operations
 * Used by entities API modules
 */

export const electronStore = {
  get: async (key: string): Promise<any> => {
    return window.electronAPI.invoke('store:get', key);
  },

  set: async (key: string, value: any): Promise<void> => {
    return window.electronAPI.invoke('store:set', key, value);
  }
};
