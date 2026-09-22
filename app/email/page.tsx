'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Mail, Inbox, Send, Save, Trash2, Search, Shield, CheckCircle2, Plus,
} from 'lucide-react';
import { useToast } from '../../src/lib/useToast';
import {
  subscribeMailbox,
  sendMail,
  saveDraftMail,
  setMailRead,
  setMailStarred,
  deleteMail,
  isFirestoreAvailable,
  type MailMessage,
} from '../../src/lib/firestore';
import { onFireAuthStateChanged, type FirebaseUser } from '../../src/lib/firebase';

interface ComposeState {
  to_uid: string;
  to_address: string;
  subject: string;
  content: string;
}

const EMPTY_COMPOSE: ComposeState = { to_uid: '', to_address: '', subject: '', content: '' };

type Filter = 'inbox' | 'sent' | 'drafts';

export default function EmailPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const configured = isFirestoreAvailable();
  const [emails, setEmails] = useState<MailMessage[]>([]);
  const [filter, setFilter] = useState<Filter>('inbox');
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(EMPTY_COMPOSE);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    if (!configured) return;
    return onFireAuthStateChanged((u) => setUser(u));
  }, [configured]);

  useEffect(() => {
    if (!user) {
      setEmails([]);
      return;
    }
    return subscribeMailbox(user.uid, (messages) => {
      setEmails(messages);
      setError(null);
    });
  }, [user]);

  const openEmail = useCallback(
    (email: MailMessage) => {
      setSelectedEmail(email.id);
      if (user && !email.read) {
        setMailRead(user.uid, email.id, true).catch((e: Error) =>
          setError(e?.message || 'Failed to mark read.')
        );
      }
    },
    [user]
  );

  const toggleStar = useCallback(
    (email: MailMessage) => {
      if (!user) return;
      setMailStarred(user.uid, email.id, !email.starred).catch((e: Error) =>
        setError(e?.message || 'Failed to update star.')
      );
    },
    [user]
  );

  const removeMail = useCallback(
    (email: MailMessage) => {
      if (!user) return;
      deleteMail(user.uid, email.id)
        .then(() => show('Email deleted', 'success', 3000))
        .catch((e: Error) => setError(e?.message || 'Failed to delete email.'));
    },
    [user, show]
  );

  const handleSend = async () => {
    if (!user) return;
    if (!compose.to_uid.trim() || !compose.to_address.trim()) {
      setError('A recipient address and uid are required.');
      return;
    }
    setError(null);
    const res = await sendMail({
      to_uid: compose.to_uid.trim(),
      to_address: compose.to_address.trim(),
      subject: compose.subject.trim(),
      content: compose.content,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setCompose(EMPTY_COMPOSE);
    setComposing(false);

    // A persistent copy lands in the Realtime Database mailbox first — it is
    // the audit trail and the demo-mode fallback. External SMTP delivery is a
    // best-effort follow-up through /api/email/send; a failed relay never
    // un-sends the message, it just surfaces the state honestly to the user.
    let delivery: 'delivered' | 'skipped' | 'failed' = 'skipped';
    try {
      const firebaseToken = await user.getIdToken();
      const smtpRes = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseToken,
          to: compose.to_address.trim(),
          subject: compose.subject.trim(),
          content: compose.content,
        }),
      });
      const smtpBody = await smtpRes.json().catch(() => null);
      if (smtpRes.ok && smtpBody?.delivered === true) delivery = 'delivered';
      else if (smtpRes.ok && smtpBody?.skipped === true) delivery = 'skipped';
      else delivery = 'failed';
    } catch {
      delivery = 'failed';
    }

    if (delivery === 'delivered') {
      show('Mail sent via SMTP', 'success', 3000);
    } else if (delivery === 'skipped') {
      show('Mail saved to your mailbox', 'success', 3000);
    } else {
      setError('Saved to your mailbox, but external SMTP delivery failed.');
    }
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    setError(null);
    const res = await saveDraftMail({
      to_uid: compose.to_uid.trim(),
      to_address: compose.to_address.trim(),
      subject: compose.subject,
      content: compose.content,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setCompose(EMPTY_COMPOSE);
    setComposing(false);
    show('Draft saved', 'success', 3000);
  };

  const filtered = emails
    .filter((e) => e.category === filter)
    .filter(
      (e) =>
        !search ||
        e.subject.toLowerCase().includes(search.toLowerCase()) ||
        e.from.toLowerCase().includes(search.toLowerCase()) ||
        e.to.toLowerCase().includes(search.toLowerCase()) ||
        e.content.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const unreadCount = emails.filter((e) => !e.read && e.category === 'inbox').length;

  const storageLabel = configured
    ? `Realtime Database · ${user ? (user.email || user.uid) : 'signed out'}`
    : 'Demo mode · local only';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Email</h1>
          <p className="text-slate-400 text-sm mt-1">Per-user mailbox in the Realtime Database, relayed via SMTP when configured</p>
        </div>
        <div className="flex items-center gap-2">
          {configured && user && (
            <button onClick={() => { setComposing(true); setCompose(EMPTY_COMPOSE); }}
              aria-label="Compose new email"
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Compose
            </button>
          )}
          <button onClick={() => { setSearch(''); setSelectedEmail(null); }} aria-label="Refresh"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
            <Mail className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!configured && (
        <div role="status" className="mb-4 rounded-lg bg-amber-900/20 border border-amber-800/40 p-4 text-amber-200 text-sm">
          Running in demo mode. Configure a cloud account to use the live per-user mailbox.
        </div>
      )}
      {configured && !user && (
        <div role="status" className="mb-4 rounded-lg bg-indigo-900/20 border border-indigo-800/40 p-4 text-indigo-200 text-sm">
          Sign in to load your mailbox.
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" /> Account
            </h2>
            {configured && user ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                <div className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{user.email || user.uid}</div>
                  <div className="text-xs text-slate-500">Cloud · {user.uid.slice(0, 8)}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No live account connected.</p>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-green-400" /> {storageLabel}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-white/10 bg-white/5 flex flex-col">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search emails..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  aria-label="Search emails" />
              </div>
            </div>
            <div className="flex gap-1">
              {([
                { key: 'inbox', label: 'Inbox' },
                { key: 'sent', label: 'Sent' },
                { key: 'drafts', label: 'Drafts' },
              ] as { key: Filter; label: string }[]).map((tab) => (
                <button key={tab.key} onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    filter === tab.key ? 'bg-indigo-900/40 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  aria-pressed={filter === tab.key}>
                  {tab.label} {tab.key === 'inbox' && unreadCount > 0 && <span className="ml-1 text-xs bg-red-500/30 text-red-300 px-1.5 rounded-full">{unreadCount}</span>}
                </button>
              ))}
            </div>
          </div>

          {composing && user && (
            <div className="p-4 border-b border-white/10 space-y-3" aria-label="Compose email">
              <input type="text" value={compose.to_address} onChange={(e) => setCompose({ ...compose, to_address: e.target.value })}
                placeholder="Recipient address"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                aria-label="Recipient address" />
              <input type="text" value={compose.to_uid} onChange={(e) => setCompose({ ...compose, to_uid: e.target.value })}
                placeholder="Recipient uid"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                aria-label="Recipient uid" />
              <input type="text" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                placeholder="Subject"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                aria-label="Subject" />
              <textarea value={compose.content} onChange={(e) => setCompose({ ...compose, content: e.target.value })}
                placeholder="Message"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-y"
                aria-label="Message" />
              <div className="flex items-center gap-2">
                <button onClick={handleSend} disabled={!compose.content.trim()}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                  aria-label="Send email">
                  <Send className="w-4 h-4" /> Send
                </button>
                <button onClick={handleSaveDraft}
                  className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 flex items-center gap-1"
                  aria-label="Save draft">
                  <Save className="w-4 h-4" /> Save draft
                </button>
                <button onClick={() => setComposing(false)}
                  className="px-3 py-1.5 text-slate-400 rounded-lg text-sm hover:text-white"
                  aria-label="Cancel compose">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto" role="list" aria-label="Email list">
            {filtered.length === 0 && <div className="text-center text-slate-500 py-8">No emails found</div>}
            {filtered.map((email) => (
              <div key={email.id} className="flex items-center gap-2 px-2">
                <button onClick={() => removeMail(email)} aria-label="Delete email"
                  className="p-2 text-slate-600 hover:text-red-400 hover:bg-white/5 rounded-lg shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEmail(email)}
                  className={`w-full flex items-start gap-3 px-2 py-3 text-left transition-colors border-b border-white/5 hover:bg-white/5 ${
                    !email.read ? 'bg-indigo-900/5' : ''
                  }`}
                  aria-expanded={selectedEmail === email.id}>
                  <div className="mt-0.5 shrink-0">
                    <Mail className={`w-4 h-4 ${!email.read ? 'text-indigo-400' : 'text-slate-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">
                        {email.category === 'inbox' ? email.from : email.to}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">
                        {new Date(email.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm text-white truncate">{email.subject}</div>
                    <div className="text-xs text-slate-500 truncate">{email.content}</div>
                  </div>
                  <div className="shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(email); }}
                      aria-label={email.starred ? 'Unstar' : 'Star'}
                      className="text-lg leading-none">
                      {email.starred ? '\u2605' : '\u2606'}
                    </button>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}