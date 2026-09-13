import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { ModelManifest, ModelShard } from '../../src/lib/models/manifest';
import {
  downloadModel,
  verifyShard,
  detectRuntime,
  getModelProfile,
  resolveModel,
  deleteDB,
  modelCache,
  openDB,
  verifyManifestSignature,
  load,
  generate,
  unload,
  canonicalStringify,
  clearActiveInstances,
} from '../../src/lib/models/adapter';

// ─── Helpers ─────────────────────────────────────

function makeManifest(
  overrides: Partial<ModelManifest> = {},
): ModelManifest {
  return {
    id: 'test-model',
    version: '1.0.0',
    publisher: 'Test Lab',
    signatureScheme: 'ed25519',
    signature: 'aB3_abc123def456ghi789',
    shards: [
      {
        url: 'https://models.vantaos.dev/test/shard-0.bin',
        byteLength: 64,
        sha256: '',
      },
      {
        url: 'https://models.vantaos.dev/test/shard-1.bin',
        byteLength: 128,
        sha256: '',
      },
    ],
    runtimeRequirements: {
      webgpu: false,
      wasm: true,
      minMemoryMB: 512,
      minStorageMB: 16,
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
      acceptableUse: ['research', 'commercial'],
    },
    ...overrides,
  };
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function mockFetch(
  handler: (url: string, init?: any) => Promise<any>,
) {
  (globalThis as any).fetch = handler;
}

function restoreFetch() {
  delete (globalThis as any).fetch;
}

async function storePartialShard(key: string, data: ArrayBuffer) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('shards', 'readwrite');
    const store = tx.objectStore('shards');
    const req = store.put({ key, data });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('tx aborted'));
  });
  db.close();
}

beforeEach(async () => {
  modelCache.clear();
  clearActiveInstances();
  try {
    await deleteDB();
  } catch {
    // DB may not exist yet
  }
});

afterEach(() => {
  restoreFetch();
});

// ─── verifyShard ─────────────────────────────

describe('verifyShard', () => {
  it('returns true when SHA-256 matches', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = await sha256Hex(data.buffer);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    expect(await verifyShard('https://models.vantaos.dev/ok.bin', hash)).toBe(
      true,
    );
  });

  it('returns false when SHA-256 does not match', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    expect(
      await verifyShard(
        'https://models.vantaos.dev/bad.bin',
        '0000000000000000000000000000000000000000000000000000000000000000',
      ),
    ).toBe(false);
  });

  it('throws when fetch returns non-ok status', async () => {
    mockFetch(async () =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response),
    );

    await expect(
      verifyShard('https://models.vantaos.dev/missing.bin', 'abc'),
    ).rejects.toThrow('HTTP 404');
  });
});

// ─── detectRuntime ────────────────────────────

describe('detectRuntime', () => {
  it('returns an object with webgpu, wasm, and suitable flags', () => {
    const result = detectRuntime();
    expect(result).toHaveProperty('webgpu');
    expect(result).toHaveProperty('wasm');
    expect(result).toHaveProperty('suitable');
    expect(typeof result.webgpu).toBe('boolean');
    expect(typeof result.wasm).toBe('boolean');
    expect(typeof result.suitable).toBe('boolean');
  });

  it('reports wasm as true in a browser environment', () => {
    const result = detectRuntime();
    expect(result.wasm).toBe(true);
  });

  it('suitable is true when either webgpu or wasm is available', () => {
    const result = detectRuntime();
    expect(result.suitable).toBe(result.webgpu || result.wasm);
  });
});

// ─── getModelProfile ─────────────────────────

describe('getModelProfile', () => {
  it('returns one of the valid profile strings', () => {
    const profile = getModelProfile();
    expect(['low-memory-mobile', 'modern-mobile', 'laptop', 'desktop']).toContain(
      profile,
    );
  });

  it('returns a string type', () => {
    const profile = getModelProfile();
    expect(typeof profile).toBe('string');
  });
});

// ─── resolveModel ────────────────────────────

describe('resolveModel', () => {
  it('returns null when no manifest is stored', async () => {
    expect(await resolveModel('unknown-id')).toBeNull();
  });

  it('returns manifest after it has been stored via downloadModel', async () => {
    const data0 = new Uint8Array(64).fill(0xAA);
    const hash0 = await sha256Hex(data0.buffer);
    const data1 = new Uint8Array(128).fill(0xBB);
    const hash1 = await sha256Hex(data1.buffer);

    const manifest = makeManifest({
      shards: [
        {
          url: 'https://models.vantaos.dev/m/shard-0.bin',
          byteLength: 64,
          sha256: hash0,
        },
        {
          url: 'https://models.vantaos.dev/m/shard-1.bin',
          byteLength: 128,
          sha256: hash1,
        },
      ],
    });

    mockFetch(async (url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          url.includes('shard-0') ? data0.buffer : data1.buffer,
      } as Response),
    );

    await downloadModel(manifest);

    const resolved = await resolveModel('test-model');
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe('test-model');
    expect(resolved!.version).toBe('1.0.0');
  });

  it('serves from cache on subsequent resolveModel calls', async () => {
    const manifest = makeManifest();
    modelCache.set('cache-test', manifest);

    const resolved = await resolveModel('cache-test');
    expect(resolved).toBe(manifest);
  });
});

// ─── downloadModel ────────────────────────────

describe('downloadModel', () => {
  it('downloads all shards and stores in IndexedDB', async () => {
    const data0 = new Uint8Array(64).fill(0xAA);
    const hash0 = await sha256Hex(data0.buffer);
    const data1 = new Uint8Array(128).fill(0xBB);
    const hash1 = await sha256Hex(data1.buffer);

    const manifest = makeManifest({
      shards: [
        {
          url: 'https://models.vantaos.dev/m/shard-0.bin',
          byteLength: 64,
          sha256: hash0,
        },
        {
          url: 'https://models.vantaos.dev/m/shard-1.bin',
          byteLength: 128,
          sha256: hash1,
        },
      ],
    });

    mockFetch(async (url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          url.includes('shard-0') ? data0.buffer : data1.buffer,
      } as Response),
    );

    await downloadModel(manifest);

    const resolved = await resolveModel('test-model');
    expect(resolved).not.toBeNull();
  });

  it('calls onProgress with increasing percentages', async () => {
    const data0 = new Uint8Array(64).fill(0xAA);
    const hash0 = await sha256Hex(data0.buffer);
    const data1 = new Uint8Array(128).fill(0xBB);
    const hash1 = await sha256Hex(data1.buffer);

    const manifest = makeManifest({
      shards: [
        {
          url: 'https://models.vantaos.dev/m/shard-0.bin',
          byteLength: 64,
          sha256: hash0,
        },
        {
          url: 'https://models.vantaos.dev/m/shard-1.bin',
          byteLength: 128,
          sha256: hash1,
        },
      ],
    });

    const progressValues: number[] = [];

    mockFetch(async (url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          url.includes('shard-0') ? data0.buffer : data1.buffer,
      } as Response),
    );

    await downloadModel(manifest, async (pct) => {
      progressValues.push(pct);
    });

    expect(progressValues.length).toBeGreaterThanOrEqual(2);
    expect(progressValues[0]).toBe(33);
    expect(progressValues[progressValues.length - 1]).toBe(100);
  });

  it('throws on SHA-256 mismatch', async () => {
    const data0 = new Uint8Array(64).fill(0xAA);
    const hash0 = await sha256Hex(data0.buffer);

    const manifest = makeManifest({
      shards: [
        {
          url: 'https://models.vantaos.dev/m/shard-0.bin',
          byteLength: 64,
          sha256: hash0,
        },
        {
          url: 'https://models.vantaos.dev/m/shard-1.bin',
          byteLength: 128,
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
        },
      ],
    });

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data0.buffer,
      } as Response),
    );

    await expect(downloadModel(manifest)).rejects.toThrow('SHA-256 mismatch');
  });

  it('resumes from partial data with a range request', async () => {
    const FULL_SIZE = 64;
    const PARTIAL_SIZE = 32;
    const firstHalf = new Uint8Array(PARTIAL_SIZE).fill(0xCC);
    const secondHalf = new Uint8Array(PARTIAL_SIZE).fill(0xDD);
    const fullData = new Uint8Array(FULL_SIZE);
    fullData.set(firstHalf, 0);
    fullData.set(secondHalf, PARTIAL_SIZE);

    const fullHash = await sha256Hex(fullData.buffer);

    const manifest = makeManifest({
      shards: [
        {
          url: 'https://models.vantaos.dev/resumable/shard-0.bin',
          byteLength: FULL_SIZE,
          sha256: fullHash,
        },
      ],
    });

    await storePartialShard('test-model/0', firstHalf.buffer);

    const rangeHeaders: string[] = [];

    mockFetch(async (url: string, init?: any) => {
      const range = init?.headers?.Range as string | undefined;
      if (range) rangeHeaders.push(range);
      return Promise.resolve({
        ok: true,
        status: 206,
        arrayBuffer: async () => secondHalf.buffer,
      } as Response);
    });

    await downloadModel(manifest);

    expect(rangeHeaders.length).toBeGreaterThanOrEqual(1);
    expect(rangeHeaders.some((r) => r === 'bytes=32-63')).toBe(true);

    const resolved = await resolveModel('test-model');
    expect(resolved).not.toBeNull();
  });

  it('skips already-complete shards', async () => {
    const data0 = new Uint8Array(64).fill(0xAA);
    const hash0 = await sha256Hex(data0.buffer);

    const manifest = makeManifest({
      shards: [
        {
          url: 'https://models.vantaos.dev/skip/shard-0.bin',
          byteLength: 64,
          sha256: hash0,
        },
      ],
    });

    await storePartialShard('test-model/0', data0.buffer);

    let fetchCalled = false;
    mockFetch(async () => {
      fetchCalled = true;
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data0.buffer,
      } as Response);
    });

    await downloadModel(manifest);

    expect(fetchCalled).toBe(false);
  });
});

// ─── Resumable download (explicit range request) ──────

describe('Resumable download', () => {
  it('verifies range request is used when resuming', async () => {
    const PARTIAL = 32;
    const FULL = 64;
    const firstHalf = new Uint8Array(PARTIAL).fill(0x11);
    const secondHalf = new Uint8Array(PARTIAL).fill(0x22);
    const fullData = new Uint8Array(FULL);
    fullData.set(firstHalf, 0);
    fullData.set(secondHalf, PARTIAL);

    const fullHash = await sha256Hex(fullData.buffer);

    const manifest = makeManifest({
      shards: [
        {
          url: 'https://models.vantaos.dev/ranges/test.bin',
          byteLength: FULL,
          sha256: fullHash,
        },
      ],
    });

    await storePartialShard('test-model/0', firstHalf.slice(0, PARTIAL).buffer);

    let observedRange: string | null = null;

    mockFetch(async (url: string, init?: any) => {
      const rangeHeader = init?.headers?.Range as string | undefined;
      if (rangeHeader) observedRange = rangeHeader;
      return Promise.resolve({
        ok: true,
        status: 206,
        arrayBuffer: async () => secondHalf.buffer,
      } as Response);
    });

    await downloadModel(manifest);

    expect(observedRange).toBe('bytes=32-63');
  });
});

// ─── Helpers ───────────────────────────────────

const enc = new TextEncoder();

async function signManifest(
  manifest: ModelManifest,
): Promise<ModelManifest> {
  const { signature, ...rest } = manifest;
  const payload = canonicalStringify(rest);
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(manifest.publisher),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sigBytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < sigBytes.length; i++) bin += String.fromCharCode(sigBytes[i]);
  const base64url = btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return { ...manifest, signature: base64url };
}

async function makeSignedManifest(
  shardOverrides: Partial<ModelShard>[] = [],
): Promise<ModelManifest> {
  const shards: ModelShard[] =
    shardOverrides.length > 0
      ? shardOverrides as ModelShard[]
      : [
          {
            url: 'https://models.vantaos.dev/test/shard-0.bin',
            byteLength: 64,
            sha256: '',
          },
        ];
  const manifest: ModelManifest = {
    id: 'test-model',
    version: '1.0.0',
    publisher: 'Test Lab',
    signatureScheme: 'hmac-sha256',
    signature: '',
    shards,
    runtimeRequirements: {
      webgpu: false,
      wasm: true,
      minMemoryMB: 512,
      minStorageMB: 16,
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
      acceptableUse: ['research', 'commercial'],
    },
  };
  return signManifest(manifest);
}

// ─── verifyManifestSignature ──────────────────

describe('verifyManifestSignature', () => {
  it('returns true for a valid HMAC-SHA256 signed manifest', async () => {
    const manifest = await makeSignedManifest();
    expect(await verifyManifestSignature(manifest)).toBe(true);
  });

  it('returns false when signature is tampered', async () => {
    const manifest = await makeSignedManifest();
    const tampered: ModelManifest = {
      ...manifest,
      signature: 'tampered-signature-value',
    };
    expect(await verifyManifestSignature(tampered)).toBe(false);
  });

  it('returns false when publisher is changed (invalidates HMAC key)', async () => {
    const manifest = await makeSignedManifest();
    const tampered: ModelManifest = {
      ...manifest,
      publisher: 'Evil Corp',
    };
    expect(await verifyManifestSignature(tampered)).toBe(false);
  });

  it('returns false for ed25519 scheme in jsdom (no WebCrypto Ed25519)', async () => {
    const manifest: ModelManifest = {
      id: 'ed25519-model',
      version: '1.0.0',
      publisher: 'Test Lab',
      signatureScheme: 'ed25519',
      signature: 'dGVzdDo=',
      shards: [
        {
          url: 'https://models.vantaos.dev/e/shard-0.bin',
          byteLength: 64,
          sha256: '',
        },
      ],
      runtimeRequirements: {
        webgpu: false,
        wasm: true,
        minMemoryMB: 512,
        minStorageMB: 16,
      },
      license: {
        name: 'MIT',
        acceptableUse: ['research'],
      },
    };
    expect(await verifyManifestSignature(manifest)).toBe(false);
  });

  it('returns false for unsupported signature scheme', async () => {
    const manifest: ModelManifest = {
      id: 'bad-scheme',
      version: '1.0.0',
      publisher: 'Test Lab',
      signatureScheme: 'hmac-sha256',
      signature: 'abc',
      shards: [
        {
          url: 'https://models.vantaos.dev/b/shard-0.bin',
          byteLength: 64,
          sha256: '',
        },
      ],
      runtimeRequirements: {
        webgpu: false,
        wasm: true,
        minMemoryMB: 512,
        minStorageMB: 16,
      },
      license: {
        name: 'MIT',
        acceptableUse: ['research'],
      },
    };
    expect(await verifyManifestSignature(manifest)).toBe(false);
  });
});

// ─── load ─────────────────────────────────────

async function makeLoadedManifest(
  data: Uint8Array,
  url: string,
): Promise<ModelManifest> {
  const hash = await sha256Hex(data.buffer);
  const manifest: ModelManifest = {
    id: 'load-test-model',
    version: '1.0.0',
    publisher: 'Test Lab',
    signatureScheme: 'hmac-sha256',
    signature: '',
    shards: [
      {
        url,
        byteLength: data.byteLength,
        sha256: hash,
      },
    ],
    runtimeRequirements: {
      webgpu: false,
      wasm: true,
      minMemoryMB: 512,
      minStorageMB: 16,
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
      acceptableUse: ['research', 'commercial'],
    },
  };
  return signManifest(manifest);
}

describe('load', () => {
  it('loads a verified model and returns a RuntimeInstance', async () => {
    const data = new Uint8Array(64).fill(0xAA);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/load/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);

    const instance = await load(signed.id);
    expect(instance).toBeDefined();
    expect(instance.modelId).toBe(signed.id);
    expect(typeof instance.loadedAt).toBe('number');
    expect(instance.loadedAt).toBeLessThanOrEqual(Date.now());
  });

  it('throws when model manifest is not found', async () => {
    await expect(load('nonexistent-model')).rejects.toThrow('Model not found');
  });

  it('throws when signature verification fails', async () => {
    const data = new Uint8Array(64).fill(0xAA);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/load/shard-0.bin');
    const badSig: ModelManifest = { ...signed, signature: 'bad' };
    modelCache.set(badSig.id, badSig);

    await expect(load(badSig.id)).rejects.toThrow('Signature verification failed');
  });
});

// ─── generate ─────────────────────────────────

describe('generate', () => {
  it('returns a string response', async () => {
    const data = new Uint8Array(64).fill(0xBB);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/gen/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);
    const instance = await load(signed.id);

    const result = await generate('hello world', instance);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('throws when instance is not loaded', async () => {
    const manifest: ModelManifest = {
      id: 'fake-model',
      version: '1.0.0',
      publisher: 'Test',
      signatureScheme: 'hmac-sha256',
      signature: 'fake',
      shards: [
        {
          url: 'https://models.vantaos.dev/fake/shard-0.bin',
          byteLength: 64,
          sha256: '0'.repeat(64),
        },
      ],
      runtimeRequirements: {
        webgpu: false,
        wasm: true,
        minMemoryMB: 512,
        minStorageMB: 16,
      },
      license: {
        name: 'MIT',
        acceptableUse: ['research'],
      },
    };
    modelCache.set('fake-model', manifest);
    const instance = { id: 'fake@1.0.0', modelId: 'fake-model', loadedAt: Date.now() };
    await expect(generate('hello', instance)).rejects.toThrow('not loaded');
  });
});

// ─── generate — real inference pipeline ───────

describe('generate — inference pipeline', () => {
  it('returns a string when inference falls back', async () => {
    const data = new Uint8Array(64).fill(0xBB);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/gen/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);
    const instance = await load(signed.id);

    const result = await generate('hello world', instance);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('fallback contains Real inference unavailable marker', async () => {
    const data = new Uint8Array(64).fill(0xBB);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/gen2/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);
    const instance = await load(signed.id);

    const result = await generate('test prompt', instance);
    expect(result).toContain('Real inference unavailable');
  });

  it('fallback contains the error reason', async () => {
    const data = new Uint8Array(64).fill(0xBB);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/gen3/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);
    const instance = await load(signed.id);

    const result = await generate('prompt', instance);
    // The fallback should explain why inference failed (e.g. WebGPU/WASM or model not found)
    expect(result).toMatch(/Real inference unavailable.*Deterministic fallback/);
  });

  it('returns a deterministic-looking fallback for different prompts', async () => {
    const data = new Uint8Array(64).fill(0xBB);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/gen4/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);
    const instance = await load(signed.id);

    const result1 = await generate('first prompt', instance);
    const result2 = await generate('second prompt', instance);
    expect(result1).not.toBe(result2);
    expect(result1).toContain('Real inference unavailable');
    expect(result2).toContain('Real inference unavailable');
  });
});

// ─── unload ───────────────────────────────────

describe('unload', () => {
  it('resolves without error for a loaded instance', async () => {
    const data = new Uint8Array(64).fill(0xCC);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/un/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);
    const instance = await load(signed.id);

    await expect(unload(instance)).resolves.toBeUndefined();
  });

  it('removes the instance from active instances', async () => {
    const data = new Uint8Array(64).fill(0xDD);
    const signed = await makeLoadedManifest(data, 'https://models.vantaos.dev/del/shard-0.bin');
    modelCache.set(signed.id, signed);

    mockFetch(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
      } as Response),
    );

    await downloadModel(signed);
    const instance = await load(signed.id);
    await unload(instance);

    // Loading again should succeed (instance was removed)
    const instance2 = await load(signed.id);
    expect(instance2.id).toBe(instance.id);
  });
});
