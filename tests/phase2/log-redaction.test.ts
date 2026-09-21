import { describe, expect, it, vi } from 'vitest';
import { redactSecrets, logServerError } from '../../src/lib/server/log';

/**
 * Phase 2 — server log redaction (AGENTS §7.9).
 *
 * Gemini requests carry the operator key as a `?key=` query param, so an
 * upstream fetch error that embeds the request URL must never reach
 * console.error verbatim.
 */

describe('redactSecrets', () => {
  it('strips a Gemini-style AIza key', () => {
    const out = redactSecrets(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=AIzaSyD-EXAMPLE1234567890',
    );
    expect(out).not.toContain('AIzaSyD-EXAMPLE1234567890');
    expect(out).toContain('[REDACTED]');
  });

  it('strips an sk- style provider key', () => {
    const out = redactSecrets('Authorization: Bearer sk-fake-key-that-will-fail');
    expect(out).not.toContain('sk-fake-key-that-will-fail');
  });

  it('strips a labeled secret assignment', () => {
    const out = redactSecrets('apiKey=abcdef123456');
    expect(out).not.toContain('abcdef123456');
  });

  it('leaves ordinary text untouched', () => {
    expect(redactSecrets('Gemini upstream timed out after 60s')).toBe(
      'Gemini upstream timed out after 60s',
    );
  });
});

describe('logServerError', () => {
  it('emits one structured JSON line with no secret material', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const err = new TypeError('fetch failed');
      (err as { cause?: unknown }).cause = new Error(
        'connect failed for ?key=AIzaSyD-EXAMPLE1234567890',
      );
      logServerError('api.ai_generate_error', 'req-1', err);

      expect(spy).toHaveBeenCalledTimes(1);
      const line = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(line);
      expect(parsed.level).toBe('error');
      expect(parsed.event).toBe('api.ai_generate_error');
      expect(parsed.requestId).toBe('req-1');
      expect(line).not.toContain('AIzaSyD-EXAMPLE1234567890');
      expect(parsed.detail).toContain('fetch failed');
    } finally {
      spy.mockRestore();
    }
  });

  it('handles a non-Error throwable without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => logServerError('api.worker_error', undefined, 'boom')).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
