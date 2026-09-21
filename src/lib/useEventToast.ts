'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

export interface EventToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  source: string;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface EventNotifierState {
  toasts: EventToast[];
  lastSync: string | null;
  eventCount: number;
}

/**
 * Event-driven notification system. Listens for cross-module events
 * (terminal-send, terminal-ready, save-active-file, vantaos:*) and
 * surfaces them as contextual toasts with real event data.
 */
export function useEventToast() {
  const [state, setState] = useState<EventNotifierState>({
    toasts: [],
    lastSync: null,
    eventCount: 0,
  });
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    setState((prev) => ({ ...prev, toasts: prev.toasts.filter((t) => t.id !== id) }));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const addToast = useCallback((message: string, type: EventToast['type'], source: string): string => {
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const toast: EventToast = { id, message, type, source };
    setState((prev) => ({
      ...prev,
      toasts: [...prev.toasts.slice(-4), toast],
      eventCount: prev.eventCount + 1,
    }));
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, toasts: prev.toasts.filter((t) => t.id !== id) }));
      timersRef.current.delete(id);
    }, 4000);
    timersRef.current.set(id, timer);

    void (async () => {
      try {
        const [{ getCurrentFireUser }, { pushNotification }] = await Promise.all([
          import('./firebase'),
          import('./firestore'),
        ]);
        const user = getCurrentFireUser();
        if (!user) return;
        await pushNotification(user.uid, { message, type, source });
      } catch { /* persistence is best-effort */ }
    })();

    return id;
  }, []);

  useEffect(() => {
    const handlers: Array<{ event: string; source: string; type: EventToast['type']; msg: (detail: any) => string }> = [
      { event: 'terminal-ready', source: 'Terminal', type: 'success', msg: () => 'Terminal ready' },
      { event: 'save-active-file', source: 'Editor', type: 'info', msg: () => 'File saved' },
      { event: 'terminal-send', source: 'Terminal', type: 'info', msg: (d: any) => `Command dispatched: ${String(d?.detail ?? '').slice(0, 60)}` },
      { event: 'vantaos:open-plugins', source: 'Plugin Manager', type: 'info', msg: () => 'Plugin manager opened' },
    ];

    const cleanups = handlers.map(({ event, source, type, msg }) => {
      const handler = (e: Event) => {
        addToast(msg((e as CustomEvent).detail), type, source);
      };
      window.addEventListener(event, handler);
      return () => window.removeEventListener(event, handler);
    });

    // Listen for sync events from peer/sync modules
    const syncHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'sync-complete') {
        addToast(`Sync complete: ${detail.files ?? 0} files synced`, 'success', 'Sync');
        setState((prev) => ({ ...prev, lastSync: new Date().toISOString() }));
      }
      if (detail?.type === 'sync-conflict') {
        addToast(`Sync conflict: ${detail.path ?? 'unknown'}`, 'warning', 'Sync');
      }
      if (detail?.type === 'transfer-complete') {
        addToast(`Transfer complete: ${detail.name ?? 'file'}`, 'success', 'Transfer');
      }
    };
    window.addEventListener('vantaos:sync-event', syncHandler);
    cleanups.push(() => window.removeEventListener('vantaos:sync-event', syncHandler));

    // Keyboard event tracker
    const keyHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        addToast('Save shortcut pressed', 'info', 'Keyboard');
      }
    };
    window.addEventListener('keydown', keyHandler);
    cleanups.push(() => window.removeEventListener('keydown', keyHandler));

    return () => cleanups.forEach((fn) => fn());
  }, [addToast]);

  return {
    toasts: state.toasts,
    eventCount: state.eventCount,
    lastSync: state.lastSync,
    dismiss,
    addToast,
  };
}
