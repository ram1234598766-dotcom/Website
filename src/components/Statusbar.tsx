import React, { useState, useEffect, useMemo } from 'react';
import { GitBranch, Wifi, WifiOff, Clock, AlertCircle, ArrowLeftRight, ChevronDown } from 'lucide-react';

const StatusBarItem = React.memo(function StatusBarItem({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5">{children}</span>;
});

interface StatusbarProps {
  fileCount?: number;
  gitBranch?: string;
  gitChanged?: boolean;
  encoding?: string;
  cursorPos?: string;
  indentType?: 'spaces' | 'tabs';
  indentSize?: number;
}

const Statusbar = React.memo(function Statusbar({
  fileCount = 0,
  gitBranch = 'main',
  gitChanged = false,
  encoding = 'UTF-8',
  cursorPos = 'Ln 1, Col 1',
  indentType = 'spaces',
  indentSize = 2,
}: StatusbarProps) {
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

  const formattedTime = useMemo(
    () =>
      time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [time]
  );

  return (
    <div
      role="status"
      aria-label="Status bar"
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
        <StatusBarItem>
          <GitBranch size={12} aria-hidden />
          {gitBranch}
          {gitChanged && (
            <span className="inline-flex items-center justify-center ml-1 w-2 h-2 bg-white rounded-full" aria-label="Uncommitted changes" title="Uncommitted changes" />
          )}
        </StatusBarItem>
        <StatusBarItem>
          {isOnline ? (
            <Wifi size={12} aria-hidden style={{ marginRight: 4, verticalAlign: 'middle' }} />
          ) : (
            <WifiOff size={12} aria-hidden style={{ marginRight: 4, verticalAlign: 'middle' }} />
          )}
          {isOnline ? 'Online' : 'Offline'}
        </StatusBarItem>
        <StatusBarItem>{formattedTime}</StatusBarItem>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <StatusBarItem>
          {encoding}
        </StatusBarItem>
        <StatusBarItem>
          {cursorPos}
        </StatusBarItem>
        <StatusBarItem>
          <ArrowLeftRight size={12} aria-hidden />
          {indentType === 'spaces' ? `${indentSize} spaces` : 'Tab'}
        </StatusBarItem>
        <span>{fileCount} files</span>
        <span style={{ opacity: 0.9 }}>Synced</span>
        <StatusBarItem>
          <Clock size={12} aria-hidden />
          {formattedTime}
        </StatusBarItem>
      </div>
    </div>
  );
});

export default Statusbar;
