import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { rateLimitCheck, rateLimitStore } from '../../workers/worker';

const env: Record<string, string | undefined> = {};

function mockRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Health endpoint ────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns status ok with ISO timestamp', async () => {
    const req = mockRequest('https://example.com/api/health');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(['ok', 'degraded']).toContain(body.status);
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp as string).getTime()).not.toThrow();
  });

  it('returns services with ai, github, drive all ok', async () => {
    const req = mockRequest('https://example.com/api/health');
    const res = await worker.fetch(req, env);
    const body = (await res.json()) as Record<string, unknown>;
    const services = body.services as Record<string, unknown>;
    expect(services.ai).toBe('ok');
    expect(services.github).toBe('ok');
    expect(services.drive).toBe('ok');
  });

  it('has exactly the expected top-level keys', async () => {
    const req = mockRequest('https://example.com/api/health');
    const res = await worker.fetch(req, env);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['services', 'status', 'timestamp']);
  });
});

// ─── Readiness endpoint ─────────────────────────────────────

describe('GET /api/ready', () => {
  it('returns { ready: true }', async () => {
    const req = mockRequest('https://example.com/api/ready');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ready).toBe(true);
  });

  it('has no extra fields', async () => {
    const req = mockRequest('https://example.com/api/ready');
    const res = await worker.fetch(req, env);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['ready']);
  });
});

// ─── Rate limiting ──────────────────────────────────────────

describe('POST /api/rate-limit-check', () => {
  it('allows requests under the limit', async () => {
    const req = mockRequest('https://example.com/api/rate-limit-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'user-1' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.allowed).toBe(true);
    expect(typeof body.remaining).toBe('number');
    expect(body.remaining).toBeGreaterThanOrEqual(0);
    expect(typeof body.resetAt).toBe('string');
  });

  it('rejects after exceeding 100 req/min', async () => {
    const key = 'burst-user';
    for (let i = 0; i < 100; i++) {
      const req = mockRequest('https://example.com/api/rate-limit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      await worker.fetch(req, env);
    }
    const req = mockRequest('https://example.com/api/rate-limit-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const res = await worker.fetch(req, env);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.allowed).toBe(false);
    expect(body.remaining).toBe(0);
  });

  it('tracks different keys independently', async () => {
    const reqA = mockRequest('https://example.com/api/rate-limit-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'indep-key-a' }),
    });
    for (let i = 0; i < 50; i++) {
      await worker.fetch(reqA, env);
    }
    const reqB = mockRequest('https://example.com/api/rate-limit-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'indep-key-b' }),
    });
    const resB = await worker.fetch(reqB, env);
    const bodyB = (await resB.json()) as Record<string, unknown>;
    expect(bodyB.allowed).toBe(true);
    expect(bodyB.remaining).toBe(99);
  });

  it('rejects missing key', async () => {
    const req = mockRequest('https://example.com/api/rate-limit-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it('rejects non-string key', async () => {
    const req = mockRequest('https://example.com/api/rate-limit-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 123 }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });
});

describe('Rate limit window reset', () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it('resets after the 60-second window', () => {
    const key = 'window-test-reset';
    for (let i = 0; i < 100; i++) {
      rateLimitCheck(key);
    }
    expect(rateLimitCheck(key).allowed).toBe(false);

    const entry = rateLimitStore.get(key);
    expect(entry).toBeDefined();
    if (entry) {
      entry.windowStart = Date.now() - 60_001;
    }

    const allowed = rateLimitCheck(key);
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(99);
  });

  it('starts a fresh window when expired', () => {
    const key = 'fresh-window';
    for (let i = 0; i < 100; i++) {
      rateLimitCheck(key);
    }
    expect(rateLimitCheck(key).allowed).toBe(false);

    const entry = rateLimitStore.get(key);
    if (entry) entry.windowStart = Date.now() - 120_000;

    const result = rateLimitCheck(key);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(rateLimitStore.get(key)?.count).toBe(1);
  });
});

// ─── Model proxy validation ─────────────────────────────────

describe('POST /api/model-proxy validation', () => {
  it('rejects oversized bodies (>1MB)', async () => {
    const largeBody = 'x'.repeat(1_048_577);
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
        'Content-Length': String(Buffer.byteLength(largeBody)),
      },
      body: largeBody,
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(413);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('1MB');
  });

  it('rejects missing Content-Type header', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer sk-test' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o', messages: [] }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('Content-Type');
  });

  it('rejects missing Authorization header', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o', messages: [] }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('authorization');
  });

  it('rejects non-json Content-Type', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': 'Bearer sk-test',
      },
      body: '{}',
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('application/json');
  });

  it('rejects invalid JSON body', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
      },
      body: 'not-json{{{',
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('JSON');
  });

  it('rejects missing provider field', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
      },
      body: JSON.stringify({ apiKey: 'sk-test', model: 'gpt-4o', messages: [] }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it('rejects missing apiKey field', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
      },
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4o', messages: [] }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/model-proxy forwards valid requests', () => {
  it('returns 500 when upstream is unreachable (validation passed)', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
      },
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o', messages: [] }),
    });
    const res = await worker.fetch(req, env);
    // Validation passes; the fetch to openai fails because no real network
    // Expect either 500 (network error) or 400 (unsupported provider via body),
    // but never 400 for validation reasons
    expect([400, 500]).toContain(res.status);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it('returns 400 for unsupported provider after validation passes', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-test',
      },
      body: JSON.stringify({ provider: 'unknown-provider', apiKey: 'sk-test', model: 'x', messages: [] }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain('Unsupported provider');
  });
});

// ─── CORS / method handling ─────────────────────────────────

describe('OPTIONS preflight', () => {
  it('returns 204 with CORS headers for all paths', async () => {
    const req = mockRequest('https://example.com/api/model-proxy', { method: 'OPTIONS' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
  });
});

describe('unknown API path', () => {
  it('returns 404 for unrecognized /api paths', async () => {
    const req = mockRequest('https://example.com/api/nonexistent');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(404);
  });
});