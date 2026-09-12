/**
 * Phase 1 — Deterministic Path Rules.
 *
 * Enforces the canonical single-path-per-node invariant: no leading/trailing
 * slashes, no empty/`.`/`..` segments, bounded depth, sanitized names, and
 * canonical path building from parent + child.
 */

import { describe, expect, it } from 'vitest';
import {
  validatePath,
  validateName,
  buildCanonicalPath,
  parentPathOf,
  pathDepth,
  isDescendantOf,
  normalizePath,
  sanitizeName,
} from '../../src/lib/workspace/paths';

describe('validatePath', () => {
  it('accepts a plain relative path', () => {
    expect(validatePath('a/b/c.ts').valid).toBe(true);
  });

  it('rejects leading slash', () => {
    expect(validatePath('/a/b').error).toMatch(/start or end/);
  });

  it('rejects trailing slash', () => {
    expect(validatePath('a/b/').error).toMatch(/start or end/);
  });

  it('rejects double slashes', () => {
    expect(validatePath('a//b').error).toMatch(/double slashes/);
  });

  it('rejects ".." segment escaping the root', () => {
    expect(validatePath('a/../b').error).toMatch(/\.\./);
  });

  it('rejects "." segment', () => {
    expect(validatePath('a/./b').error).toMatch(/\./);
  });

  it('rejects empty path', () => {
    expect(validatePath('').error).toMatch(/empty/);
  });

  it('enforces maximum depth', () => {
    const deep = Array.from({ length: 40 }, (_, i) => `s${i}`).join('/');
    expect(validatePath(deep).error).toMatch(/depth/);
  });
});

describe('validateName', () => {
  it('accepts a normal name', () => {
    expect(validateName('index.ts').valid).toBe(true);
  });

  it('rejects empty name', () => {
    expect(validateName('').error).toMatch(/empty/);
  });

  it('rejects path separators in names', () => {
    expect(validateName('a/b').error).toMatch(/separators/);
    expect(validateName('a\\b').error).toMatch(/separators/);
  });

  it('rejects control characters', () => {
    expect(validateName('bad\u0000name').error).toMatch(/invalid characters/);
  });

  it('rejects "." and ".." as names', () => {
    expect(validateName('.').error).toMatch(/\./);
    expect(validateName('..').error).toMatch(/\.\./);
  });
});

describe('buildCanonicalPath', () => {
  it('builds a root path from null parent', () => {
    expect(buildCanonicalPath(null, 'a.ts')).toBe('a.ts');
  });

  it('builds a nested path', () => {
    expect(buildCanonicalPath('src/lib', 'x.ts')).toBe('src/lib/x.ts');
  });

  it('returns null for invalid child names', () => {
    expect(buildCanonicalPath('a', '..')).toBeNull();
    expect(buildCanonicalPath('a', 'has/slash')).toBeNull();
  });

  it('returns null for invalid parent paths', () => {
    expect(buildCanonicalPath('/a', 'x.ts')).toBeNull();
  });
});

describe('parentPathOf / pathDepth / isDescendantOf', () => {
  it('computes parent paths', () => {
    expect(parentPathOf('a/b/c.ts')).toBe('a/b');
    expect(parentPathOf('a.ts')).toBeNull();
  });

  it('computes depth', () => {
    expect(pathDepth('a')).toBe(1);
    expect(pathDepth('a/b/c')).toBe(3);
  });

  it('detects descendants', () => {
    expect(isDescendantOf('a/b/c', 'a')).toBe(true);
    expect(isDescendantOf('a-b/x', 'a')).toBe(false);
    expect(isDescendantOf('b/x', 'a')).toBe(false);
  });
});

describe('normalizePath', () => {
  it('collapses redundant slashes', () => {
    expect(normalizePath('a//b///c')).toBe('a/b/c');
  });

  it('resolves "." segments', () => {
    expect(normalizePath('a/./b')).toBe('a/b');
  });

  it('resolves ".." segments', () => {
    expect(normalizePath('a/b/../c')).toBe('a/c');
  });

  it('returns null when escaping the root', () => {
    expect(normalizePath('../a')).toBeNull();
    expect(normalizePath('a/../../b')).toBeNull();
  });
});

describe('sanitizeName', () => {
  it('replaces control characters', () => {
    expect(sanitizeName('bad\u0000name')).toBe('bad_name');
  });

  it('replaces whitespace runs with underscore', () => {
    expect(sanitizeName('my file.ts')).toBe('my_file.ts');
  });

  it('falls back to "untitled" for empty input', () => {
    expect(sanitizeName('')).toBe('untitled');
    expect(sanitizeName('   ')).toBe('untitled');
  });
});