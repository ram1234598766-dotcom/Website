'use client';

import { useEffect, useState } from 'react';

type ToastState = 'idle' | 'available' | 'reloading';

export default function PWARegister() {
  const [toast, setToast] = useState<ToastState>('idle');

  const refresh = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const controller = navigator.serviceWorker.controller;

    const handleControllerChange = () => {
      setToast('available');
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const registerPromise = navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CHECK_FOR_UPDATES' });
        }
      })
      .catch((error) => {
        console.warn('[VantaOS] Service worker registration failed:', error);
      });

    return () => {
      registerPromise.catch(() => {});
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (toast !== 'available') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          background: '#0c0c12',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: 16,
          padding: '14px 18px',
          color: '#e6e9f0',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          maxWidth: 340,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: '#6366f1',
            boxShadow: '0 0 8px rgba(99, 102, 241, 0.6)',
            flexShrink: 0,
          }}
        />
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
          A new version of VantaOS is available.
        </div>
        <button
          onClick={async () => {
            await refresh();
            setToast('reloading');
          }}
          style={{
            background: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
