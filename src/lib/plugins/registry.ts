/**
 * VantaOS Plugin — Registry.
 *
 * Tracks installed plugins, their enabled state, and persists the registry
 * to localStorage. Plugins are referenced by their manifest id and stored
 * as serialized manifests.
 */

import type { PluginManifest } from './manifest';

const STORAGE_KEY = 'vantaos_plugin_registry';

export interface PluginRecord {
  readonly manifest: PluginManifest;
  enabled: boolean;
  installedAt: number;
}

export interface Registry {
  list(): readonly PluginRecord[];
  get(id: string): PluginRecord | undefined;
  install(manifest: PluginManifest): PluginRecord;
  enable(id: string): boolean;
  disable(id: string): boolean;
  remove(id: string): boolean;
  clear(): void;
}

function loadFromStorage(): Record<string, Omit<PluginRecord, 'manifest'> & { manifest: PluginManifest }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveToStorage(data: Record<string, PluginRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

let store = loadFromStorage();

export function createRegistry(): Registry {
  return {
    list() {
      return Object.values(store);
    },
    get(id: string) {
      return store[id];
    },
    install(manifest: PluginManifest) {
      const record: PluginRecord = {
        manifest,
        enabled: true,
        installedAt: Date.now(),
      };
      store[manifest.id] = record;
      saveToStorage(store);
      return record;
    },
    enable(id: string) {
      const record = store[id];
      if (!record) return false;
      record.enabled = true;
      saveToStorage(store);
      return true;
    },
    disable(id: string) {
      const record = store[id];
      if (!record) return false;
      record.enabled = false;
      saveToStorage(store);
      return true;
    },
    remove(id: string) {
      if (!store[id]) return false;
      delete store[id];
      saveToStorage(store);
      return true;
    },
    clear() {
      store = {};
      saveToStorage(store);
    },
  };
}

export function resetRegistryForTests(): void {
  store = {};
  localStorage.removeItem(STORAGE_KEY);
}
