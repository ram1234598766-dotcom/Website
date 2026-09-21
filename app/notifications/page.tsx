'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, CheckCircle2, XCircle, Info, AlertTriangle,
  Terminal, Save, Keyboard, RefreshCw, Puzzle, Trash2, Filter,
} from 'lucide-react';
import { useEventToast, type EventToast } from '../../src/lib/useEventToast';
import type { ToastType } from '../../src/lib/useToast';

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

export default function NotificationsPage() {
  const { toasts, dismiss, eventCount, lastSync } = useEventToast();
  const [filter, setFilter] = useState<ToastType | 'all'>('all');
  const [history, setHistory] = useState<EventToast[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as EventToast;
      if (detail) {
        setHistory((prev) => [detail, ...prev].slice(0, 100));
      }
    };
    window.addEventListener('vantaos:toast', handler);
    return () => window.removeEventListener('vantaos:toast', handler);
  }, []);

  const allToasts = [...toasts, ...history];
  const filtered = filter === 'all' ? allToasts : allToasts.filter((t) => t.type === filter);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          <p className="text-slate-400 text-sm mt-1">
            Event-driven alerts and activity history
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm font-mono">
            {eventCount} events
          </span>
          {lastSync && (
            <span className="text-slate-500 text-xs">
              Last sync: {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Live toasts */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-400" /> Live Toasts ({toasts.length})
        </h2>
        {toasts.length === 0 ? (
          <p className="text-slate-500 text-sm">No active toasts — events will appear here</p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {toasts.map((toast) => {
                const Icon = typeIcons[toast.type];
                return (
                  <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${typeColors[toast.type]}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm flex-1">{toast.message}</span>
                    <span className="text-xs opacity-60 shrink-0 font-mono">{toast.source}</span>
                    <button
                      onClick={() => dismiss(toast.id)}
                      className="shrink-0 p-0.5 hover:opacity-100 opacity-70"
                      aria-label="Dismiss"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-400" /> History ({history.length})
          </h2>
          <button onClick={clearHistory} className="text-xs text-slate-500 hover:text-white">Clear</button>
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
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
        )}

        {filtered.length === 0 ? (
          <p className="text-slate-500 text-sm">No events yet</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((toast, i) => {
              const Icon = typeIcons[toast.type];
              return (
                <div
                  key={`${toast.id}-${i}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 hover:bg-white/5"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-sm text-slate-300 flex-1">{toast.message}</span>
                  <span className="text-xs text-slate-600 shrink-0 font-mono">{toast.source}</span>
                  <span className="text-xs text-slate-600 shrink-0">
                    {new Date(toast.id.split('-').slice(1).join('-')).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event sources */}
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Event Sources</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { icon: Terminal, label: 'Terminal', event: 'terminal-ready', desc: 'Shell ready, commands dispatched' },
            { icon: Save, label: 'Editor', event: 'save-active-file', desc: 'File save events' },
            { icon: Keyboard, label: 'Keyboard', event: 'keydown Ctrl+S', desc: 'Shortcut detection' },
            { icon: Puzzle, label: 'Plugins', event: 'vantaos:open-plugins', desc: 'Plugin manager access' },
            { icon: RefreshCw, label: 'Sync', event: 'vantaos:sync-event', desc: 'Peer sync events' },
          ].map((src) => (
            <div key={src.label} className="rounded-lg bg-white/3 p-3">
              <div className="flex items-center gap-2 mb-1">
                <src.icon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-medium text-white">{src.label}</span>
              </div>
              <code className="text-xs text-emerald-400 block mb-1">{src.event}</code>
              <p className="text-xs text-slate-500">{src.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
