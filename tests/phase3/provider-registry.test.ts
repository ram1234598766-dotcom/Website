import { describe, expect, it, vi } from 'vitest';
import { PROVIDERS, getProviderById, type ProviderConfig } from '../../src/lib/ai/providers';

describe('Provider config registry', () => {
  it('exports all four default providers', () => {
    expect(PROVIDERS).toHaveLength(4);
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toContain('ollama');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('gemini');
    expect(ids).toContain('openai');
  });

  it('each provider has required fields', () => {
    for (const p of PROVIDERS) {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.models).toBeInstanceOf(Array);
      expect(p.models.length).toBeGreaterThan(0);
      expect(p.defaultModel).toBeDefined();
      expect(p.desc).toBeDefined();
    }
  });

  it('ollama default model is llama3', () => {
    const ollama = getProviderById('ollama');
    expect(ollama?.defaultModel).toBe('llama3');
  });

  it('getProviderById returns undefined for unknown ids', () => {
    expect(getProviderById('nonexistent')).toBeUndefined();
  });

  it('getProviderById returns the correct provider', () => {
    const p = getProviderById('openrouter');
    expect(p?.name).toBe('OpenRouter');
    expect(p?.models).toHaveLength(2);
  });

  it('PROVIDERS array is immutable in shape (models are defined)', () => {
    for (const p of PROVIDERS) {
      for (const m of p.models) {
        expect(m.id).toBeDefined();
        expect(m.name).toBeDefined();
      }
    }
  });
});
