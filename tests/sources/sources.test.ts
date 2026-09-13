/**
 * Phase — Trusted Model Source Registry tests.
 *
 * Tests getTrustedSources, isTrustedUrl, and verifyModelSource
 * from src/lib/models/sources.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  getTrustedSources,
  isTrustedUrl,
  verifyModelSource,
} from '../../src/lib/models/sources';
import type { ModelManifest } from '../../src/lib/models/manifest';

const VALID_MANIFEST: ModelManifest = {
  id: 'test-model',
  version: '1.0.0',
  publisher: 'Test Lab',
  signatureScheme: 'ed25519',
  signature: 'aB3_abc123def456ghi789',
  shards: [
    {
      url: 'https://models.vantaos.dev/test-model/v1/shard-0.bin',
      byteLength: 1024,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
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

describe('getTrustedSources', () => {
  it('returns an array of verified sources', () => {
    const sources = getTrustedSources();
    expect(sources.length).toBeGreaterThan(0);
    sources.forEach((s) => expect(s.verified).toBe(true));
  });

  it('includes HuggingFace', () => {
    const sources = getTrustedSources();
    const hf = sources.find((s) => s.name === 'HuggingFace');
    expect(hf).toBeDefined();
    expect(hf!.baseURL).toBe('https://huggingface.co');
    expect(hf!.verified).toBe(true);
  });

  it('includes VantaOS Official', () => {
    const sources = getTrustedSources();
    const vanta = sources.find((s) => s.name === 'VantaOS Official');
    expect(vanta).toBeDefined();
    expect(vanta!.baseURL).toBe('https://models.vantaos.dev');
    expect(vanta!.verified).toBe(true);
  });

  it('includes Ollama Library', () => {
    const sources = getTrustedSources();
    const ollama = sources.find((s) => s.name === 'Ollama Library');
    expect(ollama).toBeDefined();
    expect(ollama!.baseURL).toBe('https://ollama.com/library');
    expect(ollama!.verified).toBe(true);
  });

  it('each source has required fields', () => {
    const sources = getTrustedSources();
    sources.forEach((s) => {
      expect(typeof s.name).toBe('string');
      expect(typeof s.baseURL).toBe('string');
      expect(typeof s.verified).toBe('boolean');
      expect(Array.isArray(s.allowedModels)).toBe(true);
    });
  });
});

describe('isTrustedUrl', () => {
  it('returns true for VantaOS Official URLs', () => {
    expect(isTrustedUrl('https://models.vantaos.dev/model/shard.bin')).toBe(true);
    expect(
      isTrustedUrl('https://models.vantaos.dev/vanta-llama3-8b-quant/v1/shard-0.bin'),
    ).toBe(true);
  });

  it('returns true for HuggingFace URLs', () => {
    expect(isTrustedUrl('https://huggingface.co/models/xyz')).toBe(true);
    expect(isTrustedUrl('https://huggingface.co')).toBe(true);
  });

  it('returns true for Ollama Library URLs', () => {
    expect(isTrustedUrl('https://ollama.com/library/llama3')).toBe(true);
    expect(isTrustedUrl('https://ollama.com/library/phi3')).toBe(true);
  });

  it('returns true for subdomains of trusted sources', () => {
    expect(isTrustedUrl('https://cdn.models.vantaos.dev/file.bin')).toBe(true);
  });

  it('returns false for untrusted URLs', () => {
    expect(isTrustedUrl('https://evil.com/model.bin')).toBe(false);
    expect(isTrustedUrl('http://models.vantaos.dev/model.bin')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isTrustedUrl('not-a-url')).toBe(false);
    expect(isTrustedUrl('')).toBe(false);
    expect(isTrustedUrl('relative/path')).toBe(false);
  });

  it('returns false for http URLs on trusted hosts', () => {
    expect(isTrustedUrl('http://huggingface.co/model.bin')).toBe(false);
  });
});

describe('verifyModelSource', () => {
  it('returns true when all shards are from trusted sources', () => {
    const result = verifyModelSource(VALID_MANIFEST);
    expect(result).toBe(true);
  });

  it('throws when a shard URL is from an untrusted source', () => {
    const untrusted: ModelManifest = {
      ...VALID_MANIFEST,
      shards: [
        {
          ...VALID_MANIFEST.shards[0],
          url: 'https://evil.com/test-model/shard-0.bin',
        },
      ],
    };
    expect(() => verifyModelSource(untrusted)).toThrow('Untrusted model source');
  });

  it('throws when a shard URL is from an unknown domain', () => {
    const untrusted: ModelManifest = {
      ...VALID_MANIFEST,
      shards: [
        {
          ...VALID_MANIFEST.shards[0],
          url: 'https://random-server.example.com/model.bin',
        },
      ],
    };
    expect(() => verifyModelSource(untrusted)).toThrow('Untrusted model source');
  });

  it('throws when one shard is trusted and another is not', () => {
    const mixed: ModelManifest = {
      ...VALID_MANIFEST,
      shards: [
        {
          url: 'https://models.vantaos.dev/test-model/v1/shard-0.bin',
          byteLength: 1024,
          sha256: 'a'.repeat(64),
        },
        {
          url: 'https://evil.com/test-model/shard-1.bin',
          byteLength: 1024,
          sha256: 'b'.repeat(64),
        },
      ],
    };
    expect(() => verifyModelSource(mixed)).toThrow('Untrusted model source');
  });

  it('throws with details about which shards failed', () => {
    const untrusted: ModelManifest = {
      ...VALID_MANIFEST,
      shards: [
        {
          url: 'https://evil.com/test-model/shard-0.bin',
          byteLength: 1024,
          sha256: 'a'.repeat(64),
        },
      ],
    };
    try {
      verifyModelSource(untrusted);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('shard 0');
      expect((err as Error).message).toContain('evil.com');
      expect((err as Error).message).toContain('HuggingFace');
      expect((err as Error).message).toContain('VantaOS');
      expect((err as Error).message).toContain('Ollama');
    }
  });
});
