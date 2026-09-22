'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Settings, Palette, Terminal, User, Bell,
  Save, RotateCcw, CheckCircle2, Globe,
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal' | 'account' | 'notifications'>('editor');
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    theme: 'vs-dark', fontSize: 14, tabSize: 2, wordWrap: true,
    autoSave: true, autoSaveDelay: 800, terminalTheme: 'base16-dark',
    terminalFontSize: 12, shell: 'powershell', notifications: true,
    notificationSound: false, showInlineHints: true, editorSmoothCaretAnimation: true,
  });

  const themes = ['vs-dark', 'vs-light', 'one-dark', 'nord', 'dracula', 'monokai'];
  const shells = ['powershell', 'cmd', 'bash', 'zsh', 'fish'];

  useEffect(() => {
    try {
      const s = localStorage.getItem('vantaos-settings');
      if (s) setSettings(JSON.parse(s));
    } catch { /* ignore */ }
  }, []);

  const handleSave = useCallback(() => {
    localStorage.setItem('vantaos-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings]);

  const handleReset = useCallback(() => {
    setSettings({
      theme: 'vs-dark', fontSize: 14, tabSize: 2, wordWrap: true,
      autoSave: true, autoSaveDelay: 800, terminalTheme: 'base16-dark',
      terminalFontSize: 12, shell: 'powershell', notifications: true,
      notificationSound: false, showInlineHints: true, editorSmoothCaretAnimation: true,
    });
  }, []);

  const update = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-400" /> Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure your VantaOS environment</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 overflow-x-auto">
        {[
          { id: 'editor', label: 'Editor', icon: Palette },
          { id: 'terminal', label: 'Terminal', icon: Terminal },
          { id: 'account', label: 'Account', icon: User },
          { id: 'notifications', label: 'Notifications', icon: Bell },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap ${
              activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'editor' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4" /> Appearance
            </h3>
            {[
              { label: 'Theme', key: 'theme', type: 'select' as const, options: themes },
              { label: 'Font Size', key: 'fontSize', type: 'number' as const },
              { label: 'Tab Size', key: 'tabSize', type: 'number' as const },
              { label: 'Word Wrap', key: 'wordWrap', type: 'toggle' as const },
              { label: 'Smooth Caret Animation', key: 'editorSmoothCaretAnimation', type: 'toggle' as const },
              { label: 'Inline Hints', key: 'showInlineHints', type: 'toggle' as const },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-300">{item.label}</span>
                {item.type === 'select' ? (
                  <select
                    value={settings[item.key as keyof typeof settings] as string}
                    onChange={(e) => update(item.key as any, e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-2 py-1 outline-none focus:border-indigo-500"
                  >
                    {item.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : item.type === 'number' ? (
                  <input
                    type="number"
                    value={settings[item.key as keyof typeof settings] as number}
                    onChange={(e) => update(item.key as any, parseInt(e.target.value) || 0)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-2 py-1 w-20 outline-none focus:border-indigo-500"
                  />
                ) : (
                  <Toggle checked={settings[item.key as keyof typeof settings] as boolean} onChange={() => update(item.key as any, !settings[item.key as keyof typeof settings])} />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'terminal' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Terminal
            </h3>
            {[
              { label: 'Theme', key: 'terminalTheme', type: 'select' as const, options: ['base16-dark', 'base16-light', 'one-dark', 'nord', 'monokai'] },
              { label: 'Font Size', key: 'terminalFontSize', type: 'number' as const },
              { label: 'Shell', key: 'shell', type: 'select' as const, options: shells },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-300">{item.label}</span>
                {item.type === 'select' ? (
                  <select
                    value={settings[item.key as keyof typeof settings] as string}
                    onChange={(e) => update(item.key as any, e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-2 py-1 outline-none focus:border-indigo-500"
                  >
                    {item.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type="number"
                    value={settings[item.key as keyof typeof settings] as number}
                    onChange={(e) => update(item.key as any, parseInt(e.target.value) || 0)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-2 py-1 w-20 outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {activeTab === 'account' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> Account
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-sm text-slate-300">Provider</span>
                <span className="text-sm text-slate-400 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Cloud account
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-sm text-slate-300">Mode</span>
                <span className="text-sm text-slate-400">Demo (local) / Connected (cloud)</span>
              </div>
              <button className="px-4 py-2 bg-red-900/30 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </h3>
            {[
              { label: 'Enable Notifications', key: 'notifications' },
              { label: 'Notification Sound', key: 'notificationSound' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-300">{item.label}</span>
                <Toggle
                  checked={settings[item.key as keyof typeof settings] as boolean}
                  onChange={() => update(item.key as any, !settings[item.key as keyof typeof settings])}
                />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="mt-6 flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
        <span className="text-slate-500 text-sm">Changes apply immediately and persist locally</span>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={handleSave} className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
