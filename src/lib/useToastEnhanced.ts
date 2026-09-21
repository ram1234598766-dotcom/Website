'use client';

import { useCallback } from 'react';
import { useEventToast } from './useEventToast';
import type { ToastType } from './useToast';

export function useEnhancedToast() {
  const { toasts, eventCount, lastSync, dismiss, addToast } = useEventToast();

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000): string => {
      return addToast(message, type, 'manual');
    },
    [addToast]
  );

  return { toasts, show, dismiss, eventCount, lastSync };
}
