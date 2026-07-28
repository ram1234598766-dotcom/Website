'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Settings, Key, Globe, Zap, Bot, Trash2, Server, RefreshCw, Loader2 } from 'lucide-react';

type AIProvider = 'local' | 'ollama' | 'openrouter' | 'gemini' | 'openai';

const SETTINGS_KEY = 'vantaos_omni_settings';
const HISTORY_KEY = 'vantaos_omni_history';

interface StoredSettings { provider: AIProvider; model: string; apiKey: string; ollamaUrl: string; }

function loadSettings(): StoredSettings {
  try { const d = localStorage.getItem(SETTINGS_KEY); if (d) return JSON.parse(d); } catch {}
  return { provider: 'local', model: 'local', apiKey: '', ollamaUrl: 'http://localhost:11434' };
}
function saveSettings(s: StoredSettings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// ====== SEARCH ENGINES ======
async function searchDuckDuckGo(q: string): Promise<string> {
  try {
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q.slice(0, 200))}`);
    const html = await res.text();
    const results: string[] = [];
    const rows = html.match(/<tr[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows.slice(0, 5)) {
      const a = row.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snip = row.match(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/i);
      if (a) results.push(`• ${a[2].replace(/<[^>]*>/g, '').trim()} — ${a[1].replace(/^https?:\/\//, '')}`);
      if (snip) results[results.length - 1] += `\n  ${snip[1].replace(/<[^>]*>/g, '').trim()}`;
    }
    return results.join('\n');
  } catch { return ''; }
}

async function searchWikipedia(q: string): Promise<string> {
  try {
    // Clean query for Wikipedia
    const topic = q.replace(/^(what is|who is|what are|what was|tell me about|explain)\s+/i, '').trim();
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
    if (!res.ok) return '';
    const data = await res.json();
    if (data.extract) return `📖 **${data.title}** — ${data.extract.slice(0, 1500)}`;
    return '';
  } catch { return ''; }
}

async function searchWeb(q: string): Promise<string> {
  // Try Wikipedia first for knowledge queries
  const wiki = await searchWikipedia(q);
  if (wiki) return wiki;
  // Fallback to DuckDuckGo
  const ddg = await searchDuckDuckGo(q);
  if (ddg) return `**Web search results for "${q}":**\n\n${ddg}`;
  return '';
}

async function getWeather(city: string): Promise<string> {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const c = data.current_condition?.[0];
    if (c) return `🌤️ **Weather in ${city}**: ${c.temp_C}°C (${c.temp_F}°F), ${c.weatherDesc?.[0]?.value || 'clear'}\n💧 Humidity: ${c.humidity}% · 🌬️ Wind: ${c.windspeedKmph} km/h`;
    return '';
  } catch { return ''; }
}

// ====== OLLAMA ======
async function ollamaListModels(url: string): Promise<{ name: string }[]> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => ({ name: m.name }));
  } catch { return []; }
}

async function ollamaGenerate(url: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(`${url}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

// ====== LOCAL QUERY ======
async function localQuery(msg: string, settings: StoredSettings): Promise<string> {
  const q = msg.trim();
  const ql = q.toLowerCase();

  // Commands
  if (ql === 'help' || q === '?') {
    return `## 🤖 Omni-AI Commands

• **Ask anything** — questions, knowledge, explanations
• **🌤️ Weather** — \`weather in Paris\`
• **📊 Math** — \`calc 2^10\`
• **💻 Code** — \`js [1,2,3].map(x=>x*2)\`
• **🔗 Fetch** — \`fetch https://...\`
• **⏰ Time** — \`what time is it\`
• **🧠 Local AI** — install Ollama, run \`set OLLAMA_ORIGINS=* && ollama serve\`, then enable in ⚙️`;
  }
  if (ql.startsWith('weather') || ql.startsWith('temperature')) {
    const match = q.match(/(?:in|at|for)\s+([a-z\s-]+)/i);
    return await getWeather(match?.[1]?.trim() || 'your area') || 'Weather not found. Try: weather in London';
  }
  if (ql.startsWith('calc ') || ql.startsWith('math ')) {
    try { const expr = q.replace(/^(calc|math)\s+/i, ''); return `**${expr}** = \`${Function('"use strict";return (' + expr + ')')()}\``; }
    catch (e: any) { return `Math error: ${e.message}. Try \`calc 2 * (3 + 5)\``; }
  }
  if (ql.startsWith('js ') || ql.startsWith('run ')) {
    try { const code = q.replace(/^(js|run)\s+/i, ''); return `\`\`\`\n${String(new Function(code)() ?? 'undefined')}\n\`\`\``; }
    catch (e: any) { return `JS error: ${e.message}`; }
  }
  if (ql.startsWith('fetch ') || ql.startsWith('get ')) {
    try {
      const url = q.replace(/^(fetch|get)\s+/i, '').trim();
      if (!url.startsWith('http')) return 'Please provide a URL starting with http://';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await res.text();
      const body = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
      return `📄 **Content from ${url}**\n\n${body}`;
    } catch { return `Failed to fetch that URL.`; }
  }
  if (ql.includes('time') && (ql.includes('what') || ql.includes('current') || ql.includes('now'))) {
    return `🕐 **${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}**`;
  }

  // Try local Ollama
  if (settings.ollamaUrl) {
    try {
      const models = await ollamaListModels(settings.ollamaUrl);
      if (models.length > 0) {
        const model = settings.model !== 'local' ? settings.model : models[0].name;
        const context = await searchWeb(q);
        const system = `You are Omni-AI, a helpful assistant. Answer concisely.\n${context ? `Context:\n${context}\n` : ''}Date: ${new Date().toLocaleDateString()}`;
        try {
          const response = await ollamaGenerate(settings.ollamaUrl, model, `${system}\n\nUser: ${q}\nAnswer:`);
          if (response) return response;
        } catch { /* fall through */ }
      }
    } catch {}
  }

  // Web search fallback
  const web = await searchWeb(q);
  if (web) return web;

  // Knowledge base fallback
  const kb: Record<string, string> = {
    vantaos: 'VantaOS is an open-source cloud IDE with Monaco editor, Omni-AI, and GitHub sync. Built with Next.js + TypeScript, deployed on Cloudflare Workers.',
    quantum: 'Quantum computing uses qubits that can be in superposition states (0 and 1 simultaneously), enabling parallel computation on certain problems.',
    ai: 'Artificial Intelligence (AI) refers to machines that can simulate human intelligence. Machine learning is a subset that learns from data.',
    js: 'JavaScript is a programming language for the web. It runs in browsers and on servers via Node.js.',
  };
  for (const [key, val] of Object.entries(kb)) {
    if (ql.includes(key)) return `📚 **Quick Answer:**\n${val}\n\n*For more details, try "search for..." or enable Ollama in ⚙️ settings.*`;
  }

  return `I searched for "${q}" but couldn't find a specific answer.

Here's what I can do:
• **Search the web** — try \`search for ${q}\`
• **Wikipedia lookup** — try \`what is ${q.split(' ').slice(0, 3).join(' ')}\`
• **Enable Ollama** — run \`set OLLAMA_ORIGINS=* && ollama serve\` in your terminal, then refresh this page

Or add an API key (⚙️) for GPT-4o, Claude, Gemini, etc.`;
}

// ====== CLOUD PROVIDER ======
async function cloudQuery(provider: AIProvider, model: string, apiKey: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, apiKey, messages }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Error (${res.status})`); }
  const data = await res.json();
  return data.text || 'No response.';
}

export default function OmniAI() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<StoredSettings>(loadSettings);
  const [tempApiKey, setTempApiKey] = useState(settings.apiKey);
  const [tempOllamaUrl, setTempOllamaUrl] = useState(settings.ollamaUrl);
  const [ollamaModels, setOllamaModels] = useState<{ name: string }[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'offline' | 'online'>('offline');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const d = localStorage.getItem(HISTORY_KEY); if (d) setMessages(JSON.parse(d)); } catch {}
    checkOllama();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function checkOllama() {
    const url = tempOllamaUrl || settings.ollamaUrl;
    setOllamaStatus('checking');
    const models = await ollamaListModels(url);
    setOllamaModels(models);
    setOllamaStatus(models.length > 0 ? 'online' : 'offline');
  }

  const isOllamaReady = ollamaStatus === 'online';
  const isCloudReady = settings.provider !== 'local' && settings.provider !== 'ollama' && !!settings.apiKey;
  const isUsingOllama = settings.provider === 'ollama' || (settings.provider === 'local' && isOllamaReady);
  const isOnline = isOllamaReady || isCloudReady;

  const PROVIDERS = [
    { id: 'local' as AIProvider, name: 'Hybrid AI', icon: Zap,
      models: [{ id: 'local', name: 'Smart Auto' }], defaultModel: 'local',
      desc: isOllamaReady ? 'Using local Ollama + web search' : 'Web search + tools. Enable Ollama in settings.' },
    { id: 'ollama' as AIProvider, name: 'Local Ollama', icon: Server,
      models: ollamaModels.length > 0 ? ollamaModels.map(m => ({ id: m.name, name: m.name })) : [{ id: 'llama3', name: 'llama3' }],
      defaultModel: ollamaModels[0]?.name || 'llama3',
      desc: isOllamaReady ? `✅ ${ollamaModels.length} models available` : 'Run: set OLLAMA_ORIGINS=* && ollama serve' },
    { id: 'openrouter' as AIProvider, name: 'OpenRouter', icon: Globe,
      models: [{ id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
      defaultModel: 'openai/gpt-4o', desc: '200+ models. Get key at openrouter.ai/keys' },
    { id: 'gemini' as AIProvider, name: 'Gemini', icon: BrainCircuit,
      models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }], defaultModel: 'gemini-2.5-flash',
      desc: 'Free key at aistudio.google.com' },
    { id: 'openai' as AIProvider, name: 'OpenAI', icon: Bot,
      models: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }], defaultModel: 'gpt-4o-mini',
      desc: 'Key at platform.openai.com/api-keys' },
  ];

  const provider = PROVIDERS.find(p => p.id === settings.provider) || PROVIDERS[0];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    const userMsg = { role: 'user' as const, content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);
    try {
      let text: string;
      if (settings.provider === 'local' || settings.provider === 'ollama') {
        text = await localQuery(input.trim(), settings);
      } else {
        if (!settings.apiKey) throw new Error('Add your API key in Settings (⚙️)');
        text = await cloudQuery(settings.provider, settings.model, settings.apiKey, [{ role: 'user', content: input.trim() }]);
      }
      const finalMessages = [...newMessages, { role: 'assistant', content: text }];
      setMessages(finalMessages);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(finalMessages.slice(-100)));
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${err.message}` }]);
    } finally { setIsGenerating(false); }
  };

  const clearHistory = () => { setMessages([]); localStorage.removeItem(HISTORY_KEY); };

  const saveApiSettings = () => {
    const newSettings = { ...settings, apiKey: tempApiKey, ollamaUrl: tempOllamaUrl };
    setSettings(newSettings);
    saveSettings(newSettings);
    setShowSettings(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-[85vh] bg-[#0a0d12] rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Header */}
      <div className="bg-[#161B22] border-b border-slate-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-lg ${
            isOllamaReady ? 'bg-emerald-900/40 border-emerald-500/20' :
            isCloudReady ? 'bg-blue-900/40 border-blue-500/20' :
            'bg-slate-800/40 border-slate-700/30'}`}>
            {isOllamaReady ? <Server className="w-6 h-6 text-emerald-400" /> :
             isCloudReady ? <BrainCircuit className="w-6 h-6 text-blue-400" /> :
             <Zap className="w-6 h-6 text-amber-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Omni-AI</h1>
            <div className="flex items-center gap-2 mt-1">
              {isOllamaReady ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg"></span>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Ollama · {ollamaModels[0]?.name}</span></>
              ) : isCloudReady ? (
                <><span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">{provider.name}</span></>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Offline · Web + Tools</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearHistory} disabled={messages.length === 0}
            className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Clear history">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={() => { setShowSettings(!showSettings); setTempApiKey(settings.apiKey); setTempOllamaUrl(settings.ollamaUrl); }}
            className={`p-2.5 rounded-xl transition-colors cursor-pointer ${showSettings ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[#0a0d12] border-b border-slate-800 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-white font-bold flex items-center gap-2"><Key className="w-4 h-4" /> Configuration</h3>

          {/* Ollama Connection */}
          <div className="bg-black/40 p-4 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className={`w-4 h-4 ${isOllamaReady ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="text-sm font-medium text-slate-300">Local Ollama</span>
                {ollamaStatus === 'checking' && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                {isOllamaReady && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">● {ollamaModels.length} models</span>}
                {!isOllamaReady && ollamaStatus !== 'checking' && <span className="text-xs text-slate-500">offline</span>}
              </div>
              <button onClick={checkOllama} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition-colors cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={tempOllamaUrl} onChange={(e) => setTempOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1 bg-black/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500" />
            </div>
            {!isOllamaReady && ollamaStatus !== 'checking' && (
              <p className="text-[10px] text-amber-400 mt-2">Run in terminal: <code className="bg-black/60 px-1 py-0.5 rounded text-emerald-400">set OLLAMA_ORIGINS=* && ollama serve</code></p>
            )}
          </div>

          {/* Provider Selection */}
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">AI Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PROVIDERS.map(p => {
                const Icon = p.icon;
                const active = settings.provider === p.id;
                return (
                  <button key={p.id} onClick={() => setSettings(prev => ({ ...prev, provider: p.id, model: p.defaultModel }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm transition-all cursor-pointer ${active ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-[10px] text-center">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{provider.desc}</p>
          </div>

          {/* Model picker for Ollama */}
          {settings.provider === 'ollama' && isOllamaReady && (
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">Model</label>
              <select value={settings.model} onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm cursor-pointer">
                {ollamaModels.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          )}

          {/* API Key for cloud providers */}
          {(settings.provider === 'openrouter' || settings.provider === 'gemini' || settings.provider === 'openai') && (
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">API Key</label>
              <input type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)}
                placeholder={`${provider.name} API key...`}
                className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-mono" />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">Cancel</button>
            <button onClick={saveApiSettings} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">Save</button>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-16 h-16 rounded-2xl border bg-indigo-900/20 border-indigo-500/20 flex items-center justify-center mb-4">
                {isOllamaReady ? <Server className="w-8 h-8 text-emerald-400" /> : <Zap className="w-8 h-8 text-indigo-400" />}
              </div>
              <p className="text-lg font-medium text-slate-400 mb-1">
                {isOllamaReady ? '🧠 Local AI Ready' : 'Omni-AI Ready'}
              </p>
              <p className="text-sm text-slate-500 max-w-md text-center mb-6">
                {isOllamaReady
                  ? `Connected to Ollama (${ollamaModels.length} models). Ask anything!`
                  : 'Web search + Wikipedia + tools.'}
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                {[
                  { label: 'Ask a question', cmd: 'What is quantum computing?' },
                  { label: 'Wikipedia', cmd: 'what is machine learning' },
                  { label: 'Calculate', cmd: 'calc 2^10' },
                  { label: 'Run JS', cmd: 'js [1,2,3].map(x=>x*2)' },
                  { label: 'Weather', cmd: 'weather in London' },
                  { label: 'Help', cmd: 'help' },
                ].map(s => (
                  <button key={s.label} onClick={() => setInput(s.cmd)}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors text-left cursor-pointer">
                    <span className="font-medium text-indigo-400">{s.label}</span>
                    <br /><span className="opacity-70">{s.cmd}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-sm md:text-base leading-relaxed shadow-md ${
                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' :
                'bg-[#161B22] text-slate-200 border border-slate-700/50 rounded-tl-sm'}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-[#161B22] border border-slate-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 sm:p-6 bg-[#161B22] border-t border-slate-800">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={isOllamaReady ? 'Ask your local AI anything...' : 'Ask a question, search the web...'}
              disabled={isGenerating}
              className="w-full bg-[#0a0d12] border border-slate-700 text-white text-sm md:text-base rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-indigo-500 shadow-inner disabled:opacity-50 transition-colors placeholder-slate-600" />
            <button type="submit" disabled={!input.trim() || isGenerating}
              className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:bg-slate-700 disabled:text-slate-500 transition-colors cursor-pointer">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-[10px] text-slate-500 mt-3 px-2 flex items-center gap-3">
            {isOllamaReady ? (
              <span>🧠 Local Ollama · <button onClick={() => setShowSettings(true)} className="text-indigo-400 hover:underline cursor-pointer">Change model</button></span>
            ) : (
              <span>🔍 Web + Wikipedia · Type <span className="text-indigo-400">help</span> for commands</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
