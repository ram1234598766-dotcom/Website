import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Phase 3 — API Route Consistency tests.
 *
 * Verifies across all API routes:
 *   - All API routes return JSON (Content-Type: application/json)
 *   - All API routes handle OPTIONS preflight (return 200-299)
 *   - Error responses use consistent format { error: string }
 *   - All routes that should have OPTIONS do have it
 */

const API_ROUTES = [
  { method: 'GET' as const, path: '/api/status', loader: () => import('../../app/api/status/route') },
  { method: 'GET' as const, path: '/api/health', loader: () => import('../../app/api/health/route') },
  { method: 'GET' as const, path: '/api/healthz', loader: () => import('../../app/api/healthz/route') },
  { method: 'GET' as const, path: '/api/ready', loader: () => import('../../app/api/ready/route') },
  { method: 'GET' as const, path: '/api/peers', loader: () => import('../../app/api/peers/route') },
  { method: 'GET' as const, path: '/api/services/health', loader: () => import('../../app/api/services/health/route') },
  { method: 'GET' as const, path: '/api/models', loader: () => import('../../app/api/models/route') },
  { method: 'GET' as const, path: '/api/plugins', loader: () => import('../../app/api/plugins/route') },
  { method: 'POST' as const, path: '/api/rate-limit-check', loader: () => import('../../app/api/rate-limit-check/route') },
  { method: 'POST' as const, path: '/api/ai/generate', loader: () => import('../../app/api/ai/generate/route') },
  { method: 'POST' as const, path: '/api/security/scan', loader: () => import('../../app/api/security/scan/route') },
  { method: 'GET' as const, path: '/api/git-status', loader: () => import('../../app/api/git-status/route') },
  { method: 'GET' as const, path: '/api/git-diff', loader: () => import('../../app/api/git-diff/route') },
];

const ALL_ROUTES_WITH_OPTIONS = [
  { path: '/api/status', loader: () => import('../../app/api/status/route') },
  { path: '/api/health', loader: () => import('../../app/api/health/route') },
  { path: '/api/healthz', loader: () => import('../../app/api/healthz/route') },
  { path: '/api/ready', loader: () => import('../../app/api/ready/route') },
  { path: '/api/peers', loader: () => import('../../app/api/peers/route') },
  { path: '/api/services/health', loader: () => import('../../app/api/services/health/route') },
  { path: '/api/models', loader: () => import('../../app/api/models/route') },
  { path: '/api/plugins', loader: () => import('../../app/api/plugins/route') },
  { path: '/api/rate-limit-check', loader: () => import('../../app/api/rate-limit-check/route') },
  { path: '/api/ai/generate', loader: () => import('../../app/api/ai/generate/route') },
  { path: '/api/security/scan', loader: () => import('../../app/api/security/scan/route') },
  { path: '/api/git-status', loader: () => import('../../app/api/git-status/route') },
  { path: '/api/git-diff', loader: () => import('../../app/api/git-diff/route') },
  { path: '/api/edge-functions/auth-sync', loader: () => import('../../app/api/edge-functions/auth-sync/route') },
];

describe('API route consistency', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('JSON responses', () => {
    it('all API routes return Content-Type application/json', async () => {
      for (const route of API_ROUTES) {
        const mod = await route.loader();
        const handler = mod[route.method] as (req: Request) => Promise<Response>;
        const res = await handler(new Request(`https://example.com${route.path}`, { method: route.method }));
        const ct = res.headers.get('content-type') || '';
        expect(ct, `route ${route.method} ${route.path}`).toContain('application/json');
      }
    });
  });

  describe('OPTIONS preflight', () => {
    it('all routes that export OPTIONS return 200-299', async () => {
      for (const route of ALL_ROUTES_WITH_OPTIONS) {
        const mod = await route.loader();
        const { OPTIONS } = mod;
        expect(typeof OPTIONS === 'function', `OPTIONS not a function for ${route.path}`).toBe(true);
        const res = await OPTIONS(new NextRequest(`https://example.com${route.path}`, { method: 'OPTIONS' }));
        expect(res.status, `OPTIONS ${route.path}`).toBeGreaterThanOrEqual(200);
        expect(res.status, `OPTIONS ${route.path}`).toBeLessThanOrEqual(299);
      }
    });

    it('OPTIONS response has CORS headers', async () => {
      const { OPTIONS } = await import('../../app/api/health/route');
      const res = await OPTIONS(new NextRequest('https://example.com/api/health', { method: 'OPTIONS' }));
      const acm = res.headers.get('access-control-allow-methods');
      expect(acm).toBeTruthy();
      const ach = res.headers.get('access-control-allow-headers');
      expect(ach).toBeTruthy();
    });
  });

  describe('Error response format', () => {
    it('error responses use { error: string } format', async () => {
      const { POST } = await import('../../app/api/ai/generate/route');
      const res = await POST(new NextRequest('https://example.com/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      }));
      const body = JSON.parse(await res.text());
      if (res.status >= 400) {
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
      }
    });

    it('404 from api-router uses { error: string } format', async () => {
      const { handleApiRequest, serverEnv } = await import('../../src/lib/server/api-router');
      const env = serverEnv();
      const res = await handleApiRequest(new NextRequest('https://example.com/api/nonexistent'), env);
      const body = JSON.parse(await res.text());
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('500 errors use { error: string } format without internals', async () => {
      const { handleApiRequest, serverEnv } = await import('../../src/lib/server/api-router');
      const env = serverEnv();
      const res = await handleApiRequest(new NextRequest('https://example.com/api/edge-functions/auth-sync'), env);
      const body = JSON.parse(await res.text());
      if (res.status === 500) {
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
        expect(body).not.toHaveProperty('stack');
        expect(body).not.toHaveProperty('message');
      }
    });
  });

  describe('Route exports', () => {
    it('all routes that should have OPTIONS do have it', async () => {
      for (const route of ALL_ROUTES_WITH_OPTIONS) {
        const mod = await route.loader();
        expect(mod, `module for ${route.path}`).toBeDefined();
        expect(typeof mod.OPTIONS).toBe('function');
      }
    });
  });
});
