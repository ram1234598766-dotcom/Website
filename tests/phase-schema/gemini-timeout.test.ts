/**
 * Gemini upstream timeout test.
 *
 * Validates that when the Gemini upstream fetch rejects with a timeout
 * error, handleAiGenerate returns HTTP 500 with a JSON body whose `error`
 * field mentions the timeout — so the browser's fallback can surface a
 * meaningful message instead of a cryptic 503.
 *
 * Mirrors the stub patterns from edge-contract.test.ts:
 *  - stub globalThis.fetch
 *  - send same-site headers (Origin + Sec-Fetch-Site) to pass isSameSiteRequest
 *  - provide a GEMINI_API_KEY via serverEnv to pass the key check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleApiRequest } from '../../src/lib/server/api-router';
import { resetServerGeminiLimits } from '../../src/lib/server/rate-limit';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function geminiRequest(body: Record<string, unknown>, extraHeaders?: Record<string, string>): Request {
  return new Request('https://example.com/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://website.vasudevaya.workers.dev',
      'Sec-Fetch-Site': 'same-origin',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

const SERVER_ENV = { GEMINI_API_KEY: 'AIza-test-timeout-key' };

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  vi.useRealTimers();
  resetServerGeminiLimits();
});

afterEach(() => {
  vi.restoreAllMocks();
  (globalThis as any).fetch = originalFetch;
  resetServerGeminiLimits();
});

/* ------------------------------------------------------------------ */
/*  Gemini timeout                                                     */
/* ------------------------------------------------------------------ */

describe('POST /api/ai/generate — Gemini upstream timeout', () => {
  it('returns HTTP 500 with a JSON body whose error mentions timeout', async () => {
    // Simulate an AbortSignal.timeout rejection — the browser/runtime
    // throws a DOMException with name 'TimeoutError' when AbortSignal.timeout fires.
    const timeoutError = new DOMException('The operation timed out', 'TimeoutError');
    (globalThis as any).fetch = vi.fn().mockRejectedValue(timeoutError);

    const req = geminiRequest({
      provider: 'gemini',
      apiKey: 'AIza-client-key-123', // client-provided key bypasses same-site gate
      messages: [{ role: 'user', content: 'Hello' }],
    });

    const res = await handleApiRequest(req, SERVER_ENV);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.error).toBe('string');
    // The error message should indicate a timeout so the browser fallback
    // can display something meaningful (not a bare 503).
    expect(String(body.error).toLowerCase()).toMatch(/timed out|timeout/);

    // The upstream call MUST carry an AbortSignal (AbortSignal.timeout) so a
    // hung Google reply cannot hold the Worker in I/O past the budget.
    const fetchInit = (globalThis as any).fetch.mock.calls[0][1];
    expect(fetchInit).toBeDefined();
    expect(fetchInit.signal instanceof AbortSignal).toBe(true);
  });

  it('still returns 500 with descriptive error when fetch rejects generically', async () => {
    (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('upstream unreachable'));

    const req = geminiRequest({
      provider: 'gemini',
      apiKey: 'AIza-client-key-456',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    const res = await handleApiRequest(req, SERVER_ENV);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it('returns 500 when a server-key Gemini call times out', async () => {
    const timeoutError = new DOMException('The operation timed out', 'TimeoutError');
    (globalThis as any).fetch = vi.fn().mockRejectedValue(timeoutError);

    const req = geminiRequest({
      provider: 'gemini',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    const res = await handleApiRequest(req, SERVER_ENV);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error).toLowerCase()).toMatch(/timed out|timeout/);
  });
});
