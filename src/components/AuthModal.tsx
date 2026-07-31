import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import AuthForm from './AuthForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Move focus into the dialog when opened; restore it to the trigger on close.
  useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current = document.activeElement as HTMLElement;
      const firstInput = dialogRef.current?.querySelector<HTMLElement>('input');
      firstInput?.focus?.();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current.focus?.();
      restoreFocusRef.current = null;
    }
  }, [isOpen]);

  // Close on Escape; trap Tab focus within the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const container = dialogRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'button, input, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to VantaOS"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[#0a0a0c]/90 backdrop-blur-2xl rounded-3xl shadow-[0_8px_32px_rgba(79,70,229,0.2)] border border-white/10 overflow-hidden"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="max-h-[85vh] overflow-y-auto">
              <AuthForm initialMode={initialMode} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
