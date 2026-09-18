import React, { useState, useEffect } from 'react';
import { GitBranch, Wifi, WifiOff, Clock } from 'lucide-react';

export default function Statusbar() {
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div
      style={{
        height: 40,
        minHeight: 40,
        background: '#007acc',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        fontSize: 12,
        fontFamily: 'Segoe UI, sans-serif',
        justifyContent: 'space-between',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <GitBranch size={12} />
          main
        </span>
        <span>
          {isOnline ? (
            <Wifi size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          ) : (
            <WifiOff size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          )}
          {isOnline ? 'Online' : 'Offline'}
        </span>
        <span>{formattedTime}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>0 files</span>
        <span style={{ opacity: 0.9 }}>Synced</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} />
          {formattedTime}
        </span>
      </div>
    </div>
  );
}
