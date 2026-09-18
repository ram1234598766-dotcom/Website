import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { ModelManifest, ModelShard } from '../src/lib/models/manifest';
import { canonicalStringify, base64UrlToBytes, verifyManifestSignature, load, generate, unload, clearActiveInstances, downloadModel, resolveModel, modelCache, openDB, deleteDB, deduplicateResponse } from '../src/lib/models/adapter';

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function mockFetch(h: (url: string, init?: any) => Promise<any>) { (globalThis as any).fetch = h; }
function restoreFetch() { delete (globalThis as any).fetch; }

async function signManifest(m: ModelManifest): Promise<ModelManifest> {
  const { signature, ...rest } = m;
  const payload = canonicalStringify(rest);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(m.publisher), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sb = new Uint8Array(sig); let bin = '';
  for (let i = 0; i < sb.length; i++) bin += String.fromCharCode(sb[i]);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return { ...m, signature: b64 };
}

beforeEach(async () => { modelCache.clear(); clearActiveInstances(); try { await deleteDB(); } catch {} });
afterEach(() => restoreFetch());

// === 7. canonicalStringify ===
describe('canonicalStringify - undefined', () => {
  it('handles undefined', () => {
    expect(() => canonicalStringify(undefined)).not.toThrow();
    expect(canonicalStringify(undefined)).toBe('null');
    const obj: Record<string, any> = { a: 1, b: undefined, c: 'hello' };
    expect(() => canonicalStringify(obj)).not.toThrow();
  });
});

describe('canonicalStringify - circular', () => {
  it('no overflow on self-ref', () => {
    const obj: Record<string, any> = { a: 1 }; obj.self = obj;
    expect(() => canonicalStringify(obj)).not.toThrow();
  });
  it('no overflow on mutual ref', () => {
    const a: Record<string, any> = { n: 'a' }; const b: Record<string, any> = { n: 'b' };
    a.ref = b; b.ref = a;
    expect(() => canonicalStringify(a)).not.toThrow();
  });
});

// === 8. base64UrlToBytes ===
describe('base64UrlToBytes - invalid', () => {
  it('throws on invalid chars', () => { expect(() => base64UrlToBytes('!!!')).toThrow(); });
  it('throws descriptive error', () => {
    try { base64UrlToBytes('bad!!!'); expect.fail(); } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect((e as Error).message).toContain('Invalid base64url');
    }
  });
  it('empty string', () => { expect(base64UrlToBytes('').length).toBe(0); });
  it('decodes valid', () => { expect(new TextDecoder().decode(base64UrlToBytes('aGVsbG8'))).toBe('hello'); });
});

// === 1. generate() loaded check ===
describe('generate() - loaded check', () => {
  it('throws when not loaded', async () => {
    const m: ModelManifest = { id: 'tg', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: 'x', shards: [{ url: 'https://models.vantaos.dev/t/0.bin', byteLength: 64, sha256: '0'.repeat(64) }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
    modelCache.set('tg', m);
    const inst = { id: 'tg@1.0.0', modelId: 'tg', loadedAt: Date.now() };
    await expect(generate('hi', inst)).rejects.toThrow('not loaded');
  });
});

// === 4. load() idempotency ===
describe('load() - idempotency', () => {
  it('returns same instance on second load (idempotent)', async () => {
    const data = new Uint8Array(64).fill(0xAA); const hash = await sha256Hex(data.buffer);
    const m: ModelManifest = { id: 'im1', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: '', shards: [{ url: 'https://models.vantaos.dev/i/0.bin', byteLength: 64, sha256: hash }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
    const s = await signManifest(m); modelCache.set(s.id, s);
    mockFetch(async () => Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => data.buffer } as Response));
    await downloadModel(s); const i1 = await load(s.id);
    const i2 = await load(s.id);
    expect(i2.id).toBe(i1.id);
  });
  it('returns same instance after fix', async () => {
    const data = new Uint8Array(64).fill(0xBB); const hash = await sha256Hex(data.buffer);
    const m: ModelManifest = { id: 'im2', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: '', shards: [{ url: 'https://models.vantaos.dev/i2/0.bin', byteLength: 64, sha256: hash }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
    const s = await signManifest(m); modelCache.set(s.id, s);
    mockFetch(async () => Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => data.buffer } as Response));
    await downloadModel(s); const i1 = await load(s.id);
    const i2 = await load(s.id); expect(i2.id).toBe(i1.id);
  });
});

// === 5. unload() cleanup ===
describe('unload() - cleanup', () => {
  it('allows reload after unload', async () => {
    const data = new Uint8Array(64).fill(0xCC); const hash = await sha256Hex(data.buffer);
    const m: ModelManifest = { id: 'ul', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: '', shards: [{ url: 'https://models.vantaos.dev/ul/0.bin', byteLength: 64, sha256: hash }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
    const s = await signManifest(m); modelCache.set(s.id, s);
    mockFetch(async () => Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => data.buffer } as Response));
    await downloadModel(s); const i1 = await load(s.id); await unload(i1);
    const i2 = await load(s.id); expect(i2.id).toBe(i1.id);
  });
});

// === 6. verifyManifestSignature HMAC ===
describe('verifyManifestSignature - HMAC', () => {
  it('valid sig returns true', async () => { const m = await signManifest(makeManifest()); expect(await verifyManifestSignature(m)).toBe(true); });
  it('tampered returns false', async () => { const m = await signManifest(makeManifest()); const t: ModelManifest = { ...m, signature: 'bad' }; expect(await verifyManifestSignature(t)).toBe(false); });
  it('wrong publisher returns false', async () => { const m = await signManifest(makeManifest()); const t: ModelManifest = { ...m, publisher: 'Evil' }; expect(await verifyManifestSignature(t)).toBe(false); });
});

// === 9. downloadModel verifyModelSource ===
describe('downloadModel - verifyModelSource', () => {
  it('throws when any shard untrusted', async () => {
    const m: ModelManifest = { id: 'ut', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: '', shards: [{ url: 'https://models.vantaos.dev/ok/0.bin', byteLength: 64, sha256: '' }, { url: 'http://evil.com/s.bin', byteLength: 64, sha256: '' }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
    modelCache.set('ut', m);
    await expect(downloadModel(m)).rejects.toThrow('Untrusted model source');
  });
  it('checks all shards not just first', async () => {
    const m: ModelManifest = { id: 'pa', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: '', shards: [{ url: 'https://models.vantaos.dev/ok/0.bin', byteLength: 64, sha256: '' }, { url: 'http://evil.com/1.bin', byteLength: 64, sha256: '' }, { url: 'https://models.vantaos.dev/ok/2.bin', byteLength: 64, sha256: '' }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
    modelCache.set('pa', m);
    await expect(downloadModel(m)).rejects.toThrow('Untrusted model source');
  });
});

// === 2. generate() error clarity ===
describe('generate() - error clarity', () => {
  it('fallback includes error reason', async () => {
    const m: ModelManifest = { id: 'em', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: '', shards: [{ url: 'https://models.vantaos.dev/er/0.bin', byteLength: 64, sha256: '0'.repeat(64) }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
    modelCache.set('em', m);
    const inst = { id: 'em@1.0.0', modelId: 'em', loadedAt: Date.now() };
    try { const r = await generate('test', inst); expect(typeof r).toBe('string'); } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      expect(msg).not.toBe('Instance em@1.0.0 is not loaded');
      expect(msg).not.toBe('Model not found for instance em@1.0.0');
    }
  });
});
// === deduplicateResponse ===
describe('deduplicateResponse - consecutive duplicates', () => {
  it('collapses identical paragraphs to one', () => {
    const text = 'HTTPS is a protocol.\n\nHTTPS is a protocol.\n\nHTTPS is a protocol.';
    expect(deduplicateResponse(text)).toBe('HTTPS is a protocol.');
  });
  it('preserves non-duplicate paragraphs', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    expect(deduplicateResponse(text)).toBe(text);
  });
  it('handles single paragraph', () => {
    expect(deduplicateResponse('Hello world.')).toBe('Hello world.');
  });
  it('handles empty string', () => {
    expect(deduplicateResponse('')).toBe('');
  });
  it('handles mixed — some duplicates', () => {
    const text = 'A.\n\nA.\n\nB.\n\nB.\n\nC.';
    expect(deduplicateResponse(text)).toBe('A.\n\nB.\n\nC.');
  });
  it('handles null/undefined gracefully', () => {
    expect(deduplicateResponse('' as any)).toBe('');
  });
});
function makeManifest(): ModelManifest {
  return { id: 'm', version: '1.0.0', publisher: 'TL', signatureScheme: 'hmac-sha256', signature: '', shards: [{ url: 'https://models.vantaos.dev/m/0.bin', byteLength: 64, sha256: '' }], runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 }, license: { name: 'MIT', acceptableUse: ['research'] } };
}
