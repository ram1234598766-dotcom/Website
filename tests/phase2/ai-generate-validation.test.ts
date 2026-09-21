import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Phase 2 — boundary validation for POST /api/ai/generate (AGENTS §7.6).
 *
 * The `messages` field and the request body size are attacker-controlled.
 * A non-array previously reached `messages.map()` and surfaced as an opaque
 * 500, and oversized bodies were read and forwarded upstream verbatim — which
 * spends the operator's GEMINI_API_KEY when the client sends no apiKey.
 */

async function postAiGenerate(
  body: unknown,
  opts?: { query?: string; contentLength?: string },
): Promise<{ status: number; body: any }> {
  const { POST } = await import('../../app/api/ai/generate/route');
  const url = `https://example.com/api/ai/generate${opts?.query ? `?${opts.query}` : ''}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.contentLength) headers['Content-Length'] = opts.contentLength;
  const res = await POST(new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }));
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

describe('POST /api/ai/generate — boundary validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects a non-array messages field with 400 instead of throwing', async () => {
    const { status, body } = await postAiGenerate({ provider: 'gemini', messages: 'hello' });
    expect(status).toBe(400);
    expect(body.error).toBe('messages must be an array');
  });

  it('rejects an empty messages array with 400', async () => {
    const { status, body } = await postAiGenerate({ provider: 'gemini', messages: [] });
    expect(status).toBe(400);
    expect(typeof body.error).toBe('string');
  });

  it('rejects a message whose content is not a string', async () => {
    const { status, body } = await postAiGenerate({
      provider: 'gemini',
      messages: [{ role: 'user', content: { nested: true } }],
    });
    expect(status).toBe(400);
    expect(body.error).toBe('each message must have a string content');
  });

  it('rejects a message with no role', async () => {
    const { status, body } = await postAiGenerate({
      provider: 'gemini',
      messages: [{ content: 'hi' }],
    });
    expect(status).toBe(400);
    expect(body.error).toBe('each message must have a non-empty string role');
  });

  it('rejects more than 64 messages', async () => {
    const messages = Array.from({ length: 65 }, () => ({ role: 'user', content: 'hi' }));
    const { status, body } = await postAiGenerate({ provider: 'gemini', messages });
    expect(status).toBe(400);
    expect(typeof body.error).toBe('string');
  });

  it('rejects a single oversized message', async () => {
    const { status, body } = await postAiGenerate({
      provider: 'gemini',
      messages: [{ role: 'user', content: 'x'.repeat(32_001) }],
    });
    expect(status).toBe(400);
    expect(typeof body.error).toBe('string');
  });

  it('rejects a body over the 1MB cap with 413', async () => {
    const { status, body } = await postAiGenerate(
      { provider: 'gemini', messages: [{ role: 'user', content: 'hi' }] },
      { contentLength: '2000000' },
    );
    expect(status).toBe(413);
    expect(body.error).toContain('1MB');
  });

  it('applies the same validation on the streaming path', async () => {
    const { status, body } = await postAiGenerate(
      { provider: 'gemini', messages: 'not-an-array' },
      { query: 'stream=1' },
    );
    expect(status).toBe(400);
    expect(body.error).toBe('messages must be an array');
  });

  it('still accepts a well-formed payload', async () => {
    const { status } = await postAiGenerate({
      provider: 'gemini',
      messages: [{ role: 'user', content: 'hi' }],
    });
    // No live upstream in tests: an accepted payload fails later (403 for the
    // server-key gate), never 400-for-validation.
    expect(status).not.toBe(400);
  });
});
