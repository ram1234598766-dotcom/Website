'use client';

import { useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastIdCounter = 0;
function genId(): string {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
}

interface UseToastReturn {
  toasts: Toast[];
  show: (message: string, type?: ToastType, duration?: number) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000): string => {
      const id = genId();
      const toast: Toast = { id, message, type, duration };
      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          timersRef.current.delete(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    []
  );

  const dismissAll = useCallback(() => {
    setToasts([]);
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  return { toasts, show, dismiss, dismissAll };
}
