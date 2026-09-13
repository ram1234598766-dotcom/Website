/**
 * Firebase Realtime Database data layer for VantaOS.
 *
 * Forum threads, replies, and Admin metrics live in the Firebase Realtime
 * Database inside the same Firebase project used for sign-in:
 *
 *   profiles/{uid}                        denormalized user profile
 *   threads/{id}                          forum threads
 *   replies/{id}                          forum replies
 *   upvotes/{uid}_{tid}_{rid}             deterministic id — dedupes votes
 *
 * Thread/reply nodes carry denormalized author fields (author_username,
 * author_avatar_url), so lists render without an extra join. Counters are
 * updated atomically with `increment()`, and real-time updates are streamed
 * via `onValue()` subscriptions.
 *
 * Every function is a safe no-op / empty-data fallback when no Firebase
 * project is configured (demo mode).
 */

import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  query,
  orderByChild,
  equalTo,
  increment,
  serverTimestamp,
  type Database,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebaseApp, getCurrentFireUser, isFirebaseConfigured } from './firebase';
import type { Thread, Reply } from '../types';

/** Realtime Database shares the Firebase project config — no extra env vars. */
export function isFirestoreAvailable(): boolean {
  return isFirebaseConfigured();
}

let db: Database | null = null;

function getDb(): Database {
  if (db) return db;
  db = getDatabase(getFirebaseApp());
  return db;
}

/* ------------------------------------------------------------------ */
/* Node mapping (RTDB values <-> types.ts)                             */
/* ------------------------------------------------------------------ */

function toIso(value: unknown): string {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function snapshotToThreads(snap: DataSnapshot): Thread[] {
  const threads: Thread[] = [];
  snap.forEach((child) => {
    const v = child.val() || {};
    threads.push({
      id: child.key || '',
      title: v.title || '',
      content: v.content || '',
      author_id: v.author_id || '',
      category: v.category || 'General',
      created_at: toIso(v.created_at),
      upvotes_count: v.upvotes_count ?? 0,
      replies_count: v.replies_count ?? 0,
      author: {
        id: v.author_id || '',
        username: v.author_username || v.author_display_name || 'Unknown',
        avatar_url: v.author_avatar_url || undefined,
        created_at: '',
      },
    });
  });
  return threads;
}

function snapshotToReplies(snap: DataSnapshot): Reply[] {
  const replies: Reply[] = [];
  snap.forEach((child) => {
    const v = child.val() || {};
    replies.push({
      id: child.key || '',
      thread_id: v.thread_id || '',
      content: v.content || '',
      author_id: v.author_id || '',
      created_at: toIso(v.created_at),
      upvotes_count: v.upvotes_count ?? 0,
      author: {
        id: v.author_id || '',
        username: v.author_username || v.author_display_name || 'Unknown',
        avatar_url: v.author_avatar_url || undefined,
        created_at: '',
      },
    });
  });
  return replies;
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

/** Upsert (merge) the current user's profile so Admin user counts are real. */
export async function syncProfileForCurrentUser(): Promise<void> {
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !user) return;
  const username = user.displayName || (user.email ? user.email.split('@')[0] : 'unknown');
  try {
    await update(ref(getDb(), `profiles/${user.uid}`), {
      username,
      avatar_url: user.photoURL || null,
      created_at: serverTimestamp(),
    });
  } catch {
    // Non-fatal — author data is denormalized onto threads/replies anyway.
  }
}

/* ------------------------------------------------------------------ */
/* Threads & replies (writes)                                          */
/* ------------------------------------------------------------------ */

export async function createThread(input: {
  title: string;
  content: string;
  category: string;
}): Promise<{ id: string | null; error: string | null }> {
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !user) {
    return { id: null, error: 'Sign in to create a thread. Realtime Database requires a configured Firebase project.' };
  }
  const username = user.displayName || (user.email ? user.email.split('@')[0] : 'Unknown');
  try {
    await syncProfileForCurrentUser();
    const childRef = await push(ref(getDb(), 'threads'), {
      title: input.title,
      content: input.content,
      category: input.category,
      author_id: user.uid,
      author_username: username,
      author_avatar_url: null,
      created_at: serverTimestamp(),
      upvotes_count: 0,
      replies_count: 0,
    });
    return { id: childRef.key, error: null };
  } catch (err: any) {
    return { id: null, error: err?.message || 'Failed to create thread.' };
  }
}

export async function createReply(
  threadId: string,
  content: string
): Promise<{ id: string | null; error: string | null }> {
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !user) {
    return { id: null, error: 'Sign in to reply. Realtime Database requires a configured Firebase project.' };
  }
  const username = user.displayName || (user.email ? user.email.split('@')[0] : 'Unknown');
  try {
    const childRef = await push(ref(getDb(), 'replies'), {
      thread_id: threadId,
      content,
      author_id: user.uid,
      author_username: username,
      author_avatar_url: null,
      created_at: serverTimestamp(),
      upvotes_count: 0,
    });
    await update(ref(getDb(), `threads/${threadId}`), { replies_count: increment(1) });
    return { id: childRef.key, error: null };
  } catch (err: any) {
    return { id: null, error: err?.message || 'Failed to post reply.' };
  }
}

/* ------------------------------------------------------------------ */
/* Upvotes — deterministic doc id + atomic increment                    */
/* ------------------------------------------------------------------ */

export async function setUpvote(input: {
  threadId?: string;
  replyId?: string;
}): Promise<{ upvoted: boolean; error: string | null }> {
  const user = getCurrentFireUser();
  const tId = input.threadId || '';
  const rId = input.replyId || '';
  if (!isFirestoreAvailable() || !user) {
    return { upvoted: false, error: 'Sign in to upvote. Realtime Database requires a configured Firebase project.' };
  }
  if (!tId && !rId) {
    return { upvoted: false, error: 'A thread or reply is required.' };
  }
  const key = `${user.uid}_${tId || 'thread'}_${rId || 'reply'}`;
  const upRef = ref(getDb(), `upvotes/${key}`);
  const targetRef = ref(getDb(), tId ? `threads/${tId}` : `replies/${rId}`);
  try {
    const existing = await get(upRef);
    if (existing.exists()) {
      await remove(upRef);
      await update(targetRef, { upvotes_count: increment(-1) });
      return { upvoted: false, error: null };
    }
    await set(upRef, {
      user_id: user.uid,
      thread_id: tId || null,
      reply_id: rId || null,
      created_at: serverTimestamp(),
    });
    await update(targetRef, { upvotes_count: increment(1) });
    return { upvoted: true, error: null };
  } catch (err: any) {
    return { upvoted: false, error: err?.message || 'Failed to update vote.' };
  }
}

/* ------------------------------------------------------------------ */
/* Realtime subscriptions                                              */
/* ------------------------------------------------------------------ */

export function subscribeThreads(cb: (threads: Thread[]) => void): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb([]);
    return () => {};
  }
  return onValue(ref(getDb(), 'threads'), (snap) => {
    const threads = snapshotToThreads(snap);
    threads.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    cb(threads);
  });
}

export function subscribeReplies(threadId: string, cb: (replies: Reply[]) => void): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb([]);
    return () => {};
  }
  const q = query(ref(getDb(), 'replies'), orderByChild('thread_id'), equalTo(threadId));
  return onValue(q, (snap) => {
    const replies = snapshotToReplies(snap);
    replies.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    cb(replies);
  });
}

/* ------------------------------------------------------------------ */
/* Admin metrics                                                       */
/* ------------------------------------------------------------------ */

export interface Metrics {
  users: number;
  threads: number;
  replies: number;
}

export async function getMetrics(): Promise<Metrics> {
  if (!isFirestoreAvailable()) return { users: 0, threads: 0, replies: 0 };
  try {
    const [users, threads, replies] = await Promise.all([
      get(ref(getDb(), 'profiles')),
      get(ref(getDb(), 'threads')),
      get(ref(getDb(), 'replies')),
    ]);
    return {
      users: users.size,
      threads: threads.size,
      replies: replies.size,
    };
  } catch {
    return { users: 0, threads: 0, replies: 0 };
  }
}

/** Fires whenever a profiles/threads/replies node changes (replaces postgres_changes). */
export function subscribeMetrics(cb: (m: Metrics) => void): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb({ users: 0, threads: 0, replies: 0 });
    return () => {};
  }
  const d = getDb();
  let threadSnap: DataSnapshot | null = null;
  let replySnap: DataSnapshot | null = null;
  let profileSnap: DataSnapshot | null = null;
  const push = () => {
    if (!threadSnap || !replySnap || !profileSnap) return;
    cb({
      threads: threadSnap.size,
      replies: replySnap.size,
      users: profileSnap.size,
    });
  };
  const unsubThreads = onValue(ref(d, 'threads'), (snap) => {
    threadSnap = snap;
    push();
  });
  const unsubReplies = onValue(ref(d, 'replies'), (snap) => {
    replySnap = snap;
    push();
  });
  const unsubProfiles = onValue(ref(d, 'profiles'), (snap) => {
    profileSnap = snap;
    push();
  });
  return () => {
    unsubThreads();
    unsubReplies();
    unsubProfiles();
  };
}