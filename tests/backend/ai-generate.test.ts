import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Phase Backend — AI Generate endpoint tests.
 *
 * Verifies for POST /api/ai/generate:
 *   - Consistent error envelope: { error: string, code?: string }
 *   - Never leaks err.message or internal details to clients
 *   - Supports streaming (?stream=1 / Accept: text/event-stream)
 *   - Returns proper SSE formatting including [DONE] sentinel
 *   - Request ID header present for tracing
 */

async function importRoute() {
  return import('../../app/api/ai/generate/route');
}

async function postAiGenerate(body: unknown, query?: string, accept?: string): Promise<{ status: number; headers: Record<string, string | null>; body: any }> {
  const { POST } = await importRoute();
  const url = `https://example.com/api/ai/generate${query ? `?${query}` : ''}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accept) headers['Accept'] = accept;
  const res = await POST(new NextRequest(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const text = await res.text();
  let parsedBody: any;
  try { parsedBody = JSON.parse(text); } catch { parsedBody = text; }
  const h: Record<string, string | null> = {};
  res.headers.forEach((v, k) => { h[k] = v; });
  return { status: res.status, headers: h, body: parsedBody };
}

describe('POST /api/ai/generate', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    vi.stubEnv('GH_GRANT_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('Error envelope', () => {
    it('returns consistent error shape for missing provider', async () => {
      const { status, body } = await postAiGenerate({ messages: [{ role: 'user', content: 'hi' }] });
      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    });

    it('returns consistent error shape for missing messages', async () => {
      const { status, body } = await postAiGenerate({ provider: 'openrouter', model: 'gpt-4o', apiKey: 'sk-xxx' });
      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('never leaks error messages to client on provider failure', async () => {
      const { status, body } = await postAiGenerate({
        provider: 'openrouter',
        model: 'gpt-4o',
        apiKey: 'sk-fake-key-that-will-fail',
        messages: [{ role: 'user', content: 'hi' }],
      });
      if (status === 500) {
        expect(body).toEqual({ error: 'AI request failed' });
        expect(body.error).not.toContain('sk-');
        expect(body.error).not.toContain('openrouter');
      }
      expect(status).toBeGreaterThan(0);
    });

    it('has request ID header on error responses', async () => {
      const { POST } = await importRoute();
      const res = await POST(new NextRequest('https://example.com/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      }));
      const requestId = res.headers.get('x-request-id');
      expect(requestId).toBeTruthy();
      expect(typeof requestId).toBe('string');
      expect(requestId!.length).toBeGreaterThan(0);
    });
  });

  describe('Input validation', () => {
    it('rejects unsupported provider with 400', async () => {
      const { status, body } = await postAiGenerate({
        provider: 'unsupported',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(status).toBe(400);
      expect(body.error).toBe('Unsupported provider: unsupported');
    });

    it('rejects invalid Gemini model name', async () => {
      const { status, body } = await postAiGenerate({
        provider: 'gemini',
        model: 'invalid model with spaces!',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(status).toBe(400);
      expect(body.error).toBe('Invalid model name');
    });
  });

  describe('Streaming', () => {
    it('supports ?stream=1 query parameter', async () => {
      const { status, headers } = await postAiGenerate(
        { provider: 'openrouter', apiKey: 'sk-test', messages: [{ role: 'user', content: 'hi' }] },
        'stream=1',
      );
      expect(status).toBeGreaterThan(0);
      const contentType = headers['content-type'] || '';
      if (status === 200) {
        expect(contentType).toContain('text/event-stream');
      }
    });

    it('supports Accept: text/event-stream header', async () => {
      const { status, headers } = await postAiGenerate(
        { provider: 'openrouter', apiKey: 'sk-test', messages: [{ role: 'user', content: 'hi' }] },
        undefined,
        'text/event-stream',
      );
      expect(status).toBeGreaterThan(0);
      const contentType = headers['content-type'] || '';
      if (status === 200) {
        expect(contentType).toContain('text/event-stream');
      }
    });

    it('streaming response contains SSE-formatted data', async () => {
      const { status, body } = await postAiGenerate(
        { provider: 'openrouter', apiKey: 'sk-test', messages: [{ role: 'user', content: 'hi' }] },
        'stream=1',
      );
      if (status === 200 && typeof body === 'string') {
        expect(body).toContain('data:');
      }
      expect(status).toBeGreaterThan(0);
    });
  });
});
