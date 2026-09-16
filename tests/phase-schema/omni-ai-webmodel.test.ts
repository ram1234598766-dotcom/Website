import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { detectRuntime, resolveModel, modelCache, deleteDB } from '../../src/lib/models/adapter';
import { buildWebModelProvider } from '../../src/lib/ai/webmodel-provider';
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
  it('webmodel provider is present in PROVIDERS with browser models', () => {
    const webmodelProvider = getProviderById('webmodel');
    expect(webmodelProvider).toBeDefined();
    expect(webmodelProvider!.id).toBe('webmodel');
    expect(webmodelProvider!.models.length).toBeGreaterThan(0);
    expect(webmodelProvider!.defaultModel).toBe('gpt2');
  });

  it('buildWebModelProvider returns null when unsuitable', () => {
    const runtime = { webgpu: false, wasm: false, suitable: false };
    const provider = buildWebModelProvider(runtime, []);
    expect(provider).toBeNull();
  });

  it('buildWebModelProvider returns config when suitable', () => {
    const runtime = { webgpu: true, wasm: false, suitable: true };
    const models = [{ id: 'tiny-code', name: 'tiny-code-1.5b-q4' }];
    const provider = buildWebModelProvider(runtime, models);
    expect(provider).not.toBeNull();
    expect(provider!.id).toBe('webmodel');
    expect(provider!.defaultModel).toBe('tiny-code');
  });
});

// ─── 4. Provider coverage: WebModel + cloud, no local-LLM daemon ──────────

describe('Provider coverage', () => {
  it('no local-LLM daemon provider is registered (Ollama removed)', () => {
    expect(getProviderById('ollama')).toBeUndefined();
  });

  it('cloud providers are always available in PROVIDERS', () => {
    for (const id of ['openrouter', 'gemini', 'openai']) {
      const p = getProviderById(id);
      expect(p).toBeDefined();
      expect(p!.models.length).toBeGreaterThan(0);
    }
  });

  it('resolveModel returns null for unknown model (browser cache miss)', async () => {
    const result = await resolveModel('nonexistent-model');
    expect(result).toBeNull();
  });
});

// ─── 5. Provider selection order ──────────────────────────────────────────

describe('Provider selection order', () => {
  it('WebModel is first (default pick)', () => {
    expect(PROVIDERS[0].id).toBe('webmodel');
  });

  it('Cloud providers are in PROVIDERS', () => {
    const cloud = PROVIDERS.filter((p) => p.id !== 'webmodel');
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

// ─── 7. friendlyWebModelError — truthful error classification ─────────────

describe('friendlyWebModelError', () => {
  async function loadFriendly() {
    const mod = await import('../../src/components/OmniAI');
    return mod.friendlyWebModelError as (err: unknown) => string;
  }

  it('classifies download failures as a download problem, not "blocked"', async () => {
    const friendly = await loadFriendly();
    for (const msg of [
      'The onnx-community/SmolLM2-135M-ONNX model failed to download: 404 Not Found',
      'unable to locate file https://huggingface.co/.../config.json',
      'Service Unavailable',
      'load file failed',
      'Failed to download model file (403 Forbidden)',
      'fetch failed',
      'NetworkError: connection refused',
      // Exact transformers.js message seen in production when HuggingFace
      // CDN 503s a proxied .onnx_data shard
      'Service unavailable error occurred while trying to load file: "https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/onnx/model.onnx_data"',
    ]) {
      expect(friendly(new Error(msg))).toContain("couldn't download its model files");
    }
  });

  it('does not claim a HuggingFace block for ordinary model failures', async () => {
    const friendly = await loadFriendly();
    const out = friendly(
      new Error('The onnx-community/SmolLM2-135M-ONNX model failed to download: 404 Not Found'),
    );
    expect(out.toLowerCase()).not.toContain('blocked');
  });

  it('classifies runtime failures (WebGPU / device / timeout) with the raw cause', async () => {
    const friendly = await loadFriendly();
    expect(friendly(new Error('WebGPU is not supported by this browser'))).toContain("couldn't run its in-browser runtime");
    expect(friendly(new Error('Execution timed out while loading model weights'))).toContain("couldn't run its in-browser runtime");
  });

  it('returns the raw message when it does not match a known failure', async () => {
    const friendly = await loadFriendly();
    const raw = 'Something unprecedented happened while parsing';
    expect(friendly(new Error(raw))).toBe(raw);
  });

  it('coerces non-Error values and undefined', async () => {
    const friendly = await loadFriendly();
    expect(friendly('failed to download weights')).toContain("couldn't download its model files");
    expect(friendly(undefined)).toBe('Unknown error');
  });
});
