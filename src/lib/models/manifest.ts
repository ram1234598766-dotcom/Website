/**
 * VantaOS WebModel — signed model manifest schema.
 *
 * A manifest describes a model package: its identity, version, publisher,
 * cryptographic signature, shard layout, runtime requirements, and licence.
 * Every field is validated at parse time so downstream code can trust the
 * structure without re-checking.
 */

export interface ModelShard {
  url: string;
  byteLength: number;
  sha256: string;
}

export type SignatureScheme = 'ed25519' | 'hmac-sha256';

export type DeviceProfile =
  | 'low-memory-mobile'
  | 'modern-mobile'
  | 'laptop'
  | 'desktop';

export interface RuntimeRequirements {
  webgpu: boolean;
  wasm: boolean;
  minMemoryMB: number;
  minStorageMB: number;
}

export interface LicenseMetadata {
  name: string;
  url?: string;
  acceptableUse: string[];
}

export interface ModelManifest {
  id: string;
  version: string;
  publisher: string;
  signatureScheme: SignatureScheme;
  signature: string;
  shards: ModelShard[];
  runtimeRequirements: RuntimeRequirements;
  license: LicenseMetadata;
}

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                 */
/* ------------------------------------------------------------------ */

const SHA256_RE = /^[a-f0-9]{64}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.-]+)?$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export function validateManifest(raw: unknown): ModelManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Manifest must be a JSON object');
  }

  const m = raw as Record<string, unknown>;

  if (typeof m.id !== 'string' || m.id.length === 0) throw new Error('Missing or empty manifest.id');
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) throw new Error(`Invalid semver: ${m.version}`);
  if (typeof m.publisher !== 'string' || m.publisher.length === 0) throw new Error('Missing manifest.publisher');

  if (!['ed25519', 'hmac-sha256'].includes(m.signatureScheme as string)) {
    throw new Error('manifest.signatureScheme must be "ed25519" or "hmac-sha256"');
  }

  if (typeof m.signature !== 'string' || !BASE64URL_RE.test(m.signature)) {
    throw new Error('manifest.signature must be base64url-encoded');
  }

  if (!Array.isArray(m.shards) || m.shards.length === 0) {
    throw new Error('manifest.shards must be a non-empty array');
  }

  for (let i = 0; i < m.shards.length; i++) {
    const s = m.shards[i] as Record<string, unknown>;
    if (typeof s.url !== 'string' || !s.url.startsWith('https://')) {
      throw new Error(`shards[${i}].url must be an HTTPS URL`);
    }
    if (typeof s.byteLength !== 'number' || s.byteLength <= 0) {
      throw new Error(`shards[${i}].byteLength must be a positive integer`);
    }
    if (typeof s.sha256 !== 'string' || !SHA256_RE.test(s.sha256)) {
      throw new Error(`shards[${i}].sha256 must be a 64-char lowercase hex digest`);
    }
  }

  const rr = m.runtimeRequirements as Record<string, unknown>;
  if (typeof rr.webgpu !== 'boolean') throw new Error('runtimeRequirements.webgpu must be a boolean');
  if (typeof rr.wasm !== 'boolean') throw new Error('runtimeRequirements.wasm must be a boolean');
  if (typeof rr.minMemoryMB !== 'number' || rr.minMemoryMB <= 0) {
    throw new Error('runtimeRequirements.minMemoryMB must be a positive number');
  }
  if (typeof rr.minStorageMB !== 'number' || rr.minStorageMB <= 0) {
    throw new Error('runtimeRequirements.minStorageMB must be a positive number');
  }

  const lic = m.license as Record<string, unknown>;
  if (typeof lic.name !== 'string' || lic.name.length === 0) {
    throw new Error('license.name is required');
  }
  if (lic.url !== undefined && typeof lic.url !== 'string') {
    throw new Error('license.url must be a string when present');
  }
  if (!Array.isArray(lic.acceptableUse) || lic.acceptableUse.length === 0) {
    throw new Error('license.acceptableUse must be a non-empty string array');
  }

  return m as unknown as ModelManifest;
}

/** Compute the aggregate size of all shards in bytes. */
export function totalBytes(m: ModelManifest): number {
  return m.shards.reduce((sum, s) => sum + s.byteLength, 0);
}

/** Check whether the manifest's shard digests all pass a provided set of
 *  hex-encoded SHA-256 digests (keyed by shard index). */
export function verifyShardDigests(
  m: ModelManifest,
  digests: Map<number, string>
): boolean {
  for (let i = 0; i < m.shards.length; i++) {
    if (digests.get(i) !== m.shards[i].sha256) return false;
  }
  return true;
}
