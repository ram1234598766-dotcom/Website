/**
 * Manifest validation tests for validateManifest(), totalBytes(), verifyShardDigests().
 */

import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  totalBytes,
  verifyShardDigests,
  type ModelManifest,
  type ModelShard,
} from '../src/lib/models/manifest';

function validShard(o: Partial<ModelShard> = {}): ModelShard {
  return {
    url: 'https://models.vantaos.dev/test/model/v1/shard-0.bin',
    byteLength: 1024,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ...o,
  };
}

function validManifest(o: Partial<ModelManifest> = {}): ModelManifest {
  return {
    id: 'test-model',
    version: '1.0.0',
    publisher: 'Test Publisher',
    signatureScheme: 'ed25519',
    signature: 'abc123abc123abc123abc123abc123abc123abc123abc123',
    shards: [validShard()],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 },
    license: { name: 'MIT', acceptableUse: ['research', 'commercial'] },
    ...o,
  };
}

function assertThrows(fn: () => void): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error('Expected function to throw');
}

describe('validateManifest', () => {
  describe('valid input', () => {
    it('accepts a complete valid manifest', () => {
      const m = validManifest();
      const r = validateManifest(m);
      expect(r.id).toBe('test-model');
      expect(r.shards).toHaveLength(1);
    });
    it('accepts hmac-sha256 scheme', () => {
      expect(() => validateManifest(validManifest({ signatureScheme: 'hmac-sha256' }))).not.toThrow();
    });
    it('accepts multiple shards', () => {
      const m = validManifest({ shards: [validShard(), validShard({ url: 'https://models.vantaos.dev/x/y.bin' })] });
      expect(() => validateManifest(m)).not.toThrow();
    });
    it('accepts license with url', () => {
      const m = validManifest({ license: { name: 'Apache-2.0', url: 'https://example.com', acceptableUse: ['research'] } });
      expect(() => validateManifest(m)).not.toThrow();
    });
    it('accepts semver prerelease', () => {
      expect(() => validateManifest(validManifest({ version: '1.0.0-beta.1' }))).not.toThrow();
    });
    it('rejects semver build metadata', () => {
      expect(() => validateManifest(validManifest({ version: '2.1.0+build' }))).toThrow(/Invalid semver/);
    });
  });

  describe('raw input type', () => {
    it('rejects null', () => { assertThrows(() => validateManifest(null)); });
    it('rejects undefined', () => { assertThrows(() => validateManifest(undefined)); });
    it('rejects string', () => { assertThrows(() => validateManifest('hello')); });
    it('rejects number', () => { assertThrows(() => validateManifest(42)); });
    it('rejects boolean', () => { assertThrows(() => validateManifest(true)); });
    it('rejects array', () => { assertThrows(() => validateManifest([])); });
  });

  describe('id validation', () => {
    it('rejects missing', () => { assertThrows(() => validateManifest(validManifest({ id: undefined } as ModelManifest))); });
    it('rejects empty', () => { assertThrows(() => validateManifest(validManifest({ id: '' }))); });
    it('rejects non-string', () => { assertThrows(() => validateManifest(validManifest({ id: 123 } as unknown as ModelManifest))); });
  });
  describe('version validation', () => {
    it('rejects missing', () => { assertThrows(() => validateManifest(validManifest({ version: undefined } as ModelManifest))); });
    it('rejects empty', () => { assertThrows(() => validateManifest(validManifest({ version: '' }))); });
    it('rejects non-semver', () => { assertThrows(() => validateManifest(validManifest({ version: 'v1.0' }))); });
    it('rejects no patch', () => { assertThrows(() => validateManifest(validManifest({ version: '1.0' }))); });
    it('rejects special chars', () => { assertThrows(() => validateManifest(validManifest({ version: '1.0.0!' }))); });
    it('accepts hyphen prerelease', () => { expect(() => validateManifest(validManifest({ version: '1.2.3-alpha' }))).not.toThrow(); });
    it('accepts numeric prerelease', () => { expect(() => validateManifest(validManifest({ version: '1.2.3-1' }))).not.toThrow(); });
  });
  describe('publisher validation', () => {
    it('rejects missing', () => { assertThrows(() => validateManifest(validManifest({ publisher: undefined } as ModelManifest))); });
    it('rejects empty', () => { assertThrows(() => validateManifest(validManifest({ publisher: '' }))); });
    it('rejects non-string', () => { assertThrows(() => validateManifest(validManifest({ publisher: 123 } as unknown as ModelManifest))); });
  });
  describe('signatureScheme validation', () => {
    it('rejects invalid', () => { assertThrows(() => validateManifest(validManifest({ signatureScheme: 'rsa' } as any))); });
    it('rejects missing', () => { assertThrows(() => validateManifest(validManifest({ signatureScheme: undefined } as ModelManifest))); });
  });
  describe('signature validation', () => {
    it('rejects non-base64url', () => { assertThrows(() => validateManifest(validManifest({ signature: 'hello!' }))); });
    it('rejects empty', () => { assertThrows(() => validateManifest(validManifest({ signature: '' }))); });
    it('rejects with space', () => { assertThrows(() => validateManifest(validManifest({ signature: 'abc def' }))); });
    it('accepts valid base64url', () => { expect(() => validateManifest(validManifest({ signature: 'AbCd123_-' }))).not.toThrow(); });
  });

  describe('shards validation', () => {
    it('rejects missing', () => { assertThrows(() => validateManifest(validManifest({ shards: undefined } as ModelManifest))); });
    it('rejects null', () => { assertThrows(() => validateManifest(validManifest({ shards: null as any }))); });
    it('rejects empty array', () => { assertThrows(() => validateManifest(validManifest({ shards: [] }))); });
    it('rejects non-array', () => { assertThrows(() => validateManifest(validManifest({ shards: 'x' as any }))); });

    describe('individual shard', () => {
      it('rejects http url', () => { const m = validManifest({ shards: [validShard({ url: 'http://x.com/f' })] }); assertThrows(() => validateManifest(m)); });
      it('rejects empty url', () => { const m = validManifest({ shards: [validShard({ url: '' })] }); assertThrows(() => validateManifest(m)); });
      it('rejects non-string url', () => { const m = validManifest({ shards: [validShard({ url: 123 as any })] }); assertThrows(() => validateManifest(m)); });
      it('rejects zero byteLength', () => { const m = validManifest({ shards: [validShard({ byteLength: 0 })] }); assertThrows(() => validateManifest(m)); });
      it('rejects negative byteLength', () => { const m = validManifest({ shards: [validShard({ byteLength: -1 })] }); assertThrows(() => validateManifest(m)); });
      it('rejects NaN byteLength', () => { const m = validManifest({ shards: [validShard({ byteLength: NaN } as Partial<ModelShard>)] }); assertThrows(() => validateManifest(m)); });
      it('rejects Infinity byteLength', () => { const m = validManifest({ shards: [validShard({ byteLength: Infinity })] }); assertThrows(() => validateManifest(m)); });
      it('rejects non-number byteLength', () => { const m = validManifest({ shards: [validShard({ byteLength: 'x' as any })] }); assertThrows(() => validateManifest(m)); });
      it('rejects float byteLength', () => { const m = validManifest({ shards: [validShard({ byteLength: 1.5 as any })] }); assertThrows(() => validateManifest(m)); });
      it('rejects short sha256', () => { const m = validManifest({ shards: [validShard({ sha256: 'abc123' })] }); assertThrows(() => validateManifest(m)); });
      it('rejects uppercase sha256', () => { const m = validManifest({ shards: [validShard({ sha256: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855' })] }); assertThrows(() => validateManifest(m)); });
      it('rejects wrong sha256 chars', () => { const m = validManifest({ shards: [validShard({ sha256: 'g3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })] }); assertThrows(() => validateManifest(m)); });
      it('rejects missing sha256', () => { const m = validManifest({ shards: [validShard({ sha256: undefined })] }); assertThrows(() => validateManifest(m)); });
      it('rejects non-string sha256', () => { const m = validManifest({ shards: [validShard({ sha256: 123 as any })] }); assertThrows(() => validateManifest(m)); });
      it('rejects string shard', () => { const m = validManifest({ shards: ['x' as any] }); assertThrows(() => validateManifest(m)); });
    });
  });

  describe('runtimeRequirements validation', () => {
    it('rejects missing', () => { assertThrows(() => validateManifest(validManifest({ runtimeRequirements: undefined } as ModelManifest))); });
    it('rejects null', () => { assertThrows(() => validateManifest(validManifest({ runtimeRequirements: null as any }))); });
    it('rejects non-object', () => { assertThrows(() => validateManifest(validManifest({ runtimeRequirements: 'x' as any }))); });
      it('rejects non-boolean webgpu', () => { const m = validManifest({ runtimeRequirements: { webgpu: 'yes' as any, wasm: true, minMemoryMB: 512, minStorageMB: 16 } }); assertThrows(() => validateManifest(m)); });
      it('rejects non-boolean wasm', () => { const m = validManifest({ runtimeRequirements: { webgpu: true, wasm: 1 as any, minMemoryMB: 512, minStorageMB: 16 } }); assertThrows(() => validateManifest(m)); });
      it('rejects non-number minMemoryMB', () => { const m = validManifest({ runtimeRequirements: { webgpu: true, wasm: true, minMemoryMB: 'x' as any, minStorageMB: 16 } }); assertThrows(() => validateManifest(m)); });
    it('rejects zero minMemoryMB', () => { const m = validManifest({ runtimeRequirements: { webgpu: true, wasm: true, minMemoryMB: 0, minStorageMB: 16 } }); assertThrows(() => validateManifest(m)); });
      it('rejects non-number minStorageMB', () => { const m = validManifest({ runtimeRequirements: { webgpu: true, wasm: true, minMemoryMB: 512, minStorageMB: 'x' as any } }); assertThrows(() => validateManifest(m)); });
    it('rejects negative minStorageMB', () => { const m = validManifest({ runtimeRequirements: { webgpu: true, wasm: true, minMemoryMB: 512, minStorageMB: -1 } }); assertThrows(() => validateManifest(m)); });
  });

  describe('license validation', () => {
    it('rejects missing', () => { assertThrows(() => validateManifest(validManifest({ license: undefined } as ModelManifest))); });
    it('rejects null', () => { assertThrows(() => validateManifest(validManifest({ license: null as any }))); });
      it('rejects non-object', () => { assertThrows(() => validateManifest(validManifest({ license: 'MIT' as any }))); });
    it('rejects empty name', () => { const m = validManifest({ license: { name: '', acceptableUse: ['r'] } }); assertThrows(() => validateManifest(m)); });
    it('rejects non-string name', () => { const m = validManifest({ license: { name: 123, acceptableUse: ['r'] } as any }); assertThrows(() => validateManifest(m)); });
      it('rejects non-string url', () => { const m = validManifest({ license: { name: 'MIT', url: 42 as any, acceptableUse: ['r'] } }); assertThrows(() => validateManifest(m)); });
    it('rejects empty acceptableUse', () => { const m = validManifest({ license: { name: 'MIT', acceptableUse: [] } }); assertThrows(() => validateManifest(m)); });
    it('rejects non-array acceptableUse', () => { const m = validManifest({ license: { name: 'MIT', acceptableUse: 'r' } as any }); assertThrows(() => validateManifest(m)); });
    it('accepts license with url', () => { const m = validManifest({ license: { name: 'Apache-2.0', url: 'https://x', acceptableUse: ['c'] } }); expect(() => validateManifest(m)).not.toThrow(); });
    it('accepts license without url', () => { const m = validManifest({ license: { name: 'MIT', acceptableUse: ['r'] } }); expect(() => validateManifest(m)).not.toThrow(); });
  });

  describe('return type', () => {
    it('returned manifest has correct types', () => {
      const m = validateManifest(validManifest());
      expect(typeof m.id).toBe('string');
      expect(typeof m.version).toBe('string');
      expect(typeof m.shards).toBe('object');
      expect(Array.isArray(m.shards)).toBe(true);
      expect(typeof m.signatureScheme).toBe('string');
      expect(typeof m.signature).toBe('string');
      expect(typeof m.publisher).toBe('string');
      expect(typeof m.runtimeRequirements).toBe('object');
      expect(typeof m.license).toBe('object');
    });
    it('returned shards are ModelShard-compatible', () => {
      const m = validateManifest(validManifest());
      const s = m.shards[0];
      expect(typeof s.url).toBe('string');
      expect(typeof s.byteLength).toBe('number');
      expect(typeof s.sha256).toBe('string');
    });
  });
});

describe('totalBytes', () => {
  it('sums shard bytes', () => {
    const m = validManifest({ shards: [validShard({ byteLength: 100 }), validShard({ byteLength: 200 })] });
    expect(totalBytes(m)).toBe(300);
  });
  it('single shard', () => {
    const m = validManifest({ shards: [validShard({ byteLength: 512 })] });
    expect(totalBytes(m)).toBe(512);
  });
  it('large bytes', () => {
    const m = validManifest({ shards: [validShard({ byteLength: 512 * 1024 * 1024 })] });
    expect(totalBytes(m)).toBe(512 * 1024 * 1024);
  });
});

describe('verifyShardDigests', () => {
  const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  it('true when all match', () => {
    const m = validManifest({ shards: [validShard({ sha256: sha }), validShard({ sha256: sha })] });
    expect(verifyShardDigests(m, new Map<number, string>([[0, sha], [1, sha]]))).toBe(true);
  });
  it('false on mismatch', () => {
    const m = validManifest({ shards: [validShard({ sha256: sha }), validShard({ sha256: sha })] });
    expect(verifyShardDigests(m, new Map<number, string>([[0, sha], [1, 'wrong']]))).toBe(false);
  });
  it('false when digest missing', () => {
    const m = validManifest({ shards: [validShard({ sha256: sha })] });
    expect(verifyShardDigests(m, new Map<number, string>())).toBe(false);
  });
  it('single shard', () => {
    const m = validManifest({ shards: [validShard({ sha256: sha })] });
    expect(verifyShardDigests(m, new Map<number, string>([[0, sha]]))).toBe(true);
  });
});
