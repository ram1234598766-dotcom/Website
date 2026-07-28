'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Settings, Key, Globe, Zap, Bot, Trash2 } from 'lucide-react';

type AIProvider = 'local' | 'openrouter' | 'gemini' | 'openai';

interface ProviderConfig {
  id: AIProvider;
  name: string;
  icon: typeof Bot;
  models: { id: string; name: string }[];
  defaultModel: string;
  description: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'local',
    name: 'Local AI',
    icon: Zap,
    models: [{ id: 'local', name: 'Built-in Assistant' }],
    defaultModel: 'local',
    description: 'Works offline. Web search + built-in knowledge. No API key needed.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: Globe,
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'meta-llama/llama-3.3-70b', name: 'Llama 3.3 70B' },
    ],
    defaultModel: 'openai/gpt-4o',
    description: '200+ models, one API key. Get yours at openrouter.ai/keys',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: BrainCircuit,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (free)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
    defaultModel: 'gemini-2.5-flash',
    description: 'Google AI. Free API key at aistudio.google.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: Bot,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (cheap)' },
    ],
    defaultModel: 'gpt-4o-mini',
    description: 'OpenAI models. Get your key at platform.openai.com/api-keys',
  },
];

const SETTINGS_KEY = 'vantaos_omni_settings';
const HISTORY_KEY = 'vantaos_omni_history';

interface StoredSettings {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

function loadSettings(): StoredSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return { provider: 'local', model: 'local', apiKey: '' };
}

function saveSettings(s: StoredSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ====== Local fallback AI with web search ======
async function localQuery(messages: { role: string; content: string }[]): Promise<string> {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const q = lastMsg.toLowerCase();

  if (q.includes('weather') || q.includes('temperature')) {
    try {
      const cityMatch = q.match(/(?:in|at|for)\s+([a-z\s-]+)/i);
      const city = cityMatch ? cityMatch[1].trim() : 'London';
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      const data = await res.json();
      const c = data.current_condition?.[0];
      if (c) return `Weather in ${city}: ${c.temp_C}°C (${c.temp_F}°F), ${c.weatherDesc?.[0]?.value || 'clear'}. Humidity: ${c.humidity}%. Wind: ${c.windspeedKmph} km/h.`;
    } catch {}
  }

  // Web search for anything query-like
  try {
    const query = encodeURIComponent(lastMsg.slice(0, 200));
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await res.text();
    const snippets = html.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi) || [];
    const titles = html.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/gi) || [];

    if (titles.length > 0) {
      const results = titles.slice(0, 4).map((t, i) => {
        const title = t.replace(/<[^>]*>/g, '').trim();
        const snippet = snippets[i] ? snippets[i].replace(/<[^>]*>/g, '').trim() : '';
        return `• ${title}${snippet ? ': ' + snippet : ''}`;
      });
      return `**Web search results:**\n\n${results.join('\n')}\n\n---\n*I'm in offline mode. Add an API key (⚙️) for full AI responses including code, analysis, and more.*`;
    }
  } catch {}

  if (q.includes('hello') || q.includes('hi ')) {
    return 'Hello! I\'m VantaOS Omni-AI. To use my full AI capabilities, add your API key in settings (⚙️). Otherwise, ask me anything and I\'ll search the web for answers.';
  }
  if (q.includes('help') || q.includes('what can you')) {
    return `I can help with:\n• Web search — ask any question\n• Weather — "weather in Paris"\n• General knowledge\n\nFor real AI power, add a key from OpenRouter, Gemini, or OpenAI in ⚙️ settings.`;
  }

  return `I searched for that but didn't find a great result. Try asking more specifically, or add an API key (⚙️) for full AI capabilities.

You can also try:\n• "weather in Tokyo"\n• "Search for ..."\n• "What is ..."`;
}

// ====== Provider API via Worker proxy ======
async function queryProvider(
  provider: AIProvider,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  if (provider === 'local') return localQuery(messages);
  if (!apiKey) throw new Error('Please add your API key in settings (⚙️) to use this provider.');

  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, apiKey, messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error (${res.status})`);
  }
  const data = await res.json();
  return data.text || 'No response generated.';
}

export default function OmniAI() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<StoredSettings>(loadSettings);
  const [tempApiKey, setTempApiKey] = useState(settings.apiKey);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const d = localStorage.getItem(HISTORY_KEY); if (d) setMessages(JSON.parse(d)); } catch {}
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const provider = PROVIDERS.find(p => p.id === settings.provider) || PROVIDERS[0];
  const isOnline = settings.provider !== 'local' && !!settings.apiKey;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    const userMsg = { role: 'user' as const, content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);
    try {
      const text = await queryProvider(settings.provider, settings.model, settings.apiKey, newMessages);
      const finalMessages = [...newMessages, { role: 'assistant', content: text }];
      setMessages(finalMessages);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(finalMessages.slice(-100)));
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${err.message}` }]);
    } finally { setIsGenerating(false); }
  };

  const clearHistory = () => { setMessages([]); localStorage.removeItem(HISTORY_KEY); };
  const saveApiSettings = () => {
    const newSettings = { ...settings, apiKey: tempApiKey };
    setSettings(newSettings); saveSettings(newSettings); setShowSettings(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-[85vh] bg-[#0a0d12] rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Header */}
      <div className="bg-[#161B22] border-b border-slate-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-lg ${isOnline ? 'bg-emerald-900/40 border-emerald-500/20' : 'bg-slate-800/40 border-slate-700/30'}`}>
            {isOnline ? <BrainCircuit className="w-6 h-6 text-emerald-400" /> : <Zap className="w-6 h-6 text-amber-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Omni-AI</h1>
            <div className="flex items-center gap-2 mt-1">
              {isOnline ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg"></span><span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">{provider.name}</span></>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-amber-500"></span><span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Offline Mode</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={clearHistory} disabled={messages.length === 0} className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30" title="Clear history">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={() => { setShowSettings(!showSettings); setTempApiKey(settings.apiKey); }}
            className={`p-2.5 rounded-xl transition-colors ${showSettings ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`} title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[#0a0d12] border-b border-slate-800 p-6 space-y-4">
          <h3 className="text-white font-bold flex items-center gap-2"><Key className="w-4 h-4" /> API Configuration</h3>
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROVIDERS.map(p => {
                const Icon = p.icon;
                const isActive = settings.provider === p.id;
                return (
                  <button key={p.id} onClick={() => setSettings(prev => ({ ...prev, provider: p.id, model: p.defaultModel }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm transition-all ${isActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-xs text-center">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{provider.description}</p>
          </div>

          {settings.provider !== 'local' && (
            <>
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">Model</label>
                <select value={settings.model} onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500">
                  {provider.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">API Key</label>
                <input type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder={`Enter your ${provider.name} API key...`}
                  className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-mono" />
                <p className="text-xs text-slate-500 mt-1">Stored locally in your browser. Never sent to our servers.</p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={saveApiSettings} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">Save Settings</button>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 ${isOnline ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-amber-900/20 border-amber-500/20'}`}>
                {isOnline ? <BrainCircuit className="w-8 h-8 text-emerald-400" /> : <Zap className="w-8 h-8 text-amber-400" />}
              </div>
              <p className="text-lg font-medium text-slate-400 mb-2">How can I help you?</p>
              <p className="text-sm text-slate-500 max-w-md text-center">
                {isOnline ? `Connected via ${provider.name}. Ask me anything!` : 'Add an API key in settings (⚙️) for full AI capabilities.'}
              </p>
            </div>
          ) : messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-sm md:text-base leading-relaxed shadow-md ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-[#161B22] text-slate-200 border border-slate-700/50 rounded-tl-sm'}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-[#161B22] border border-slate-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 sm:p-6 bg-[#161B22] border-t border-slate-800">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={isOnline ? 'Ask anything...' : 'Ask a question or search the web...'}
              disabled={isGenerating}
              className="w-full bg-[#0a0d12] border border-slate-700 text-white text-sm md:text-base rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-indigo-500 shadow-inner disabled:opacity-50 transition-colors" />
            <button type="submit" disabled={!input.trim() || isGenerating}
              className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:bg-slate-700 disabled:text-slate-500 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-[10px] text-slate-500 mt-3 px-2">
            {isOnline ? `Using ${settings.model}` : 'Offline — web search + built-in knowledge'}
          </div>
        </div>
      </div>
    </div>
  );
}
