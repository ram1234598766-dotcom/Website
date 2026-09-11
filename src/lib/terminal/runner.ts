/**
 * VantaOS Terminal — isolated JavaScript runner.
 *
 * Replaces main-thread `new Function` execution with a disposable Web Worker
 * so an infinite loop or runaway script cannot freeze the browser tab. The
 * host watches a wall-clock budget and an output cap and can force-terminate
 * the worker on either. There is deliberately no shared state between runs —
 * each run gets a fresh worker (mirrors the old per-call `new Function`
 * semantics).
 *
 * The runner is platform-adapter-based so tests can drive the exact same
 * protocol over Node's `worker_threads`, giving real isolation and real
 * termination in CI rather than a mock.
 */

import { QUOTA_LIMITS } from './types';

// ─── Worker host protocol ────────────────────────────────────────────────────

type SandboxWorkerMessage =
  | { type: 'run'; id: number; code: string }
  | { type: 'output'; id: number; level: string; text: string }
  | { type: 'result'; id: number; value: string }
  | { type: 'error'; id: number; message: string };

export interface SandboxWorkerLike {
  onMessage(cb: (data: unknown) => void): void;
  onError(cb: (err: Error) => void): void;
  post(message: unknown): void;
  terminate(): void;
}

export type SandboxWorkerFactory = (source: string) => SandboxWorkerLike;

export interface SandboxRunnerConfig {
  /** Hard wall-clock budget for one run, in ms. */
  maxRunMs: number;
  /** Output character cap before a flush is force-stopped. */
  maxOutputChars: number;
  /** Upper bound for the submitted code, in chars. */
  maxCodeChars: number;
}

export interface SandboxRunResult {
  ok: boolean;
  /** String form of the returned value ('undefined' when none). */
  value: string;
  /** Console lines captured during the run, in order. */
  output: readonly string[];
  /** Thrown error message when the code itself failed. */
  error?: string;
  /** Human-readable reason when the host stopped the run early. */
  terminated?: string;
  durationMs: number;
}

export interface SandboxRunHandle {
  readonly runId: number;
  readonly result: Promise<SandboxRunResult>;
  /** Best-effort stop; the returned result settles with `terminated`. */
  cancel(): void;
}

/** Dependency surface used by the shell so tests can inject a fake. */
export interface JsRunner {
  run(code: string): SandboxRunHandle;
}

const DEFAULT_CONFIG: SandboxRunnerConfig = {
  maxRunMs: 10_000,
  maxOutputChars: QUOTA_LIMITS.maxOutputChars,
  maxCodeChars: 200_000,
};

/**
 * The worker body. Environment-neutral: it drives `globalThis.postMessage`
 * and registers `globalThis.onmessage`, which the browser exposes natively in
 * a classic worker. A Node `worker_threads` adapter prepends a bridge that
 * aliases those to `parentPort` before this body runs.
 */
export function buildSandboxWorkerSource(): string {
  return `
const SBOX = globalThis;
SBOX.sboxRun = function (id, code) {
  const orig = {
    log: SBOX.console.log, error: SBOX.console.error,
    warn: SBOX.console.warn, info: SBOX.console.info,
  };
  const send = SBOX.postMessage.bind(SBOX);
  const emit = function (level, args) {
    try { send({ type: 'output', id: id, level: level, text: Array.from(args).map(String).join(' ') }); } catch (e) {}
  };
  SBOX.console.log   = function () { emit('log', arguments); };
  SBOX.console.error = function () { emit('error', arguments); };
  SBOX.console.warn  = function () { emit('warn', arguments); };
  SBOX.console.info  = function () { emit('info', arguments); };
  try {
    const result = new Function(code)();
    send({ type: 'result', id: id, value: String(result ?? 'undefined') });
  } catch (e) {
    send({ type: 'error', id: id, message: (e && typeof e.message === 'string') ? e.message : String(e) });
  } finally {
    SBOX.console.log = orig.log; SBOX.console.error = orig.error;
    SBOX.console.warn = orig.warn; SBOX.console.info = orig.info;
  }
};
SBOX.onmessage = function (ev) {
  const data = (ev && typeof ev === 'object' && 'data' in ev) ? ev.data : ev;
  if (!data || data.type !== 'run') return;
  if (typeof data.code !== 'string') {
    SBOX.postMessage({ type: 'error', id: data.id, message: 'No code supplied.' });
    return;
  }
  SBOX.sboxRun(data.id, data.code);
};
`;
}

/** Node.js bridge prepended to the worker body for `worker_threads` hosts. */
export function buildNodeWorkerBridge(): string {
  return `
import { parentPort } from 'node:worker_threads';
globalThis.postMessage = (m) => parentPort.postMessage(m);
parentPort.on('message', (raw) => {
  const fn = globalThis.onmessage;
  if (typeof fn === 'function') fn({ data: raw });
});
`;
}

function browserSandboxWorkerFactory(source: string): SandboxWorkerLike {
  if (typeof Worker === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error(
      'SandboxRunner needs a Worker-capable browser (Web Worker or URL.createObjectURL).'
    );
  }
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  let worker: Worker | null = new Worker(url);
  return {
    onMessage(cb) {
      worker?.addEventListener('message', (ev: MessageEvent) => cb(ev.data));
    },
    onError(cb) {
      worker?.addEventListener('error', (ev) =>
        cb(ev.error ?? new Error(ev.message ?? 'Worker error'))
      );
    },
    post(message) {
      worker?.postMessage(message);
    },
    terminate() {
      worker?.terminate();
      worker = null;
      URL.revokeObjectURL(url);
    },
  };
}

export class SandboxRunner implements JsRunner {
  private nextRunId = 0;
  private readonly config: SandboxRunnerConfig;

  constructor(
    factory: SandboxWorkerFactory = browserSandboxWorkerFactory,
    config?: Partial<SandboxRunnerConfig>
  ) {
    this.factory = factory;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private readonly factory: SandboxWorkerFactory;

  run(code: string): SandboxRunHandle {
    const runId = ++this.nextRunId;
    const started = Date.now();

    if (typeof code !== 'string' || code.length > this.config.maxCodeChars) {
      return {
        runId,
        result: Promise.resolve({
          ok: false,
          value: '',
          output: [],
          terminated:
            typeof code !== 'string'
              ? 'no code supplied'
              : 'code exceeds the size limit',
          durationMs: 0,
        }),
        cancel() {},
      };
    }

    let worker: SandboxWorkerLike | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    let finish: (r: SandboxRunResult) => void = () => {};
    const result = new Promise<SandboxRunResult>((resolve) => {
      finish = resolve;
    });

    const output: string[] = [];
    let outputChars = 0;

    const settle = (r: Omit<SandboxRunResult, 'durationMs'>) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      worker?.terminate();
      worker = null;
      finish({ ...r, durationMs: Date.now() - started });
    };

    try {
      worker = this.factory(buildSandboxWorkerSource());
    } catch (err) {
      settle({
        ok: false,
        value: '',
        output,
        error: (err as Error)?.message ?? String(err),
        terminated: 'sandbox failed to start',
      });
      return { runId, result, cancel() {} };
    }

    worker.onError((err) => {
      settle({
        ok: false,
        value: '',
        output,
        error: String((err as Error)?.message ?? err),
        terminated: 'sandbox worker crashed',
      });
    });

    worker.onMessage((data) => {
      const msg = (data ?? {}) as Partial<SandboxWorkerMessage>;
      if (msg.type === 'output' && typeof msg.text === 'string') {
        output.push(msg.text);
        outputChars += msg.text.length + 1;
        if (outputChars > this.config.maxOutputChars) {
          output.push('[output truncated — exceeded the character limit]');
          settle({
            ok: false,
            value: '',
            output,
            terminated: 'output exceeded the character limit',
          });
        }
      } else if (msg.type === 'result') {
        settle({ ok: true, value: msg.value ?? 'undefined', output });
      } else if (msg.type === 'error') {
        settle({ ok: false, value: '', output, error: msg.message });
      }
    });

    timer = setTimeout(() => {
      output.push('[output truncated — stopped by the run limit]');
      settle({
        ok: false,
        value: '',
        output,
        terminated: `exceeded the ${Math.max(1, Math.round(this.config.maxRunMs / 1000))}s execution limit`,
      });
    }, this.config.maxRunMs);

    worker.post({ type: 'run', id: runId, code });

    return {
      runId,
      result,
      cancel() {
        settle({ ok: false, value: '', output, terminated: 'cancelled' });
      },
    };
  }
}