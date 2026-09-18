/**
 * VantaOS API Request Validation Helpers
 *
 * Shared validation utilities for API route handlers.
 */

// ─── JSON Body Validation ──────────────────────────────────────────────────

export function validateJsonBody<T>(body: unknown, schema: object): T | { error: string } {
  if (body === null || body === undefined) {
    return { error: 'Request body is required' };
  }
  if (typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }
  if (Array.isArray(body)) {
    return { error: 'Request body must be a JSON object, not an array' };
  }
  const bodyObj = body as Record<string, unknown>;
  const schemaObj = schema as Record<string, unknown>;
  for (const [key, expectedType] of Object.entries(schemaObj)) {
    if (!(key in bodyObj)) {
      return { error: `Missing required field: ${key}` };
    }
    const actual = bodyObj[key];
    const typeName = typeof expectedType;
    if (typeName === 'string') {
      if (typeof actual !== 'string') {
        return { error: `Field "${key}" must be a string` };
      }
    } else if (typeName === 'number') {
      if (typeof actual !== 'number' || Number.isNaN(actual)) {
        return { error: `Field "${key}" must be a number` };
      }
    } else if (typeName === 'boolean') {
      if (typeof actual !== 'boolean') {
        return { error: `Field "${key}" must be a boolean` };
      }
    } else if (expectedType === Object) {
      if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
        return { error: `Field "${key}" must be an object` };
      }
    } else if (Array.isArray(expectedType)) {
      const allowed = expectedType as unknown[];
      if (!allowed.includes(actual)) {
        return { error: `Field "${key}" must be one of: ${allowed.join(', ')}` };
      }
    }
  }
  return body as T;
}

// ─── Query Parameter Validation ────────────────────────────────────────────

export function validateQueryParam(
  value: string | null,
  name: string,
  opts?: { required?: boolean; pattern?: RegExp },
): string | { error: string } {
  if (value === null || value === undefined || value === '') {
    if (opts?.required) {
      return { error: `Required query parameter "${name}" is missing` };
    }
    return '';
  }
  if (opts?.pattern && !opts.pattern.test(value)) {
    return { error: `Query parameter "${name}" has invalid format` };
  }
  return value;
}

// ─── Input Sanitization ────────────────────────────────────────────────────

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

export function sanitizeInput(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }
  const truncated = input.length > maxLength ? input.slice(0, maxLength) : input;
  return truncated.replace(/[&<>"'/]/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

// ─── URL Validation ────────────────────────────────────────────────────────

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
