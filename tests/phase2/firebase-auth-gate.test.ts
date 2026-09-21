import { describe, expect, it, vi, afterEach } from 'vitest';
import { handleApiRequest, type Env } from '../../src/lib/server/api-router';

/**
 * Phase 2 — Firebase token-verification gate.
 *
 * Named test for the demo-mode regression: with no NEXT_PUBLIC_FIREBASE_*
 * configured (the default first-run experience), `projectId()` used to throw
 * inside the token-verifying routes, so the outer catch-all answered a
 * misleading 500. The routes must instead fail closed with 503 and never touch
 * the JWKS endpoint.
 */

const TOKEN_ROUTES = [
  { path: '/api/edge-functions/auth-sync', body: { token: 'fake-token' } },
  { path: '/api/gh/authorize', body: { firebaseToken: 'fake-token' } },
  { path: '/api/gh/import', body: { firebaseToken: 'fake-token', accessToken: 'gh-token' } },
  { path: '/api/gh/session', body: {} },
];

async function post(path: string, env: Env, body: unknown): Promise<{ status: number; body: any }> {
  const res = await handleApiRequest(
    new Request(`https://example.com${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  );
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

describe('Firebase token verification gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('when Firebase is not configured (demo mode)', () => {
    it.each(TOKEN_ROUTES)('$path fails closed with 503, not 500', async ({ path, body }) => {
      const { status, body: resBody } = await post(path, {}, body);
      expect(status).toBe(503);
      expect(resBody.error).toBe('Firebase is not configured');
      expect(resBody.code).toBe('firebase_not_configured');
    });

    it.each(TOKEN_ROUTES)('$path never fetches the JWKS endpoint', async ({ path, body }) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await post(path, {}, body);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats an empty project id as unconfigured', async () => {
      const { status } = await post(
        '/api/edge-functions/auth-sync',
        { NEXT_PUBLIC_FIREBASE_PROJECT_ID: '' },
        { token: 'fake-token' },
      );
      expect(status).toBe(503);
    });
  });

  describe('when Firebase is configured', () => {
    it('rejects a malformed token with 401 rather than 503', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { status } = await post(
        '/api/edge-functions/auth-sync',
        { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-project' },
        { token: 'not-a-jwt' },
      );
      expect(status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
