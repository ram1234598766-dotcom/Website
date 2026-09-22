'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, CheckCircle2, XCircle, Info, AlertTriangle, Trash2, Plus, Shield,
} from 'lucide-react';
import { useToast } from '../../src/lib/useToast';
import type { ToastType } from '../../src/lib/useToast';
import {
  subscribeNotifications,
  clearNotifications,
  isFirestoreAvailable,
  type AppNotification,
} from '../../src/lib/firestore';
import { onFireAuthStateChanged, type FirebaseUser } from '../../src/lib/firebase';

const typeIcons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const typeColors: Record<ToastType, string> = {
  success: 'bg-green-900/30 border-green-800/50 text-green-300',
  error: 'bg-red-900/30 border-red-800/50 text-red-300',
  info: 'bg-indigo-900/30 border-indigo-800/50 text-indigo-300',
  warning: 'bg-yellow-900/30 border-yellow-800/50 text-yellow-300',
};

function isToastType(t: string): t is ToastType {
  return t === 'success' || t === 'error' || t === 'info' || t === 'warning';
}

export default function NotificationsPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const configured = isFirestoreAvailable();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<ToastType | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    if (!configured) return;
    return onFireAuthStateChanged((u) => setUser(u));
  }, [configured]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    return subscribeNotifications(user.uid, (list) => {
      setItems(list);
      setError(null);
    });
  }, [user]);

  const pushTest = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const { pushNotification } = await import('../../src/lib/firestore');
      const res = await pushNotification(user.uid, {
        message: `Test notification from the Notifications panel at ${new Date().toLocaleTimeString()}`,
        type: 'info',
        source: 'Notifications',
      });
      if (res.error) setError(res.error);
      else show('Notification published', 'success', 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setBusy(false);
    }
  };

  const clearFeed = async () => {
    if (!user) return;
    setError(null);
    try {
      await clearNotifications(user.uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear');
    }
  };

  const filtered = items.filter((n) =>
    filter === 'all' ? true : isToastType(n.type) && n.type === filter);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          <p className="text-slate-400 text-sm mt-1">
            Live activity feed from the Realtime Database
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Shield className="w-3.5 h-3.5" />
          {configured ? (user ? 'Connected' : 'Signed out') : 'Demo mode'}
        </div>
      </div>

      {!configured && (
        <div role="status" className="mb-4 rounded-lg bg-amber-900/20 border border-amber-800/40 p-4 text-amber-200 text-sm">
          Running in demo mode. Configure a cloud account to persist a personal notification feed.
        </div>
      )}
      {configured && !user && (
        <div role="status" className="mb-4 rounded-lg bg-indigo-900/20 border border-indigo-800/40 p-4 text-indigo-200 text-sm">
          Sign in to view and manage your notification feed.
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          Error: {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {(['all', 'success', 'error', 'info', 'warning'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs border ${
                filter === f
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pushTest}
            disabled={!user || busy}
            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Publish test
          </button>
          <button
            onClick={clearFeed}
            disabled={!user || items.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear feed
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">Feed ({items.length})</span>
        </div>
        <div className="p-3">
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No notifications yet</p>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence>
                {filtered.map((n) => {
                  const type = isToastType(n.type) ? n.type : 'info';
                  const Icon = typeIcons[type];
                  return (
                    <motion.li
                      key={n.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${typeColors[type]}`}
                    >
                      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm break-words">{n.message}</p>
                        <p className="text-xs opacity-60 mt-1 font-mono">
                          {n.source} · {new Date(n.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}