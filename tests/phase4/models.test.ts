/**
 * Phase 4 — WebModel delivery tests.
 *
 * Tests manifest validation, download interruption/resume, digest
 * verification, and device capability detection.
 *
 * Network calls are fully mocked — no real fetch is made.
 */

import { describe, expect, it, afterEach } from 'vitest';
import {
  validateManifest,
  totalBytes,
  verifyShardDigests,
} from '../../src/lib/models/manifest';
import type { ModelManifest } from '../../src/lib/models/manifest';
import { ResumableShardDownloader } from '../../src/lib/models/downloader';
import { detectDeviceSync, meetsRequirements } from '../../src/lib/models/device';

/* ------------------------------------------------------------------ */
/*  Manifest validation                                                */
/* ------------------------------------------------------------------ */

const VALID_MANIFEST: ModelManifest = {
  id: 'vanta-test-model',
  version: '1.0.0',
  publisher: 'Test Lab',
  signatureScheme: 'ed25519',
  signature: 'aB3_abc123def456ghi789',
  shards: [
    {
      url: 'https://models.example.com/model/shard-0.bin',
      byteLength: 1024,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      url: 'https://models.example.com/model/shard-1.bin',
      byteLength: 2048,
      sha256: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a',
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

describe('validateManifest', () => {
  it('accepts a fully-valid manifest', () => {
    const result = validateManifest(JSON.parse(JSON.stringify(VALID_MANIFEST)));
    expect(result.id).toBe('vanta-test-model');
    expect(result.shards).toHaveLength(2);
  });

  it('rejects null / non-object input', () => {
    expect(() => validateManifest(null)).toThrow('Manifest must be a JSON object');
    expect(() => validateManifest('string')).toThrow('Manifest must be a JSON object');
    expect(() => validateManifest(42)).toThrow('Manifest must be a JSON object');
  });

  it('rejects missing id', () => {
    const m = { ...VALID_MANIFEST, id: '' };
    expect(() => validateManifest(m)).toThrow('Missing or empty manifest.id');
  });

  it('rejects invalid semver', () => {
    const m = { ...VALID_MANIFEST, version: 'not-semver' };
    expect(() => validateManifest(m)).toThrow('Invalid semver');
  });

  it('accepts pre-release semver', () => {
    const m = { ...VALID_MANIFEST, version: '1.0.0-alpha.1' };
    const result = validateManifest(m);
    expect(result.version).toBe('1.0.0-alpha.1');
  });

  it('rejects invalid signatureScheme', () => {
    const m = { ...VALID_MANIFEST, signatureScheme: 'rsa' as any };
    expect(() => validateManifest(m)).toThrow('signatureScheme must be');
  });

  it('rejects non-base64url signature', () => {
    const m = { ...VALID_MANIFEST, signature: 'not base64url!' };
    expect(() => validateManifest(m)).toThrow('signature must be base64url-encoded');
  });

  it('rejects empty shards array', () => {
    const m = { ...VALID_MANIFEST, shards: [] };
    expect(() => validateManifest(m)).toThrow('non-empty array');
  });

  it('rejects non-HTTPS shard URL', () => {
    const m = {
      ...VALID_MANIFEST,
      shards: [{ ...VALID_MANIFEST.shards[0], url: 'http://insecure.example.com/x.bin' }],
    };
    expect(() => validateManifest(m)).toThrow('HTTPS URL');
  });

  it('rejects invalid SHA-256 digest length', () => {
    const m = {
      ...VALID_MANIFEST,
      shards: [{ ...VALID_MANIFEST.shards[0], sha256: 'tooshort' }],
    };
    expect(() => validateManifest(m)).toThrow('64-char lowercase hex digest');
  });

  it('rejects non-positive byteLength', () => {
    const m = {
      ...VALID_MANIFEST,
      shards: [{ ...VALID_MANIFEST.shards[0], byteLength: 0 }],
    };
    expect(() => validateManifest(m)).toThrow('positive integer');
  });

  it('rejects non-boolean webgpu', () => {
    const m = {
      ...VALID_MANIFEST,
      runtimeRequirements: { ...VALID_MANIFEST.runtimeRequirements, webgpu: 'yes' as any },
    };
    expect(() => validateManifest(m)).toThrow('webgpu must be a boolean');
  });

  it('rejects non-positive minMemoryMB', () => {
    const m = {
      ...VALID_MANIFEST,
      runtimeRequirements: { ...VALID_MANIFEST.runtimeRequirements, minMemoryMB: -1 },
    };
    expect(() => validateManifest(m)).toThrow('positive number');
  });

  it('rejects missing license.name', () => {
    const m = {
      ...VALID_MANIFEST,
      license: { ...VALID_MANIFEST.license, name: '' },
    };
    expect(() => validateManifest(m)).toThrow('license.name is required');
  });

  it('rejects empty acceptableUse', () => {
    const m = {
      ...VALID_MANIFEST,
      license: { ...VALID_MANIFEST.license, acceptableUse: [] },
    };
    expect(() => validateManifest(m)).toThrow('non-empty string array');
  });
});

describe('totalBytes', () => {
  it('sums all shard byteLengths', () => {
    expect(totalBytes(VALID_MANIFEST)).toBe(1024 + 2048);
  });

  it('returns 0 for a manifest with no shards (post-validation)', () => {
    const empty = { ...VALID_MANIFEST, shards: [] } as ModelManifest;
    expect(totalBytes(empty)).toBe(0);
  });
});

describe('verifyShardDigests', () => {
  it('returns true when all digests match', () => {
    const digests = new Map<number, string>();
    digests.set(0, VALID_MANIFEST.shards[0].sha256);
    digests.set(1, VALID_MANIFEST.shards[1].sha256);
    expect(verifyShardDigests(VALID_MANIFEST, digests)).toBe(true);
  });

  it('returns false on any mismatch', () => {
    const digests = new Map<number, string>();
    digests.set(0, VALID_MANIFEST.shards[0].sha256);
    digests.set(1, 'bad_digest_here');
    expect(verifyShardDigests(VALID_MANIFEST, digests)).toBe(false);
  });

  it('returns false when a shard is missing from the digest map', () => {
    const digests = new Map<number, string>();
    digests.set(0, VALID_MANIFEST.shards[0].sha256);
    expect(verifyShardDigests(VALID_MANIFEST, digests)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Download interruption / resume / digest verification               */
/* ------------------------------------------------------------------ */

/**
 * We mock `fetch` globally in this describe block so no real network calls
 * happen. Each test can install its own handler.
 */
describe('ResumableShardDownloader', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('downloads a shard and reports progress', async () => {
    const CHUNK = 256;
    const SHARD_SIZE = 1024;
    const data = new Uint8Array(SHARD_SIZE).fill(0xAB);

    (globalThis as any).fetch = async (_url: string, init: any) => {
      const rangeHeader = init.headers.Range;
      const match = rangeHeader?.match(/bytes=(\d+)-(\d+)/);
      const start = match ? parseInt(match[1]) : 0;
      const end = match ? parseInt(match[2]) : SHARD_SIZE - 1;
      const slice = data.slice(start, end + 1);
      return {
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(slice.buffer),
      } as Response;
    };

    const downloader = new ResumableShardDownloader();
    const progressEvents: any[] = [];
    const shard = {
      url: 'https://models.example.com/shard.bin',
      byteLength: SHARD_SIZE,
      sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    // Compute expected SHA-256 after fill
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
    const expectedHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const expectedShard = { ...shard, sha256: expectedHex };

    const buf = await downloader.download(expectedShard, 0, (p) => progressEvents.push(p), 0, 1, CHUNK);

    expect(buf.byteLength).toBe(SHARD_SIZE);
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(progressEvents[progressEvents.length - 1].phase).toBe('downloading');
    expect(progressEvents[progressEvents.length - 1].bytesReceived).toBe(SHARD_SIZE);
  });

  it('resumes from a given offset', async () => {
    const SHARD_SIZE = 512;
    const data = new Uint8Array(SHARD_SIZE).fill(0xCD);

    (globalThis as any).fetch = async (_url: string, init: any) => {
      const rangeHeader = init.headers.Range;
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
      const start = match ? parseInt(match[1]) : 0;
      const end = match ? parseInt(match[2]) : SHARD_SIZE - 1;
      const slice = data.slice(start, end + 1);
      return {
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(slice.buffer),
      } as Response;
    };

    const downloader = new ResumableShardDownloader();
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
    const expectedHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const shard = {
      url: 'https://models.example.com/shard.bin',
      byteLength: SHARD_SIZE,
      sha256: expectedHex,
    };

    // Resume from byte 256
    const buf = await downloader.download(shard, 0, () => {}, 256, 3, 128);
    expect(buf.byteLength).toBe(SHARD_SIZE);
  });

  it('reports error and throws on cancelled download', async () => {
    let resolveFetch: (v: Response) => void;
    let rejectFetch: (e: Error) => void;

    (globalThis as any).fetch = async (_url: string, init: any) => {
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
        resolveFetch = resolve;
        rejectFetch = reject;
      });
    };

    const downloader = new ResumableShardDownloader();
    // Give downloader its own AbortController so cancel() propagates
    const ac = new AbortController();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (downloader as any).abortController = ac;

    const shard = {
      url: 'https://models.example.com/shard.bin',
      byteLength: 1024,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    const progressEvents: any[] = [];
    const promise = downloader
      .download(shard, 0, (p) => progressEvents.push(p), 0, 1, 256)
      .catch(() => {});

    // Cancel after a tick so the download loop is inside the fetch wait
    await new Promise((r) => setTimeout(r, 50));
    downloader.cancel();

    await promise;

    const last = progressEvents[progressEvents.length - 1];
    expect(last?.phase).toBe('error');
    expect(last?.error).toBe('Aborted');
  });

  it('verifyDigest returns true for correct data and false for wrong', async () => {
    const data = new TextEncoder().encode('hello world');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
    const correctHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(await ResumableShardDownloader.verifyDigest(data.buffer, correctHex)).toBe(true);
    expect(await ResumableShardDownloader.verifyDigest(data.buffer, 'badhex'.padEnd(64, '0'))).toBe(false);
  });

  it('installShard verifies digest before returning a Blob', async () => {
    const SHARD_SIZE = 256;
    const data = new Uint8Array(SHARD_SIZE).fill(0x42);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
    const correctHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    (globalThis as any).fetch = async (_url: string, init: any) => {
      const rangeHeader = init.headers.Range;
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
      const start = match ? parseInt(match[1]) : 0;
      const end = match ? parseInt(match[2]) : SHARD_SIZE - 1;
      const slice = data.slice(start, end + 1);
      return {
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(slice.buffer),
      } as Response;
    };

    const downloader = new ResumableShardDownloader();
    const shard = {
      url: 'https://models.example.com/shard.bin',
      byteLength: SHARD_SIZE,
      sha256: correctHex,
    };

    const events: any[] = [];
    const blob = await ResumableShardDownloader.installShard(shard, 0, downloader, (p) => events.push(p), 2, 128);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(SHARD_SIZE);

    const phases = events.map((e) => e.phase);
    expect(phases).toContain('downloading');
    expect(phases).toContain('verifying');
    expect(phases).toContain('installing');
    expect(phases).toContain('done');
  });

  it('installShard rejects on bad digest', async () => {
    const SHARD_SIZE = 64;
    const data = new Uint8Array(SHARD_SIZE).fill(0x99);

    (globalThis as any).fetch = async (_url: string, init: any) => {
      const rangeHeader = init.headers.Range;
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
      const start = match ? parseInt(match[1]) : 0;
      const end = match ? parseInt(match[2]) : SHARD_SIZE - 1;
      const slice = data.slice(start, end + 1);
      return {
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(slice.buffer),
      } as Response;
    };

    const downloader = new ResumableShardDownloader();
    const shard = {
      url: 'https://models.example.com/shard.bin',
      byteLength: SHARD_SIZE,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // intentionally wrong
    };

    const events: any[] = [];
    await expect(
      ResumableShardDownloader.installShard(shard, 0, downloader, (p) => events.push(p), 1, 32),
    ).rejects.toThrow('Digest verification failed');

    const last = events[events.length - 1];
    expect(last.phase).toBe('error');
    expect(last.error).toContain('SHA-256 mismatch');
  });
});

/* ------------------------------------------------------------------ */
/*  Device detection                                                    */
/* ------------------------------------------------------------------ */

describe('detectDeviceSync', () => {
  it('returns a device profile string', () => {
    const caps = detectDeviceSync();
    expect(['low-memory-mobile', 'modern-mobile', 'laptop', 'desktop']).toContain(caps.profile);
  });

  it('reports wasm support flag (true in real browser, may be false in jsdom)', () => {
    const caps = detectDeviceSync();
    expect(typeof caps.wasm).toBe('boolean');
  });

  it('reports deviceMemoryMB > 0', () => {
    const caps = detectDeviceSync();
    expect(caps.deviceMemoryMB).toBeGreaterThan(0);
  });

  it('reports cores > 0', () => {
    const caps = detectDeviceSync();
    expect(caps.cores).toBeGreaterThan(0);
  });

  it('reports storageQuotaMB > 0', () => {
    const caps = detectDeviceSync();
    expect(caps.storageQuotaMB).toBeGreaterThan(0);
  });
});

describe('meetsRequirements', () => {
  const caps = {
    profile: 'laptop' as const,
    webgpu: true,
    wasm: true,
    deviceMemoryMB: 8192,
    storageQuotaMB: 4096,
    cores: 8,
  };

  it('returns true when all requirements are met', () => {
    expect(
      meetsRequirements(caps, { webgpu: true, wasm: true, minMemoryMB: 4096, minStorageMB: 1024 }),
    ).toBe(true);
  });

  it('returns false when WebGPU is required but unavailable', () => {
    expect(
      meetsRequirements(
        { ...caps, webgpu: false },
        { webgpu: true, wasm: true, minMemoryMB: 512, minStorageMB: 16 },
      ),
    ).toBe(false);
  });

  it('returns false when WASM is required but unavailable', () => {
    expect(
      meetsRequirements(
        { ...caps, wasm: false },
        { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 },
      ),
    ).toBe(false);
  });

  it('returns false when device memory is below threshold', () => {
    expect(
      meetsRequirements(
        { ...caps, deviceMemoryMB: 256 },
        { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 },
      ),
    ).toBe(false);
  });

  it('returns false when storage quota is below threshold', () => {
    expect(
      meetsRequirements(
        { ...caps, storageQuotaMB: 8 },
        { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 },
      ),
    ).toBe(false);
  });
});
