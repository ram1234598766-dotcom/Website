'use client';

import dynamic from 'next/dynamic';

const VantaApp = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#07070b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        zIndex: 9999,
      }}
    >
      <div
        style={{ position: 'relative', width: 80, height: 80 }}
        aria-hidden
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '2px solid transparent',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1.2s cubic-bezier(0.5,0,0.5,1) infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 10,
            border: '2px solid transparent',
            borderRightColor: '#818cf8',
            borderRadius: '50%',
            animation: 'spin 1.8s cubic-bezier(0.5,0,0.5,1) infinite reverse',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 20,
            border: '2px solid transparent',
            borderBottomColor: '#a5b4fc',
            borderRadius: '50%',
            animation: 'spin 2.4s cubic-bezier(0.5,0,0.5,1) infinite',
          }}
        />
      </div>
      <div
        style={{
          color: '#818cf8',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 900,
          letterSpacing: 6,
          fontSize: 14,
        }}
      >
        VANTA.OS
      </div>
    </div>
  ),
});

export default function Page() {
  return <VantaApp />;
}
