/**
 * @deprecated Use FSD-organized storage modules instead:
 * - specStorage: src/renderer/entities/spec/api/spec-storage.ts
 * - configStorage: src/renderer/entities/config/api/config-storage.ts
 *
 * This module provides backward compatibility for renderer code
 */

// Re-export storage APIs from renderer entities for backward compatibility
export const storage = {
  async getConfig() {
    const { configStorage } = await import('../../entities/config/api/config-storage');
    return configStorage.getConfig();
  },

  async setConfig(config: any) {
    const { configStorage } = await import('../../entities/config/api/config-storage');
    return configStorage.setConfig(config);
  },

  async getSpecs(hostname: string) {
    const { specStorage } = await import('../../entities/spec/api/spec-storage');
    return specStorage.getSpecs(hostname);
  },

  async saveSpec(hostname: string, spec: any) {
    const { specStorage } = await import('../../entities/spec/api/spec-storage');
    return specStorage.saveSpec(hostname, spec);
  },

  async deleteSpec(hostname: string, specId: string) {
    const { specStorage } = await import('../../entities/spec/api/spec-storage');
    return specStorage.deleteSpec(hostname, specId);
  },

  async getLastUrl() {
    const { configStorage } = await import('../../entities/config/api/config-storage');
    return configStorage.getLastUrl();
  },

  async setLastUrl(url: string) {
    const { configStorage } = await import('../../entities/config/api/config-storage');
    return configStorage.setLastUrl(url);
  }
};
