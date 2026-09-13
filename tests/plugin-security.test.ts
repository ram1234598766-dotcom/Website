/**
 * Plugin Security Audit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isValidManifest, manifestToSign, hasCapability } from '../src/lib/plugins/manifest';
import { createRegistry, resetRegistryForTests } from '../src/lib/plugins/registry';
import { verifyManifestSignature, PluginRunner, WORKER_SOURCE } from '../src/lib/plugins/loader';

function makeManifest(o = {}) {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Tester',
    capabilities: ['workspace:read'],
    entryPoint: { kind: 'inline', script: 'api.log("hello")' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'dummysignature',
    ...o,
  };
}

const TEST_KEY = 'test-secret-key-for-hmac';

async function signManifest(manifest) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(TEST_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(manifestToSign(manifest)));
  const bin = String.fromCharCode(...new Uint8Array(sig));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

beforeEach(() => { resetRegistryForTests(); });
describe('Q2 - Sandbox model', () => {
  it('WORKER_SOURCE defines SANDBOX_GLOBALS list', () => {
    expect(WORKER_SOURCE).toContain('SANDBOX_GLOBALS');
    expect(WORKER_SOURCE).toContain('window');
    expect(WORKER_SOURCE).toContain('document');
    expect(WORKER_SOURCE).toContain('fetch');
    expect(WORKER_SOURCE).toContain('Function');
    expect(WORKER_SOURCE).toContain('eval');
    expect(WORKER_SOURCE).toContain('self');
    expect(WORKER_SOURCE).toContain('globalThis');
  });
  it("WORKER_SOURCE passes globals as undefined", () => {
    expect(WORKER_SOURCE).toMatch(/SANDBOX_GLOBALS\.map\(\(\)\s*=>\s*undefined\)/);
  });
  it('WORKER_SOURCE uses new Function for script eval', () => {
    expect(WORKER_SOURCE).toContain('new Function');
    expect(WORKER_SOURCE).toContain('buildSandboxedFunction');
  });
  it('WORKER_SOURCE intercepts API calls via postMessage', () => {
    expect(WORKER_SOURCE).toContain('api_request');
    expect(WORKER_SOURCE).toContain('requireCap');
  });
});
describe('Q3 - Manifest validation', () => {
  it('isValidManifest rejects null', () => { expect(isValidManifest(null)).toBe(false); });
  it('isValidManifest rejects non-objects', () => { expect(isValidManifest('x')).toBe(false); });
  it('isValidManifest rejects empty id', () => { expect(isValidManifest({ ...makeManifest(), id: '' })).toBe(false); });
  it('isValidManifest rejects unknown capabilities', () => { expect(isValidManifest({ ...makeManifest(), capabilities: ['evil'] })).toBe(false); });
  it('isValidManifest rejects unknown sigAlg', () => { expect(isValidManifest({ ...makeManifest(), signatureAlgorithm: 'md5' })).toBe(false); });
  it('isValidManifest rejects http URL', () => { expect(isValidManifest({ ...makeManifest(), entryPoint: { kind: 'url', url: 'http://x' } })).toBe(false); });
  it('isValidManifest accepts valid', () => { expect(isValidManifest(makeManifest())).toBe(true); });
  it('verifyManifestSignature fails no key', async () => {
    expect(await verifyManifestSignature(makeManifest() as any, undefined)).toBe(false);
  });
});

describe('Q5 - Injection points', () => {
  it('isValidManifest accepts extra properties', () => {
    const m = JSON.parse(JSON.stringify({ ...makeManifest(), extra: 'inj' }));
    expect(isValidManifest(m)).toBe(true);
  });
  it('description accepts undefined (BUG)', () => {
    const m = { ...makeManifest(), description: undefined };
    expect(isValidManifest(m)).toBe(true);
  });
});
