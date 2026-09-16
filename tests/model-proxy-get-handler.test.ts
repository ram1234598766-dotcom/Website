/**
 * Unit tests for handleModelProxyGet — the GET /api/model-proxy handler.
 *
 * Validates:
 *   (a) Forwards client Range header upstream when present
 *   (b) 206 upstream → status 206 + Content-Range + Content-Length forwarded
 *   (c) 200 upstream → 200 + Content-Length + Content-Type + Cache-Control
 *   (d) Upstream 500 → 500 JSON error with original status preserved
 *   (e) Blocked host → 403 with error + allowed list
 *   (f) Upstream timeout → 502 `{ error: 'upstream timed out' }`
 *
 * Network calls are fully mocked via globalThis.fetch — no real network.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleApiRequest } from '../src/lib/server/api-router';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function proxyRequest(
  url: string,
  headers?: Record<string, string>,
): Request {
  return new Request(url, { method: 'GET', headers });
}

const ALLOWED_UA = 'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/config.json';
const BLOCKED_UA = 'https://evil.example.com/malware.bin';

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  (globalThis as any).fetch = originalFetch;
});

/* ------------------------------------------------------------------ */
/*  (e) Blocked host → 403 with error + allowed list                   */
/* ------------------------------------------------------------------ */

describe('GET /api/model-proxy — blocked host', () => {
  it('returns 403 with error and allowed host list for a non-allowlisted URL', async () => {
    const req = proxyRequest(`https://example.com/api/model-proxy?url=${encodeURIComponent(BLOCKED_UA)}`);
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('blocked host');
    expect(Array.isArray(body.allowed)).toBe(true);
    expect((body.allowed as string[]).length).toBeGreaterThan(0);
  });

  it('returns 403 for an empty URL', async () => {
    const req = proxyRequest('https://example.com/api/model-proxy');
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('blocked host');
  });
});

/* ------------------------------------------------------------------ */
/*  (a) Forwards client Range header upstream                          */
/* ------------------------------------------------------------------ */

describe('GET /api/model-proxy — forwards Range header', () => {
  it('includes the client Range header in the upstream request when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '14',
        },
      }),
    );
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
      { Range: 'bytes=0-0' },
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, fetchInit] = fetchMock.mock.calls[0];
    expect(fetchInit.headers).toHaveProperty('Range', 'bytes=0-0');
  });

  it('does not include Range header in upstream when client sends none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Content-Length': '14' },
      }),
    );
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
    );
    await handleApiRequest(req, {});

    const [, fetchInit] = fetchMock.mock.calls[0];
    expect(fetchInit.headers).not.toHaveProperty('Range');
  });
});

/* ------------------------------------------------------------------ */
/*  (b) 206 upstream → status 206 + Content-Range + Content-Length     */
/* ------------------------------------------------------------------ */

describe('GET /api/model-proxy — 206 partial content', () => {
  it('forwards 206 status, Content-Range, and Content-Length from upstream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('x', {
        status: 206,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': '1',
          'Content-Range': 'bytes 0-0/540000000',
        },
      }),
    );
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
      { Range: 'bytes=0-0' },
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-0/540000000');
    expect(res.headers.get('Content-Length')).toBe('1');
  });
});

/* ------------------------------------------------------------------ */
/*  (c) 200 upstream → 200 + Content-Length + Content-Type + Cache-Control */
/* ------------------------------------------------------------------ */

describe('GET /api/model-proxy — 200 success', () => {
  it('returns 200 with Content-Length, Content-Type, and Cache-Control', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('model-config-json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '17', // exactly matches 'model-config-json'
        },
      }),
    );
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Content-Length')).toBe('17');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
  });
});

/* ------------------------------------------------------------------ */
/*  (d) Upstream 500 → 500 JSON error with original status preserved  */
/* ------------------------------------------------------------------ */

describe('GET /api/model-proxy — upstream error', () => {
  it('returns 500 with error message when upstream returns 500', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
    expect(body.status).toBe(500);
  });

  it('returns 404 with original status when upstream returns 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe(404);
  });
});

/* ------------------------------------------------------------------ */
/*  (g) Redirect leaves the allowlist → 403                           */
/* ------------------------------------------------------------------ */

describe('GET /api/model-proxy — redirect leaves allowlist', () => {
  it('returns 403 when the post-redirect final URL is not allowlisted', async () => {
    // Simulate fetch following a redirect from an allowlisted host to an
    // arbitrary host: Response.url is the final URL after redirects.
    const body = new Response('redirected', { status: 200 });
    Object.defineProperty(body, 'url', { value: 'https://evil.example.com/exfil.bin' });
    const fetchMock = vi.fn().mockResolvedValue(body);
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(403);
    const resp = (await res.json()) as Record<string, unknown>;
    expect(resp.error).toBe('redirect left allowed hosts');
  });

  it('allows a post-redirect final URL that is still under a HuggingFace-owned zone', async () => {
    const body = new Response('x', {
      status: 206,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': '1',
        'Content-Range': 'bytes 0-0/100',
      },
    });
    // huggingface.co resolve/ 302s weight blobs to its Xet CDN — this is the
    // real, legitimate redirect path (us.aws.cdn.hf.co) and must keep working.
    Object.defineProperty(body, 'url', { value: 'https://us.aws.cdn.hf.co/xet-bridge-us/681a5019767ca450/model.onnx' });
    const fetchMock = vi.fn().mockResolvedValue(body);
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(`https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`);
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(206);
  });
});

/* ------------------------------------------------------------------ */
/*  (f) Upstream timeout → 502 with descriptive error                  */
/* ------------------------------------------------------------------ */

describe('GET /api/model-proxy — timeout', () => {
  it('returns 502 with upstream timed out message when AbortController fires', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('upstream timed out');
  });

  it('returns 502 with generic message for non-abort network errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failure'));
    (globalThis as any).fetch = fetchMock;

    const req = proxyRequest(
      `https://example.com/api/model-proxy?url=${encodeURIComponent(ALLOWED_UA)}`,
    );
    const res = await handleApiRequest(req, {});
    expect(res.status).toBe(502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('upstream request failed');
  });
});
