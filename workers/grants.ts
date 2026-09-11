/**
 * Short-lived GitHub grant tokens.
 *
 * A grant is a stateless, HMAC-signed token that lets the browser address
 * the GitHub access token the Worker holds in KV — without ever seeing the
 * access token itself. Grants expire quickly; revocation is enforced by
 * deleting the KV entry, which makes every subsequent proxy call fail closed.
 */

import { bytesToBase64Url, base64UrlToBytes, hmacSha256, timingSafeEqual } from './crypto';

export const GRANT_TTL_SECONDS = 15 * 60;
export const GRANT_VERSION = 1;

export interface GrantClaims {
  uid: string;
  /** Unix seconds after which the grant is invalid. */
  exp: number;
  /** Random unique ID so identical inputs produce distinct grants. */
  jti: string;
}

export interface SignGrantDeps {
  randomBytes?: (n: number) => Uint8Array;
}

function defaultRandomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export async function signGrant(
  secret: string,
  uid: string,
  opts: { ttlSeconds?: number; nowSec?: number } = {},
  deps: SignGrantDeps = {}
): Promise<string> {
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? GRANT_TTL_SECONDS;
  const expire = nowSec + ttl;
  const jti = bytesToBase64Url(
    (deps.randomBytes ?? defaultRandomBytes)(16)
  );
  const body = `${GRANT_VERSION}.${expire}.${uid}.${jti}`;
  const sig = await hmacSha256(secret, body);
  return `${body}.${bytesToBase64Url(sig)}`;
}

/**
 * Verifies a grant's signature, version, and expiry. Returns the claims, or
 * null when the token is malformed, expired, or not signed by `secret`.
 */
export async function verifyGrant(
  secret: string,
  grant: string,
  opts: { nowSec?: number; clockSkewSec?: number } = {}
): Promise<GrantClaims | null> {
  if (!secret || !grant) return null;
  const parts = grant.split('.');
  if (parts.length !== 5) return null;

  const [version, expS, uid, jti, sigB64] = parts;
  if (version !== String(GRANT_VERSION)) return null;
  if (!expS || !uid || !jti || !sigB64) return null;

  const expected = await hmacSha256(secret, `${version}.${expS}.${uid}.${jti}`);
  let actual: Uint8Array;
  try {
    actual = base64UrlToBytes(sigB64);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, actual)) return null;

  const exp = parseInt(expS, 10);
  if (!Number.isFinite(exp)) return null;

  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const skewSec = opts.clockSkewSec ?? 15;
  if (exp + skewSec < nowSec) return null;

  return { uid, exp, jti };
}