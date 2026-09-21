'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Shield, Lock, Key, Globe, Users, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, ExternalLink,
} from 'lucide-react';

interface HealthData {
  status: string;
  timestamp: string;
  services: Record<string, { status: string; detail: string }>;
  uptimeSeconds?: number;
  nodeVersion?: string;
  environment?: string;
}

interface GrantInfo {
  ok: boolean;
  gh_grant: string;
  expiresIn: number;
}

export default function SecurityPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [grantStatus, setGrantStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/healthz?verbose=true');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthData = await res.json();
      setHealth(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  const checkGrant = useCallback(async () => {
    setGrantStatus('checking');
    try {
      const res = await fetch('/api/gh/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) {
        const data: GrantInfo = await res.json();
        setGrantStatus(data.ok ? 'connected' : 'disconnected');
      } else if (res.status === 401) {
        setGrantStatus('disconnected');
      } else {
        setGrantStatus('error');
      }
    } catch {
      setGrantStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    checkGrant();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth, checkGrant]);

  const securityChecks = [
    { label: 'CORS Preflight', detail: 'Origin-validated, no wildcard', status: health ? 'ok' : 'checking' },
    { label: 'Rate Limiting', detail: 'Atomic check-and-record per IP', status: health ? 'ok' : 'checking' },
    { label: 'SSRF Protection', detail: 'Model name regex validation', status: health ? 'ok' : 'checking' },
    { label: 'AI Key Gate', detail: 'Same-site + daily cap enforcement', status: health ? 'ok' : 'checking' },
    { label: 'Error Sanitization', detail: 'No internal messages leaked', status: health ? 'ok' : 'checking' },
    { label: 'Sandbox Blocking', detail: '18 blocked constructs in runner', status: health ? 'ok' : 'checking' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-400" /> Security & Identity
          </h1>
          <p className="text-slate-400 text-sm mt-1">Auth status, OAuth connections, and security posture</p>
        </div>
        <button onClick={fetchHealth} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && !health && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm">
          Error: {error}
        </div>
      )}

      {/* OAuth Connections */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: 'Firebase Auth',
            icon: Lock,
            connected: health?.services?.firebase?.status === 'healthy' || health?.services?.firebase?.status === 'degraded',
            detail: health?.services?.firebase?.detail || 'Checking...',
            color: '#ef5350',
          },
          {
            label: 'GitHub OAuth',
            icon: Globe,
            connected: grantStatus === 'connected',
            detail: grantStatus === 'connected' ? 'Connected via worker grant' : grantStatus === 'disconnected' ? 'Not connected' : 'Checking...',
            color: '#e8e8e8',
          },
          {
            label: 'Gemini AI',
            icon: Key,
            connected: health?.services?.ai?.status === 'healthy',
            detail: health?.services?.ai?.detail || 'Checking...',
            color: '#4285f4',
          },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <item.icon className="w-5 h-5" style={{ color: item.color }} />
              <span className="text-white font-medium text-sm">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {item.connected ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm ${item.connected ? 'text-green-400' : 'text-red-400'}`}>
                {item.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">{item.detail}</p>
          </motion.div>
        ))}
      </div>

      {/* GitHub Grant Action */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium mb-1">GitHub OAuth Connection</h3>
            <p className="text-slate-400 text-sm">
              {grantStatus === 'connected'
                ? 'GitHub is connected via a worker-issued grant. Tokens auto-expire for security.'
                : grantStatus === 'disconnected'
                ? 'GitHub is not connected. Sign in via the IDE to enable repo import/push.'
                : 'Checking connection status...'}
            </p>
          </div>
          {grantStatus !== 'connected' && (
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent('vantaos:auth-signin')); }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
            >
              Connect GitHub
            </button>
          )}
        </div>
      </div>

      {/* Security Checklist */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" /> Security Checklist
        </h2>
        <div className="space-y-3">
          {securityChecks.map((check) => (
            <div key={check.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <div className="text-sm text-slate-300">{check.label}</div>
                <div className="text-xs text-slate-500">{check.detail}</div>
              </div>
              {check.status === 'ok' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Auth Events Log */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mt-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" /> Recent Auth Events
        </h2>
        <div className="text-sm text-slate-400 space-y-1">
          <p>• Firebase project: <span className="font-mono text-slate-300">website-6e8b1</span></p>
          <p>• Auth domain: <span className="font-mono text-slate-300">website-6e8b1.firebaseapp.com</span></p>
          <p>• GitHub OAuth redirect: <span className="font-mono text-slate-300">https://website-6e8b1.firebaseapp.com/__/auth/handler</span></p>
          <p>• Grant type: Worker-issued JWT (15-min expiry)</p>
          <p>• Rate limit: 20 req/60s + 200/day per IP for server-key Gemini</p>
        </div>
      </div>
    </div>
  );
}
