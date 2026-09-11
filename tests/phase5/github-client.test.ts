// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureGitHubGrantFromUrl,
  hasGitHubGrant,
  onGitHubGrantChange,
  setFirebaseTokenGetter,
  fetchGitHub,
  revokeGitHub,
  updateRef,
  refreshGitHubGrant,
  __resetGitHubStateForTests,
  GitHubError,
} from '../../src/lib/github';

const ORIGIN = 'https://proxy.test';
const GRANT = '1.1800000000.firebase-uid-1.jti.sig';
const FIREBASE_TOKEN = 'firebase-id-token';

function setOrigin() {
  process.env.GITHUB_API_ORIGIN = ORIGIN;
}

function installFetchQueue(routes: Array<{ matcher: (url: string) => boolean; handler: () => Promise<Response> }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const proxy = async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const route = routes.find((r) => r.matcher(String(url)));
    if (!route) throw new Error(`no mock route for ${url}`);
    return route.handler();
  };
  vi.stubGlobal('fetch', proxy);
  return calls;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  setOrigin();
  __resetGitHubStateForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GITHUB_API_ORIGIN;
});

describe('grant capture from URL hash', () => {
  it('captures #gh_grant=…, stores it, and strips it from the URL', () => {
    window.history.replaceState(null, '', '/page#other=1&gh_grant=ABC123&x=2');
    expect(hasGitHubGrant()).toBe(false);
    expect(captureGitHubGrantFromUrl()).toBe(true);
    expect(hasGitHubGrant()).toBe(true);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/page');
  });

  it('returns false when no grant is present', () => {
    window.history.replaceState(null, '', '/page#fragment');
    expect(captureGitHubGrantFromUrl()).toBe(false);
    expect(hasGitHubGrant()).toBe(false);
  });

  it('notifies grant-change listeners', () => {
    window.history.replaceState(null, '', '/#gh_grant=grant-9');
    const seen: Array<string | null> = [];
    const unsubscribe = onGitHubGrantChange((g) => seen.push(g));
    captureGitHubGrantFromUrl();
    expect(seen).toEqual(['grant-9']);
    unsubscribe();
  });
});

describe('grant refresh and proxied API', () => {
  it('re-arms a grant via /api/gh/session, then uses it as Authorization on the proxy', async () => {
    setFirebaseTokenGetter(async () => FIREBASE_TOKEN);
    const calls = installFetchQueue([
      {
        matcher: (u) => u.includes('/api/gh/session'),
        handler: async () => json({ gh_grant: GRANT }),
      },
      {
        matcher: (u) => u === `${ORIGIN}/api/gh/user/repos`,
        handler: async () => json([{ id: 1, name: 'repo-a' }]),
      },
    ]);

    const repos = await fetchGitHub('/user/repos');
    expect(repos).toEqual([{ id: 1, name: 'repo-a' }]);

    const sessionCall = calls.find((c) => c.url.includes('/api/gh/session'))!;
    expect(sessionCall.init?.headers).toMatchObject({
      Authorization: `Bearer ${FIREBASE_TOKEN}`,
    });
    const apiCall = calls.find((c) => c.url === `${ORIGIN}/api/gh/user/repos`)!;
    expect(apiCall.init?.headers).toMatchObject({
      Authorization: `Bearer ${GRANT}`,
    });
    expect(hasGitHubGrant()).toBe(true);
  });

  it('throws needs_connect when there is no grant and no firebase session', async () => {
    setFirebaseTokenGetter(async () => null);
    installFetchQueue([]);
    await expect(fetchGitHub('/user')).rejects.toMatchObject({
      code: 'needs_connect',
      status: 401,
    });
  });

  it('clears the grant on a 401 from the proxy and surfaces needs_connect', async () => {
    window.history.replaceState(null, '', '/#gh_grant=expired-grant');
    captureGitHubGrantFromUrl();
    installFetchQueue([
      {
        matcher: () => true,
        handler: async () =>
          json({ message: 'Grant expired or revoked', code: 'needs_connect' }, 401),
      },
    ]);
    await expect(fetchGitHub('/user')).rejects.toMatchObject({ code: 'needs_connect' });
    expect(hasGitHubGrant()).toBe(false);
  });

  it('propagates typed push_conflict errors from the proxy', async () => {
    window.history.replaceState(null, '', '/#gh_grant=valid-grant');
    captureGitHubGrantFromUrl();
    installFetchQueue([
      {
        matcher: () => true,
        handler: async () =>
          json(
            { message: 'Base commit is stale. Pull first.', code: 'push_conflict' },
            409
          ),
      },
    ]);
    await expect(
      updateRef('o', 'r', 'main', 'abc123', 'old-parent')
    ).rejects.toMatchObject({ code: 'push_conflict', status: 409 });
  });

  it('refreshGitHubGrant returns false and clears the grant when the server has no token', async () => {
    setFirebaseTokenGetter(async () => FIREBASE_TOKEN);
    window.history.replaceState(null, '', '/#gh_grant=stale-grant');
    captureGitHubGrantFromUrl();
    installFetchQueue([
      { matcher: () => true, handler: async () => json({ needsConnect: true }) },
    ]);
    const ok = await refreshGitHubGrant();
    expect(ok).toBe(false);
    expect(hasGitHubGrant()).toBe(false);
  });
});

describe('revocation', () => {
  it('calls /api/gh/revoke with the grant and clears local state', async () => {
    window.history.replaceState(null, '', '/#gh_grant=revocable');
    captureGitHubGrantFromUrl();
    const calls = installFetchQueue([
      { matcher: (u) => u.includes('/api/gh/revoke'), handler: async () => json({ ok: true }) },
    ]);
    await revokeGitHub();
    const call = calls.find((c) => c.url.includes('/api/gh/revoke'))!;
    expect(call.init?.headers).toMatchObject({ Authorization: `Bearer revocable` });
    expect(hasGitHubGrant()).toBe(false);
  });

  it('clears local state even if the server call fails', async () => {
    window.history.replaceState(null, '', '/#gh_grant=revocable');
    captureGitHubGrantFromUrl();
    installFetchQueue([
      { matcher: () => true, handler: async () => json({ error: 'down' }, 500) },
    ]);
    await expect(revokeGitHub()).rejects.toThrow('down');
    expect(hasGitHubGrant()).toBe(false);
  });
});

describe('updateRef request shape', () => {
  it('sends expected_parent and force:false', async () => {
    window.history.replaceState(null, '', '/#gh_grant=g');
    captureGitHubGrantFromUrl();
    const calls = installFetchQueue([
      { matcher: () => true, handler: async () => json({ ok: true }) },
    ]);
    await updateRef('owner', 'repo', 'main', 'sha1', 'parent-sha');
    const apiCall = calls.find((c) => c.url.includes('/api/gh/repos/owner/repo/git/refs/heads/main'))!;
    const opts = apiCall.init as RequestInit;
    expect(opts.method).toBe('PATCH');
    const body = JSON.parse(String(opts.body));
    expect(body).toEqual({ sha: 'sha1', force: false, expected_parent: 'parent-sha' });
  });

  it('omits expected_parent when not provided', async () => {
    window.history.replaceState(null, '', '/#gh_grant=g');
    captureGitHubGrantFromUrl();
    const calls = installFetchQueue([
      { matcher: () => true, handler: async () => json({ ok: true }) },
    ]);
    await updateRef('owner', 'repo', 'main', 'sha1');
    const apiCall = calls.find((c) => c.url.includes('/api/gh/repos/owner/repo/git/refs/heads/main'))!;
    const body = JSON.parse(String((apiCall.init as RequestInit).body));
    expect(body).toEqual({ sha: 'sha1', force: false });
  });
});

describe('GitHubError', () => {
  it('is recognized by the type guard with status and code', () => {
    const err = new GitHubError('boom', 429, 'rate_limited');
    expect(err.status).toBe(429);
    expect(err.code).toBe('rate_limited');
    expect(err.name).toBe('GitHubError');
  });
});