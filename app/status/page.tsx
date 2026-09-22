'use client';

import { useEffect, useState } from 'react';

interface StatusData {
  status: string;
  version: string;
  timestamp: string;
  mode: string;
  services: Record<string, string>;
  tips: string[];
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
    const interval = setInterval(() => {
      fetch('/api/status')
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' }}>
        <h1>Status</h1>
        <p style={{ color: '#ef4444' }}>Error loading status: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' }}>
        <h1>Status</h1>
        <p>Loading...</p>
      </div>
    );
  }

  const serviceColors: Record<string, string> = {
    available: '#22c55e',
    configured: '#22c55e',
    connected: '#22c55e',
    cloud: '#22c55e',
    browser: '#22c55e',
    disabled: '#94a3b8',
  };

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <h1>VantaOS Status</h1>
      <p style={{ color: '#64748b' }}>{data.status === 'ok' ? '✓ All systems operational' : '⚠ Issue detected'} — v{data.version}</p>
      <p style={{ fontSize: 14, color: '#94a3b8' }}>{new Date(data.timestamp).toLocaleString()}</p>
      <p style={{ marginTop: 16 }}>
        Mode: <strong>{data.mode === 'connected' ? '🔗 Connected (cloud)' : '💻 Demo (local)'}</strong>
      </p>

      <h2 style={{ marginTop: 32, fontSize: 18 }}>Services</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <tbody>
          {Object.entries(data.services).map(([name, state]) => (
            <tr key={name} style={{ borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '8px 0', textTransform: 'capitalize' }}>{name}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: serviceColors[state] || '#94a3b8',
                  marginRight: 8,
                }} />
                {state}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.tips.length > 0 && (
        <>
          <h2 style={{ marginTop: 32, fontSize: 18 }}>Quick tips</h2>
          <ul style={{ marginTop: 8, lineHeight: 2 }}>
            {data.tips.map((tip) => (
              <li key={tip} style={{ color: '#94a3b8' }}>{tip}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
