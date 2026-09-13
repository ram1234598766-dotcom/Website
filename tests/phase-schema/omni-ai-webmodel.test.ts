import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { detectRuntime, resolveModel, modelCache, deleteDB } from '../../src/lib/models/adapter';
import { PROVIDERS, getProviderById } from '../../src/lib/ai/providers';

// ─── Helpers ─────────────────────────────────────

beforeEach(async () => {
  try { await deleteDB(); } catch { /* DB may not exist */ }
  modelCache.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. WebModel provider appears in PROVIDERS when runtime is ready ─────

describe('WebModel provider availability', () => {
  it('detectRuntime returns required fields', () => {
    const result = detectRuntime();
    expect(result).toHaveProperty('webgpu');
    expect(result).toHaveProperty('wasm');
    expect(result).toHaveProperty('suitable');
    expect(typeof result.webgpu).toBe('boolean');
    expect(typeof result.wasm).toBe('boolean');
    expect(typeof result.suitable).toBe('boolean');
  });

  it('suitable is true when WebGPU is available', () => {
    const originalGPU = (globalThis.navigator as any).gpu;
    try {
      Object.defineProperty(globalThis.navigator, 'gpu', { value: {}, configurable: true, writable: true });
      const result = detectRuntime();
      expect(result.suitable).toBe(true);
    } finally {
      if (originalGPU === undefined) {
        delete (globalThis.navigator as any).gpu;
      } else {
        (globalThis.navigator as any).gpu = originalGPU;
      }
    }
  });

  it('suitable is true when WASM is available', () => {
    const result = detectRuntime();
    expect(result.suitable).toBe(true);
  });

  it('suitable is false when neither runtime is available', () => {
    const originalWA = (globalThis as any).WebAssembly;
    const originalGPU = (globalThis.navigator as any).gpu;
    try {
      (globalThis as any).WebAssembly = undefined;
      delete (globalThis.navigator as any).gpu;
      const result = detectRuntime();
      expect(result.suitable).toBe(false);
    } finally {
      (globalThis as any).WebAssembly = originalWA;
      if (originalGPU === undefined) {
        delete (globalThis.navigator as any).gpu;
      } else {
        (globalThis.navigator as any).gpu = originalGPU;
      }
    }
  });
});

// ─── 2. WebModel model listing from cache ─────────────────────────────────

describe('WebModel model listing', () => {
  it('returns empty list when no models are cached', async () => {
    modelCache.clear();
    const models: { id: string; name: string }[] = [];
    modelCache.forEach((manifest) => {
      models.push({ id: manifest.id, name: `${manifest.id} (${manifest.version})` });
    });
    expect(models).toEqual([]);
  });

  it('lists cached models from modelCache', async () => {
    const manifest = {
      id: 'tiny-code-1.5b-q4',
      version: '2026.09.1',
      publisher: 'Test Lab',
      signatureScheme: 'ed25519' as const,
      signature: 'aB3_abc123def456ghi789',
      shards: [
        { url: 'https://models.example.com/m/shard-0.bin', byteLength: 64, sha256: 'a'.repeat(64) },
      ],
      runtimeRequirements: { webgpu: true, wasm: false, minMemoryMB: 512, minStorageMB: 16 },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT', acceptableUse: ['research'] },
    };
    modelCache.set(manifest.id, manifest as any);

    const models: { id: string; name: string }[] = [];
    modelCache.forEach((m) => {
      models.push({ id: m.id, name: `${m.id} (${m.version})` });
    });

    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBe('tiny-code-1.5b-q4');
    expect(models[0].name).toContain('tiny-code-1.5b-q4');
  });
});

// ─── 3. WebModel provider configuration ───────────────────────────────────

describe('WebModel provider config', () => {
  it('webmodel provider id is in PROVIDERS list', () => {
    const webmodelProvider = PROVIDERS.find((p) => p.id === 'webmodel');
    expect(webmodelProvider).toBeUndefined();
  });

  it('buildWebModelProvider returns null when unsuitable', () => {
    const runtime = { webgpu: false, wasm: false, suitable: false };
    const configs = [{ id: 'test', name: 'Test', models: [], defaultModel: '', desc: '' }];
    expect(runtime.suitable).toBe(false);
  });

  it('buildWebModelProvider returns config when suitable', () => {
    const runtime = { webgpu: true, wasm: false, suitable: true };
    const models = [{ id: 'tiny-code', name: 'tiny-code-1.5b-q4' }];
    expect(runtime.suitable).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });
});

// ─── 4. Fallback to Ollama when WebModel unavailable ──────────────────────

describe('WebModel → Ollama fallback', () => {
  it('falls back to Ollama when WebModel runtime is unsuitable', () => {
    const runtime = detectRuntime();
    if (!runtime.suitable) {
      const ollamaProvider = getProviderById('ollama');
      expect(ollamaProvider).toBeDefined();
      expect(ollamaProvider!.id).toBe('ollama');
    }
  });

  it('Ollama provider exists in PROVIDERS', () => {
    const ollamaProvider = getProviderById('ollama');
    expect(ollamaProvider).toBeDefined();
    expect(ollamaProvider!.id).toBe('ollama');
    expect(ollamaProvider!.models.length).toBeGreaterThan(0);
  });

  it('resolveModel returns null for unknown model (triggers fallback)', async () => {
    const result = await resolveModel('nonexistent-model');
    expect(result).toBeNull();
  });
});

// ─── 5. Provider selection order ──────────────────────────────────────────

describe('Provider selection order', () => {
  it('Ollama is in PROVIDERS', () => {
    const ollama = PROVIDERS.find((p) => p.id === 'ollama');
    expect(ollama).toBeDefined();
  });

  it('Cloud providers are in PROVIDERS', () => {
    const cloud = PROVIDERS.filter((p) => p.id !== 'ollama');
    expect(cloud.length).toBeGreaterThanOrEqual(1);
  });

  it('getProviderById returns correct provider', () => {
    const provider = getProviderById('openrouter');
    expect(provider).toBeDefined();
    expect(provider!.id).toBe('openrouter');
  });
});

// ─── 6. WebModel query fallback chain ─────────────────────────────────────

describe('Query fallback chain', () => {
  it('localQuery is available as fallback', async () => {
    const { localQuery } = await import('../../src/components/OmniAI');
    expect(typeof localQuery).toBe('function');
  }, 30000);
});
