import { describe, it, expect } from 'vitest';
import { signGrant, verifyGrant, GRANT_TTL_SECONDS } from '../../src/lib/server/grants';
import { hmacSha256, bytesToBase64Url } from '../../src/lib/server/crypto';

const SECRET = 'test-grant-secret';
const UID = 'user-123';

describe('grants (stateless HMAC grant tokens)', () => {
  it('signs then verifies a grant for the originating uid', async () => {
    const now = 1_800_000_000;
    const grant = await signGrant(SECRET, UID, { nowSec: now });
    expect(grant.split('.')).toHaveLength(5); // version.exp.uid.jti.sig
    const claims = await verifyGrant(SECRET, grant, { nowSec: now, clockSkewSec: 0 });
    expect(claims).not.toBeNull();
    expect(claims!.uid).toBe(UID);
    expect(claims!.exp).toBe(now + GRANT_TTL_SECONDS);
  });

  it('rejects a forged grant (wrong secret)', async () => {
    const grant = await signGrant(SECRET, UID);
    const claims = await verifyGrant('other-secret', grant);
    expect(claims).toBeNull();
  });

  it('rejects a tampered grant body', async () => {
    const now = 1_800_000_000;
    const grant = await signGrant(SECRET, UID, { nowSec: now });
    // Change the uid inside the signed body while keeping the signature.
    const parts = grant.split('.');
    parts[2] = 'attacker-uid';
    const tampered = parts.join('.');
    const claims = await verifyGrant(SECRET, tampered, { nowSec: now, clockSkewSec: 0 });
    expect(claims).toBeNull();
  });

  it('rejects an expired grant unless inside the clock skew', async () => {
    const now = 1_800_000_000;
    const grant = await signGrant(SECRET, UID, { nowSec: now, ttlSeconds: 10 });
    // Expired beyond the tolerated skew → rejected.
    expect(
      await verifyGrant(SECRET, grant, { nowSec: now + 11, clockSkewSec: 0 })
    ).toBeNull();
    // Expired but within the default 15s skew → still accepted.
    const claims = await verifyGrant(SECRET, grant, { nowSec: now + 15 });
    expect(claims).not.toBeNull();
  });

  it('produces distinct grants for identical inputs (jti nonce)', async () => {
    const a = await signGrant(SECRET, UID);
    const b = await signGrant(SECRET, UID);
    expect(a).not.toBe(b);
  });

  it('rejects malformed grant strings', async () => {
    expect(await verifyGrant(SECRET, 'nonsense')).toBeNull();
    expect(await verifyGrant(SECRET, '')).toBeNull();
    expect(await verifyGrant('', '1.1.2.3.x.y')).toBeNull();
  });

  it('supports a byte-injected nonce for deterministic tests', async () => {
    const grant = await signGrant(SECRET, UID, { nowSec: 1_800_000_000 }, {
      randomBytes: () => new Uint8Array(16).fill(7),
    });
    const parts = grant.split('.');
    expect(parts[3]).toBe('BwcHBwcHBwcHBwcHBwcHBw');
  });

  it('rejects a wrong version field', async () => {
    const now = 1_800_000_000;
    const grant = await signGrant(SECRET, UID, { nowSec: now });
    const sig = await bytesToBase64Url(await hmacSha256(SECRET, grant.slice(2)));
    const legacy = `0.${grant.slice(2)}.${sig}`;
    expect(await verifyGrant(SECRET, legacy, { nowSec: now, clockSkewSec: 0 })).toBeNull();
  });
});