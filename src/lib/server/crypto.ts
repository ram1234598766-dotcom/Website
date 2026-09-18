/**
 * Shared WebCrypto helpers for the VantaOS Worker.
 *
 * Portable across the Cloudflare Workers runtime and Node 18+ (vitest), so
 * the token/proxy logic is unit-testable without a live deployment.
 */

const enc = new TextEncoder();

export function bytesToBase64Url(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function base64UrlToBytes(input: string): Uint8Array {
  if (input.length > 1_000_000) throw new Error('base64Url input too large');
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function hmacSha256(
  secret: string,
  message: string
): Promise<Uint8Array> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return new Uint8Array(sig);
  } catch (err: any) {
    throw new Error(`HMAC-SHA256 failed: ${err?.message ?? 'unknown error'}`);
  }
}

/** Constant-time byte comparison. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const aLen = a.length;
  const bLen = b.length;
  const len = aLen > bLen ? aLen : bLen;
  let diff = aLen ^ bLen;
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}