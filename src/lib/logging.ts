/**
 * VantaOS Structured Logging
 *
 * Provides leveled, structured logging with automatic secret redaction.
 * In the browser: logs to console with collapsible groups per context.
 * In tests: records entries into a capture array for assertions.
 * In Node/worker: logs JSON lines.
 *
 * Usage:
 *   import { logger } from '@/lib/logging';
 *   logger.info('userSignedIn', { uid: 'abc', method: 'google' });
 *   logger.warn('tokenExpiring', { userId: 'abc', ttlSec: 60 });
 *   logger.error('syncFailed', { deviceId: 'xyz', reason: 'network' });
 */

/* ------------------------------------------------------------------ */
/* Secret redaction                                                    */
/* ------------------------------------------------------------------ */

const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z\-_]{35}/g,                  // Firebase API key
  /(?:api[_-]?key|apikey|api_secret|secret|token|password)\s*[:=]\s*['"]?([A-Za-z0-9\-_\.]{8,})/gi,
  /sk_live_[0-9a-zA-Z]{24,}/gi,               // Stripe-style live keys
  /sk_test_[0-9a-zA-Z]{24,}/gi,               // Stripe-style test keys
  /ghp_[0-9a-zA-Z]{36}/gi,                    // GitHub personal-access token
  /github_pat_[0-9a-zA-Z_]{22,}/gi,           // GitHub fine-grained PAT
  /xox[baprs]-[0-9a-zA-Z-]+/gi,               // Slack token
  /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/gi, // PEM block markers
];

/**
 * Replace any matched secret with a redaction marker.
 */
export function redact(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

/**
 * Deep-redact a log context object — walks all string values and
 * replaces secrets at the top level and one object level deep.
 */
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
/* Log level                                                           */
/* ------------------------------------------------------------------ */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/* ------------------------------------------------------------------ */
/* Log entry shape                                                     */
/* ------------------------------------------------------------------ */

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

/* ------------------------------------------------------------------ */
/* Test capture buffer                                                 */
/* ------------------------------------------------------------------ */

let testCapture: LogEntry[] | null = null;

export function getTestCapture(): LogEntry[] {
  if (!testCapture) testCapture = [];
  return testCapture;
}

export function resetTestCapture(): void {
  testCapture = [];
}

/* ------------------------------------------------------------------ */
/* Console formatting                                                  */
/* ------------------------------------------------------------------ */

const CONSOLE_PREFIX = '[VantaOS]';

function emitConsole(entry: LogEntry): void {
  const { timestamp, level, message, context } = entry;
  const groupLabel = context?.groupId || message;

  switch (level) {
    case 'debug':
      console.debug(`${CONSOLE_PREFIX} [DEBUG] ${timestamp}`, message, context ?? '');
      break;
    case 'info':
      console.groupCollapsed(`${CONSOLE_PREFIX} [INFO] ${groupLabel}`);
      console.log(`  time  : ${timestamp}`);
      console.log(`  msg   : ${message}`);
      if (context) console.log('  ctx   :', context);
      console.groupEnd();
      break;
    case 'warn':
      console.group(`${CONSOLE_PREFIX} [WARN] ${groupLabel}`);
      console.warn(`  time  : ${timestamp}`);
      console.warn(`  msg   : ${message}`);
      if (context) console.warn('  ctx   :', context);
      console.groupEnd();
      break;
    case 'error':
      console.group(`${CONSOLE_PREFIX} [ERROR] ${groupLabel}`);
      console.error(`  time  : ${timestamp}`);
      console.error(`  msg   : ${message}`);
      if (context) console.error('  ctx   :', context);
      console.groupEnd();
      break;
  }
}

function emitJsonLine(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case 'debug': console.debug(line); break;
    case 'info':  console.log(line);   break;
    case 'warn':  console.warn(line);  break;
    case 'error': console.error(line); break;
  }
}

/* ------------------------------------------------------------------ */
/* Logger                                                              */
/* ------------------------------------------------------------------ */

export interface LoggerOptions {
  /** Minimum level to emit. Default: info. */
  minLevel?: LogLevel;
  /** Group name prepended to the console output. */
  groupId?: string;
}

const DEFAULT_OPTIONS: Required<LoggerOptions> = {
  minLevel: 'info',
  groupId: 'VantaOS',
};

export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}

/**
 * Create a logger instance. Call once per module and reuse.
 *
 * @example
 *   const log = createLogger({ groupId: 'CloudOS' });
 *   log.info('fileSaved', { path: '/main.ts', size: 1024 });
 */
export function createLogger(opts: LoggerOptions = {}): Logger {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  function shouldEmit(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[options.minLevel];
  }

  function log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!shouldEmit(level)) return;

    const safeContext = redactContext(context);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: redact(message),
      context: safeContext,
    };

    if (testCapture !== null) {
      testCapture.push(entry);
    } else if (typeof window !== 'undefined') {
      emitConsole(entry);
    } else {
      emitJsonLine(entry);
    }
  }

  return {
    debug: (message, context) => log('debug', message, context),
    info:  (message, context) => log('info',  message, context),
    warn:  (message, context) => log('warn',  message, context),
    error: (message, context) => log('error', message, context),
  };
}

/* ------------------------------------------------------------------ */
/* Module-level default logger                                         */
/* ------------------------------------------------------------------ */

export const logger = createLogger({ groupId: 'VantaOS' });
