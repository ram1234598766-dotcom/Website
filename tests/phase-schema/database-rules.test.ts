import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

interface RulesRoot {
  rules?: Record<string, unknown>;
}

function loadRules(): RulesRoot {
  const file = readFileSync(join(ROOT, 'database.rules.json'), 'utf8');
  return JSON.parse(file) as RulesRoot;
}

describe('database.rules.json', () => {
  const rules = loadRules();

  it('parses and exposes a rules object', () => {
    expect(rules.rules).toBeDefined();
    expect(typeof rules.rules).toBe('object');
  });

  it('covers every top-level path used by the app', () => {
    const messages = (rules.rules as Record<string, unknown>);
    for (const key of ['profiles', 'threads', 'replies', 'upvotes']) {
      expect(messages[key]).toBeDefined();
    }
  });

  it('allows unauthenticated reads only for public content', () => {
    const messages = (rules.rules as Record<string, unknown>);
    const profile = (messages.profiles as Record<string, unknown>)['$uid'] as { '.read': unknown };
    const thread = (messages.threads as Record<string, unknown>)['.read'] as unknown;
    const reply = (messages.replies as Record<string, unknown>)['.read'] as unknown;
    const upvotes = (messages.upvotes as Record<string, unknown>)['.read'] as unknown;

    // Public, read-only-shared data stays readable.
    expect(profile['.read']).toBe(true);
    expect(thread).toBe(true);
    expect(reply).toBe(true);
    // Upvotes are finer-grained and require auth.
    expect(upvotes).toBe('auth != null');
  });

  it('requires authentication for every write', () => {
    const messages = (rules.rules as Record<string, unknown>);
    const writes: unknown[] = [];
    for (const key of ['profiles', 'threads', 'replies', 'upvotes']) {
      const node = messages[key] as Record<string, unknown>;
      for (const [path, val] of Object.entries(node)) {
        if (typeof val === 'object' && val !== null) {
          const w = (val as Record<string, unknown>)['.write'];
          if (typeof w === 'string') writes.push(w);
        }
      }
    }
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(String(w)).toContain('auth != null');
    }
  });

  it('scopes profile writes to the owner UID', () => {
    const messages = (rules.rules as Record<string, unknown>);
    const profile = (messages.profiles as Record<string, unknown>)['$uid'] as {
      '.write': unknown;
      '.validate': unknown;
    };
    expect(String(profile['.write'])).toContain('$uid === auth.uid');
    expect(String(profile['.validate'])).toContain('hasChildren([\'username\'])');
  });

  it('enforces a username field on new profiles', () => {
    const messages = (rules.rules as Record<string, unknown>);
    const profile = (messages.profiles as Record<string, unknown>)['$uid'] as {
      '.validate': string;
    };
    expect(profile['.validate']).toContain('newData.child(\'username\')');
  });

  it('enforces author_id on new threads and replies', () => {
    const messages = (rules.rules as Record<string, unknown>);
    const thread = (messages.threads as Record<string, unknown>)['$id'] as {
      '.validate': string;
    };
    const reply = (messages.replies as Record<string, unknown>)['$id'] as {
      '.validate': string;
    };
    expect(thread['.validate']).toContain('author_id');
    expect(reply['.validate']).toContain('author_id');
  });

  it('scopes upvote writes to the creating user', () => {
    const messages = (rules.rules as Record<string, unknown>);
    const upvote = (messages.upvotes as Record<string, unknown>)['$id'] as {
      '.write': string;
      '.validate': string;
    };
    expect(upvote['.write']).toContain('auth.uid');
    expect(upvote['.validate']).toContain('user_id');
  });
});

describe('firebase.json wiring', () => {
  it('points database rules at database.rules.json', () => {
    const fb = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'));
    expect(fb.database.rules).toBe('database.rules.json');
  });

  it('points firestore at the deployed rule and index files', () => {
    const fb = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'));
    expect(fb.firestore.rules).toBe('firestore.rules');
    expect(fb.firestore.indexes).toBe('firestore.indexes.json');
  });
});