import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Phase 3 — API Healthz endpoint tests.
 *
 * Verifies GET /api/healthz:
 *   - Returns 200
 *   - Response has status field (healthy/degraded/unhealthy)
 *   - If ?verbose=true, returns detailed diagnostics
 *   - Service checks are included
 */

async function callHealthz(url: string): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  const mod = await import('../../app/api/healthz/route');
  const res = await mod.GET(new NextRequest(`https://example.com${url}`));
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => { headers[key] = value; });
  return { status: res.status, headers, body };
}

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'test-project');
    vi.stubGlobal('indexedDB', {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns 200', async () => {
    const { status } = await callHealthz('/api/healthz');
    expect(status).toBe(200);
  });

  it('returns valid JSON', async () => {
    const { headers, body } = await callHealthz('/api/healthz');
    expect(headers['content-type']).toContain('application/json');
    expect(body).not.toBeNull();
    expect(typeof body).toBe('object');
  });

  it('response has status field', async () => {
    const { body } = await callHealthz('/api/healthz');
    expect(body).toHaveProperty('status');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
  });

  it('service checks are included', async () => {
    const { body } = await callHealthz('/api/healthz');
    expect(body).toHaveProperty('services');
    expect(typeof body.services).toBe('object');
  });

  it('mode is healthy when Firebase and IndexedDB are available', async () => {
    const { body } = await callHealthz('/api/healthz');
    expect(body.status).toBe('healthy');
  });

  it('mode is degraded when Firebase and IndexedDB are not available', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubGlobal('indexedDB', null);
    const { body } = await callHealthz('/api/healthz');
    expect(body.status).toBe('degraded');
  });

  it('if ?verbose=true, returns detailed diagnostics', async () => {
    const { body } = await callHealthz('/api/healthz?verbose=true');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('timestamp');
    expect(typeof body.services).toBe('object');
  });

  it('verbose mode includes per-service details', async () => {
    const { body } = await callHealthz('/api/healthz?verbose=true');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('services');
    expect(typeof body.services).toBe('object');
    expect(body).toHaveProperty('uptimeSeconds');
    expect(body).toHaveProperty('nodeVersion');
  });

  it('includes timestamp', async () => {
    const { body } = await callHealthz('/api/healthz');
    expect(body).toHaveProperty('timestamp');
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp).getTime()).not.toThrow();
  });

  it('has Content-Type application/json', async () => {
    const { headers } = await callHealthz('/api/healthz');
    expect(headers['content-type']).toContain('application/json');
  });
});
