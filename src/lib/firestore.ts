/**
 * Cloud Firestore data layer for VantaOS.
 *
 * Forum threads, replies, and Admin metrics live in Cloud Firestore inside
 * the same Firebase project used for sign-in:
 *
 *   profiles/{uid}                        denormalized user profile
 *   threads/{id}                          forum threads
 *   replies/{id}                          forum replies
 *   upvotes/{uid}_{tid}_{rid}             deterministic id — dedupes votes
 *
 * Thread/reply docs carry denormalized author fields (author_username,
 * author_avatar_url), so lists render without an extra join.
 *
 * Every function is a safe no-op / empty-data fallback when no Firebase
 * project is configured (demo mode).
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  where,
  type Firestore,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseApp, getCurrentFireUser, isFirebaseConfigured } from './firebase';
import type { Thread, Reply } from '../types';

/** Firestore shares the Firebase project config — no extra env vars. */
export function isFirestoreAvailable(): boolean {
  return isFirebaseConfigured();
}

let db: Firestore | null = null;

function getFireStore(): Firestore {
  if (db) return db;
  db = getFirestore(getFirebaseApp());
  return db;
}

/* ------------------------------------------------------------------ */
/* Doc mapping (Firestore snake_case <-> types.ts)                     */
/* ------------------------------------------------------------------ */

function toIso(value: unknown): string {
  if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function mapThread(docData: DocumentData, id: string): Thread {
  return {
    id,
    title: docData.title || '',
    content: docData.content || '',
    author_id: docData.author_id || '',
    category: docData.category || 'General',
    created_at: toIso(docData.created_at ?? docData.createdAt),
    upvotes_count: docData.upvotes_count ?? docData.upvotesCount ?? 0,
    replies_count: docData.replies_count ?? docData.repliesCount ?? 0,
    author: {
      id: docData.author_id || '',
      username: docData.author_username || docData.author_display_name || 'Unknown',
      avatar_url: docData.author_avatar_url || undefined,
      created_at: '',
    },
  };
}

function mapReply(docData: DocumentData, id: string): Reply {
  return {
    id,
    thread_id: docData.thread_id || '',
    content: docData.content || '',
    author_id: docData.author_id || '',
    created_at: toIso(docData.created_at ?? docData.createdAt),
    upvotes_count: docData.upvotes_count ?? docData.upvotesCount ?? 0,
    author: {
      id: docData.author_id || '',
      username: docData.author_username || docData.author_display_name || 'Unknown',
      avatar_url: docData.author_avatar_url || undefined,
      created_at: '',
    },
  };
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
    await setDoc(
      doc(getFireStore(), 'profiles', user.uid),
      { username, avatar_url: user.photoURL || null, created_at: serverTimestamp() },
      { merge: true }
    );
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
    return { id: null, error: 'Sign in to create a thread. Firestore requires a configured Firebase project.' };
  }
  const username = user.displayName || (user.email ? user.email.split('@')[0] : 'Unknown');
  const db0 = getFireStore();
  try {
    await syncProfileForCurrentUser();
    const ref = await addDoc(collection(db0, 'threads'), {
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
    return { id: ref.id, error: null };
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
    return { id: null, error: 'Sign in to reply. Firestore requires a configured Firebase project.' };
  }
  const username = user.displayName || (user.email ? user.email.split('@')[0] : 'Unknown');
  const db0 = getFireStore();
  try {
    const ref = await addDoc(collection(db0, 'replies'), {
      thread_id: threadId,
      content,
      author_id: user.uid,
      author_username: username,
      author_avatar_url: null,
      created_at: serverTimestamp(),
      upvotes_count: 0,
    });
    await updateDoc(doc(db0, 'threads', threadId), { replies_count: increment(1) });
    return { id: ref.id, error: null };
  } catch (err: any) {
    return { id: null, error: err?.message || 'Failed to post reply.' };
  }
}

/* ------------------------------------------------------------------ */
/* Upvotes — deterministic doc id replaces the old 23505 dedupe         */
/* ------------------------------------------------------------------ */

export async function setUpvote(input: {
  threadId?: string;
  replyId?: string;
}): Promise<{ upvoted: boolean; error: string | null }> {
  const user = getCurrentFireUser();
  const tId = input.threadId || '';
  const rId = input.replyId || '';
  if (!isFirestoreAvailable() || !user) {
    return { upvoted: false, error: 'Sign in to upvote. Firestore requires a configured Firebase project.' };
  }
  if (!tId && !rId) {
    return { upvoted: false, error: 'A thread or reply is required.' };
  }
  const db0 = getFireStore();
  const upRef = doc(db0, `upvotes/${user.uid}_${tId || 'thread'}_${rId || 'reply'}`);
  const targetRef = tId ? doc(db0, 'threads', tId) : doc(db0, 'replies', rId);
  try {
    const existing = await getDoc(upRef);
    if (existing.exists()) {
      await deleteDoc(upRef);
      await updateDoc(targetRef, { upvotes_count: increment(-1) });
      return { upvoted: false, error: null };
    }
    await setDoc(upRef, {
      user_id: user.uid,
      thread_id: tId || null,
      reply_id: rId || null,
      created_at: serverTimestamp(),
    });
    await updateDoc(targetRef, { upvotes_count: increment(1) });
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
  const q = query(collection(getFireStore(), 'threads'), orderBy('created_at', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapThread(d.data(), d.id)));
  });
}

export function subscribeReplies(threadId: string, cb: (replies: Reply[]) => void): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(getFireStore(), 'replies'),
    where('thread_id', '==', threadId),
    orderBy('created_at', 'asc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => mapReply(d.data(), d.id)));
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
      getDocs(collection(getFireStore(), 'profiles')),
      getDocs(collection(getFireStore(), 'threads')),
      getDocs(collection(getFireStore(), 'replies')),
    ]);
    return { users: users.size, threads: threads.size, replies: replies.size };
  } catch {
    return { users: 0, threads: 0, replies: 0 };
  }
}

/** Fires whenever a profiles/threads/replies doc changes (replaces postgres_changes). */
export function subscribeMetrics(cb: (m: Metrics) => void): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb({ users: 0, threads: 0, replies: 0 });
    return () => {};
  }
  const db0 = getFireStore();
  let threadSnap: QuerySnapshot | null = null;
  let replySnap: QuerySnapshot | null = null;
  let profileSnap: QuerySnapshot | null = null;
  const push = () => {
    if (!threadSnap || !replySnap || !profileSnap) return;
    cb({ threads: threadSnap.size, replies: replySnap.size, users: profileSnap.size });
  };
  const unsubThreads = onSnapshot(collection(db0, 'threads'), (snap) => {
    threadSnap = snap;
    push();
  });
  const unsubReplies = onSnapshot(collection(db0, 'replies'), (snap) => {
    replySnap = snap;
    push();
  });
  const unsubProfiles = onSnapshot(collection(db0, 'profiles'), (snap) => {
    profileSnap = snap;
    push();
  });
  return () => {
    unsubThreads();
    unsubReplies();
    unsubProfiles();
  };
}