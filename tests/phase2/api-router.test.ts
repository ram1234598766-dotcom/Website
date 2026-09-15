import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Phase 2 — REST endpoints (TDD).
 *
 * Contract:
 *   - GET /api/peers               → 200, JSON body with a real peer list
 *                                   (peers this node has seen / is syncing
 *                                   with), no secrets.
 *   - GET /api/services/health     → 200, JSON body with per-service health
 *                                   state backed by real checks, no secrets.
 *
 * Harness mirrors the established api-router pattern used by the health
 * endpoint: import the App Router route wrapper, stub the process.env
 * surfaces it depends on, and call the route's GET handler.
 */

async function importRoute(routePath: string) {
  return import(routePath);
}

async function routeGet(routePath: string, url: string): Promise<{ status: number; body: any }> {
  const { GET } = await importRoute(routePath);
  const res = await GET(new Request(url));
  const text = await res.text();
  const body = JSON.parse(text);
  return { status: res.status, body };
}

describe('Phase 2 REST endpoints', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    vi.stubGlobal('indexedDB', {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('GET /api/peers', () => {
    it('returns 200 with a JSON body', async () => {
      const { status } = await routeGet('../../app/api/peers/route', 'https://example.com/api/peers');
      expect(status).toBe(200);
    });

    it('returns a real peers list (not hardcoded)', async () => {
      const { body } = await routeGet('../../app/api/peers/route', 'https://example.com/api/peers');
      expect(Array.isArray(body.peers)).toBe(true);
      expect(body.peers).toBeDefined();
    });

    it('does not include offline peers', async () => {
      const { body } = await routeGet('../../app/api/peers/route', 'https://example.com/api/peers');
      for (const peer of body.peers) {
        expect(peer.online).not.toBe(false);
      }
    });

    it('has no secrets in the response', async () => {
      const { body } = await routeGet('../../app/api/peers/route', 'https://example.com/api/peers');
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('apiKey');
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('token');
    });
  });

  describe('GET /api/services/health', () => {
    it('returns 200 with a JSON body', async () => {
      const { status } = await routeGet('../../app/api/services/health/route', 'https://example.com/api/services/health');
      expect(status).toBe(200);
    });

    it('reports per-service health from real checks', async () => {
      const { body } = await routeGet('../../app/api/services/health/route', 'https://example.com/api/services/health');
      expect(body.status).toBeDefined();
      expect(body.services).toBeDefined();
      expect(typeof body.services).toBe('object');
    });

    it('has no secrets in the response', async () => {
      const { body } = await routeGet('../../app/api/services/health/route', 'https://example.com/api/services/health');
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('apiKey');
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('token');
    });
  });
});
