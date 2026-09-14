import { describe, it, expect, vi } from 'vitest';
import {
  GitHubOAuthService,
  makeOAuthState,
  verifyOAuthState,
  exchangeCodeForToken,
  mapUnprocessableEntity,
  buildAuthorizeUrl,
  OAuthCallbackError,
  type KvLike,
  type GitHubEnvLike,
} from '../../src/lib/server/github-proxy';
import { verifyGrant } from '../../src/lib/server/grants';

const SECRET = 'test-grant-secret';
const UID = 'firebase-uid-1';

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

function makeEnv(overrides: Partial<GitHubEnvLike> = {}, seed: Record<string, string> = {}): GitHubEnvLike {
  return {
    GITHUB_CLIENT_ID: 'client-123',
    GITHUB_CLIENT_SECRET: 'client-secret-123',
    GH_GRANT_SECRET: SECRET,
    APP_ORIGIN: 'https://app.test',
    GH_TOKENS: makeKv(seed),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const NOW = () => 1_800_000_000;

describe('OAuth state linking', () => {
  it('signs and verifies state bound to the originating uid', async () => {
    const state = await makeOAuthState(SECRET, UID, {});
    const uid = await verifyOAuthState(SECRET, state, {});
    expect(uid).toBe(UID);
  });

  it('rejects state with a tampered uid', async () => {
    const state = await makeOAuthState(SECRET, UID, {});
    const parts = state.split('.');
    parts[1] = 'attacker';
    expect(await verifyOAuthState(SECRET, parts.join('.'), {})).toBeNull();
  });

  it('rejects state signed with a different secret (CSRF protection)', async () => {
    const state = await makeOAuthState(SECRET, UID, {});
    expect(await verifyOAuthState('other', state, {})).toBeNull();
  });

  it('authorize URL carries client id, redirect uri, scope and state', () => {
    const url = buildAuthorizeUrl({ clientId: 'c1', redirectUri: 'https://app.test/api/gh/callback', state: 'st', scope: 'user:email repo' });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('c1');
    expect(u.searchParams.get('state')).toBe('st');
    expect(u.searchParams.get('scope')).toBe('user:email repo');
    expect(u.searchParams.get('response_type')).toBe('code');
  });
});

describe('access-token exchange', () => {
  it('exchanges a code for an access token', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ access_token: 'gho_supersecret' }, 200));
    const token = await exchangeCodeForToken('c', 's', 'code1', 'https://app.test/api/gh/callback', fetchImpl);
    expect(token).toBe('gho_supersecret');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('code=code1');
    expect(String(init.body)).toContain('client_secret=s');
  });

  it('throws with the GitHub error description when the exchange fails', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'bad_verification_code', error_description: 'The code is expired.' }, 400));
    await expect(exchangeCodeForToken('c', 's', 'bad', 'cb', fetchImpl)).rejects.toThrow(/expired/);
  });
});

describe('GitHubOAuthService end-to-end', () => {
  it('startAuthorize → processCallback stores the token and mints a grant', async () => {
    const kv = makeKv();
    const env = makeEnv({ GH_TOKENS: kv });
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/access_token')) return jsonResponse({ access_token: 'gho_abc123' });
      throw new Error('unexpected fetch');
    });
    const service = new GitHubOAuthService(env, { fetchImpl, nowSec: NOW });

    const { url } = await service.startAuthorize(UID);
    const state = new URL(url).searchParams.get('state')!;
    const { location } = await service.processCallback({ code: 'code1', state });

    expect(await kv.get('gh:firebase-uid-1')).toBe('gho_abc123');
    expect(location).toMatch(/^https:\/\/app\.test\/#gh_grant=/);
    const grant = decodeURIComponent(location.split('=')[1]);
    const claims = await verifyGrant(SECRET, grant, { nowSec: NOW(), clockSkewSec: 0 });
    expect(claims).not.toBeNull();
    expect(claims!.uid).toBe(UID);
  });

  it('rejects a callback whose state was not issued for this session', async () => {
    const service = new GitHubOAuthService(makeEnv(), { nowSec: NOW });
    await expect(
      service.processCallback({ code: 'code1', state: 'forged-state-value' })
    ).rejects.toBeInstanceOf(OAuthCallbackError);
  });

  it('importToken stores the token server-side and returns a grant', async () => {
    const kv = makeKv();
    const service = new GitHubOAuthService(makeEnv({ GH_TOKENS: kv }), { nowSec: NOW });
    const grant = await service.importToken(UID, 'gho_popuptoken_12345');
    expect(await kv.get('gh:firebase-uid-1')).toBe('gho_popuptoken_12345');
    const claims = await verifyGrant(SECRET, grant, { nowSec: NOW(), clockSkewSec: 0 });
    expect(claims!.uid).toBe(UID);
  });

  it('refuses to import an implausibly short token', async () => {
    const service = new GitHubOAuthService(makeEnv(), { nowSec: NOW });
    await expect(service.importToken(UID, 'short')).rejects.toThrow(/looks invalid/);
  });

  it('revoke deletes the KV entry so existing grants fail closed', async () => {
    const kv = makeKv({ 'gh:firebase-uid-1': 'gho_secret' });
    const env = makeEnv({ GH_TOKENS: kv });
    const service = new GitHubOAuthService(env, { nowSec: NOW });

    const grant = await service.createGrant(UID);
    expect(grant).not.toBeNull();

    await service.revoke(UID);
    expect(await kv.get('gh:firebase-uid-1')).toBeNull();
    // Even with a technically-valid grant, the proxy must now refuse.
    const res = await service.proxy('/user', new Request('https://app.test/api/gh/user', { method: 'GET' }), { uid: UID, exp: NOW() + 900, jti: 'x' });
    expect(res.status).toBe(401);
    expect((await res.json()).needsConnect).toBe(true);
  });
});

describe('proxy routing', () => {
  function serviceWithToken(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, token = 'gho_stored_token') {
    const kv = makeKv({ 'gh:firebase-uid-1': token });
    return new GitHubOAuthService(makeEnv({ GH_TOKENS: kv }), { fetchImpl, nowSec: NOW });
  }

  it('forwards method, path and adds the stored bearer token for the grant uid', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const service = serviceWithToken((async (url, init) => {
      calls.push([url, init]);
      return jsonResponse({ ok: true, name: 'repo1' });
    }) as any);

    const req = new Request('https://app.test/api/gh/repos/o/r?per_page=1', {
      method: 'GET',
      headers: { 'X-Client': 'vantaos' },
    });
    const res = await service.proxy(
      '/repos/o/r?per_page=1',
      req,
      { uid: UID, exp: NOW() + 900, jti: 'x' }
    );
    expect(res.status).toBe(200);

    const [targetUrl, init] = calls[0];
    expect(targetUrl).toBe('https://api.github.com/repos/o/r?per_page=1');
    expect(init.method).toBe('GET');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer gho_stored_token');
    expect((init.headers as Headers).get('X-Client')).toBe('vantaos');
  });

  it('returns 401 with needsConnect when the uid has no stored token', async () => {
    const service = new GitHubOAuthService(makeEnv({ GH_TOKENS: makeKv() }), { nowSec: NOW });
    const res = await service.proxy('/user/repos', new Request('https://app.test/api/gh/user/repos'), { uid: 'other-uid', exp: NOW() + 900, jti: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects paths that escape the GitHub API origin', async () => {
    const service = serviceWithToken((async () => jsonResponse({}, 500)) as any);
    const res = await service.proxy('//evil.example/steal', new Request('https://app.test/api/gh//evil.example/steal'), { uid: UID, exp: NOW() + 900, jti: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects a forged Authorization carrying no stored token', async () => {
    const service = serviceWithToken((async () => jsonResponse({}, 500)) as any);
    const res = await service.proxy('/repos/o/r/git/blobs', new Request('https://app.test/api/gh/repos/o/r/git/blobs', { method: 'POST' }), { uid: 'intruder', exp: NOW() + 900, jti: 'x' });
    expect(res.status).toBe(401);
    expect((await res.json()).needsConnect).toBe(true);
  });

  it('maps a non-fast-forward 422 into a 409 push_conflict with pull-first guidance', async () => {
    const service = serviceWithToken((async () =>
      jsonResponse({ message: 'Update is not a fast forward' }, 422)
    ) as any);
    const res = await service.proxy('/repos/o/r/git/refs/heads/main', new Request('https://app.test/api/gh/repos/o/r/git/refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: 's', force: false }) }), { uid: UID, exp: NOW() + 900, jti: 'x' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('push_conflict');
    expect(String(body.message)).toMatch(/pull|push/i);
  });

  it('fresh-parent mismatch returns 409 stale_base BEFORE forwarding the push', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (!init?.method || init.method === 'GET') {
        return jsonResponse({ object: { sha: 'upstream-advanced' } });
      }
      return jsonResponse({ ok: true });
    }) as any;
    const service = serviceWithToken(fetchImpl);

    const req = new Request('https://app.test/api/gh/repos/o/r/git/refs/heads/main', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sha: 'my-new-commit', force: false, expected_parent: 'my-old-base' }),
    });
    const res = await service.proxy('/repos/o/r/git/refs/heads/main', req, { uid: UID, exp: NOW() + 900, jti: 'x' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('stale_base');
    // only the fresh-parent read happened — the PATCH must not be forwarded
    expect(calls.filter((u) => u.includes('refs/heads/main') && true)).toHaveLength(1);
  });

  it('fresh-parent matches and the PATCH is forwarded upstream', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (!init?.method || init.method === 'GET') {
        return jsonResponse({ object: { sha: 'expected-base' } });
      }
      return jsonResponse({ ok: true });
    }) as any;
    const service = serviceWithToken(fetchImpl);

    const req = new Request('https://app.test/api/gh/repos/o/r/git/refs/heads/main', {
      method: 'PATCH',
      body: JSON.stringify({ sha: 'new', force: false, expected_parent: 'expected-base' }),
    });
    const res = await service.proxy('/repos/o/r/git/refs/heads/main', req, { uid: UID, exp: NOW() + 900, jti: 'x' });
    expect(res.status).toBe(200);
    expect(calls.filter((u) => u.includes('refs/heads/main')).length).toBe(2);
  });
});

describe('mapUnprocessableEntity', () => {
  it('maps non-fast-forward messages to a 409 push_conflict', () => {
    const res = mapUnprocessableEntity({ message: 'Update is not a fast forward' }, '/repos/o/r/git/refs/heads/main');
    expect(res!.status).toBe(409);
    expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    return res!.json().then((b) => expect(b.code).toBe('push_conflict'));
  });

  it('maps protected-branch messages to a 409 protected_branch', () => {
    const res = mapUnprocessableEntity({ message: 'refs/heads/main: branch protection rule' }, '/repos/o/r/git/refs/heads/main');
    expect(res!.status).toBe(409);
    return res!.json().then((b) => expect(b.code).toBe('protected_branch'));
  });

  it('leaves unrelated 422s unmapped', () => {
    expect(mapUnprocessableEntity({ message: 'Tree is broken' }, '/x')).toBeNull();
  });
});