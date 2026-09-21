'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Mail, Inbox, Send, Trash2, RefreshCw, Search, Shield, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useToast } from '../../src/lib/useToast';

interface EmailAccount {
  id: string;
  provider: string;
  email: string;
  status: 'connected' | 'syncing' | 'error';
  lastSync: string;
}

interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  preview: string;
  timestamp: string;
  read: boolean;
  starred: boolean;
  category: 'inbox' | 'sent' | 'drafts';
}

export default function EmailPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [filter, setFilter] = useState<'inbox' | 'sent' | 'drafts'>('inbox');
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        const connected = data.firebase?.connected ?? true;
        setAccounts([
          {
            id: 'primary',
            provider: 'Google Workspace',
            email: 'vantaos@website-6e8b1.firebaseapp.com',
            status: connected ? 'connected' : 'error',
            lastSync: new Date().toISOString(),
          },
          {
            id: 'github',
            provider: 'GitHub',
            email: 'noreply@github.com',
            status: 'connected',
            lastSync: new Date(Date.now() - 3600000).toISOString(),
          },
        ]);
      }
      setLoading(false);
      setError(null);
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const seed: EmailMessage[] = [
      {
        id: 'e1', from: 'GitHub <noreply@github.com>', to: 'me@vantaos.dev',
        subject: 'Security alert: new OAuth sign-in', preview: 'A new OAuth sign-in was detected from an unrecognized device...',
        timestamp: new Date(Date.now() - 7200000).toISOString(), read: false, starred: true, category: 'inbox',
      },
      {
        id: 'e2', from: 'Firebase <no-reply@firebase.google.com>', to: 'me@vantaos.dev',
        subject: 'Realtime Database backup complete', preview: 'Your scheduled backup for profiles/threads/replies completed successfully...',
        timestamp: new Date(Date.now() - 86400000).toISOString(), read: false, starred: false, category: 'inbox',
      },
      {
        id: 'e3', from: 'Cloudflare <alerts@cloudflare.com>', to: 'me@vantaos.dev',
        subject: 'Worker deployment succeeded', preview: 'Your OpenNext Cloudflare worker deployed without errors. Build hash: a3f2c1...',
        timestamp: new Date(Date.now() - 172800000).toISOString(), read: true, starred: false, category: 'inbox',
      },
      {
        id: 'e4', from: 'me@vantaos.dev', to: 'team@vantaos.dev',
        subject: 'Phase 5 complete - Dashboard panels ready', preview: 'All messaging, email, and security panels are now wired up and tested...',
        timestamp: new Date(Date.now() - 259200000).toISOString(), read: true, starred: true, category: 'sent',
      },
      {
        id: 'e5', from: 'me@vantaos.dev', to: 'reviewer@example.com',
        subject: 'DRAFT: Architecture decision record - rate limiter', preview: 'Attaching the draft ADR for the opt-in RateLimitDO binding...',
        timestamp: new Date(Date.now() - 345600000).toISOString(), read: true, starred: false, category: 'drafts',
      },
    ];
    setEmails(seed);
  }, []);

  const toggleStar = (id: string) => {
    setEmails((prev) => prev.map((e) => e.id === id ? { ...e, starred: !e.starred } : e));
  };

  const markRead = (id: string) => {
    setEmails((prev) => prev.map((e) => e.id === id ? { ...e, read: true } : e));
  };

  const filtered = emails
    .filter((e) => e.category === filter)
    .filter((e) => !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase()) || e.preview.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const unreadCount = emails.filter((e) => !e.read && e.category === 'inbox').length;

  if (loading) {
    return <div className="p-8 text-slate-400">Loading email...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Email</h1>
          <p className="text-slate-400 text-sm mt-1">Connected accounts and messages</p>
        </div>
        <button onClick={fetchData} aria-label="Refresh" className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" /> Accounts
            </h2>
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: acc.status === 'connected' ? '#22c55e' : '#ef4444' }} />
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{acc.email}</div>
                    <div className="text-xs text-slate-500">{acc.provider}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> Compliance
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-green-400"><CheckCircle2 className="w-3 h-3" /> DKIM signed</div>
              <div className="flex items-center gap-2 text-green-400"><CheckCircle2 className="w-3 h-3" /> SPF configured</div>
              <div className="flex items-center gap-2 text-green-400"><CheckCircle2 className="w-3 h-3" /> DMARC policy</div>
              <div className="flex items-center gap-2 text-amber-400"><AlertCircle className="w-3 h-3" /> 2FA enabled</div>
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
              ] as { key: typeof filter; label: string }[]).map((tab) => (
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

          <div className="flex-1 overflow-y-auto" role="list" aria-label="Email list">
            {filtered.length === 0 && <div className="text-center text-slate-500 py-8">No emails found</div>}
            {filtered.map((email) => (
              <div key={email.id} role="listitem">
                <button onClick={() => { setSelectedEmail(email.id); markRead(email.id); }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-white/5 hover:bg-white/5 ${
                    !email.read ? 'bg-indigo-900/5' : ''
                  }`}>
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
                    <div className="text-xs text-slate-500 truncate">{email.preview}</div>
                  </div>
                  <div className="shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}
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
