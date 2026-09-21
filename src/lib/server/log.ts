/**
 * VantaOS server-side structured logging.
 *
 * AGENTS §7.9 requires every server log line to be structured and free of
 * user content and secrets. Upstream fetch errors are the risk here: the
 * Gemini call carries the operator key as a `?key=` query param, and an
 * undici `TypeError: fetch failed` can carry the request URL (and a nested
 * `cause`) in its message. Nothing reaches console.error until it has been
 * reduced to a redacted string.
 *
 * NOTE: the patterns mirror src/lib/ai/orchestrator.ts. That module is a
 * client-side AI primitive; importing it here would pull client AI code into
 * the worker/server bundle (AGENTS §7.8), so the redaction is kept local.
 */

const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z\-_]{8,}/g,
  /sk-(?:live|test)?[0-9A-Za-z\-_]{8,}/g,
  /ghp_[0-9A-Za-z]{8,}/g,
  /github_pat_[0-9A-Za-z_]{8,}/g,
  /(?:api[_-]?key|apikey|access[_-]?token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9\-_.]{6,}/gi,
];

export function redactSecrets(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const causeText = cause instanceof Error ? ` (cause: ${cause.message})` : '';
    return `${err.name}: ${err.message}${causeText}`;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unserializable error';
  }
}

/** Emit one structured, secret-free error line. Never throws. */
export function logServerError(event: string, requestId: string | undefined, err: unknown): void {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      requestId: requestId ?? null,
      detail: redactSecrets(errorText(err)),
    }),
  );
}
