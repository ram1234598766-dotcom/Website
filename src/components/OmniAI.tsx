'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Settings, Key, Globe, Zap, Bot, Trash2, Server, Loader2 } from 'lucide-react';

type AIProvider = 'local' | 'ollama' | 'openrouter' | 'gemini' | 'openai';

interface ProviderConfig {
  id: AIProvider;
  name: string;
  icon: typeof Bot;
  models: { id: string; name: string }[];
  defaultModel: string;
  description: string;
}

const SETTINGS_KEY = 'vantaos_omni_settings';
const HISTORY_KEY = 'vantaos_omni_history';

interface StoredSettings { provider: AIProvider; model: string; apiKey: string; ollamaUrl: string; }

function loadSettings(): StoredSettings {
  try { const d = localStorage.getItem(SETTINGS_KEY); if (d) return JSON.parse(d); } catch {}
  return { provider: 'local', model: 'local', apiKey: '', ollamaUrl: 'http://localhost:11434' };
}

function saveSettings(s: StoredSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ====== WEB SEARCH ENGINE ======
async function searchWeb(q: string): Promise<string> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q.slice(0, 300))}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VantaOS/1.0)' } });
    const html = await res.text();
    const results: string[] = [];
    const blocks = html.match(/<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
    for (const block of blocks.slice(0, 5)) {
      const t = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
      const s = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
      if (t) results.push(`• ${t[1].replace(/<[^>]*>/g, '').trim()}${s ? ': ' + s[1].replace(/<[^>]*>/g, '').trim() : ''}`);
    }
    return results.length > 0 ? results.join('\n') : '';
  } catch { return ''; }
}

async function getWeather(city: string): Promise<string> {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const c = data.current_condition?.[0];
    if (c) return `Weather: ${city}: ${c.temp_C}°C, ${c.weatherDesc?.[0]?.value || 'clear'}, Humidity: ${c.humidity}%`;
    return '';
  } catch { return ''; }
}

// ====== OLLAMA INFERENCE ======
async function queryOllama(ollamaUrl: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
    mode: 'cors',
  });
  if (!res.ok) throw new Error(`Ollama error (${res.status})`);
  const data = await res.json();
  return data.response || '';
}

async function ollamaListModels(ollamaUrl: string): Promise<{ name: string; size: number }[]> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { mode: 'cors' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => ({ name: m.name, size: m.size }));
  } catch { return []; }
}

// ====== LOCAL ENGINE ======
async function localQuery(messages: { role: string; content: string }[], settings: StoredSettings): Promise<string> {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const q = lastMsg.trim();
  const ql = q.toLowerCase();

  // Help
  if (ql === 'help' || q === '?' || ql.includes('what can you do')) {
    return `## Omni-AI Engine v3

**🌐 Web Search** — ask any question, I'll search the web
**🧠 Local Ollama** — uses your local LLM if running (qwen2.5-coder, llama3, etc.)
**📊 Math**: \`calc 2^10\` • **💻 Code**: \`js [1,2,3].map(x=>x*2)\`
**🌤️ Weather**: \`weather in London\`
**🔗 Fetch URL**: \`fetch https://example.com\`

For cloud AI, add an API key in Settings (⚙️).`;
  }

  // Built-in tools
  if (ql.startsWith('weather') || ql.includes('weather in')) {
    const match = q.match(/(?:in|at|for)\s+([a-z\s-]+)/i);
    const result = await getWeather(match ? match[1].trim() : 'your area');
    if (result) return result;
  }
  if (ql.startsWith('calc ') || ql.startsWith('math ')) {
    try {
      const expr = q.replace(/^(calc|math)\s+/i, '').trim();
      return `= ${expr}\n\`${Function('"use strict"; return (' + expr + ')')()}\``;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
  if (ql.startsWith('js ') || ql.startsWith('run ')) {
    try {
      const code = q.replace(/^(js|run)\s+/i, '').trim();
      return `\`\`\`\n${String(new Function(code)() ?? 'undefined')}\n\`\`\``;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
  if (ql.startsWith('fetch ') || ql.startsWith('get ')) {
    try {
      const url = q.replace(/^(fetch|get)\s+/i, '').trim();
      if (!url.startsWith('http')) return 'Provide a valid URL';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await res.text();
      const body = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
      return `Content from ${url}:\n\n${body}`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }

  // Try local Ollama for AI responses
  if (settings.ollamaUrl) {
    try {
      const ollamaModels = await ollamaListModels(settings.ollamaUrl);
      if (ollamaModels.length > 0) {
        const model = ollamaModels[0].name;
        // Build a system prompt with web context
        const webContext = await searchWeb(q);
        const systemPrompt = `You are VantaOS Omni-AI, a helpful coding and general assistant. Answer concisely and accurately.
${webContext ? `Web search results for context:\n${webContext}\n` : ''}
Current date: ${new Date().toLocaleDateString()}`;
        const response = await queryOllama(settings.ollamaUrl, model,
          `${systemPrompt}\n\nUser query: ${q}\n\nProvide a helpful, concise answer. If the user asks about code, provide working code examples.`);
        if (response) return response;
      }
    } catch {}
  }

  // Fallback: web search
  const results = await searchWeb(q);
  if (results) return `**Web search results:**\n\n${results}\n\n---\n*For AI-powered responses without API keys, install Ollama and run: set OLLAMA_ORIGINS=* && ollama serve*`;
  return `I couldn't find an answer. Try:
• \`weather in Paris\` — real-time weather
• \`calc 2+2\` — math
• \`js console.log('hi')\` — code execution
• \`fetch https://...\` — read a URL
• **Install Ollama** for local AI responses (Settings → enable Local Ollama)`;
}

// ====== CLOUD PROVIDERS ======
async function queryProvider(
  provider: AIProvider, model: string, apiKey: string,
  messages: { role: string; content: string }[], settings: StoredSettings
): Promise<string> {
  if (provider === 'local') return localQuery(messages, settings);
  if (provider === 'ollama') {
    if (!settings.ollamaUrl) throw new Error('Ollama URL not configured');
    const lastMsg = messages[messages.length - 1]?.content || '';
    try {
      const webContext = await searchWeb(lastMsg);
      const prompt = `${webContext ? `Web context:\n${webContext}\n\n` : ''}User: ${lastMsg}\n\nRespond helpfully:`;
      return await queryOllama(settings.ollamaUrl, model || 'llama3', prompt);
    } catch (e: any) { throw new Error(`Ollama: ${e.message}`); }
  }
  if (!apiKey) throw new Error('Add your API key in Settings (⚙️)');

  const res = await fetch('/api/ai/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, apiKey, messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error (${res.status})`);
  }
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
  const [ollamaModels, setOllamaModels] = useState<{ name: string; size: number }[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'offline' | 'online'>('offline');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const d = localStorage.getItem(HISTORY_KEY); if (d) setMessages(JSON.parse(d)); } catch {}
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Check Ollama status on mount and when settings change
  useEffect(() => {
    (async () => {
      if (settings.ollamaUrl) {
        setOllamaStatus('checking');
        const models = await ollamaListModels(settings.ollamaUrl);
        setOllamaModels(models);
        setOllamaStatus(models.length > 0 ? 'online' : 'offline');
      }
    })();
  }, [settings.ollamaUrl]);

  const isOnline = (settings.provider === 'ollama' && ollamaStatus === 'online') ||
    (settings.provider !== 'local' && settings.provider !== 'ollama' && !!settings.apiKey);

  // Build provider list with dynamic Ollama models
  const PROVIDERS: ProviderConfig[] = [
    { id: 'local', name: 'Hybrid AI', icon: Zap,
      models: [{ id: 'local', name: 'Smart Auto' }], defaultModel: 'local',
      description: 'Auto mode: uses local Ollama if available, otherwise web search + tools.' },
    { id: 'ollama', name: 'Local Ollama', icon: Server,
      models: ollamaModels.length > 0 ? ollamaModels.map(m => ({ id: m.name, name: m.name })) : [{ id: 'llama3', name: 'llama3 (default)' }],
      defaultModel: ollamaModels[0]?.name || 'llama3',
      description: ollamaStatus === 'online' ? `Connected (${ollamaModels.length} models)` : 'Connect to local Ollama for free AI' },
    { id: 'openrouter', name: 'OpenRouter', icon: Globe,
      models: [{ id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
      defaultModel: 'openai/gpt-4o', description: '200+ models. Get key at openrouter.ai/keys' },
    { id: 'gemini', name: 'Gemini', icon: BrainCircuit,
      models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (free)' }],
      defaultModel: 'gemini-2.5-flash', description: 'Free key at aistudio.google.com' },
    { id: 'openai', name: 'OpenAI', icon: Bot,
      models: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini (cheap)' }],
      defaultModel: 'gpt-4o-mini', description: 'Key at platform.openai.com/api-keys' },
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
      const text = await queryProvider(settings.provider, settings.model, settings.apiKey, newMessages, settings);
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
    setSettings(newSettings); saveSettings(newSettings); setShowSettings(false);
  };
  const refreshOllama = async () => {
    setOllamaStatus('checking');
    const models = await ollamaListModels(tempOllamaUrl);
    setOllamaModels(models);
    setOllamaStatus(models.length > 0 ? 'online' : 'offline');
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-[85vh] bg-[#0a0d12] rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Header */}
      <div className="bg-[#161B22] border-b border-slate-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-lg ${
            isOnline ? 'bg-emerald-900/40 border-emerald-500/20' :
            ollamaStatus === 'online' ? 'bg-indigo-900/40 border-indigo-500/20' :
            'bg-slate-800/40 border-slate-700/30'}`}>
            {isOnline ? <BrainCircuit className="w-6 h-6 text-emerald-400" /> :
             ollamaStatus === 'online' ? <Server className="w-6 h-6 text-indigo-400" /> :
             <Zap className="w-6 h-6 text-amber-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Omni-AI</h1>
            <div className="flex items-center gap-2 mt-1">
              {isOnline ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg"></span><span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">{provider.name}</span></>
              ) : ollamaStatus === 'online' ? (
                <><span className="w-2 h-2 rounded-full bg-indigo-500"></span><span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Ollama Ready</span></>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-amber-500"></span><span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Offline Mode</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={clearHistory} disabled={messages.length === 0}
            className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30" title="Clear history">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={() => { setShowSettings(!showSettings); setTempApiKey(settings.apiKey); setTempOllamaUrl(settings.ollamaUrl); }}
            className={`p-2.5 rounded-xl transition-colors ${showSettings ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`} title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[#0a0d12] border-b border-slate-800 p-6 space-y-4">
          <h3 className="text-white font-bold flex items-center gap-2"><Key className="w-4 h-4" /> Configuration</h3>

          {/* Ollama Status */}
          <div className="bg-black/40 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className={`w-4 h-4 ${ollamaStatus === 'online' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-sm text-slate-300">Local Ollama</span>
              {ollamaStatus === 'online' ? (
                <span className="text-xs text-emerald-400">● {ollamaModels.length} models</span>
              ) : ollamaStatus === 'checking' ? (
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
              ) : (
                <span className="text-xs text-slate-500">offline</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="text" value={tempOllamaUrl} onChange={(e) => setTempOllamaUrl(e.target.value)}
                className="bg-black/60 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 w-36 font-mono focus:outline-none focus:border-indigo-500" />
              <button onClick={refreshOllama} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition-colors">
                <Loader2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">AI Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PROVIDERS.map(p => {
                const Icon = p.icon;
                const isActive = settings.provider === p.id;
                return (
                  <button key={p.id} onClick={() => setSettings(prev => ({ ...prev, provider: p.id, model: p.defaultModel }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm transition-all ${isActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-[10px] text-center">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{provider.description}</p>
          </div>

          {settings.provider === 'ollama' && ollamaModels.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">Ollama Model</label>
              <select value={settings.model} onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm">
                {ollamaModels.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          )}

          {(settings.provider === 'openrouter' || settings.provider === 'gemini' || settings.provider === 'openai') && (
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">API Key</label>
              <input type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)}
                placeholder={`${provider.name} API key...`}
                className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-mono" />
              <p className="text-xs text-slate-500 mt-1">Stored locally in your browser.</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={saveApiSettings} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">Save</button>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-16 h-16 rounded-2xl border bg-indigo-900/20 border-indigo-500/20 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-lg font-medium text-slate-400 mb-1">Omni-AI v3 Ready</p>
              <p className="text-sm text-slate-500 max-w-md text-center mb-6">
                {ollamaStatus === 'online'
                  ? `🧠 Connected to local Ollama (${ollamaModels.length} models). Ask anything!`
                  : 'Web search, code execution, math — no API key needed.'}
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                {[
                  { label: 'Ask anything', cmd: 'What is quantum computing?' },
                  { label: 'Calculate', cmd: 'calc 2^10' },
                  { label: 'Run JS', cmd: 'js [1,2,3].map(x=>x*2)' },
                  { label: 'Weather', cmd: 'weather in London' },
                  { label: 'Fetch URL', cmd: 'fetch https://example.com' },
                  { label: 'Help', cmd: 'help' },
                ].map(s => (
                  <button key={s.label} onClick={() => setInput(s.cmd)}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors text-left">
                    <span className="font-medium text-indigo-400">{s.label}</span>
                    <br /><span className="opacity-70">{s.cmd}</span>
                  </button>
                ))}
              </div>
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
              placeholder={ollamaStatus === 'online' ? 'Ask with local AI...' : 'Search, calculate, run code...'}
              disabled={isGenerating}
              className="w-full bg-[#0a0d12] border border-slate-700 text-white text-sm md:text-base rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-indigo-500 shadow-inner disabled:opacity-50 transition-colors placeholder-slate-600" />
            <button type="submit" disabled={!input.trim() || isGenerating}
              className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:bg-slate-700 disabled:text-slate-500 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-[10px] text-slate-500 mt-3 px-2 flex items-center gap-3">
            {ollamaStatus === 'online' ? (
              <span>🧠 Using local {ollamaModels[0]?.name} · <span className="text-indigo-400">Settings</span> to change model</span>
            ) : (
              <span>🔍 Web + Tools · Type <code className="text-indigo-400">help</code> for commands</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
