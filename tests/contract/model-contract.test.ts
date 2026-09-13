import { describe, it, expect } from 'vitest';
import { validateManifest } from '../../src/lib/models/manifest';

describe('validateManifest() contract', () => {
  it('is a function', () => {
    expect(typeof validateManifest).toBe('function');
  });

  it('accepts a valid manifest', () => {
    const manifest = {
      id: 'model-1',
      version: '1.0.0',
      publisher: 'test',
      signatureScheme: 'ed25519' as const,
      signature: 'abc123',
      shards: [
        { url: 'https://example.com/model.bin', byteLength: 1024, sha256: 'a'.repeat(64) },
      ],
      runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 1024, minStorageMB: 1024 },
      license: { name: 'MIT', acceptableUse: ['research'] },
    };

    const result = validateManifest(manifest);
    expect(result).not.toBeNull();
    expect(result.id).toBe('model-1');
  });

  it('rejects invalid manifests', () => {
    expect(() => validateManifest(null)).toThrow();
    expect(() => validateManifest({})).toThrow();
    expect(() => validateManifest({ id: 'x', version: 'bad', publisher: 'p', signatureScheme: 'ed25519', signature: 'abc', shards: [{ url: 'https://x.com/f.bin', byteLength: 1, sha256: 'a'.repeat(64) }], runtimeRequirements: { webgpu: false, wasm: false, minMemoryMB: 1, minStorageMB: 1 }, license: { name: 'x', acceptableUse: ['a'] } })).toThrow();
  });
});
