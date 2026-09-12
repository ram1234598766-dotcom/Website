import { describe, expect, it, beforeEach } from 'vitest';
import {
  createRegistry,
  resetRegistryForTests,
} from '../../src/lib/plugins/registry';
import type { PluginManifest } from '../../src/lib/plugins/manifest';

function makeManifest(id: string): PluginManifest {
  return {
    id,
    name: `${id} Plugin`,
    version: '1.0.0',
    description: 'Test plugin',
    author: 'Test',
    capabilities: ['workspace:read'],
    entryPoint: { kind: 'inline', script: '' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'sig',
  };
}

describe('registry', () => {
  beforeEach(() => {
    resetRegistryForTests();
  });

  it('starts empty', () => {
    const registry = createRegistry();
    expect(registry.list()).toEqual([]);
  });

  it('installs and lists a plugin', () => {
    const registry = createRegistry();
    const record = registry.install(makeManifest('plugin-a'));
    expect(record.manifest.id).toBe('plugin-a');
    expect(record.enabled).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('plugin-a')).toBeDefined();
  });

  it('enables and disables a plugin', () => {
    const registry = createRegistry();
    registry.install(makeManifest('plugin-a'));
    expect(registry.get('plugin-a')?.enabled).toBe(true);
    registry.disable('plugin-a');
    expect(registry.get('plugin-a')?.enabled).toBe(false);
    registry.enable('plugin-a');
    expect(registry.get('plugin-a')?.enabled).toBe(true);
  });

  it('removes a plugin', () => {
    const registry = createRegistry();
    registry.install(makeManifest('plugin-a'));
    expect(registry.list()).toHaveLength(1);
    expect(registry.remove('plugin-a')).toBe(true);
    expect(registry.list()).toHaveLength(0);
    expect(registry.remove('plugin-a')).toBe(false);
  });

  it('persists across registry instances', () => {
    createRegistry().install(makeManifest('plugin-a'));
    const registry2 = createRegistry();
    expect(registry2.list()).toHaveLength(1);
    expect(registry2.get('plugin-a')?.manifest.id).toBe('plugin-a');
  });

  it('clears all plugins', () => {
    const registry = createRegistry();
    registry.install(makeManifest('plugin-a'));
    registry.install(makeManifest('plugin-b'));
    registry.clear();
    expect(registry.list()).toEqual([]);
  });
});
