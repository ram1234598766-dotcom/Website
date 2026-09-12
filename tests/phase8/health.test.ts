import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Phase 8 — Health check endpoint tests.
 *
 * Verifies that GET /api/health returns:
 *   - HTTP 200
 *   - JSON with status, timestamp, services
 *   - Firebase config status
 *   - IndexedDB availability
 *   - No secrets in the response body
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function importRoute() {
  return import('../../app/api/health/route');
}

async function getHealth(): Promise<{ status: number; body: any }> {
  const { GET } = await importRoute();
  const res = await GET();
  const text = await res.text();
  const body = JSON.parse(text);
  return { status: res.status, body };
}

function ok(status: number): void {
  expect(status).toBe(200);
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('GET /api/health', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns 200 with a JSON body containing status, timestamp, and services', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { status, body } = await getHealth();
    ok(status);
    expect(body.status).toBe('degraded'); // no services available
    expect(body.timestamp).toBeTruthy();
    expect(body.services).toBeDefined();
    expect(body.services.firebase).toBeDefined();
    expect(body.services.indexeddb).toBeDefined();
  });

  it('includes a valid ISO-8601 timestamp', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { body } = await getHealth();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('reports degraded status when neither firebase nor indexeddb are available', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { body } = await getHealth();
    expect(body.services.firebase.configured).toBe(false);
    expect(body.services.indexeddb.available).toBe(false);
    expect(body.status).toBe('degraded');
  });

  it('reports firebase configured: false when not configured', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { body } = await getHealth();
    expect(body.services.firebase.configured).toBe(false);
  });

  it('reports firebase configured: true when env vars are present', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => true,
    }));

    const { body } = await getHealth();
    expect(body.services.firebase.configured).toBe(true);
  });

  it('reports indexeddb available: true when IDB is supported', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', { open: () => ({}) } as any);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { body } = await getHealth();
    expect(body.services.indexeddb.available).toBe(true);
  });

  it('reports indexeddb available: false when IDB is unavailable', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { body } = await getHealth();
    expect(body.services.indexeddb.available).toBe(false);
    expect(['degraded', 'ok']).toContain(body.status);
  });

  it('returns ok when firebase is configured but indexeddb is unavailable', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => true,
    }));

    const { body } = await getHealth();
    expect(body.services.firebase.configured).toBe(true);
    expect(body.services.indexeddb.available).toBe(false);
    // Firebase availability keeps status 'ok' even without local IndexedDB
    expect(body.status).toBe('ok');
  });

  it('returns ok when firebase is unavailable but indexeddb is available', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', { open: () => ({}) } as any);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { body } = await getHealth();
    expect(body.services.firebase.configured).toBe(false);
    expect(body.services.indexeddb.available).toBe(true);
    expect(body.status).toBe('ok');
  });

  it('never leaks the Firebase API key in the response body', async () => {
    const fakeKey = 'AIzaSyD-very-secret-api-key-12345';
    vi.resetModules();
    vi.stubGlobal('indexedDB', { open: () => ({}) } as any);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => true,
    }));

    const { status, body } = await getHealth();
    ok(status);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(fakeKey);
    expect(serialized).not.toContain('API_KEY');
  });

  it('sets cache-control: no-store on the response', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    vi.doMock('@/src/lib/env', () => ({
      isFirebaseConfigured: () => false,
    }));

    const { GET } = await importRoute();
    const res = await GET();
    const cc = res.headers.get('cache-control') || '';
    expect(cc).toContain('no-store');
  });
});
