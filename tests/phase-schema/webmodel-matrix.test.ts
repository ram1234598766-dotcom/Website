import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { ModelManifest } from '../../src/lib/models/manifest';
import type { DeviceProfile } from '../../src/lib/models/manifest';
import {
  downloadModel,
  verifyShard,
  detectRuntime,
  getModelProfile,
  getCloudFallbackMessage,
  getModelClass,
  checkStorageQuota,
  resolveModel,
  deleteDB,
  modelCache,
  openDB,
} from '../../src/lib/models/adapter';

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

function mockNavigator(overrides: Record<string, unknown>) {
  const original = globalThis.navigator;
  const mocked = { ...original, ...overrides };
  Object.defineProperty(globalThis, 'navigator', {
    value: mocked,
    writable: true,
    configurable: true,
  });
  return () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: original,
      writable: true,
      configurable: true,
    });
  };
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
  try {
    await deleteDB();
  } catch {
    // DB may not exist yet
  }
});

afterEach(() => {
  restoreFetch();
});

// ─── 1-4. Device profile detection ─────────────────────────────

describe('device profile detection', () => {
  it('low-memory-mobile: mobile UA with 2GB RAM returns correct profile', () => {
    const restore = mockNavigator({
      userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
      deviceMemory: 2,
      hardwareConcurrency: 2,
    });
    try {
      const profile = getModelProfile();
      expect(profile).toBe('low-memory-mobile');
    } finally {
      restore();
    }
  });

  it('modern-mobile: mobile UA with 6GB RAM returns correct profile', () => {
    const restore = mockNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      deviceMemory: 6,
      hardwareConcurrency: 4,
    });
    try {
      const profile = getModelProfile();
      expect(profile).toBe('modern-mobile');
    } finally {
      restore();
    }
  });

  it('laptop: desktop UA with 4 cores returns laptop profile', () => {
    const restore = mockNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      deviceMemory: 8,
      hardwareConcurrency: 4,
    });
    try {
      const profile = getModelProfile();
      expect(profile).toBe('laptop');
    } finally {
      restore();
    }
  });

  it('desktop: desktop UA with 8+ cores and 16GB returns desktop profile', () => {
    const restore = mockNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      deviceMemory: 16,
      hardwareConcurrency: 12,
    });
    try {
      const profile = getModelProfile();
      expect(profile).toBe('desktop');
    } finally {
      restore();
    }
  });
});

// ─── 5-6. WebGPU detection ─────────────────────────────────────

describe('WebGPU detection', () => {
  it('reports webgpu=true when navigator.gpu is present', () => {
    const restore = mockNavigator({ gpu: {} });
    try {
      const result = detectRuntime();
      expect(result.webgpu).toBe(true);
    } finally {
      restore();
    }
  });

  it('reports webgpu=false when navigator.gpu is absent', () => {
    const original = globalThis.navigator;
    const restore = mockNavigator({});
    try {
      delete (globalThis.navigator as any).gpu;
      const result = detectRuntime();
      expect(result.webgpu).toBe(false);
    } finally {
      restore();
    }
  });
});

// ─── 7-8. WASM detection ───────────────────────────────────────

describe('WASM detection', () => {
  it('reports wasm=true when WebAssembly is available', () => {
    const result = detectRuntime();
    expect(result.wasm).toBe(true);
  });

  it('reports wasm=false when WebAssembly is unavailable', () => {
    const original = (globalThis as any).WebAssembly;
    try {
      (globalThis as any).WebAssembly = undefined;
      const result = detectRuntime();
      expect(result.wasm).toBe(false);
    } finally {
      (globalThis as any).WebAssembly = original;
    }
  });
});

// ─── 9-10. Cloud fallback ──────────────────────────────────────

describe('cloud fallback', () => {
  it('returns fallback message when no local runtime is available', () => {
    const message = getCloudFallbackMessage({ webgpu: false, wasm: false });
    expect(message).toBe('No local runtime detected — falling back to cloud AI.');
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain('cloud');
  });

  it('returns empty string when a local runtime is available', () => {
    const message = getCloudFallbackMessage({ webgpu: true, wasm: false });
    expect(message).toBe('');
  });

  it('returns empty string when WASM is available', () => {
    const message = getCloudFallbackMessage({ webgpu: false, wasm: true });
    expect(message).toBe('');
  });
});

// ─── 11-12. Model profile selection ────────────────────────────

describe('model profile selection', () => {
  it('low-memory-mobile selects a small model (1B)', () => {
    const profile = 'low-memory-mobile' as DeviceProfile;
    const modelClass = getModelClass(profile);
    expect(modelClass).toBe('1B');
    expect(modelClass).toMatch(/^1B$/);
  });

  it('desktop selects a large model (70B)', () => {
    const profile = 'desktop' as DeviceProfile;
    const modelClass = getModelClass(profile);
    expect(modelClass).toBe('70B');
    expect(modelClass).toMatch(/^70B$/);
  });

  it('modern-mobile selects a medium model (3B)', () => {
    const modelClass = getModelClass('modern-mobile');
    expect(modelClass).toBe('3B');
  });

  it('laptop selects a medium-large model (7B)', () => {
    const modelClass = getModelClass('laptop');
    expect(modelClass).toBe('7B');
  });
});

// ─── 13. Resumable download ────────────────────────────────────

describe('resumable download after interruption', () => {
  it('resumes from partial state and verifies full data', async () => {
    const FULL_SIZE = 64;
    const PARTIAL_SIZE = 32;
    const firstHalf = new Uint8Array(PARTIAL_SIZE).fill(0x11);
    const secondHalf = new Uint8Array(PARTIAL_SIZE).fill(0x22);
    const fullData = new Uint8Array(FULL_SIZE);
    fullData.set(firstHalf, 0);
    fullData.set(secondHalf, PARTIAL_SIZE);

    const fullHash = await sha256Hex(fullData.buffer);

    const manifest = makeManifest({
      id: 'resume-test-model',
      shards: [
        {
          url: 'https://models.vantaos.dev/resume/test.bin',
          byteLength: FULL_SIZE,
          sha256: fullHash,
        },
      ],
    });

    await storePartialShard('resume-test-model/0', firstHalf.buffer);

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

    const resolved = await resolveModel('resume-test-model');
    expect(resolved).not.toBeNull();
  });
});

// ─── 14. Shard verification failure ────────────────────────────

describe('shard verification failure', () => {
  it('rejects a modified shard with SHA-256 mismatch', async () => {
    const data0 = new Uint8Array(64).fill(0xAA);
    const hash0 = await sha256Hex(data0.buffer);

    const manifest = makeManifest({
      id: 'tamper-test-model',
      shards: [
        {
          url: 'https://models.vantaos.dev/tamper/shard-0.bin',
          byteLength: 64,
          sha256: hash0,
        },
        {
          url: 'https://models.vantaos.dev/tamper/shard-1.bin',
          byteLength: 128,
          sha256: '00000000000000000000000000000000000000000000000000000000000000',
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
});

// ─── 15-16. Storage quota check ────────────────────────────────

describe('storage quota check', () => {
  it('refuses installation when storage is below threshold', () => {
    const result = checkStorageQuota(8, 16);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('Insufficient storage');
    expect(result.reason).toContain('8MB');
    expect(result.reason).toContain('16MB');
  });

  it('allows installation when storage meets threshold', () => {
    const result = checkStorageQuota(64, 16);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows installation at exact quota boundary', () => {
    const result = checkStorageQuota(16, 16);
    expect(result.ok).toBe(true);
  });
});

// ─── 17. detectRuntime suitable flag ───────────────────────────

describe('detectRuntime suitable flag', () => {
  it('suitable is true when WebGPU is available', () => {
    const restore = mockNavigator({ gpu: {} });
    try {
      const result = detectRuntime();
      expect(result.suitable).toBe(true);
    } finally {
      restore();
    }
  });

  it('suitable is true when WASM is available', () => {
    const result = detectRuntime();
    expect(result.suitable).toBe(true);
  });

  it('suitable is false when neither runtime is available', () => {
    const restore = mockNavigator({});
    const originalWA = (globalThis as any).WebAssembly;
    try {
      delete (globalThis.navigator as any).gpu;
      (globalThis as any).WebAssembly = undefined;
      const result = detectRuntime();
      expect(result.suitable).toBe(false);
    } finally {
      restore();
      (globalThis as any).WebAssembly = originalWA;
    }
  });
});
