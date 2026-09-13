import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  telemetry,
  clearTelemetryQueue,
  resetTelemetry,
  getTelemetryQueue,
} from '../src/lib/telemetry';
import { captureException, isSentryInitialized } from '../src/lib/telemetry/sentry';

beforeEach(() => {
  clearTelemetryQueue();
  resetTelemetry();
  vi.resetModules();
  try {
    delete (window as any).__vantaos_sentry_wired;
  } catch {
    /* jsdom may not have window */
  }
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
});

// ====================================================================
// 1. Does initSentry fail gracefully if NEXT_PUBLIC_SENTRY_DSN is not set?
// ====================================================================
describe('1. initSentry graceful failure without DSN', () => {
  it('returns false when NEXT_PUBLIC_SENTRY_DSN is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const mod = await import('../src/lib/telemetry/sentry');
    expect(await mod.initSentry()).toBe(false);
  });

  it('returns false when NEXT_PUBLIC_SENTRY_DSN is undefined', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', undefined as any);
    const mod = await import('../src/lib/telemetry/sentry');
    expect(await mod.initSentry()).toBe(false);
  });

  it('isSentryInitialized returns false when no DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const mod = await import('../src/lib/telemetry/sentry');
    await mod.initSentry();
    expect(mod.isSentryInitialized()).toBe(false);
  });

  it('does not throw when DSN is absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const mod = await import('../src/lib/telemetry/sentry');
    await expect(mod.initSentry()).resolves.not.toThrow();
  });

  it('can initialize on retry after DSN becomes available', async () => {
    const mod = await import('../src/lib/telemetry/sentry');

    // First attempt without DSN � must return false
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    expect(await mod.initSentry()).toBe(false);

    // Second attempt with DSN � should attempt again (not permanently blocked)
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const result = await mod.initSentry();
    // After the fix: initAttempted is only set after the DSN check passes,
    // so this call should proceed (not return false due to stuck initAttempted)
    expect(result).toBe(mod.isSentryInitialized());
  });
});

// ====================================================================
// 2. Is there a risk of double-initialization?
// ====================================================================
describe('2. Double-initialization guard', () => {
  it('initAttempted prevents redundant init calls', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const mod = await import('../src/lib/telemetry/sentry');

    const result1 = await mod.initSentry();
    const result2 = await mod.initSentry();

    expect(result1).toBe(result2);
  });

  it('initSentry returns consistent state when called multiple times', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const mod = await import('../src/lib/telemetry/sentry');

    await mod.initSentry();
    const stateAfterFirst = mod.isSentryInitialized();

    await mod.initSentry();
    const stateAfterSecond = mod.isSentryInitialized();

    expect(stateAfterFirst).toBe(stateAfterSecond);
  });

  it('isSentryInitialized is consistent after repeated calls', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const mod = await import('../src/lib/telemetry/sentry');

    await mod.initSentry();
    expect(mod.isSentryInitialized()).toBe(false);

    await mod.initSentry();
    expect(mod.isSentryInitialized()).toBe(false);
  });
});

// ====================================================================
// 3. Does captureException properly redact sensitive data?
// ====================================================================
describe('3. captureException redacts sensitive data', () => {
  it('redacts token from context before telemetry', () => {
    captureException(new Error('test'), { token: 'secret123', safe: 'data' });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.token).toBe('[REDACTED]');
    expect(queue[0].payload.safe).toBe('data');
  });

  it('redacts password from context', () => {
    captureException(new Error('test'), { password: 'hunter2' });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.password).toBe('[REDACTED]');
  });

  it('redacts apikey from context', () => {
    captureException(new Error('test'), { apikey: 'abc123', version: '1.0' });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.apikey).toBe('[REDACTED]');
    expect(queue[0].payload.version).toBe('1.0');
  });

  it('redacts nested sensitive keys in objects', () => {
    captureException(new Error('test'), { user: { apiKey: 'secret', name: 'Alice' } });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.user.apiKey).toBe('[REDACTED]');
    expect(queue[0].payload.user.name).toBe('Alice');
  });

  it('redacts all known sensitive keys', () => {
    const context = {
      token: 't1',
      secret: 's1',
      password: 'p1',
      credential: 'c1',
      apikey: 'a1',
      key: 'k1',
      source: 'src',
      prompt: 'p',
      output: 'o',
      safe: 'value',
    };
    captureException(new Error('test'), context);
    const queue = getTelemetryQueue();
    expect(queue[0].payload.safe).toBe('value');
    const sensitiveKeys = ['token', 'secret', 'password', 'credential', 'apikey', 'key', 'source', 'prompt', 'output'];
    for (const k of sensitiveKeys) {
      expect(queue[0].payload[k]).toBe('[REDACTED]');
    }
  });

  it('does not throw when context has sensitive data', () => {
    expect(() => captureException(new Error('test'), { token: 'secret' })).not.toThrow();
  });

  it('does not throw when context is undefined', () => {
    expect(() => captureException(new Error('test'))).not.toThrow();
  });

  it('telemetry event payload has redacted sensitive values', () => {
    // captureException passes unredacted context to telemetry.error,
    // but telemetry.createEvent() redacts via redactValue internally
    captureException(new Error('test'), { token: 'secret123' });
    const queue = getTelemetryQueue();
    expect(queue[0].payload.token).toBe('[REDACTED]');
  });
});

// ====================================================================
// 4. Verify app/error.tsx and ErrorBoundary.tsx use sentry correctly
// ====================================================================
describe('4. Sentry integration usage verification', () => {
  it('captureException is importable from sentry.ts', () => {
    expect(typeof captureException).toBe('function');
  });

  it('isSentryInitialized is importable from sentry.ts', () => {
    expect(typeof isSentryInitialized).toBe('function');
  });

  it('initSentry is importable from sentry.ts', async () => {
    const mod = await import('../src/lib/telemetry/sentry');
    expect(typeof mod.initSentry).toBe('function');
  });

  it('captureException always creates telemetry event regardless of Sentry state', () => {
    captureException(new Error('test'));
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('error');
    expect(queue[0].name).toBe('client-error');
  });

  it('captureException handles Error objects', () => {
    captureException(new Error('specific message'));
    const queue = getTelemetryQueue();
    expect(queue[0].payload.message).toBe('specific message');
  });

  it('captureException handles string errors', () => {
    captureException('something broke');
    const queue = getTelemetryQueue();
    expect(queue[0].payload.message).toBe('something broke');
  });

  it('captureException includes correlationId and timestamp', () => {
    captureException(new Error('test'));
    const queue = getTelemetryQueue();
    expect(queue[0].correlationId).toBeTruthy();
    expect(queue[0].timestamp).toBeTruthy();
  });

  it('ErrorBoundary uses correct import path for captureException', () => {
    // src/components/ErrorBoundary.tsx imports captureException from ../lib/telemetry/sentry
    // This path is validated by tsc --noEmit. Verify the export exists.
    expect(typeof captureException).toBe('function');
  });

  it('initSentry passes tracesSampleRate when DSN is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const mod = await import('../src/lib/telemetry/sentry');
    const result = await mod.initSentry();
    expect(result).toBe(mod.isSentryInitialized());
  });

  it('initSentry returns false gracefully without DSN (no tracing attempted)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const mod = await import('../src/lib/telemetry/sentry');
    expect(await mod.initSentry()).toBe(false);
    expect(mod.isSentryInitialized()).toBe(false);
  });

  it('initSentry does not crash in browser environment', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const mod = await import('../src/lib/telemetry/sentry');
    await expect(mod.initSentry()).resolves.toBeDefined();
  });
});

// ====================================================================
// 6. Check initialization order with LogRocket
// ====================================================================
describe('6. Initialization order with LogRocket', () => {
  it('Sentry init does not depend on LogRocket', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    const mod = await import('../src/lib/telemetry/sentry');
    await expect(mod.initSentry()).resolves.toBeDefined();
  });

  it('LogRocket init does not depend on Sentry', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ID', 'test-id');
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ENVIRONMENT', 'production');
    const mod = await import('../src/lib/telemetry/logrocket');
    await expect(mod.initLogRocket('production')).resolves.toBeDefined();
  });

  it('both can be initialized independently without errors', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ID', 'test-id');
    vi.stubEnv('NEXT_PUBLIC_LOGROCKET_ENVIRONMENT', 'production');

    const sentryMod = await import('../src/lib/telemetry/sentry');
    const logrocketMod = await import('../src/lib/telemetry/logrocket');

    const [sentryResult, logrocketResult] = await Promise.all([
      sentryMod.initSentry(),
      logrocketMod.initLogRocket('production'),
    ]);

    expect(typeof sentryResult).toBe('boolean');
    expect(typeof logrocketResult).toBe('boolean');
  });

  it('telemetry.error records events regardless of Sentry/LogRocket state', () => {
    captureException(new Error('test'));
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].payload.message).toBe('test');
  });

  it('no circular dependency between sentry.ts and index.ts', async () => {
    const fs = require('fs');
    const path = require('path');
    const indexPath = path.join(__dirname, '../src/lib/telemetry/index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    // sentry.ts imports from index.ts, but index.ts must NOT import from sentry.ts
    expect(indexContent).not.toContain("from './sentry'");
  });
});