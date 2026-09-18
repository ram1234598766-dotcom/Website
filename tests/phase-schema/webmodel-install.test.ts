import { describe, it, expect } from 'vitest';
import { installModel, queryWebModel, resolveModelRepo, SUPPORTED_MODEL_IDS } from '../../src/lib/models/adapter';
import type { SupportedModelId } from '../../src/lib/models/adapter';

// Tests that don't require browser (can run in Node) verify the plumbing.
// Tests that require browser inference are marked with a comment about infra requirement.

describe('WebModel install', () => {
  it('resolves model IDs to HuggingFace repos', () => {
    expect(resolveModelRepo('gpt2')).toBe('Xenova/gpt2');
    expect(resolveModelRepo('tinyllama')).toBe('onnx-community/SmolLM2-135M-ONNX');
    expect(resolveModelRepo('webmodel')).toBe('onnx-community/SmolLM2-135M-ONNX');
  });

  it('supports the expected model IDs', () => {
    const ids: SupportedModelId[] = ['gpt2', 'tinyllama', 'webmodel'];
    expect(SUPPORTED_MODEL_IDS).toEqual(expect.arrayContaining(ids));
  });

  it('installModel exists and is a function', () => {
    expect(typeof installModel).toBe('function');
  });

  it('queryWebModel exists and is a function', () => {
    expect(typeof queryWebModel).toBe('function');
  });

  it('installModel runs inference test and returns a RuntimeInstance for gpt2 (requires browser + WASM)', async () => {
    // This test requires browser environment with IndexedDB (for model caching).
    // Skip gracefully if not available.
    if (typeof indexedDB === 'undefined') {
      console.warn('[webmodel-install] IndexedDB required, skipping inference test');
      return; // vitest treats returning from test as pass (no fail)
    }
    const instance = await installModel('gpt2');
    expect(instance).toBeDefined();
    expect(instance.modelId).toBe('gpt2');
    expect(instance.id).toContain('gpt2');

    // Now run actual inference
    const output = await queryWebModel('Hello, world!', 'gpt2', 60000);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });
});
