import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Phase Backend — CORS preflight tests.
 *
 * Verifies for OPTIONS /api/*:
 *   - Allow-Origin reflects request origin when allowlisted
 *   - Allow-Origin is NOT set (null) for non-allowlisted origins
 *   - No wildcard (*) with credentials (Allow-Credentials: true)
 *   - Proper Allow-Methods and Allow-Headers on preflight
 */

async function preflight(path: string, origin: string): Promise<{ status: number; response: Response }> {
  const { OPTIONS } = await import(`../../app${path}/route`);
  const res = await OPTIONS(new Request(`https://example.com${path}`, {
    method: 'OPTIONS',
    headers: { Origin: origin },
  }));
  return { status: res.status, response: res };
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://website.vasudevaya.workers.dev',
  'https://www.vantaos.org',
];

const BLOCKED_ORIGINS = [
  'https://evil.example.com',
  'https://vantaos.org.evil.com',
  'https://website.vasudevaya.workers.dev.evil.com',
];

describe('CORS preflight handling', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('Allowlisted origins', () => {
    it('reflects the request origin in Access-Control-Allow-Origin', async () => {
      for (const origin of ALLOWED_ORIGINS) {
        const { response } = await preflight('/api/health', origin);
        expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      }
    });

    it('sets Access-Control-Allow-Credentials for allowlisted origins', async () => {
      const { response } = await preflight('/api/health', 'http://localhost:3000');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('returns proper Allow-Methods on preflight', async () => {
      const { response } = await preflight('/api/health', 'http://localhost:3000');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, PATCH, DELETE, OPTIONS');
    });

    it('returns proper Allow-Headers on preflight', async () => {
      const { response } = await preflight('/api/health', 'http://localhost:3000');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type, Authorization');
    });
  });

  describe('Non-allowlisted origins', () => {
    it('does NOT set Access-Control-Allow-Origin for blocked origins', async () => {
      for (const origin of BLOCKED_ORIGINS) {
        const { response } = await preflight('/api/health', origin);
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
      }
    });

    it('does NOT set Allow-Credentials for blocked origins', async () => {
      for (const origin of BLOCKED_ORIGINS) {
        const { response } = await preflight('/api/health', origin);
        expect(response.headers.get('access-control-allow-credentials')).toBeNull();
      }
    });
  });

  describe('No wildcard with credentials', () => {
    it('never returns "*" as Allow-Origin when credentials are used', async () => {
      const { POST } = await import('../../app/api/ai/generate/route');
      const res = await POST(new NextRequest('https://example.com/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.example.com',
        },
        body: JSON.stringify({ provider: 'openrouter', apiKey: 'sk-test', messages: [{ role: 'user', content: 'hi' }] }),
      }));
      const acao = res.headers.get('access-control-allow-origin');
      if (acao !== null) {
        expect(acao).not.toBe('*');
      }
    });
  });
});
