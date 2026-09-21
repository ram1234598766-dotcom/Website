import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Phase 2 — /api/healthz liveness in demo mode (AGENTS §4).
 *
 * With no Firebase configuration the app is expected to run in demo mode.
 * That is a degraded *report* in the body, not a failed liveness probe: a 503
 * here would have orchestrators restart a perfectly healthy app.
 */

describe('GET /api/healthz — demo mode', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_DATABASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns HTTP 200 while reporting degraded in the body', async () => {
    const { GET } = await import('../../app/api/healthz/route');
    const res = await GET(new NextRequest('https://example.com/api/healthz'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.services.firebase.status).toBe('degraded');
  });
});
