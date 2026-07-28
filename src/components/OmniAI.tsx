'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainCircuit, Send, Settings, Key, Globe, Zap, Bot, Trash2, Code, Search, Loader2 } from 'lucide-react';

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
  { id: 'local', name: 'Local AI', icon: Zap,
    models: [{ id: 'local', name: 'Omni-Engine v2' }], defaultModel: 'local',
    description: 'No API key needed. Web search, code execution, math, knowledge base. Private & powerful.' },
  { id: 'openrouter', name: 'OpenRouter', icon: Globe,
    models: [{ id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }, { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }],
    defaultModel: 'openai/gpt-4o', description: '200+ models. Get a key at openrouter.ai/keys' },
  { id: 'gemini', name: 'Gemini', icon: BrainCircuit,
    models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (free)' }, { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }],
    defaultModel: 'gemini-2.5-flash', description: 'Google AI. Free key at aistudio.google.com' },
  { id: 'openai', name: 'OpenAI', icon: Bot,
    models: [{ id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }],
    defaultModel: 'gpt-4o-mini', description: 'OpenAI. Key at platform.openai.com/api-keys' },
];

const SETTINGS_KEY = 'vantaos_omni_settings';
const HISTORY_KEY = 'vantaos_omni_history';

interface StoredSettings { provider: AIProvider; model: string; apiKey: string; }

function loadSettings(): StoredSettings {
  try { const d = localStorage.getItem(SETTINGS_KEY); if (d) return JSON.parse(d); } catch {}
  return { provider: 'local', model: 'local', apiKey: '' };
}

function saveSettings(s: StoredSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ====== LOCAL AI ENGINE ======
const localEngine = {
  async searchWeb(query: string): Promise<string> {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.slice(0, 300))}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VantaOS/1.0)' } });
      const html = await res.text();
      const results: { title: string; snippet: string; url: string }[] = [];

      // Extract result blocks
      const blocks = html.match(/<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
      for (const block of blocks.slice(0, 5)) {
        const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
        const urlMatch = block.match(/href="(https?:\/\/[^"]+)"/);
        if (titleMatch) {
          results.push({
            title: titleMatch[1].replace(/<[^>]*>/g, '').trim(),
            snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '',
            url: urlMatch ? urlMatch[1] : '',
          });
        }
      }

      if (results.length > 0) {
        return results.map((r, i) =>
          `${i + 1}. **${r.title}**${r.snippet ? ': ' + r.snippet : ''}`
        ).join('\n');
      }
      return '';
    } catch { return ''; }
  },

  async executeJS(code: string): Promise<string> {
    try {
      const fn = new Function(code);
      const result = fn();
      return String(result ?? 'undefined');
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  },

  async fetchURL(url: string): Promise<string> {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await res.text();
      // Extract readable content
      const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
      const body = text.replace(/<script[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[\s\S]*?<\/style>/gi, '')
                       .replace(/<[^>]+>/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim()
                       .slice(0, 2000);
      return `Title: ${title}\n\n${body}`;
    } catch (e: any) {
      return `Failed to fetch URL: ${e.message}`;
    }
  },

  async getWeather(city: string): Promise<string> {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      const data = await res.json();
      const c = data.current_condition?.[0];
      if (c) return `**Weather in ${city}**\n• Temperature: ${c.temp_C}°C / ${c.temp_F}°F\n• Conditions: ${c.weatherDesc?.[0]?.value || 'N/A'}\n• Humidity: ${c.humidity}%\n• Wind: ${c.windspeedKmph} km/h\n• Feels like: ${c.FeelsLikeC}°C`;
      return `Weather data for "${city}" not found.`;
    } catch { return `Could not fetch weather for "${city}".`; }
  },

  knowledge: `VantaOS is an open-source browser-based cloud IDE.
It features a Monaco code editor, Omni-AI assistant, file management, and GitHub sync.
VantaOS is built with Next.js, React, TypeScript, and Tailwind CSS.
It deploys on Cloudflare Workers as a static export.
Supabase provides authentication, database, and real-time subscriptions.
The Omni-AI supports multiple AI providers: OpenRouter, Gemini, and OpenAI.
Ollama local integration allows running models on your own machine.
All data is stored locally via IndexedDB or synced to Supabase when configured.
The platform emphasizes privacy, data ownership, and zero tracking.`,

  async query(messages: { role: string; content: string }[]): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const q = lastMsg.trim();
    const ql = q.toLowerCase();

    // Help
    if (ql.startsWith('help') || q === '?' || ql.includes('what can you do')) {
      return `## Omni-AI Local Engine v2

I can help you with:

**🌐 Web Search** — Ask any question and I'll search the web
**📊 Math & Calculations** — Try: \`calc 2 + 2\` or \`math sqrt(144)\`
**💻 Code Execution** — Try: \`js 2 + 2\` or \`run console.log("hello")\`
**🌤️ Weather** — Try: \`weather in Tokyo\`
**📄 URL Fetch** — Try: \`fetch https://example.com\`
**🧠 Knowledge** — Ask about VantaOS, programming, or general topics

For full AI power, add an API key in Settings (⚙️) to use GPT-4o, Claude, or Gemini.`;
    }

    // Weather
    if (ql.includes('weather') || ql.includes('temperature')) {
      const match = q.match(/(?:in|at|for)\s+([a-z\s-]+)/i);
      return await this.getWeather(match ? match[1].trim() : 'your area');
    }

    // JavaScript execution
    if (ql.startsWith('js ') || ql.startsWith('run ') || ql.startsWith('exec ')) {
      const code = q.replace(/^(js|run|exec)\s+/i, '').trim();
      const result = await this.executeJS(code);
      return `**Result:**\n\`\`\`\n${result}\n\`\`\``;
    }

    // Math
    if (ql.startsWith('calc') || ql.startsWith('math') || ql.startsWith('calculate')) {
      const expr = q.replace(/^(calc|math|calculate)\s+/i, '').trim();
      try {
        const result = Function('"use strict"; return (' + expr + ')')();
        return `**=${expr}**\n\`\`\`\n${result}\n\`\`\``;
      } catch (e: any) {
        return `Could not calculate: ${e.message}. Try: \`calc 2 * (3 + 5)\``;
      }
    }

    // URL fetch
    if (ql.startsWith('fetch ') || ql.startsWith('get url ') || ql.startsWith('read ')) {
      const url = q.replace(/^(fetch|get url|read)\s+/i, '').trim();
      if (url.startsWith('http')) {
        const content = await this.fetchURL(url);
        return `**Fetched from:** ${url}\n\n${content}`;
      }
      return 'Please provide a valid URL starting with http:// or https://';
    }

    // Time/date
    if (ql.includes('time') && (ql.includes('current') || ql.includes('now') || ql.includes('what'))) {
      return `**Current time:** ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`;
    }

    // Code generation (simple patterns)
    if (ql.includes('function') && (ql.includes('javascript') || ql.includes('js')) && (ql.includes('write') || ql.includes('create') || ql.includes('generate'))) {
      const desc = q.slice(0, 200);
      const results = await this.searchWeb(`javascript ${desc} example code`);
      if (results) return `I searched the web for code examples:\n\n${results}\n\n---\n*For more accurate code generation, add an API key in Settings.*`;
    }

    // Programming questions
    if (ql.includes('python') || ql.includes('react') || ql.includes('typescript') || ql.includes('javascript')) {
      const results = await this.searchWeb(q.slice(0, 300));
      if (results) return `**Web search results for:** "${q}"\n\n${results}\n\n---\n*For detailed explanations, add an API key in Settings.*`;
    }

    // Web search (catch-all)
    const results = await this.searchWeb(q.slice(0, 300));
    if (results) {
      return `**Search results for:** "${q}"\n\n${results}\n\n---\n*I'm in offline mode. Add an API key (⚙️) for full AI responses including code generation, analysis, and more.*`;
    }

    // Knowledge base fallback
    const kb = this.knowledge.toLowerCase();
    const keywords = ql.split(' ').filter(w => w.length > 3);
    const matched = keywords.filter(w => kb.includes(w));
    if (matched.length >= 2) {
      return `**Based on my knowledge:**\n\n${this.knowledge}\n\n*For more details, try asking more specifically or add an API key.*`;
    }

    return `I couldn't find a specific answer to "${q}". Here's what I can do:

• **Search the web** — Try rephrasing your question
• **Calculate math** — \`calc 2 + 2\`
• **Run JavaScript** — \`js console.log("hello")\`
• **Check weather** — \`weather in Paris\`
• **Fetch a URL** — \`fetch https://example.com\`

Or add an API key in Settings (⚙️) for full AI capabilities.`;
  }
};

// ====== Provider API ======
async function queryProvider(
  provider: AIProvider, model: string, apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  if (provider === 'local') return localEngine.query(messages);
  if (!apiKey) throw new Error('Add your API key in Settings (⚙️) to use this provider.');

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
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-lg ${isOnline ? 'bg-emerald-900/40 border-emerald-500/20' : 'bg-indigo-900/40 border-indigo-500/20'}`}>
            {isOnline ? <BrainCircuit className="w-6 h-6 text-emerald-400" /> : <Zap className="w-6 h-6 text-indigo-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Omni-AI</h1>
            <div className="flex items-center gap-2 mt-1">
              {isOnline ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg"></span><span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">{provider.name}</span></>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-indigo-500"></span><span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Omni-Engine v2 · Offline</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={clearHistory} disabled={messages.length === 0}
            className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30" title="Clear history">
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
              <p className="text-lg font-medium text-slate-400 mb-1">Omni-Engine v2 Ready</p>
              <p className="text-sm text-slate-500 max-w-md text-center mb-6">
                Web search, code execution, math, weather, knowledge base — no API key needed.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                {[
                  { label: 'Search web', cmd: 'What is quantum computing?' },
                  { label: 'Calculate', cmd: 'calc 2^10 + 5*3' },
                  { label: 'Run JS', cmd: 'js [1,2,3].map(x => x*2)' },
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
                <span className="text-xs text-slate-400">Processing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 sm:p-6 bg-[#161B22] border-t border-slate-800">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={isOnline ? 'Ask anything...' : 'Search, calculate, run code, ask anything...'}
              disabled={isGenerating}
              className="w-full bg-[#0a0d12] border border-slate-700 text-white text-sm md:text-base rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-indigo-500 shadow-inner disabled:opacity-50 transition-colors placeholder-slate-600" />
            <button type="submit" disabled={!input.trim() || isGenerating}
              className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:bg-slate-700 disabled:text-slate-500 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-[10px] text-slate-500 mt-3 px-2 flex items-center gap-3">
            <span>{isOnline ? `Using ${settings.model}` : '🧠 Web + Math + Code + Weather + Knowledge'}</span>
            <span className="opacity-50">·</span>
            <span className="opacity-70">Type <code className="text-indigo-400">help</code> for commands</span>
          </div>
        </div>
      </div>
    </div>
  );
}
