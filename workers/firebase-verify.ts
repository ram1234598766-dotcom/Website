/**
 * Server-side verification of Firebase Auth ID tokens (RS256).
 *
 * Verifies the signature against Google's published JWKS for the
 * `securetoken@system.gserviceaccount.com` service account, then checks the
 * audience, issuer, and expiry. The key set is cached according to the
 * Cache-Control max-age returned by Google.
 */

import { base64UrlToBytes } from './crypto';

export interface FirebaseIdClaims {
  uid: string;
  email?: string;
  authTime?: number;
  exp: number;
}

export interface VerifyOptions {
  projectId: string;
  /** Seconds of tolerated clock skew on `exp`. Defaults to 60s. */
  clockSkewSec?: number;
  nowMs?: number;
  jwksUrl?: string;
}

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface Jwk extends JsonWebKey {
  kid?: string;
  use?: string;
}

interface CachedJwks {
  keys: Record<string, JsonWebKey>;
  loadedAt: number;
  maxAgeSec: number;
}

let cached = new Map<string, CachedJwks>();

/** Parses an RFC 7234 max-age directive out of a Cache-Control header. */
export function parseMaxAge(cacheControl: string | null): number {
  if (!cacheControl) return 300;
  const m = /max-age=(\d+)/.exec(cacheControl);
  return m ? parseInt(m[1], 10) : 300;
}

export function isJwkExpired(cachedJwks: CachedJwks, nowMs: number): boolean {
  return nowMs - cachedJwks.loadedAt > cachedJwks.maxAgeSec * 1000;
}

interface FetchLike {
  (url: string, init?: RequestInit): Promise<Response>;
}

async function loadJwks(
  fetchImpl: FetchLike,
  jwksUrl: string,
  nowMs: number
): Promise<Record<string, JsonWebKey>> {
  const entry = cached.get(jwksUrl);
  if (entry && !isJwkExpired(entry, nowMs)) return entry.keys;

  const res = await fetchImpl(jwksUrl);
  if (!res.ok) {
    throw new Error(`JWKS fetch failed with status ${res.status}`);
  }
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys: Record<string, JsonWebKey> = {};
  for (const k of body.keys ?? []) {
    if (k.kid && k.use === 'sig') keys[k.kid] = k;
  }
  cached.set(jwksUrl, {
    keys,
    loadedAt: nowMs,
    maxAgeSec: parseMaxAge(res.headers.get('cache-control')),
  });
  return keys;
}

export function decodeTokenParts(
  token: string
): { header: any; payload: any; signature: Uint8Array } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(parts[0]))
    );
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(parts[1]))
    );
    const signature = base64UrlToBytes(parts[2]);
    return { header, payload, signature };
  } catch {
    return null;
  }
}

function signingInput(token: string): string {
  const parts = token.split('.');
  return `${parts[0]}.${parts[1]}`;
}

interface VerifyDeps {
  importKey: (
    format: 'jwk',
    keyData: JsonWebKey,
    algorithm: { name: string; hash: string },
    extractable: boolean,
    keyUsages: string[]
  ) => Promise<CryptoKey>;
  verify: (
    algorithm: { name: string; hash: string },
    key: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array
  ) => Promise<boolean>;
}

/**
 * Verifies a Firebase ID token end to end. Returns the verified claims, or
 * null when the token is structurally invalid, has a bad signature, or fails
 * an audience/issuer/expiry check.
 */
export async function verifyFirebaseIdToken(
  token: string,
  opts: VerifyOptions,
  deps: VerifyDeps = {
    importKey: crypto.subtle.importKey.bind(crypto.subtle),
    verify: crypto.subtle.verify.bind(crypto.subtle),
  },
  fetchImpl: FetchLike = fetch
): Promise<FirebaseIdClaims | null> {
  if (!opts.projectId || !token) return null;

  const decoded = decodeTokenParts(token);
  if (!decoded) return null;
  const { header, payload, signature } = decoded;

  if (header.alg !== 'RS256') return null;
  const kid: string | undefined = header.kid;
  if (!kid) return null;

  const nowMs = opts.nowMs ?? Date.now();
  const keys = await loadJwks(fetchImpl, opts.jwksUrl ?? JWKS_URL, nowMs);
  const jwk = keys[kid];
  if (!jwk) return null;

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await deps.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch {
    return null;
  }

  const verified = await deps.verify(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    cryptoKey,
    signature,
    new TextEncoder().encode(signingInput(token))
  );
  if (!verified) return null;

  const skewMs = (opts.clockSkewSec ?? 60) * 1000;
  const nowSec = Math.floor((nowMs + skewMs) / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < nowSec) return null;
  if (payload.aud !== opts.projectId) return null;
  if (
    payload.iss !== `https://securetoken.google.com/${opts.projectId}`
  ) {
    return null;
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    authTime:
      typeof payload.auth_time === 'number' ? payload.auth_time : undefined,
    exp: payload.exp,
  };
}