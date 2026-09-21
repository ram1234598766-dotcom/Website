'use client';

import { useEventToast } from '../lib/useEventToast';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-green-900/60 border-green-700/50 text-green-200',
  error: 'bg-red-900/60 border-red-700/50 text-red-200',
  info: 'bg-indigo-900/60 border-indigo-700/50 text-indigo-200',
  warning: 'bg-yellow-900/60 border-yellow-700/50 text-yellow-200',
};

export default function ToastBar() {
  const { toasts, dismiss } = useEventToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm min-w-[280px] max-w-[420px] ${colors[toast.type]}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm flex-1">{toast.message}</span>
              <span className="text-xs opacity-60 shrink-0">{toast.source}</span>
              <button onClick={() => dismiss(toast.id)} className="shrink-0 p-0.5 hover:opacity-100 opacity-70" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
