import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { verifyFirebaseIdToken, parseMaxAge } from '../../workers/firebase-verify';

const PROJECT_ID = 'test-project-123';
const JWT_URL = 'https://jwks.invalid/keys';

function b64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodePart(o: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(o)));
}

function firebaseToken(params: {
  privateKey: CryptoKey;
  kid: string;
  aud?: string;
  iss?: string;
  exp?: number;
  sub?: string;
  email?: string;
  nowSec?: number;
}): string {
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: params.kid, typ: 'JWT' };
  const payload = {
    aud: params.aud ?? PROJECT_ID,
    iss: params.iss ?? `https://securetoken.google.com/${PROJECT_ID}`,
    exp: params.exp ?? nowSec + 3600,
    sub: params.sub ?? 'firebase-uid-42',
    email: params.email ?? 'user@example.com',
    auth_time: nowSec - 30,
  };
  const h = encodePart(header);
  const p = encodePart(payload);
  return `${h}.${p}.SIGNATURE_PLACEHOLDER`;
}

describe('Firebase ID token verification (RS256, real WebCrypto)', () => {
  let privateKey: CryptoKey;
  let publicJwk: JsonWebKey & { kid?: string; use?: string };
  const KID = 'jwks-kid-1';

  beforeAll(async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
    privateKey = keyPair.privateKey;
    publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    publicJwk.kid = KID;
    publicJwk.use = 'sig';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function signToken(token: string): Promise<string> {
    const [h, p] = token.split('.');
    const input = new TextEncoder().encode(`${h}.${p}`);
    const sig = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      input
    );
    return `${h}.${p}.${b64url(sig)}`;
  }

  function stubJwks(
    jwks: Array<JsonWebKey & { kid?: string; use?: string }> = [publicJwk],
    status = 200
  ): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ keys: jwks }), {
        status,
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=600' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('accepts a genuine Firebase token and returns the uid', async () => {
    stubJwks();
    const token = await signToken(firebaseToken({ privateKey, kid: KID }));
    const claims = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      jwksUrl: JWT_URL,
      clockSkewSec: 0,
    });
    expect(claims).not.toBeNull();
    expect(claims!.uid).toBe('firebase-uid-42');
    expect(claims!.email).toBe('user@example.com');
  });

  it('rejects a tampered signature (signature replaced)', async () => {
    stubJwks();
    const token = await signToken(firebaseToken({ privateKey, kid: KID }));
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${b64url(new Uint8Array(256).fill(9))}`;
    const claims = await verifyFirebaseIdToken(tampered, {
      projectId: PROJECT_ID,
      jwksUrl: JWT_URL,
      clockSkewSec: 0,
    });
    expect(claims).toBeNull();
  });

  it('rejects a token signed by a key not advertised in the JWKS', async () => {
    const otherPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    );
    const base = firebaseToken({ privateKey: otherPair.privateKey, kid: KID });
    const [h, p] = base.split('.');
    const sig = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      otherPair.privateKey,
      new TextEncoder().encode(`${h}.${p}`)
    );
    const token = `${h}.${p}.${b64url(sig)}`;
    // JWKS only advertises publicJwk — the signing key is unknown.
    stubJwks();
    const claims = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      jwksUrl: JWT_URL,
      clockSkewSec: 0,
    });
    expect(claims).toBeNull();
  });

  it('rejects tokens for a different Firebase project (aud mismatch)', async () => {
    const token = await signToken(
      firebaseToken({ privateKey, kid: KID, aud: 'other-project', iss: 'https://securetoken.google.com/other-project' })
    );
    stubJwks();
    const claims = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      jwksUrl: JWT_URL,
      clockSkewSec: 0,
    });
    expect(claims).toBeNull();
  });

  it('rejects an expired token', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = await signToken(
      firebaseToken({ privateKey, kid: KID, exp: nowSec - 10 })
    );
    stubJwks();
    const claims = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      jwksUrl: JWT_URL,
      nowMs: Date.now(),
      clockSkewSec: 0,
    });
    expect(claims).toBeNull();
  });

  it('rejects a wrong algorithm (HS256 header)', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const header = { alg: 'HS256', kid: KID, typ: 'JWT' };
    const payload = { aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, exp, sub: 'u1' };
    const h = encodePart(header);
    const p = encodePart(payload);
    const token = `${h}.${p}.${b64url(new Uint8Array(32))}`;
    stubJwks();
    const claims = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      jwksUrl: JWT_URL,
      clockSkewSec: 0,
    });
    expect(claims).toBeNull();
  });

  it('rejects when the kid is not in the JWKS', async () => {
    const token = await signToken(firebaseToken({ privateKey, kid: 'unknown-kid' }));
    stubJwks();
    const claims = await verifyFirebaseIdToken(token, {
      projectId: PROJECT_ID,
      jwksUrl: JWT_URL,
      clockSkewSec: 0,
    });
    expect(claims).toBeNull();
  });

  it('rejects malformed and structurally invalid tokens without parsing crashes', async () => {
    expect(await verifyFirebaseIdToken('', { projectId: PROJECT_ID })).toBeNull();
    expect(await verifyFirebaseIdToken('a.b', { projectId: PROJECT_ID })).toBeNull();
    expect(await verifyFirebaseIdToken('!.@.#', { projectId: PROJECT_ID })).toBeNull();
  });

  it('caches the JWKS across calls (single fetch per URL)', async () => {
    const token = await signToken(firebaseToken({ privateKey, kid: KID }));
    const url = `${JWT_URL}/cache-1`;
    const fetchMock = stubJwks();
    await verifyFirebaseIdToken(token, { projectId: PROJECT_ID, jwksUrl: url, clockSkewSec: 0 });
    await verifyFirebaseIdToken(token, { projectId: PROJECT_ID, jwksUrl: url, clockSkewSec: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the JWKS endpoint fails hard (5xx)', async () => {
    const token = await signToken(firebaseToken({ privateKey, kid: KID }));
    stubJwks([], 503);
    await expect(
      verifyFirebaseIdToken(token, { projectId: PROJECT_ID, jwksUrl: `${JWT_URL}/error` })
    ).rejects.toThrow(/JWKS fetch failed/);
  });

  it('parses the Cache-Control max-age (defaults to 300s)', () => {
    expect(parseMaxAge('public, max-age=60')).toBe(60);
    expect(parseMaxAge('no-store')).toBe(300);
    expect(parseMaxAge(null)).toBe(300);
  });
});