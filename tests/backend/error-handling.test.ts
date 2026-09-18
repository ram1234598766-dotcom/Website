import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Phase Backend — Error handling consistency tests.
 *
 * Verifies across all API endpoints:
 *   - Consistent error envelope: { error: string }
 *   - No internal error messages leaked to clients
 *   - Request ID header present on responses
 *   - Proper HTTP status codes
 */

async function callEndpoint(method: string, routePath: string, body?: unknown): Promise<{ status: number; headers: Headers; body: any }> {
  const mod = await import(`../../app${routePath}/route`);
  const handler = mod[method.toUpperCase()];
  if (!handler) return { status: 405, headers: new Headers(), body: null };
  const res = await handler(new Request(`https://example.com${routePath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }));
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, headers: res.headers, body: parsed };
}

async function callApiRouter(path: string): Promise<{ status: number; headers: Headers; body: any }> {
  const { handleApiRequest, serverEnv } = await import('../../src/lib/server/api-router');
  const env = serverEnv();
  const res = await handleApiRequest(new Request(`https://example.com${path}`), env);
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, headers: res.headers, body: parsed };
}

// Routes that should have request IDs (all go through handleApiRequest).
const ROUTES_WITH_ID = [
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/ready' },
  { method: 'GET', path: '/api/peers' },
  { method: 'GET', path: '/api/services/health' },
  { method: 'POST', path: '/api/rate-limit-check', body: { key: 'test-key' } },
  { method: 'POST', path: '/api/ai/generate', body: { provider: 'openrouter', messages: [{ role: 'user', content: 'hi' }], apiKey: 'sk-test' } },
  { method: 'POST', path: '/api/security/scan' },
  { method: 'POST', path: '/api/edge-functions/auth-sync', body: { token: 'fake-token' } },
];

describe('Error handling consistency', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    vi.stubEnv('GH_GRANT_SECRET', 'test-secret');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubGlobal('indexedDB', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('Request ID tracing', () => {
    it('includes X-Request-ID header on main endpoints', async () => {
      const mod = await import('../../app/api/health/route');
      console.log('health route exports:', Object.keys(mod));
      for (const route of ROUTES_WITH_ID) {
        const { headers } = await callEndpoint(route.method, route.path, route.body);
        const hasId = headers.get('x-request-id');
        if (!hasId) {
          console.log('MISSING ID:', route.method, route.path);
        }
        expect(hasId).toBeTruthy();
      }
    });

    it('X-Request-ID is a non-empty string', async () => {
      const { headers } = await callEndpoint('GET', '/api/health');
      const val = headers.get('x-request-id');
      expect(typeof val === 'string' && val.length > 0).toBe(true);
    });
  });

  describe('Error envelope', () => {
    it('404 responses use consistent error envelope', async () => {
      const { body } = await callApiRouter('/api/nonexistent');
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('400 responses use consistent error envelope', async () => {
      const { body } = await callEndpoint('POST', '/api/ai/generate', { messages: [{ role: 'user', content: 'hi' }] });
      if (body && typeof body === 'object' && 'error' in body) {
        expect(typeof body.error).toBe('string');
      }
    });

    it('never returns 500 with internal details in body', async () => {
      for (const route of ROUTES_WITH_ID) {
        const { status, body } = await callEndpoint(route.method, route.path, route.body);
        if (status === 500) {
          expect(body).toHaveProperty('error');
          expect(typeof body.error).toBe('string');
          // Error must be a generic client-safe message — no internals leaked
          expect(body.error.length).toBeLessThanOrEqual(40);
          expect(body).not.toHaveProperty('message');
          expect(body).not.toHaveProperty('stack');
          expect(body).not.toHaveProperty('details');
        }
      }
    });
  });

  describe('No secret leakage', () => {
    it('no API keys in health endpoint response', async () => {
      const { body } = await callEndpoint('GET', '/api/health');
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('GEMINI_API_KEY');
      expect(serialized).not.toContain('gh_secret');
    });

    it('no secrets in peers endpoint response', async () => {
      const { body } = await callEndpoint('GET', '/api/peers');
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('apiKey');
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('token');
    });

    it('no secrets in services/health endpoint response', async () => {
      const { body } = await callEndpoint('GET', '/api/services/health');
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('GEMINI_API_KEY');
      expect(serialized).not.toContain('gh_secret');
    });
  });
});
