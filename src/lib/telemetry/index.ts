const REDACT_KEYS = new Set([
  'token',
  'secret',
  'password',
  'credential',
  'apikey',
  'key',
  'source',
  'prompt',
  'output',
]);

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 50;

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCorrelationId(): string {
  try {
    let cid = sessionStorage.getItem('vantaos_correlation_id');
    if (!cid) {
      cid = generateCorrelationId();
      sessionStorage.setItem('vantaos_correlation_id', cid);
    }
    return cid;
  } catch {
    return generateCorrelationId();
  }
}

export function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(redactValue);
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactValue(v);
      }
    }
    return result;
  }
  return value;
}

export type TelemetryEventType = 'event' | 'timing' | 'error';

export interface QueuedEvent {
  type: TelemetryEventType;
  name: string;
  payload: Record<string, any>;
  correlationId: string;
  timestamp: string;
}

interface QueuedEventInternal extends QueuedEvent {}

let queue: QueuedEventInternal[] = [];
let flushHandler: ((events: QueuedEventInternal[]) => void) | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
const MAX_QUEUE_SIZE = 500;

function createEvent(
  type: TelemetryEventType,
  name: string,
  payload: Record<string, unknown>,
): QueuedEventInternal {
  return {
    type,
    name,
    payload: redactValue(payload) as Record<string, unknown>,
    correlationId: getCorrelationId(),
    timestamp: new Date().toISOString(),
  };
}

let eventObserver: ((event: QueuedEventInternal) => void) | null = null;

function enqueue(event: QueuedEventInternal): void {
  queue.push(event);
  if (eventObserver) {
    eventObserver(event);
  }
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.splice(0, Math.floor(MAX_QUEUE_SIZE / 2));
  }
  if (queue.length >= FLUSH_THRESHOLD) {
    flush();
  }
}

function flush(): void {
  if (queue.length === 0) return;
  const events = [...queue];
  queue = [];
  if (flushHandler) {
    try {
      flushHandler(events);
    } catch (err) {
      queue.unshift(...events);
    }
  }
}

function startFlushTimer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
}

function stopFlushTimer(): void {
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Telemetry API for recording events, timings, and errors.
 *
 * Events are queued in memory and flushed when the queue reaches
 * FLUSH_THRESHOLD or every FLUSH_INTERVAL_MS.
 */
export const telemetry = {
  /**
   * Record a custom telemetry event.
   *
   * @param name - Event name
   * @param data - Optional event payload (sensitive keys are auto-redacted)
   */
  event(name: string, data?: Record<string, unknown>): void {
    const ev = createEvent('event', name, data ?? {});
    enqueue(ev);
    startFlushTimer();
  },

  /**
   * Record a timing measurement.
   *
   * @param name - Timing name
   * @param duration - Duration in milliseconds
   */
  timing(name: string, duration: number): void {
    const ev = createEvent('timing', name, { duration });
    enqueue(ev);
    startFlushTimer();
  },

  /**
   * Record an error event.
   *
   * @param name - Error event name
   * @param error - The error object, message, or unknown value
   * @param data - Optional additional context (auto-redacted)
   */
  error(name: string, error: unknown, data?: Record<string, unknown>): void {
    const payload: Record<string, unknown> = {};
    if (error instanceof Error) {
      payload.message = error.message;
      payload.stack = error.stack ?? null;
    } else if (typeof error === 'string') {
      payload.message = error;
    } else if (error && typeof error === 'object') {
      payload.message = String(error);
    } else {
      payload.message = String(error);
    }
    if (data) {
      Object.assign(payload, data);
    }
    const ev = createEvent('error', name, payload);
    enqueue(ev);
    startFlushTimer();
  },
};

/**
 * Get a copy of the current telemetry queue.
 *
 * @returns Array of queued events
 */
export function getTelemetryQueue(): QueuedEvent[] {
  return [...queue];
}

/**
 * Clear all queued events from the in-memory queue.
 */
export function clearTelemetryQueue(): void {
  queue = [];
}

/**
 * Set the flush handler called when the queue is flushed.
 *
 * @param handler - Function to receive flushed events, or null to disable
 */
export function setTelemetryEventObserver(
  observer: (event: QueuedEventInternal) => void,
): void {
  eventObserver = observer;
}

export function setTelemetryFlushHandler(
  handler: ((events: QueuedEvent[]) => void) | null,
): void {
  flushHandler = handler;
}

/**
 * Manually trigger a flush of the telemetry queue.
 */
export function flushTelemetry(): void {
  flush();
}

/**
 * Reset telemetry state: clear queue, stop timer, remove flush handler.
 */
export function resetTelemetry(): void {
  clearTelemetryQueue();
  stopFlushTimer();
  flushHandler = null;
}

export async function initLogRocket(environment: string): Promise<boolean> {
  const mod = await import('./logrocket');
  return mod.initLogRocket(environment);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flush();
    stopFlushTimer();
  });
  window.addEventListener('pagehide', () => {
    flush();
    stopFlushTimer();
  });
}
