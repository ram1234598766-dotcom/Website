import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Phase 3 — API Status endpoint tests.
 *
 * Verifies GET /api/status:
 *   - Returns 200 with proper JSON structure
 *   - Response has: status, version, timestamp, mode, services fields
 *   - Services object has at least: editor, terminal, ai, fileManager
 *   - Tips array is present
 *   - Mode is 'demo' when Firebase env vars are not set
 *   - JSON response is valid (Content-Type: application/json)
 */

async function callStatus(): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  const mod = await import('../../app/api/status/route');
  const res = await mod.GET(new Request('https://example.com/api/status'));
  const text = await res.text();
  const body = JSON.parse(text);
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => { headers[key] = value; });
  return { status: res.status, headers, body };
}

describe('GET /api/status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_DATABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GITHUB_CLIENT_ID', '');
    vi.stubEnv('GH_GRANT_SECRET', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200', async () => {
    const { status } = await callStatus();
    expect(status).toBe(200);
  });

  it('returns valid JSON with Content-Type application/json', async () => {
    const { headers, body } = await callStatus();
    expect(headers['content-type']).toContain('application/json');
    expect(body).not.toBeNull();
    expect(typeof body).toBe('object');
  });

  it('has required top-level fields: status, version, timestamp, mode, services', async () => {
    const { body } = await callStatus();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('mode');
    expect(body).toHaveProperty('services');
  });

  it('services has at least editor, terminal, ai, fileManager', async () => {
    const { body } = await callStatus();
    const services = body.services;
    expect(services).toHaveProperty('editor');
    expect(services).toHaveProperty('terminal');
    expect(services).toHaveProperty('ai');
    expect(services).toHaveProperty('fileManager');
  });

  it('tips array is present', async () => {
    const { body } = await callStatus();
    expect(body).toHaveProperty('tips');
    expect(Array.isArray(body.tips)).toBe(true);
  });

  it('mode is demo when Firebase env vars are not set', async () => {
    const { body } = await callStatus();
    expect(body.mode).toBe('demo');
  });

  it('timestamp is a valid ISO string', async () => {
    const { body } = await callStatus();
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp).getTime()).not.toThrow();
  });

  it('version is a string', async () => {
    const { body } = await callStatus();
    expect(typeof body.status).toBe('string');
    expect(typeof body.version).toBe('string');
    expect(typeof body.mode).toBe('string');
  });

  it('mode is connected when Firebase env vars are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'test-key');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_DATABASE_URL', 'https://test.firebaseio.com');
    const { body } = await callStatus();
    expect(body.mode).toBe('connected');
  });

  it('ai service is browser when no Gemini key', async () => {
    const { body } = await callStatus();
    expect(body.services.ai).toBe('browser');
  });

  it('ai service is cloud when Gemini key is set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const { body } = await callStatus();
    expect(body.services.ai).toBe('cloud');
  });
});
