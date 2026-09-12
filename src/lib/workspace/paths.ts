/**
 * VantaOS Workspace — Deterministic Path Rules.
 *
 * Enforces a single, canonical path for every node. Rules:
 * - No leading or trailing slashes.
 * - No double slashes.
 * - No empty segments (e.g., "a//b" is invalid).
 * - No "." or ".." segments.
 * - Maximum depth of 32 segments.
 * - Path is always relative to the workspace root.
 * - Names are sanitized: no control characters, max 255 bytes.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 255;
const MAX_DEPTH = 32;
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;
const INVALID_NAME_CHARS_RE = /[<>:"|?*\x00-\x1f\x7f]/;

// ─── Path Validation ────────────────────────────────────────────────────────

export interface PathValidation {
  readonly valid: boolean;
  readonly error?: string;
}

/** Validate a workspace path (relative, forward-slash separated). */
export function validatePath(path: string): PathValidation {
  if (typeof path !== 'string') {
    return { valid: false, error: 'path must be a string' };
  }
  if (path.length === 0) {
    return { valid: false, error: 'path must not be empty' };
  }
  if (path.startsWith('/') || path.endsWith('/')) {
    return { valid: false, error: 'path must not start or end with /' };
  }
  if (path.includes('//')) {
    return { valid: false, error: 'path must not contain double slashes' };
  }

  const segments = path.split('/');
  if (segments.length > MAX_DEPTH) {
    return {
      valid: false,
      error: `path exceeds maximum depth of ${MAX_DEPTH}`,
    };
  }

  for (const seg of segments) {
    const nameCheck = validateName(seg);
    if (!nameCheck.valid) {
      return nameCheck;
    }
  }

  return { valid: true };
}

// ─── Name Validation ────────────────────────────────────────────────────────

/** Validate a single node name (file or folder name, not a full path). */
export function validateName(name: string): PathValidation {
  if (typeof name !== 'string') {
    return { valid: false, error: 'name must be a string' };
  }
  if (name.length === 0) {
    return { valid: false, error: 'name must not be empty' };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `name exceeds maximum length of ${MAX_NAME_LENGTH}`,
    };
  }
  if (INVALID_NAME_CHARS_RE.test(name)) {
    return { valid: false, error: 'name contains invalid characters' };
  }
  if (name.includes('/') || name.includes('\\')) {
    return { valid: false, error: 'name must not contain path separators' };
  }
  if (name === '.' || name === '..') {
    return { valid: false, error: 'name must not be "." or ".."' };
  }
  return { valid: true };
}

// ─── Path Building ──────────────────────────────────────────────────────────

/** Build a canonical path from parent path and child name. Returns null on invalid. */
export function buildCanonicalPath(
  parentPath: string | null,
  childName: string
): string | null {
  const nameCheck = validateName(childName);
  if (!nameCheck.valid) return null;

  if (parentPath === null || parentPath === '') {
    return childName;
  }

  const parentCheck = validatePath(parentPath);
  if (!parentCheck.valid) return null;

  const canonical = `${parentPath}/${childName}`;
  const pathCheck = validatePath(canonical);
  return pathCheck.valid ? canonical : null;
}

/**
 * Compute the parent path from a given path.
 * Returns null for root-level paths.
 */
export function parentPathOf(path: string): string | null {
  const idx = path.lastIndexOf('/');
  return idx < 0 ? null : path.substring(0, idx);
}

/**
 * Get the depth (number of segments) of a path.
 * "a" → 1, "a/b" → 2, "a/b/c" → 3.
 */
export function pathDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

/** Check if a path is a descendant of an ancestor path. */
export function isDescendantOf(path: string, ancestor: string): boolean {
  return path.startsWith(ancestor + '/');
}

/**
 * Normalize a path: collapse multiple slashes, resolve "." and "..".
 * Returns null if the result would escape the root or be invalid.
 */
export function normalizePath(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  const result: string[] = [];

  for (const seg of segments) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (result.length === 0) return null;
      result.pop();
    } else {
      result.push(seg);
    }
  }

  const normalized = result.join('/') || null;
  if (normalized === null) return null;

  const pathCheck = validatePath(normalized);
  return pathCheck.valid ? normalized : null;
}

/**
 * Sanitize a name for use in the workspace.
 * Replaces control characters, trims whitespace, and validates.
 */
export function sanitizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'untitled';

  let sanitized = trimmed
    .replace(CONTROL_CHAR_RE, '_')
    .replace(INVALID_NAME_CHARS_RE, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '');

  if (sanitized.length > MAX_NAME_LENGTH) {
    sanitized = sanitized.substring(0, MAX_NAME_LENGTH);
  }

  if (sanitized.length === 0) {
    sanitized = 'untitled';
  }

  return sanitized;
}
