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
 *   mailboxes/{uid}/messages/{msgId}      per-user email mailbox
 *   presence/{deviceId}                   online presence for peer discovery
 *   dms/{uid}/inbox/{oppUid}/{msgId}      direct messages (dual-inbox copy)
 *   notifications/{uid}/{evtId}           per-user notification feed
 *
 * Every message/mail node is self-contained (recipient + sender denormalized)
 * so lists render without a join. Sends write one copy into the sender's
 * folder and one into the recipient's folder via the same key.
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
  onDisconnect,
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

/* ------------------------------------------------------------------ */
/* Mailbox                                                             */
/* ------------------------------------------------------------------ */

export type MailCategory = 'inbox' | 'sent' | 'drafts';

export interface MailMessage {
  id: string;
  from: string;
  from_uid: string;
  to: string;
  subject: string;
  content: string;
  category: MailCategory;
  read: boolean;
  starred: boolean;
  timestamp: string;
}

function snapshotToMail(snap: DataSnapshot): MailMessage[] {
  const messages: MailMessage[] = [];
  snap.forEach((child) => {
    const v = child.val() || {};
    const category: MailCategory =
      v.category === 'sent' || v.category === 'drafts' ? v.category : 'inbox';
    messages.push({
      id: child.key || '',
      from: v.from || '',
      from_uid: v.from_uid || '',
      to: v.to || '',
      subject: v.subject || '',
      content: v.content || '',
      category,
      read: v.read === true,
      starred: v.starred === true,
      timestamp: toIso(v.timestamp),
    });
  });
  return messages;
}

export function subscribeMailbox(
  uid: string,
  cb: (messages: MailMessage[]) => void
): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb([]);
    return () => {};
  }
  return onValue(ref(getDb(), `mailboxes/${uid}/messages`), (snap) => {
    const messages = snapshotToMail(snap);
    messages.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    cb(messages);
  });
}

export async function sendMail(input: {
  to_uid: string;
  to_address: string;
  subject: string;
  content: string;
}): Promise<{ id: string | null; error: string | null }> {
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !user) {
    return { id: null, error: 'Sign in to send mail. Realtime Database requires a configured Firebase project.' };
  }
  if (!input.to_uid) {
    return { id: null, error: 'A recipient is required.' };
  }
  const senderAddress = user.email || 'you@vantaos.local';
  const base = {
    from_uid: user.uid,
    to_uid: input.to_uid,
    subject: String(input.subject).slice(0, 300),
    content: String(input.content),
    timestamp: serverTimestamp(),
  };
  try {
    const mine = await push(ref(getDb(), `mailboxes/${user.uid}/messages`), {
      ...base,
      to: input.to_address,
      from: senderAddress,
      category: 'sent',
      read: true,
      starred: false,
    });
    const msgKey = mine.key ?? '';
    if (msgKey) {
      await set(
        ref(getDb(), `mailboxes/${input.to_uid}/messages/${msgKey}`),
        {
          ...base,
          to: input.to_address,
          from: senderAddress,
          category: 'inbox',
          read: false,
          starred: false,
        }
      );
    }
    return { id: msgKey || null, error: null };
  } catch (err: any) {
    return { id: null, error: err?.message || 'Failed to send mail.' };
  }
}

export async function saveDraftMail(input: {
  to_uid?: string;
  to_address?: string;
  subject?: string;
  content?: string;
  draftId?: string;
}): Promise<{ id: string | null; error: string | null }> {
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !user) {
    return { id: null, error: 'Drafts require a configured Firebase project.' };
  }
  const payload = {
    from: user.email || 'you@vantaos.local',
    from_uid: user.uid,
    to: input.to_address || '',
    to_uid: input.to_uid || '',
    subject: String(input.subject ?? '').slice(0, 300),
    content: String(input.content ?? ''),
    category: 'drafts',
    read: true,
    starred: false,
    timestamp: serverTimestamp(),
  };
  try {
    if (input.draftId) {
      await set(ref(getDb(), `mailboxes/${user.uid}/messages/${input.draftId}`), payload);
      return { id: input.draftId, error: null };
    }
    const childRef = await push(ref(getDb(), `mailboxes/${user.uid}/messages`), payload);
    return { id: childRef.key ?? null, error: null };
  } catch (err: any) {
    return { id: null, error: err?.message || 'Failed to save draft.' };
  }
}

export async function setMailRead(
  uid: string,
  messageId: string,
  read: boolean
): Promise<void> {
  if (!isFirestoreAvailable()) return;
  await update(ref(getDb(), `mailboxes/${uid}/messages/${messageId}`), { read });
}

export async function setMailStarred(
  uid: string,
  messageId: string,
  starred: boolean
): Promise<void> {
  if (!isFirestoreAvailable()) return;
  await update(ref(getDb(), `mailboxes/${uid}/messages/${messageId}`), { starred });
}

export async function deleteMail(uid: string, messageId: string): Promise<void> {
  if (!isFirestoreAvailable()) return;
  await remove(ref(getDb(), `mailboxes/${uid}/messages/${messageId}`));
}

/* ------------------------------------------------------------------ */
/* Presence — peer discovery                                           */
/* ------------------------------------------------------------------ */

export interface PresencePeer {
  deviceId: string;
  uid: string;
  email: string;
  label: string;
  address: string;
  protocol: string;
  online: boolean;
  lastSeen: string;
}

export function subscribePresence(
  omitUid: string,
  cb: (peers: PresencePeer[]) => void
): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb([]);
    return () => {};
  }
  return onValue(ref(getDb(), 'presence'), (snap) => {
    const peers: PresencePeer[] = [];
    snap.forEach((child) => {
      const v = child.val() || {};
      if (v.uid && v.uid !== omitUid) {
        peers.push({
          deviceId: child.key || '',
          uid: v.uid,
          email: v.email || '',
          label: v.label || '',
          address: v.address || '',
          protocol: v.protocol || '',
          online: v.online !== false,
          lastSeen: toIso(v.lastSeen),
        });
      }
    });
    peers.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
    cb(peers);
  });
}

/** Announce this device and remove the record when the tab closes. */
export async function publishPresence(input: {
  label: string;
  address: string;
  protocol: string;
}): Promise<{ stop: () => void }> {
  const noop = { stop: () => {} };
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !user) return noop;
  const deviceId = crypto.randomUUID();
  const node = ref(getDb(), `presence/${deviceId}`);
  await set(node, {
    uid: user.uid,
    email: user.email || '',
    label: input.label,
    address: input.address,
    protocol: input.protocol,
    online: true,
    lastSeen: serverTimestamp(),
  });
  onDisconnect(node).remove();
  return {
    stop: () => {
      remove(node);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Direct messages — dual-inbox copy keyed by opponent                 */
/* ------------------------------------------------------------------ */

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  timestamp: string;
}

/** inbox keyed by opponent uid (the second identifier on the path). */
export function subscribeDirectInbox(
  uid: string,
  cb: (inbox: Record<string, DirectMessage[]>) => void
): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb({});
    return () => {};
  }
  return onValue(ref(getDb(), `dms/${uid}/inbox`), (snap) => {
    const inbox: Record<string, DirectMessage[]> = {};
    snap.forEach((opponent) => {
      const list: DirectMessage[] = [];
      opponent.forEach((child) => {
        const v = child.val() || {};
        list.push({
          id: child.key || '',
          sender_id: v.sender_id || '',
          recipient_id: v.recipient_id || v.sender_id || '',
          content: v.content || '',
          timestamp: toIso(v.timestamp),
        });
      });
      list.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
      inbox[opponent.key || ''] = list;
    });
    cb(inbox);
  });
}

export async function sendDirectMessage(input: {
  to_uid: string;
  content: string;
}): Promise<{ id: string | null; error: string | null }> {
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !user) {
    return { id: null, error: 'Sign in to message. Realtime Database requires a configured Firebase project.' };
  }
  if (!input.to_uid) {
    return { id: null, error: 'A recipient is required.' };
  }
  const payload = {
    sender_id: user.uid,
    recipient_id: input.to_uid,
    content: String(input.content).slice(0, 4000),
    timestamp: serverTimestamp(),
  };
  try {
    const mine = await push(ref(getDb(), `dms/${user.uid}/inbox/${input.to_uid}`), payload);
    const msgKey = mine.key ?? '';
    if (msgKey) {
      await set(
        ref(getDb(), `dms/${input.to_uid}/inbox/${user.uid}/${msgKey}`),
        payload
      );
    }
    return { id: msgKey || null, error: null };
  } catch (err: any) {
    return { id: null, error: err?.message || 'Failed to send message.' };
  }
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface AppNotification {
  id: string;
  message: string;
  type: string;
  source: string;
  timestamp: string;
}

export function subscribeNotifications(
  uid: string,
  cb: (items: AppNotification[]) => void
): Unsubscribe {
  if (!isFirestoreAvailable()) {
    cb([]);
    return () => {};
  }
  return onValue(ref(getDb(), `notifications/${uid}`), (snap) => {
    const items: AppNotification[] = [];
    snap.forEach((child) => {
      const v = child.val() || {};
      items.push({
        id: child.key || '',
        message: v.message || '',
        type: v.type || 'info',
        source: v.source || 'system',
        timestamp: toIso(v.timestamp),
      });
    });
    items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    cb(items);
  });
}

export async function pushNotification(
  uid: string,
  input: { message: string; type?: string; source?: string }
): Promise<{ id: string | null; error: string | null }> {
  const user = getCurrentFireUser();
  if (!isFirestoreAvailable() || !uid || !user) {
    return { id: null, error: 'Notifications require a configured Firebase project.' };
  }
  if (uid !== user.uid) {
    return { id: null, error: 'Cannot notify another user.' };
  }
  try {
    const childRef = await push(ref(getDb(), `notifications/${uid}`), {
      message: String(input.message).slice(0, 500),
      type: input.type || 'info',
      source: input.source || 'system',
      timestamp: serverTimestamp(),
    });
    return { id: childRef.key ?? null, error: null };
  } catch (err: any) {
    return { id: null, error: err?.message || 'Failed to save notification.' };
  }
}

export async function clearNotifications(uid: string): Promise<void> {
  if (!isFirestoreAvailable()) return;
  await remove(ref(getDb(), `notifications/${uid}`));
}