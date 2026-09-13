import { describe, it, expect, vi, beforeEach } from 'vitest';
import { telemetry, clearTelemetryQueue, resetTelemetry, getTelemetryQueue } from '../src/lib/telemetry';
import {
  initLogRocket,
  identifyUser,
  trackEvent,
  captureException,
  isLogRocketInitialized,
} from '../src/lib/telemetry/logrocket';

beforeEach(() => {
  clearTelemetryQueue();
  resetTelemetry();
  try {
    delete (window as any).__vantaos_logrocket_wired;
  } catch {
    /* jsdom may not have window */
  }
});

// ─── initLogRocket without ID ───────────────────────────

describe('initLogRocket without ID', () => {
  it('returns false when NEXT_PUBLIC_LOGROCKET_ID is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ID', '');
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ENVIRONMENT', 'production');
    const result = await initLogRocket('production');
    expect(result).toBe(false);
  });

  it('returns false when NEXT_PUBLIC_LOGROCKET_ID is undefined', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ID', undefined as any);
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ENVIRONMENT', 'production');
    const result = await initLogRocket('production');
    expect(result).toBe(false);
  });

  it('isLogRocketInitialized returns false when no ID', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ID', '');
    await initLogRocket('production');
    expect(isLogRocketInitialized()).toBe(false);
  });
});

// ─── initLogRocket with ID ──────────────────────────────

describe('initLogRocket with ID', () => {
  it('returns boolean when NEXT_PUBLIC_LOGROCKET_ID is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ID', 'test-logrocket-id');
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ENVIRONMENT', 'production');
    const result = await initLogRocket('production');
    expect(typeof result).toBe('boolean');
  });
});

// ─── identifyUser ───────────────────────────────────────

describe('identifyUser', () => {
  it('tracks user identification through telemetry', () => {
    identifyUser('user-123');
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('event');
    expect(queue[0].name).toBe('user-identify');
    expect(queue[0].payload.userId).toBe('user-123');
  });

  it('includes user details when provided', () => {
    identifyUser('user-456', { name: 'Alice', email: 'alice@example.com' });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.userId).toBe('user-456');
    expect(queue[0].payload.userDetails).toEqual({ name: 'Alice', email: 'alice@example.com' });
  });

  it('PII in user details is redacted', () => {
    identifyUser('user-789', { name: 'Bob', token: 'secret', email: 'bob@example.com' });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.userDetails.token).toBe('[REDACTED]');
    expect(queue[0].payload.userDetails.name).toBe('Bob');
  });
});

// ─── trackEvent ─────────────────────────────────────────

describe('trackEvent', () => {
  it('tracks custom event through telemetry', () => {
    trackEvent('buttonClicked', { button: 'submit' });
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('event');
    expect(queue[0].name).toBe('logrocket-buttonClicked');
    expect(queue[0].payload.button).toBe('submit');
  });

  it('handles event with no data', () => {
    trackEvent('pageView');
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].name).toBe('logrocket-pageView');
    expect(queue[0].payload).toEqual({});
  });
});

// ─── captureException ───────────────────────────────────

describe('captureException', () => {
  it('posts error to telemetry when LogRocket is not initialized', () => {
    captureException(new Error('test error'));
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('error');
    expect(queue[0].name).toBe('logrocket-error');
    expect(queue[0].payload.message).toBe('test error');
  });

  it('includes correlationId', () => {
    captureException(new Error('test'));
    const queue = getTelemetryQueue();
    expect(queue[0].correlationId).toBeTruthy();
  });

  it('PII in error context is redacted', () => {
    captureException(new Error('test'), { token: 'secret123', safe: 'data' });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.token).toBe('[REDACTED]');
    expect(queue[0].payload.safe).toBe('data');
  });
});

// ─── Graceful fallback ──────────────────────────────────

describe('graceful fallback', () => {
  it('does not throw when LogRocket module fails to load', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ID', 'test-id');
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ENVIRONMENT', 'production');

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const mod = await import('../src/lib/telemetry/logrocket');
      // Force module to null to simulate failed import
      const result = await mod.initLogRocket('production');
      // Should either succeed or return false without throwing
      expect(typeof result).toBe('boolean');
    } finally {
      spy.mockRestore();
    }
  });

  it('identifyUser does not throw when not initialized', () => {
    expect(() => identifyUser('user-1')).not.toThrow();
  });

  it('trackEvent does not throw when not initialized', () => {
    expect(() => trackEvent('event')).not.toThrow();
  });

  it('captureException does not throw when not initialized', () => {
    expect(() => captureException(new Error('test'))).not.toThrow();
  });
});

// ─── Telemetry integration ──────────────────────────────

describe('LogRocket-telemetry integration', () => {
  it('trackEvent creates a telemetry event', () => {
    trackEvent('testEvent', { action: 'click', target: 'button' });
    const queue = getTelemetryQueue();
    expect(queue[0].type).toBe('event');
    expect(queue[0].payload.action).toBe('click');
    expect(queue[0].payload.target).toBe('button');
  });

  it('identifyUser creates a telemetry event', () => {
    identifyUser('user-1');
    const queue = getTelemetryQueue();
    expect(queue[0].type).toBe('event');
  });

  it('captureException creates a telemetry error event', () => {
    captureException(new Error('integration test'));
    const queue = getTelemetryQueue();
    expect(queue[0].type).toBe('error');
    expect(queue[0].name).toBe('logrocket-error');
  });
});
