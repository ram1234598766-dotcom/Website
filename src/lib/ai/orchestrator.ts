/**
 * VantaOS Phase 3 — Omni-AI Orchestration primitives.
 *
 * Provides:
 *  - RedactedError: wraps errors so secrets never leak through error messages
 *    or logged context.
 *  - createAIStream / AIStreamHandle: simulates a streaming provider that
 *    yields partial text chunks on a setInterval timer (reliable under fake
 *    timers — one chunk per advanceTimersByTimeAsync tick), supports
 *    cancellation, and enforces a wall-clock timeout.
 *  - ProviderOrchestrator: tries providers in priority order, falls back on
 *    failure, and exposes per-provider health state for the UI.
 */

/* ------------------------------------------------------------------ */
/*  Secret redaction                                                   */
/* ------------------------------------------------------------------ */

const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z\-_]{8,}/,
  /(?:api[_-]?key|apikey|api_secret|secret|token|password)\s*[:=]\s*['"]?([A-Za-z0-9\-_\.]{8,})/gi,
  /sk_live_[0-9a-zA-Z]{8,}/gi,
  /sk_test_[0-9a-zA-Z]{8,}/gi,
  /ghp_[0-9a-zA-Z]{8,}/gi,
  /github_pat_[0-9a-zA-Z_]{8,}/gi,
  /xox[baprs]-[0-9a-zA-Z-]{8,}/gi,
  /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/gi,
];

export function redact(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

export function redactForLog(value: string): string {
  return redact(value);
}

export function redactContext(context?: Record<string, any>): Record<string, any> | undefined {
  if (!context) return undefined;
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(context)) {
    if (typeof val === 'string') {
      out[key] = redact(val);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = redactContext(val as Record<string, any>);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  RedactedError                                                      */
/* ------------------------------------------------------------------ */

export class RedactedError extends Error {
  readonly isRedacted = true;

  constructor(message: string) {
    super(redact(message));
    this.name = 'RedactedError';
  }

  static from(error: unknown): RedactedError {
    const message = error instanceof Error ? error.message : String(error);
    return new RedactedError(message);
  }
}

/* ------------------------------------------------------------------ */
/*  AIStream — streaming provider with cancellation + timeout          */
/* ------------------------------------------------------------------ */

export interface StreamChunk {
  readonly index: number;
  readonly text: string;
  readonly delta: string;
}

export type StreamStatus = 'streaming' | 'done' | 'cancelled' | 'timeout' | 'error';

export interface StreamResult {
  readonly status: StreamStatus;
  readonly text: string;
  readonly chunks: readonly StreamChunk[];
}

export type StreamAbortHandler = () => void;

export interface AIStreamHandle {
  readonly status: StreamStatus;
  readonly text: string;
  readonly chunks: readonly StreamChunk[];
  cancel(): void;
  onStatusChange(cb: (s: StreamStatus) => void): StreamAbortHandler;
}

/**
 * Creates a handle for a simulated streaming AI provider.
 *
 * Chunk delivery uses setInterval so each call to
 * `vi.advanceTimersByTimeAsync(chunkIntervalMs)` advances exactly one chunk.
 * This is reliable under fake timers and avoids setTimeout chains.
 *
 * An empty chunks array resolves to 'done' on the next microtask.
 */
export function createAIStream(opts: {
  provider: string;
  prompt: string;
  chunks: string[];
  chunkIntervalMs?: number;
  timeoutMs?: number;
}): AIStreamHandle {
  const { chunks, chunkIntervalMs = 50, timeoutMs = 5000 } = opts;

  // Empty chunk list → done on next microtask (no timers needed).
  if (chunks.length === 0) {
    return createImmediateDoneHandle();
  }

  let status: StreamStatus = 'streaming';
  const collectedChunks: StreamChunk[] = [];
  let fullText = '';
  let chunkIndex = 0;
  const statusListeners = new Set<(s: StreamStatus) => void>();
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  function settle(s: StreamStatus): void {
    if (settled) return;
    settled = true;
    status = s;
    if (intervalHandle !== null) { clearInterval(intervalHandle); intervalHandle = null; }
    if (timeoutHandle !== null) { clearTimeout(timeoutHandle); timeoutHandle = null; }
    for (const cb of statusListeners) cb(s);
  }

  function deliverChunk(): void {
    if (settled) return;
    if (chunkIndex >= chunks.length) {
      settle('done');
      return;
    }
    const text = chunks[chunkIndex];
    fullText += text;
    collectedChunks.push({ index: chunkIndex, text, delta: text });
    chunkIndex++;
    if (chunkIndex >= chunks.length) {
      settle('done');
    }
  }

  // Deliver chunks on a fixed interval.  Under fake timers each
  // advanceTimersByTimeAsync(chunkIntervalMs) fires exactly one tick.
  intervalHandle = setInterval(deliverChunk, chunkIntervalMs);

  // Watchdog: if the wall-clock budget elapses before all chunks arrive,
  // mark the stream timed-out.
  timeoutHandle = setTimeout(() => {
    settle('timeout');
  }, timeoutMs);

  return {
    get status() { return status; },
    get text() { return fullText; },
    get chunks() { return collectedChunks; },

    cancel(): void {
      if (!settled) settle('cancelled');
    },

    onStatusChange(cb: (s: StreamStatus) => void): StreamAbortHandler {
      statusListeners.add(cb);
      return () => { statusListeners.delete(cb); };
    },
  };
}

/**
 * Flush microtasks after advancing fake timers so that interval callback
 * side-effects (state updates) are observable before assertions.
 *
 * Pass the `vi` instance when running under fake timers; omit it (or pass
 * undefined) when running in real-time mode.
 */
export async function streamDrain(viInstance?: typeof globalThis.vi): Promise<void> {
  if (viInstance) {
    await viInstance.advanceTimersByTimeAsync(0);
  } else {
    await new Promise((r) => setTimeout(r, 0));
  }
}

export function createImmediateDoneHandle(): AIStreamHandle {
  let status: StreamStatus = 'done';
  const collectedChunks: StreamChunk[] = [];
  const statusListeners = new Set<(s: StreamStatus) => void>();
  let settled = false;

  function settle(s: StreamStatus): void {
    if (settled) return;
    settled = true;
    status = s;
    for (const cb of statusListeners) cb(s);
  }

  Promise.resolve().then(() => settle('done'));

  return {
    get status() { return status; },
    get text() { return ''; },
    get chunks() { return collectedChunks; },

    cancel(): void { if (!settled) settle('cancelled'); },

    onStatusChange(cb: (s: StreamStatus) => void): StreamAbortHandler {
      statusListeners.add(cb);
      return () => { statusListeners.delete(cb); };
    },
  };
}

/**
 * Consume all chunks from a stream and return the accumulated text.
 */
export async function consumeStream(stream: AIStreamHandle, timeoutMs = 5000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (stream.status === 'streaming') {
    if (Date.now() > deadline) {
      throw new Error('consumeStream timed out');
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  return stream.text;
}

/* ------------------------------------------------------------------ */
/*  ProviderOrchestrator — fallback + health tracking                  */
/* ------------------------------------------------------------------ */

export type ProviderHealth = 'healthy' | 'degraded' | 'unhealthy';

export interface ProviderEntry {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  health: ProviderHealth;
  errorCount: number;
  lastError?: string;
}

export interface ProviderCallResult {
  readonly text: string;
  readonly providerId: string;
}

export type ProviderCallFn = (entry: ProviderEntry) => Promise<ProviderCallResult>;

export class ProviderOrchestrator {
  private providers: ProviderEntry[] = [];
  private activeProviderId: string | null = null;

  register(entry: Omit<ProviderEntry, 'health' | 'errorCount'>): void {
    const health = (entry as any).health ?? 'healthy';
    const errorCount = (entry as any).errorCount ?? 0;
    this.providers.push({ ...entry, health, errorCount });
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  getProviders(): readonly ProviderEntry[] {
    return this.providers;
  }

  getActiveProvider(): ProviderEntry | null {
    if (this.activeProviderId === null) return null;
    return this.providers.find((p) => p.id === this.activeProviderId) ?? null;
  }

  async query(call: ProviderCallFn): Promise<ProviderCallResult> {
    const sorted = [...this.providers].sort((a, b) => a.priority - b.priority);

    for (const entry of sorted) {
      if (entry.health === 'unhealthy') continue;
      try {
        const result = await call(entry);
        entry.health = 'healthy';
        entry.errorCount = 0;
        entry.lastError = undefined;
        this.activeProviderId = entry.id;
        return result;
      } catch (err) {
        entry.errorCount++;
        entry.lastError = err instanceof Error ? err.message : String(err);
        if (entry.errorCount >= 3) {
          entry.health = 'unhealthy';
        } else {
          entry.health = 'degraded';
        }
      }
    }

    throw new Error('All providers unavailable');
  }

  markHealthy(providerId: string): void {
    const entry = this.providers.find((p) => p.id === providerId);
    if (entry) {
      entry.health = 'healthy';
      entry.errorCount = 0;
      entry.lastError = undefined;
    }
  }
}
