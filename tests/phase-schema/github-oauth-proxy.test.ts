import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleApiRequest, type Env } from '../../src/lib/server/api-router';
import { resetServerGeminiLimits } from '../../src/lib/server/rate-limit';
import { makeOAuthState, type KvLike } from '../../src/lib/server/github-proxy';
import { signGrant, verifyGrant } from '../../src/lib/server/grants';

const TEST_CLIENT_ID = 'client-id-test';
const TEST_CLIENT_SECRET = 'client-secret-test';
const TEST_GRANT_SECRET = 'grant-secret-test';
const TEST_UID = 'uid-test';
const TEST_ORIGIN = 'https://app.test';

function makeEnv(overrides: Partial<Env> = {}, kvSeed: Record<string, string> = {}): Env {
  return {
    GITHUB_CLIENT_ID: TEST_CLIENT_ID,
    GITHUB_CLIENT_SECRET: TEST_CLIENT_SECRET,
    GH_GRANT_SECRET: TEST_GRANT_SECRET,
    APP_ORIGIN: TEST_ORIGIN,
    GH_TOKENS: makeKv(kvSeed),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
    ...overrides,
  };
}

function makeKv(seed: Record<string, string> = {}): KvLike {
  const m = new Map(Object.entries(seed));
  return {
    get: async (k) => m.get(k) ?? null,
    put: async (k, v) => {
      m.set(k, v);
    },
    delete: async (k) => {
      m.delete(k);
    },
  };
}

function mockRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  vi.useRealTimers();
  resetServerGeminiLimits();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetServerGeminiLimits();
});

// ─── Grant gate: missing / invalid grant is rejected ────────

describe('GitHub proxy — grant gate (fails closed)', () => {
  it('rejects a proxied call with no Authorization header', async () => {
    const req = mockRequest(`${TEST_ORIGIN}/api/gh/user`, { method: 'GET' });
    const res = await handleApiRequest(req, makeEnv());
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Unauthorized');
    expect(String(body.message)).toContain('Re-connect');
  });

  it('rejects a proxied call carrying a forged grant (wrong secret)', async () => {
    const forged = await signGrant('attacker-secret', TEST_UID);
    const req = mockRequest(`${TEST_ORIGIN}/api/gh/user`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${forged}` },
    });
    const res = await handleApiRequest(req, makeEnv());
    expect(res.status).toBe(401);
  });

  it('rejects a valid-looking grant when GH_GRANT_SECRET is unset', async () => {
    const grant = await signGrant(TEST_GRANT_SECRET, TEST_UID);
    const env = makeEnv({ GH_GRANT_SECRET: undefined });
    const req = mockRequest(`${TEST_ORIGIN}/api/gh/user`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${grant}` },
    });
    const res = await handleApiRequest(req, env);
    expect(res.status).toBe(401);
  });
});

// ─── Valid grant: token exchange reaches GitHub and maps success ──────────────

describe('GitHub proxy — valid grant flow maps a successful token response', () => {
  it('exchanges the code at token-exchange step and returns the app success shape', async () => {
    const kv = makeKv();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'gho_test_token_123' }, 200)
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = await makeOAuthState(TEST_GRANT_SECRET, TEST_UID, {});
    const req = mockRequest(
      `${TEST_ORIGIN}/api/gh/callback?code=test-code&state=${encodeURIComponent(state)}`
    );
    const res = await handleApiRequest(req, makeEnv({ GH_TOKENS: kv }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchUrl).toBe('https://github.com/login/oauth/access_token');
    expect(fetchInit.method).toBe('POST');
    expect(String(fetchInit.body)).toContain('client_secret=client-secret-test');
    expect(String(fetchInit.body)).toContain('code=test-code');

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toMatch(/^https:\/\/app\.test\/#gh_grant=/);
    expect(await kv.get(`gh:${TEST_UID}`)).toBe('gho_test_token_123');

    const grant = decodeURIComponent(location!.split('gh_grant=')[1]);
    const claims = await verifyGrant(TEST_GRANT_SECRET, grant);
    expect(claims).not.toBeNull();
    expect(claims!.uid).toBe(TEST_UID);
  });
});

// ─── Upstream GitHub 400/401 surfaces as a clear failure ──────────────────────

describe('GitHub proxy — upstream 400/401 surfaces as a clear failure', () => {
  it('maps a GitHub 400 approval rejection to a readable 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: 'bad_verification_code', error_description: 'The code is expired.' },
        400
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = await makeOAuthState(TEST_GRANT_SECRET, TEST_UID, {});
    const req = mockRequest(
      `${TEST_ORIGIN}/api/gh/callback?code=expired-code&state=${encodeURIComponent(state)}`
    );
    const res = await handleApiRequest(req, makeEnv());

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain('GitHub token exchange failed');
    expect(String(body.error)).toContain('The code is expired.');
  });

  it('maps a GitHub 401 credential rejection to a readable 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: 'incorrect_client_credentials',
          error_description: 'The client_secret is incorrect.',
        },
        401
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const state = await makeOAuthState(TEST_GRANT_SECRET, TEST_UID, {});
    const req = mockRequest(
      `${TEST_ORIGIN}/api/gh/callback?code=x&state=${encodeURIComponent(state)}`
    );
    const res = await handleApiRequest(req, makeEnv());

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain('client_secret is incorrect');
  });
});

// ─── Proxy passthrough with a valid grant ─────────────────────────────────────

describe('GitHub proxy — valid grant forwards to the upstream API', () => {
  it('adds the stored bearer token and returns the upstream body', async () => {
    const kvSeed = { [`gh:${TEST_UID}`]: 'gho_stored_token' };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ login: 'octocat', id: 1 }, 200)
    );
    vi.stubGlobal('fetch', fetchMock);

    const grant = await signGrant(TEST_GRANT_SECRET, TEST_UID);
    const req = mockRequest(`${TEST_ORIGIN}/api/gh/user`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${grant}` },
    });
    const res = await handleApiRequest(req, makeEnv({}, kvSeed));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchUrl).toBe('https://api.github.com/user');
    expect((fetchInit.headers as Headers).get('Authorization')).toBe('Bearer gho_stored_token');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Vantaos-Proxy')).toBe('1');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.login).toBe('octocat');
  });
});

// ─── Rate-limit integration ───────────────────────────────────────────────────

describe('GitHub proxy — rate-limit integration', () => {
  it('maps an upstream GitHub 403 rate-limit response to a 429', async () => {
    const kvSeed = { [`gh:${TEST_UID}`]: 'gho_stored_token' };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { message: 'API rate limit exceeded' },
        403,
        { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '1900000000' }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const grant = await signGrant(TEST_GRANT_SECRET, TEST_UID);
    const req = mockRequest(`${TEST_ORIGIN}/api/gh/user`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${grant}` },
    });
    const res = await handleApiRequest(req, makeEnv({}, kvSeed));

    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe('rate_limited');
    expect(String(body.error)).toContain('rate limit');
    expect(String(body.error)).toContain('retry after');
  });
});