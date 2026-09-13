import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  telemetry,
  getTelemetryQueue,
  clearTelemetryQueue,
  setTelemetryFlushHandler,
  flushTelemetry,
  resetTelemetry,
  type QueuedEvent,
} from '../../src/lib/telemetry';

beforeEach(() => {
  clearTelemetryQueue();
  resetTelemetry();
  try {
    sessionStorage.clear();
  } catch {
    /* jsdom may be unavailable */
  }
});

// ─── Event shape ────────────────────────────────────────────────

describe('telemetry.event', () => {
  it('creates an event with type "event"', () => {
    telemetry.event('userSignedIn', { method: 'google' });
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('event');
  });

  it('includes the event name', () => {
    telemetry.event('fileSaved', { path: '/main.ts' });
    expect(getTelemetryQueue()[0].name).toBe('fileSaved');
  });

  it('includes correlationId', () => {
    telemetry.event('boot', {});
    expect(getTelemetryQueue()[0].correlationId).toBeTruthy();
  });

  it('includes timestamp', () => {
    telemetry.event('boot', {});
    const ev = getTelemetryQueue()[0];
    expect(ev.timestamp).toBeTruthy();
    expect(new Date(ev.timestamp).getTime()).not.toBeNaN();
  });

  it('preserves non-sensitive keys in payload', () => {
    telemetry.event('userAction', { action: 'click', target: 'button', count: 3 });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.action).toBe('click');
    expect(payload.target).toBe('button');
    expect(payload.count).toBe(3);
  });

  it('handles empty data', () => {
    telemetry.event('noData');
    const payload = getTelemetryQueue()[0].payload;
    expect(payload).toEqual({});
  });
});

// ─── Redaction ──────────────────────────────────────────────────

describe('redaction', () => {
  const sensitiveKeys = [
    'token',
    'secret',
    'password',
    'credential',
    'apiKey',
    'key',
    'source',
    'prompt',
    'output',
  ];

  it('redacts top-level sensitive keys', () => {
    telemetry.event('apiCall', {
      token: 'abc123',
      secret: 'shh',
      password: 'letmein',
      credential: 'cred-1',
      apiKey: 'sk-456',
      key: 'mykey',
      source: 'src',
      prompt: 'hello',
      output: 'result',
    });
    const payload = getTelemetryQueue()[0].payload as Record<string, any>;
    for (const k of sensitiveKeys) {
      expect(payload[k]).toBe('[REDACTED]');
    }
  });

  it('redacts case-insensitive key names', () => {
    telemetry.event('test', { Token: 'x', APIKEY: 'y', Source: 'z' });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.Token).toBe('[REDACTED]');
    expect(payload.APIKEY).toBe('[REDACTED]');
    expect(payload.Source).toBe('[REDACTED]');
  });

  it('redacts nested sensitive keys in objects', () => {
    telemetry.event('deep', {
      user: { name: 'Alice', token: 'secret123' },
    });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.user.token).toBe('[REDACTED]');
    expect(payload.user.name).toBe('Alice');
  });

  it('redacts deeply nested sensitive keys (3+ levels)', () => {
    telemetry.event('deep', {
      level1: {
        level2: {
          level3: {
            password: 'hunter2',
            safe: 'keep',
          },
        },
      },
    });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.level1.level2.level3.password).toBe('[REDACTED]');
    expect(payload.level1.level2.level3.safe).toBe('keep');
  });

  it('redacts sensitive keys inside arrays', () => {
    telemetry.event('items', {
      items: [
        { id: 1, token: 'aaa' },
        { id: 2, token: 'bbb' },
      ],
    });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.items[0].token).toBe('[REDACTED]');
    expect(payload.items[0].id).toBe(1);
    expect(payload.items[1].token).toBe('[REDACTED]');
    expect(payload.items[1].id).toBe(2);
  });

  it('handles mixed safe and redacted keys in nested objects', () => {
    telemetry.event('mixed', {
      publicData: 'visible',
      nested: {
        publicData: 'also visible',
        secret: 'hidden',
        deeper: {
          publicData: 'yes',
          token: 'no',
        },
      },
    });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.publicData).toBe('visible');
    expect(payload.nested.publicData).toBe('also visible');
    expect(payload.nested.secret).toBe('[REDACTED]');
    expect(payload.nested.deeper.publicData).toBe('yes');
    expect(payload.nested.deeper.token).toBe('[REDACTED]');
  });

  it('preserves numbers, booleans, and null values', () => {
    telemetry.event('types', {
      count: 42,
      enabled: true,
      nullable: null,
      nested: { count: 7, enabled: false },
    });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.count).toBe(42);
    expect(payload.enabled).toBe(true);
    expect(payload.nullable).toBeNull();
    expect(payload.nested.count).toBe(7);
    expect(payload.nested.enabled).toBe(false);
  });

  it('handles null data gracefully', () => {
    telemetry.event('nullTest', null as any);
    expect(getTelemetryQueue()).toHaveLength(1);
    expect(getTelemetryQueue()[0].payload).toEqual({});
  });

  it('handles undefined data gracefully', () => {
    telemetry.event('undefTest', undefined as any);
    expect(getTelemetryQueue()).toHaveLength(1);
    expect(getTelemetryQueue()[0].payload).toEqual({});
  });

  it('handles arrays of primitives at top level', () => {
    telemetry.event('list', { tags: ['a', 'b', 'c'] });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.tags).toEqual(['a', 'b', 'c']);
  });

  it('redacts sensitive keys in arrays of objects with all sensitive keys', () => {
    telemetry.event('batch', {
      records: [
        { token: 't1', secret: 's1', safe: 'a' },
        { token: 't2', secret: 's2', safe: 'b' },
      ],
    });
    const payload = getTelemetryQueue()[0].payload;
    expect(payload.records[0].token).toBe('[REDACTED]');
    expect(payload.records[0].secret).toBe('[REDACTED]');
    expect(payload.records[0].safe).toBe('a');
    expect(payload.records[1].token).toBe('[REDACTED]');
    expect(payload.records[1].secret).toBe('[REDACTED]');
    expect(payload.records[1].safe).toBe('b');
  });
});

// ─── Correlation ID ─────────────────────────────────────────────

describe('correlation ID', () => {
  it('generates a UUID-format correlation ID', () => {
    telemetry.event('test', {});
    const cid = getTelemetryQueue()[0].correlationId;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(cid).toMatch(uuidRegex);
  });

  it('returns the same correlationId on multiple calls in a session', () => {
    telemetry.event('first', {});
    telemetry.event('second', {});
    const events = getTelemetryQueue();
    expect(events[0].correlationId).toBe(events[1].correlationId);
  });

  it('stores correlation ID in sessionStorage', () => {
    try {
      sessionStorage.removeItem('vantaos_correlation_id');
      telemetry.event('test', {});
      const stored = sessionStorage.getItem('vantaos_correlation_id');
      expect(stored).toBeTruthy();
      expect(stored).toBe(getTelemetryQueue()[0].correlationId);
    } finally {
      sessionStorage.removeItem('vantaos_correlation_id');
    }
  });

  it('reuses correlation ID from sessionStorage on subsequent events', () => {
    try {
      sessionStorage.removeItem('vantaos_correlation_id');
      telemetry.event('a', {});
      const firstId = getTelemetryQueue()[0].correlationId;
      clearTelemetryQueue();
      telemetry.event('b', {});
      const secondId = getTelemetryQueue()[0].correlationId;
      expect(firstId).toBe(secondId);
      expect(secondId).toBe(sessionStorage.getItem('vantaos_correlation_id'));
    } finally {
      sessionStorage.removeItem('vantaos_correlation_id');
    }
  });
});

// ─── Timing events ──────────────────────────────────────────────

describe('telemetry.timing', () => {
  it('creates a timing event with type "timing"', () => {
    telemetry.timing('bootTime', 123);
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('timing');
  });

  it('includes the timing name', () => {
    telemetry.timing('renderDuration', 45);
    expect(getTelemetryQueue()[0].name).toBe('renderDuration');
  });

  it('stores duration as a number in payload', () => {
    telemetry.timing('loadTime', 1.5);
    expect(getTelemetryQueue()[0].payload.duration).toBe(1.5);
  });

  it('includes correlationId', () => {
    telemetry.timing('test', 10);
    expect(getTelemetryQueue()[0].correlationId).toBeTruthy();
  });
});

// ─── Error events ───────────────────────────────────────────────

describe('telemetry.error', () => {
  it('creates an error event with type "error"', () => {
    telemetry.error('networkFailure', new Error('timeout'));
    const queue = getTelemetryQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('error');
  });

  it('extracts message from Error object', () => {
    telemetry.error('err', new Error('connection refused'));
    expect(getTelemetryQueue()[0].payload.message).toBe('connection refused');
  });

  it('includes stack trace from Error object', () => {
    const err = new Error('test error');
    telemetry.error('err', err);
    expect(getTelemetryQueue()[0].payload.stack).toBe(err.stack);
  });

  it('handles string error messages', () => {
    telemetry.error('err', 'something broke');
    expect(getTelemetryQueue()[0].payload.message).toBe('something broke');
  });

  it('handles plain object error', () => {
    telemetry.error('err', { code: 500, reason: 'server' });
    const msg = getTelemetryQueue()[0].payload.message;
    expect(msg).toBe('[object Object]');
  });

  it('handles null error', () => {
    telemetry.error('err', null as any);
    expect(getTelemetryQueue()[0].payload.message).toBe('null');
  });

  it('includes correlationId', () => {
    telemetry.error('err', new Error('x'));
    expect(getTelemetryQueue()[0].correlationId).toBeTruthy();
  });
});

// ─── Event queuing and flushing ─────────────────────────────────

describe('event queue', () => {
  it('accumulates events below the flush threshold', () => {
    for (let i = 0; i < 10; i++) {
      telemetry.event(`event${i}`, { index: i });
    }
    expect(getTelemetryQueue()).toHaveLength(10);
  });

  it('flushes when queue reaches 50 events', () => {
    setTelemetryFlushHandler(vi.fn());
    for (let i = 0; i < 50; i++) {
      telemetry.event(`ev${i}`, { i });
    }
    expect(getTelemetryQueue()).toHaveLength(0);
  });

  it('flush handler receives all 50 events', () => {
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    for (let i = 0; i < 50; i++) {
      telemetry.event(`ev${i}`, { i });
    }
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.any(Array));
    expect(handler.mock.calls[0][0]).toHaveLength(50);
  });

  it('manual flushTelemetry sends queued events to handler', () => {
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    telemetry.event('a', {});
    telemetry.event('b', {});
    expect(getTelemetryQueue()).toHaveLength(2);
    flushTelemetry();
    expect(getTelemetryQueue()).toHaveLength(0);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toHaveLength(2);
  });

  it('flushTelemetry with no handler clears the queue', () => {
    telemetry.event('a', {});
    telemetry.event('b', {});
    flushTelemetry();
    expect(getTelemetryQueue()).toHaveLength(0);
  });

  it('timer-based flush after 5 seconds', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    telemetry.event('timed', {});
    expect(getTelemetryQueue()).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getTelemetryQueue()).toHaveLength(0);
    vi.useRealTimers();
  });

  it('timer does not flush before 5 seconds', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    telemetry.event('early', {});
    vi.advanceTimersByTime(4999);
    expect(handler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('only one timer is active (no duplicate intervals)', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    telemetry.event('a', {});
    telemetry.event('b', {});
    vi.advanceTimersByTime(5000);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getTelemetryQueue()).toHaveLength(0);
    vi.advanceTimersByTime(5000);
    expect(handler).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('timer flushes new events added after prior flush', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    for (let i = 0; i < 50; i++) {
      telemetry.event(`e${i}`, {});
    }
    expect(handler).toHaveBeenCalledTimes(1);
    expect(getTelemetryQueue()).toHaveLength(0);
    telemetry.event('new', {});
    vi.advanceTimersByTime(5000);
    expect(handler).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('flushed events are removed from queue', () => {
    setTelemetryFlushHandler(vi.fn());
    for (let i = 0; i < 3; i++) {
      telemetry.event(`e${i}`, {});
    }
    flushTelemetry();
    expect(getTelemetryQueue()).toHaveLength(0);
  });

  it('subsequent events after flush work correctly', () => {
    setTelemetryFlushHandler(vi.fn());
    for (let i = 0; i < 50; i++) {
      telemetry.event(`e${i}`, {});
    }
    expect(getTelemetryQueue()).toHaveLength(0);
    telemetry.event('afterFlush', {});
    expect(getTelemetryQueue()).toHaveLength(1);
  });

  it('resetTelemetry clears queue and stops timer', () => {
    setTelemetryFlushHandler(vi.fn());
    for (let i = 0; i < 5; i++) {
      telemetry.event(`e${i}`, {});
    }
    resetTelemetry();
    expect(getTelemetryQueue()).toHaveLength(0);
  });

  it('queue is independent between test sessions', () => {
    telemetry.event('session1', {});
    telemetry.event('session1b', {});
    expect(getTelemetryQueue()).toHaveLength(2);
  });

  it('redacted events are still queued and flushed correctly', () => {
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    telemetry.event('sensitive', {
      token: 'secret',
      safe: 'data',
      nested: { password: 'pw', ok: true },
    });
    flushTelemetry();
    expect(handler).toHaveBeenCalledTimes(1);
    const events = handler.mock.calls[0][0] as QueuedEvent[];
    expect(events[0].payload.token).toBe('[REDACTED]');
    expect(events[0].payload.safe).toBe('data');
    expect(events[0].payload.nested.password).toBe('[REDACTED]');
    expect(events[0].payload.nested.ok).toBe(true);
  });

  it('timing and error events also go through the queue', () => {
    const handler = vi.fn();
    setTelemetryFlushHandler(handler);
    telemetry.timing('t1', 100);
    telemetry.error('e1', new Error('fail'));
    telemetry.event('ev1', {});
    flushTelemetry();
    expect(handler).toHaveBeenCalledTimes(1);
    const events = handler.mock.calls[0][0] as QueuedEvent[];
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('timing');
    expect(events[1].type).toBe('error');
    expect(events[2].type).toBe('event');
  });
});
