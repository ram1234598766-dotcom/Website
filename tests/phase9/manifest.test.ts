import { describe, expect, it } from 'vitest';
import {
  isValidManifest,
  manifestToSign,
  getCapabilities,
  type PluginManifest,
} from '../../src/lib/plugins/manifest';
import { verifyManifestSignature } from '../../src/lib/plugins/loader';

const SAMPLE_MANIFEST: PluginManifest = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  author: 'Test Author',
  capabilities: ['workspace:read', 'ai:call'],
  entryPoint: { kind: 'inline', script: 'return 1;' },
  signatureAlgorithm: 'hmac-sha256',
  signature: 'dGVzdA==',
};

describe('manifest', () => {
  it('accepts a valid manifest', () => {
    expect(isValidManifest(SAMPLE_MANIFEST)).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(isValidManifest(null)).toBe(false);
    expect(isValidManifest('string')).toBe(false);
    expect(isValidManifest(42)).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(isValidManifest({ ...SAMPLE_MANIFEST, id: '' })).toBe(false);
    expect(isValidManifest({ ...SAMPLE_MANIFEST, name: '' })).toBe(false);
    expect(isValidManifest({ ...SAMPLE_MANIFEST, version: '' })).toBe(false);
    expect(isValidManifest({ ...SAMPLE_MANIFEST, author: '' })).toBe(false);
  });

  it('rejects unknown capabilities', () => {
    expect(isValidManifest({ ...SAMPLE_MANIFEST, capabilities: ['unknown:thing'] })).toBe(false);
  });

  it('rejects invalid entryPoint kinds', () => {
    expect(isValidManifest({ ...SAMPLE_MANIFEST, entryPoint: { kind: 'weird', script: '' } as any })).toBe(false);
  });

  it('rejects invalid signatureAlgorithm', () => {
    expect(isValidManifest({ ...SAMPLE_MANIFEST, signatureAlgorithm: 'md5' as any })).toBe(false);
  });

  it('returns a stable payload for signing', () => {
    const payload = manifestToSign(SAMPLE_MANIFEST);
    expect(typeof payload).toBe('string');
    const parsed = JSON.parse(payload);
    expect(parsed.id).toBe('test-plugin');
    expect(parsed.capabilities).toEqual(['workspace:read', 'ai:call']);
  });

  it('lists all allowed capabilities', () => {
    expect(getCapabilities()).toEqual([
      'workspace:read',
      'workspace:write',
      'ai:call',
      'network:request',
      'terminal:execute',
    ]);
  });
});

describe('signature verification', () => {
  const secret = 'super-secret-key';

  async function sign(manifest: PluginManifest): Promise<PluginManifest> {
    const payload = manifestToSign(manifest);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const bytes = new Uint8Array(sig);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return { ...manifest, signature: b64, signatureAlgorithm: 'hmac-sha256' };
  }

  it('verifies a correctly signed manifest', async () => {
    const signed = await sign(SAMPLE_MANIFEST);
    expect(await verifyManifestSignature(signed, secret)).toBe(true);
  });

  it('rejects a manifest signed with a different secret', async () => {
    const signed = await sign(SAMPLE_MANIFEST);
    expect(await verifyManifestSignature(signed, 'wrong-secret')).toBe(false);
  });

  it('rejects a tampered manifest body', async () => {
    const signed = await sign(SAMPLE_MANIFEST);
    const tampered = { ...signed, name: 'Hacked Plugin' };
    expect(await verifyManifestSignature(tampered, secret)).toBe(false);
  });

  it('rejects when no public key is provided', async () => {
    expect(await verifyManifestSignature(SAMPLE_MANIFEST)).toBe(false);
  });

  it('rejects an unsupported algorithm without a key', async () => {
    const ed = { ...SAMPLE_MANIFEST, signatureAlgorithm: 'ed25519' as const };
    expect(await verifyManifestSignature(ed)).toBe(false);
  });
});
