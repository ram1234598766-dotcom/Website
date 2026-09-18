/**
 * Realtime Database security rules — real emulator-backed tests.
 *
 * These are NOT static assertions: every case issues an actual read/write
 * against a live `firebase emulators:exec` database instance, so a rule that
 * "looks" right but denies (or permits) wrongly fails here.
 *
 * Run with:  npm run test:rules
 *
 * The write shapes below mirror `src/lib/firestore.ts` exactly, because a
 * rules file is only correct relative to the writes the app actually makes.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-vantaos';

const RULES = readFileSync(join(process.cwd(), 'database.rules.json'), 'utf8');

const EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST;

if (!EMULATOR_HOST) {
  describe('database rules', () => {
    it('skips — run with `npm run test:rules` for emulator-backed tests', () => {
      console.warn('[database-rules] emulator host not set; tests skipped.');
    });
  });
}

let testEnv!: RulesTestEnvironment;

if (EMULATOR_HOST) {
  beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules: RULES },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

afterEach(async () => {
  await testEnv.clearDatabase();
});

/** A Realtime Database client for an authenticated uid, or anonymous when omitted. */
function db(uid?: string) {
  const context = uid
    ? testEnv.authenticatedContext(uid)
    : testEnv.unauthenticatedContext();
  return context.database();
}

/** Seed data bypassing rules (as a trusted backend would). */
async function seed(path: string, value: unknown): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.database().ref(path).set(value);
  });
}

function thread(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Thread title',
    content: 'Thread body',
    category: 'General',
    author_id: 'alice',
    author_username: 'alice',
    author_avatar_url: null,
    created_at: 1_700_000_000_000,
    upvotes_count: 0,
    replies_count: 0,
    ...overrides,
  };
}

function reply(overrides: Record<string, unknown> = {}) {
  return {
    thread_id: 't1',
    content: 'Reply body',
    author_id: 'bob',
    author_username: 'bob',
    author_avatar_url: null,
    created_at: 1_700_000_000_000,
    upvotes_count: 0,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* threads                                                             */
/* ------------------------------------------------------------------ */

describe('threads rules', () => {
  it('lets an author create a thread with the exact shape the app uses', async () => {
    await assertSucceeds(db('alice').ref('threads/t1').set(thread()));
  });

  it('rejects an unauthenticated create', async () => {
    await assertFails(db().ref('threads/t1').set(thread()));
  });

  it('rejects a create attributed to a different user', async () => {
    await assertFails(
      db('mallory').ref('threads/t1').set(thread({ author_id: 'alice' }))
    );
  });

  it('rejects a create missing the fields the app relies on', async () => {
    const partial = thread();
    delete (partial as Record<string, unknown>).created_at;
    await assertFails(db('alice').ref('threads/t1').set(partial));
  });

  it('rejects a cross-author content edit', async () => {
    await seed('threads/t1', thread());
    await assertFails(
      db('mallory').ref('threads/t1').update({ title: 'Hijacked' })
    );
  });

  it('rejects a cross-author delete', async () => {
    await seed('threads/t1', thread());
    await assertFails(db('mallory').ref('threads/t1').remove());
  });

  it('allows the author to delete their own thread', async () => {
    await seed('threads/t1', thread());
    await assertSucceeds(db('alice').ref('threads/t1').remove());
  });

  /**
   * `createReply()` in src/lib/firestore.ts:187 increments replies_count on
   * *someone else's* thread, so a non-author must be allowed to bump it.
   */
  it('allows a non-author to increment replies_count by one', async () => {
    await seed('threads/t1', thread());
    await assertSucceeds(
      db('bob').ref('threads/t1').update({ replies_count: 1 })
    );
  });

  it('allows a voter to move upvotes_count by exactly one', async () => {
    await seed('threads/t1', thread({ upvotes_count: 4 }));
    await assertSucceeds(
      db('bob').ref('threads/t1').update({ upvotes_count: 5 })
    );
    await assertSucceeds(
      db('bob').ref('threads/t1').update({ upvotes_count: 4 })
    );
  });

  it('rejects a counter jump larger than one', async () => {
    await seed('threads/t1', thread({ upvotes_count: 0 }));
    await assertFails(
      db('bob').ref('threads/t1').update({ upvotes_count: 1000 })
    );
  });

  it('rejects driving upvotes_count negative', async () => {
    await seed('threads/t1', thread({ upvotes_count: 1 }));
    await assertFails(
      db('bob').ref('threads/t1').update({ upvotes_count: -1 })
    );
  });

  it('rejects creating a thread with an empty author_username', async () => {
    await assertFails(
      db('alice').ref('threads/t1').update({ author_username: '' })
    );
  });

  it('freezes author_username after creation', async () => {
    await seed('threads/t1', thread({ author_username: 'alice' }));
    await assertFails(
      db('alice').ref('threads/t1').update({ author_username: 'mallory' })
    );
  });

  it('rejects replies_count moving backwards', async () => {
    await seed('threads/t1', thread({ replies_count: 5 }));
    await assertFails(
      db('bob').ref('threads/t1').update({ replies_count: 4 })
    );
  });

  it('is world-readable so the forum renders before sign-in', async () => {
    await seed('threads/t1', thread());
    await assertSucceeds(db().ref('threads').once('value'));
  });
});

/* ------------------------------------------------------------------ */
/* replies                                                             */
/* ------------------------------------------------------------------ */

describe('replies rules', () => {
  it('lets an author create a reply with the exact shape the app uses', async () => {
    await assertSucceeds(db('bob').ref('replies/r1').set(reply()));
  });

  it('rejects an unauthenticated create', async () => {
    await assertFails(db().ref('replies/r1').set(reply()));
  });

  it('rejects a reply attributed to a different user', async () => {
    await assertFails(
      db('mallory').ref('replies/r1').set(reply({ author_id: 'bob' }))
    );
  });

  it('rejects a cross-author content edit', async () => {
    await seed('replies/r1', reply());
    await assertFails(
      db('mallory').ref('replies/r1').update({ content: 'Hijacked' })
    );
  });

  it('allows the author to change a non-content field (e.g. vote count)', async () => {
    await seed('replies/r1', reply({ upvotes_count: 0 }));
    await assertSucceeds(
      db('carol').ref('replies/r1').update({ upvotes_count: 1 })
    );
  });

  it('rejects driving a reply upvotes_count negative', async () => {
    await seed('replies/r1', reply({ upvotes_count: 1 }));
    await assertFails(
      db('carol').ref('replies/r1').update({ upvotes_count: -1 })
    );
  });

  it('rejects creating a reply with an empty author_username', async () => {
    await assertFails(
      db('bob').ref('replies/r2').update({ author_username: '' })
    );
  });

  it('is world-readable', async () => {
    await seed('replies/r1', reply());
    await assertSucceeds(db().ref('replies').once('value'));
  });
});

/* ------------------------------------------------------------------ */
/* profiles                                                            */
/* ------------------------------------------------------------------ */

describe('profiles rules', () => {
  it('allows a user to upsert their own profile', async () => {
    await assertSucceeds(
      db('alice').ref('profiles/alice').update({
        username: 'alice',
        avatar_url: null,
        created_at: 1_700_000_000_000,
      })
    );
  });

  it('rejects writing another user profile', async () => {
    await assertFails(
      db('mallory').ref('profiles/alice').update({ username: 'mallory' })
    );
  });

  it('rejects an empty username', async () => {
    await assertFails(db('alice').ref('profiles/alice').set({ username: '' }));
  });

  it('rejects a profile with no username', async () => {
    await assertFails(db('alice').ref('profiles/alice').set({ avatar_url: 'https://example.com/a.png' }));
  });

  /**
   * AdminPanel reads `profiles` as a whole to count users (getMetrics /
   * subscribeMetrics in src/lib/firestore.ts). A `.read` at `profiles/$uid`
   * only would deny that top-level read and silently report 0 users.
   */
  it('allows reading the whole profiles node for the admin user count', async () => {
    await seed('profiles/alice', { username: 'alice', created_at: 1 });
    await assertSucceeds(db('admin').ref('profiles').once('value'));
  });
});

/* ------------------------------------------------------------------ */
/* upvotes                                                             */
/* ------------------------------------------------------------------ */

describe('upvotes rules', () => {
  it('lets a user cast their own vote', async () => {
    await assertSucceeds(
      db('alice').ref('upvotes/alice_t1_thread').set({
        user_id: 'alice',
        thread_id: 't1',
        reply_id: null,
        created_at: 1_700_000_000_000,
      })
    );
  });

  it('rejects casting a vote on behalf of another user', async () => {
    await assertFails(
      db('mallory').ref('upvotes/alice_t1_thread').set({
        user_id: 'alice',
        thread_id: 't1',
        reply_id: null,
        created_at: 1_700_000_000_000,
      })
    );
  });

  it('lets a user retract their own vote', async () => {
    await seed('upvotes/alice_t1_thread', {
      user_id: 'alice',
      thread_id: 't1',
      reply_id: null,
      created_at: 1_700_000_000_000,
    });
    await assertSucceeds(db('alice').ref('upvotes/alice_t1_thread').remove());
  });

  it('rejects retracting another user vote', async () => {
    await seed('upvotes/alice_t1_thread', {
      user_id: 'alice',
      thread_id: 't1',
      reply_id: null,
      created_at: 1_700_000_000_000,
    });
    await assertFails(db('mallory').ref('upvotes/alice_t1_thread').remove());
  });

  it('hides the vote graph from anonymous clients', async () => {
    await seed('upvotes/alice_t1_thread', {
      user_id: 'alice',
      thread_id: 't1',
      reply_id: null,
      created_at: 1_700_000_000_000,
    });
    await assertFails(db().ref('upvotes').once('value'));
  });

  it('exposes the vote graph to authenticated clients', async () => {
    await seed('upvotes/alice_t1_thread', {
      user_id: 'alice',
      thread_id: 't1',
      reply_id: null,
      created_at: 1_700_000_000_000,
    });
    await assertSucceeds(db('bob').ref('upvotes').once('value'));
  });
});
}
