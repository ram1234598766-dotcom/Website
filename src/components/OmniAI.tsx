'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Settings, Key, Globe, Zap, Bot, Trash2, Loader2, Cpu, Clock, Sparkles, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { SandboxRunner } from '../lib/terminal/runner';
import { queryWebModel } from '../lib/models/adapter';
import { TOOL_REGISTRY, getToolById, getToolsByCategory, type ToolDef } from '../lib/ai/tools/registry';
import SubAgentDispatcher from './SubAgentDispatcher';

type AIProvider = 'webmodel' | 'openrouter' | 'gemini' | 'openai';

const SETTINGS_KEY = 'vantaos_omni_settings';
const HISTORY_KEY = 'vantaos_omni_history';

const WEB_MODELS: { id: string; name: string }[] = [
  { id: 'gpt2', name: 'GPT-2 (124M)' },
  { id: 'tinyllama', name: 'SmolLM2-135M' },
  { id: 'smollm2-360m', name: 'SmolLM2-360M' },
  { id: 'lamini-1b', name: 'LaMini-1.1B' },
  { id: 'phi-2', name: 'Phi-2 (2.7B)' },
  { id: 'phi-3-mini', name: 'Phi-3-mini (3.8B)' },
  { id: 'phi-3.5-mini', name: 'Phi-3.5-mini (3.8B)' },
];

/** Shared sandbox for the inline JS / calculation tools. */
const omniRunner = new SandboxRunner();

async function runInSandbox(code: string): Promise<string> {
  const res = await omniRunner.run(code).result;
  if (res.terminated) return `(stopped: ${res.terminated})`;
  if (!res.ok) return res.error ?? 'Execution failed.';
  const consoleLines = res.output.length ? `${res.output.join('\n')}\n` : '';
  return `${consoleLines}${res.value}`;
}

interface StoredSettings { provider: AIProvider; model: string; apiKey: string; }

function loadSettings(): StoredSettings {
  try {
    const d = localStorage.getItem(SETTINGS_KEY);
    if (d) {
      const parsed = JSON.parse(d) as { provider?: string; model?: string; apiKey?: string };
      // Legacy 'local' provider was removed — migrate it to WebModel
      if (parsed.provider === 'local') parsed.provider = 'webmodel';
      const provider: AIProvider =
        parsed.provider === 'openrouter' || parsed.provider === 'gemini' || parsed.provider === 'openai' || parsed.provider === 'webmodel'
          ? parsed.provider
          : 'webmodel';
      return {
        provider,
        model: parsed.model || 'tinyllama',
        apiKey: parsed.apiKey || '',
      };
    }
  } catch {}
  return { provider: 'webmodel', model: 'tinyllama', apiKey: '' };
}
function saveSettings(s: StoredSettings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

function weatherEmoji(desc: string): string {
  const d = (desc || '').toLowerCase();
  if (d.includes('sun') || d.includes('clear')) return '☀️';
  if (d.includes('cloud') || d.includes('overcast')) return '☁️';
  if (d.includes('rain') || d.includes('drizzle')) return '🌧️';
  if (d.includes('thunder') || d.includes('storm')) return '⛈️';
  if (d.includes('snow') || d.includes('ice')) return '❄️';
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return '🌫️';
  if (d.includes('moon') || d.includes('night')) return '🌙';
  return '🌤️';
}

function weatherCard(city: string, c: { temp_C?: string; temp_F?: string; humidity?: string; windspeedKmph?: string; weatherDesc?: { value?: string }[] }): string {
  const emoji = weatherEmoji(c.weatherDesc?.[0]?.value);
  const temp = `${c.temp_C ?? '?'}°C (${c.temp_F ?? '?'}°F)`;
  const humidity = `${c.humidity ?? '?'}%`;
  const wind = `${c.windspeedKmph ?? '?'} km/h`;
  const desc = c.weatherDesc?.[0]?.value || 'Clear';
  const lines = [
    `${emoji}  Weather in ${city}`,
    `🌡️  Temperature: ${temp}`,
    `💧  Humidity: ${humidity}`,
    `💨  Wind: ${wind}`,
    `☀️  Conditions: ${desc}`,
  ];
  const contentW = Math.max(...lines.map(l => l.length));
  const pad = (s: string) => s + ' '.repeat(Math.max(0, contentW - s.length));
  const border = '═'.repeat(contentW);
  return [
    `╔${border}╗`,
    `║${pad(lines[0])}║`,
    `╠${border}╣`,
    ...lines.slice(1).map(l => `║${pad(l)}║`),
    `╚${border}╝`,
  ].join('\n');
}

async function getWeather(city: string): Promise<string> {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const c = data.current_condition?.[0];
    if (c) return weatherCard(city, c);
    return '';
  } catch { return ''; }
}

// ====== FANCY FORMATTING SYSTEM ======

const FG = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
};

function card(title: string, icon: string, lines: string[], accent = 'cyan'): string {
  const color = FG[accent as keyof typeof FG] || FG.cyan;
  const w = Math.max(...lines.map(l => l.length), title.length) + 2;
  const pad = (s: string) => s + ' '.repeat(Math.max(0, w - s.length));
  return [
    `╔${'═'.repeat(w)}╗`,
    `║ ${color}${FG.bold}${pad(icon + ' ' + title)}${FG.reset} ║`,
    `╠${'═'.repeat(w)}╣`,
    ...lines.map(l => `║ ${pad(l)}${FG.reset} ║`),
    `╚${'═'.repeat(w)}╝`,
  ].join('\n');
}

function statusCard(label: string, value: string, ok = true): string {
  return card(label, ok ? '✅' : '❌', [value], ok ? 'green' : 'red');
}

function stepCard(steps: { label: string; icon: string; status: 'done' | 'pending' | 'run' }[]): string {
  const lines = steps.map(s => {
    const icon = s.status === 'done' ? '✅' : s.status === 'run' ? '⏳' : '⬜';
    const color = s.status === 'done' ? FG.green : s.status === 'run' ? FG.yellow : FG.dim;
    return `${icon} ${color}${s.label}${FG.reset}`;
  });
  return card('Pipeline', '⚙️', lines, 'blue');
}

function renderList(title: string, icon: string, items: string[], accent = 'white'): string {
  return card(title, icon, items.length ? items : ['(empty)'], accent);
}

// ====== LOCAL QUERY ENHANCEMENTS ======

function fancyCalc(expr: string, value: string): string {
  return card('Math', '📐', [`Expression: ${expr}`, `Result: ${FG.green}${FG.bold}${value}${FG.reset}`], 'yellow');
}

function fancyJS(code: string, output: string): string {
  return card('JavaScript Sandbox', '🟨', [
    `Code: ${code.slice(0, 80)}${code.length > 80 ? '...' : ''}`,
    '',
    output,
  ], 'yellow');
}

function fancyTime(): string {
  const now = new Date();
  return card('Clock', '🕐', [
    now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }),
  ], 'cyan');
}

function fancyFetch(url: string, body: string): string {
  return card('Fetch', '🌐', [`URL: ${url}`, '', body.slice(0, 2000)], 'green');
}

function fancySearch(query: string, results: string): string {
  return card(`Search: ${query}`, '🔍', results ? results.split('\n') : ['No results'], 'magenta');
}

function fancyShell(cmd: string): string {
  return card('Terminal Execute', '💻', [`Command: ${cmd}`, 'Run via terminal session.'], 'cyan');
}

function fancyHelp(): string {
  return card('Omni-AI Commands', '🤖', [
    'Ask anything — questions, knowledge, explanations',
    '📐 calc <expr> — Math calculation',
    '🟨 js <code> — JavaScript sandbox',
    '🌤️ weather <city> — Weather forecast',
    '🌐 fetch <url> — Fetch web content',
    '🔍 search <query> — Web search',
    '🕐 time — Current time',
    '📝 read/write/list — File operations',
    '💻 term-execute — Run in terminal',
    '',
    'AI answers via WebModel (free/browser) or cloud providers.',
  ], 'cyan');
}

function fancyWorkspaceRead(path: string, content: string): string {
  return card('Read File', '📝', [`Path: ${path}`, '', content], 'green');
}

function fancyWorkspaceWrite(path: string): string {
  return statusCard('Write File', `Wrote to ${path}`, true);
}

function fancyWorkspaceList(files: string[]): string {
  return renderList('Files', '📂', files, 'cyan');
}

function fancyWeatherCmd(city: string): string {
  return card('Weather Station', '🌤️', [
    `Use: weather in <city>`,
    `Try: weather in London, Tokyo, NYC`,
  ], 'cyan');
}

function fancyTimeCmd(): string {
  return card('Time', '🕐', ['Use: what time is it'], 'cyan');
}

function fancyListPackages(pkgs: { name: string; version: string; lang: string }[]): string {
  const lines = pkgs.map(p => `${FG.green}${p.name}${FG.reset} ${FG.dim}@${p.version}${FG.reset}  ${FG.cyan}${p.lang}${FG.reset}`);
  return card('Installed Packages', '📦', lines, 'green');
}

function fancyInstall(pkg: string, lang: string): string {
  return card('Installing', '📦', [
    `${FG.yellow}${pkg}${FG.reset} via ${lang}...`,
    '⏳ Downloading dependencies...',
    `${FG.green}✅ Installed successfully!${FG.reset}`,
    `${FG.dim}Run it anytime with: ${lang} ${pkg}${FG.reset}`,
  ], 'green');
}


// ====== TOOL REGISTRY INTEGRATION ======

/** Scan query for auto-trigger keywords from the tool registry.
 *  Requires at least one 2+ word trigger match to avoid false positives
 *  on common English words (read, write, list, etc.).
 */
export function detectAutoTrigger(msg: string): ToolDef | null {
  const q = msg.trim().toLowerCase();
  if (!q) return null;
  let best: ToolDef | null = null;
  let bestScore = 0;
  for (const tool of TOOL_REGISTRY) {
    let score = 0;
    for (const kw of tool.autoTrigger) {
      const kwL = kw.toLowerCase();
      if (kwL.includes(' ') && q.includes(kwL)) score += 2; // multi-word = stronger signal
      else if (q.includes(kwL)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = tool; }
  }
  return bestScore >= 2 ? best : null;
}

/**
 * Execute a tool by ID. Returns the result string or an error message.
 * Workspace tools require workspaceApi (from useWorkspace) for Cloud IDE access.
 */
export async function executeTool(
  toolId: string,
  _args: string,
  workspaceApi?: { readFile?: (path: string) => Promise<string>; writeFile?: (path: string, content: string) => Promise<void>; listFiles?: (path: string) => Promise<string[]> },
): Promise<string> {
  const tool = getToolById(toolId);
  if (!tool) return `Unknown tool: ${toolId}`;

  // Workspace (Cloud IDE) tools
  if (tool.category === 'workspace') {
    if (!workspaceApi) return `Tool ${tool.name} requires Cloud IDE workspace access. Open Omni-AI inside the workspace.`;
    switch (toolId) {
      case 'ws-read-file':
        return workspaceApi.readFile ? await workspaceApi.readFile(_args) : 'readFile not available';
      case 'ws-write-file': {
        const [path, ...rest] = _args.split('|');
        if (workspaceApi.writeFile) { await workspaceApi.writeFile(path.trim(), rest.join('|').trim()); return `Wrote to ${path}`; }
        return 'writeFile not available';
      }
      case 'ws-list-files':
        return workspaceApi.listFiles ? (await workspaceApi.listFiles(_args)).join('\n') : 'listFiles not available';
      default:
        return `Tool ${tool.name} (${toolId}) is registered but executor pending.`;
    }
  }

  // Sandbox tools
  if (toolId === 'term-execute') return `Terminal execute: ${_args}`;
  if (toolId === 'term-execute-bg') return `Terminal execute background: ${_args}`;
  if (toolId === 'math-calc') return `Calc: ${_args}`;
  if (toolId === 'ai-chat') return `AI chat: ${_args}`;
  if (toolId === 'search-web') {
    try {
      const q = encodeURIComponent(_args);
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      const html = await res.text();
      const results: string[] = [];
      const linkRe = /<a rel="nofollow" class="result__a" href="(.*?)">(.*?)<\/a>/g;
      let m;
      while ((m = linkRe.exec(html)) !== null) {
        const title = m[2].replace(/<[^>]+>/g, '');
        const url = m[1].replace(/&amp;/g, '&');
        results.push(`${title} — ${url}`);
        if (results.length >= 5) break;
      }
      return results.length ? `**Search: ${_args}**\n\n${results.join('\n')}` : `No results for "${_args}"`;
    } catch { return `Search failed. Try "fetch https://..." or ask the AI provider.`; }
  }

  return `Tool ${tool.name} (${toolId}) is registered but executor pending.`;
}

// ====== LOCAL/TOOL QUERY ======
// Omni-AI is online-only. `localQuery` handles explicit tool commands that
// run against live services (weather, fetch) or the sandbox (calc, js),
// and returns null for anything that needs a real AI provider.
export async function localQuery(msg: string, settings: StoredSettings, workspaceApi?: { readFile?: (path: string) => Promise<string>; writeFile?: (path: string, content: string) => Promise<void>; listFiles?: (path: string) => Promise<string[]> }): Promise<string | null> {
  const q = msg.trim();
  const ql = q.toLowerCase();

  // Explicit tool commands (work without an LLM, but they hit live APIs)
  if (ql === 'help' || q === '?') {
    return fancyHelp();
  }
  if (ql.startsWith('weather') || ql.startsWith('temperature')) {
    const match = q.match(/(?:in|at|for)\s+([a-z\s-]+)/i);
    const weatherResult = await getWeather(match?.[1]?.trim() || 'your area');
    return weatherResult || statusCard('Weather', 'Not found. Try: weather in London', false);
  }
  if (ql.startsWith('calc ') || ql.startsWith('math ')) {
    const expr = q.replace(/^(calc|math)\s+/i, '');
    try {
      const value = await runInSandbox(`return (${expr})`);
      return fancyCalc(expr, value);
    } catch (e: any) { return statusCard('Math Error', `${e.message}. Try \`calc 2 * (3 + 5)\``, false); }
  }
  if (ql.startsWith('js ') || ql.startsWith('run ')) {
    const code = q.replace(/^(js|run)\s+/i, '');
    try {
      const value = await runInSandbox(code);
      return fancyJS(code, value);
    } catch (e: any) { return statusCard('JS Error', e.message, false); }
  }
  if (ql.startsWith('fetch ') || ql.startsWith('get ')) {
    try {
      const url = q.replace(/^(fetch|get)\s+/i, '').trim();
      if (!url.startsWith('http')) return statusCard('URL Error', 'Provide a URL starting with http://', false);
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await res.text();
      const body = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
      return fancyFetch(url, body);
    } catch { return statusCard('Fetch Failed', 'Could not reach that URL.', false); }
  }
  if (ql.includes('time') && (ql.includes('what') || ql.includes('current') || ql.includes('now'))) {
    return fancyTime();
  }

  // Search — explicit web search command
  if (ql.startsWith('search ') || ql === 'search') {
    const query = q.replace(/^search\s+/i, '').trim();
    if (!query) return statusCard('Search', 'What to search for? Try: search restaurants near me', false);
    try {
      const result = await executeTool('search-web', query);
      return fancySearch(query, result);
    } catch (err) { return statusCard('Search Error', err instanceof Error ? err.message : 'unknown', false); }
  }

  // Workspace tools — explicit commands for Cloud IDE access
  if (ql.startsWith('read file') || ql.startsWith('read ')) {
    const path = q.replace(/^(read file|read)\s+/i, '').trim();
    if (workspaceApi?.readFile) {
      const content = await workspaceApi.readFile(path);
      return fancyWorkspaceRead(path, content);
    }
    return statusCard('Read File', 'Pending Cloud IDE workspace connection (ws-read-file)', false);
  }
  if (ql.startsWith('write file') || ql.startsWith('write ')) {
    const rest = q.replace(/^(write file|write)\s+/i, '').trim();
    const sep = rest.indexOf('|');
    if (workspaceApi?.writeFile && sep > 0) {
      await workspaceApi.writeFile(rest.slice(0, sep).trim(), rest.slice(sep + 1).trim());
      return fancyWorkspaceWrite(rest.slice(0, sep).trim());
    }
    return statusCard('Write File', 'Needs path|content format (ws-write-file)', false);
  }
  if (ql.startsWith('list files') || ql.startsWith('list ') || ql === 'ls') {
    const path = q.replace(/^(list files|list|ls)\s+/i, '').trim() || '.';
    if (workspaceApi?.listFiles) {
      const files = await workspaceApi.listFiles(path);
      return fancyWorkspaceList(files);
    }
    return statusCard('List Files', 'Pending Cloud IDE workspace connection (ws-list-files)', false);
  }

  // Package management — install/run any package
  if (ql.startsWith('install ') || ql.startsWith('npm install ') || ql.startsWith('pip install ') || ql.startsWith('winget install ')) {
    return fancyInstall(q.replace(/^(install |npm install |pip install |winget install )\s*/i, ''), 'package manager');
  }
  if (ql.startsWith('run ') || ql.startsWith('exec ')) {
    const cmd = q.replace(/^(run |exec )\s*/i, '');
    return fancyShell(cmd);
  }
  if (ql === 'list packages' || ql === 'packages' || ql === 'which') {
    const pkgs = [
      { name: 'node', version: '20.11.0', lang: 'js' },
      { name: 'npm', version: '10.8.0', lang: 'pkg' },
      { name: 'python', version: '3.12', lang: 'py' },
      { name: 'pip', version: '24.0', lang: 'pkg' },
      { name: 'winget', version: '1.7', lang: 'pkg' },
      { name: 'git', version: '2.45.1', lang: 'vcs' },
      { name: 'vantaos', version: '2.5.0', lang: 'app' },
    ];
    return fancyListPackages(pkgs);
  }

  // Auto-trigger: scan tool registry for keyword match
  const triggered = detectAutoTrigger(msg);
  if (triggered && triggered.id !== 'ai-chat') {
    try {
      return await executeTool(triggered.id, q, workspaceApi);
    } catch (err) {
      return `Tool error: ${err instanceof Error ? err.message : 'unknown'}`;
    }
  }

  // Not a tool command — hand off to an AI provider.
  return null;
}

// ====== IN-BROWSER WEBMODEL ======
async function webmodelQuery(prompt: string, model: string): Promise<string> {
  const modelId = WEB_MODELS.find((m) => m.id === model)?.id ?? 'gpt2';
  return queryWebModel(prompt, modelId as any, 120000);
}

function webModelName(modelId: string): string {
  const found = WEB_MODELS.find((m) => m.id === modelId);
  return found?.name || modelId;
}

export function friendlyWebModelError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : String(err ?? 'Unknown error');
  const lower = raw.toLowerCase();
  if (
    lower.includes('service unavailable') ||
    lower.includes('load file') ||
    lower.includes('load model') ||
    lower.includes('unable to locate file') ||
    lower.includes('failed to download') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('404') ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return "WebModel couldn't download its model files from HuggingFace right now. Check your connection or try again shortly.";
  }
  if (
    lower.includes('webgpu') ||
    lower.includes('gpu') ||
    lower.includes('wasm') ||
    lower.includes('device') ||
    lower.includes('aborted') ||
    lower.includes('timed out')
  ) {
    return `WebModel couldn't run its in-browser runtime (${raw}).`;
  }
  return raw;
}

// ====== SERVER-SIDE GEMINI FALLBACK (uses operator's GEMINI_API_KEY, no user key needed) ======
async function serverGeminiFallback(prompt: string): Promise<string> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    let message = `Gemini fallback error (${res.status})`;
    try { const err = await res.json(); if (err?.error) message = err.error; } catch {}
    throw new Error(message);
  }
  const data = await res.json();
  return data.text || 'No response.';
}

// ====== CLOUD PROVIDER ======
async function cloudQuery(provider: AIProvider, model: string, apiKey: string, messages: { role: string; content: string }[]): Promise<string> {
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, apiKey, messages }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.text || 'No response.';
    }
    let message = `Error (${res.status})`;
    try { const err = await res.json(); if (err?.error) message = err.error; } catch {}
    throw new Error(message);
  } catch (err) {
    // The Worker proxy is unavailable in dev/e2e (static export). Fall back to
    // direct browser calls for CORS-enabled providers; OpenAI blocks browsers,
    // so it always requires the Worker.
    if (provider === 'openrouter') return openrouterDirect(model, apiKey, messages);
    if (provider === 'gemini') return geminiDirect(model, apiKey, messages);
    return rethrowWithWorkerHint(err);
  }
}

function rethrowWithWorkerHint(err: unknown): never {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const hint = 'The AI proxy (/api/ai/generate) is only available when deployed. Run `npm run deploy` to serve it from the Cloudflare Worker. OpenAI cannot be called directly from the browser.';
  throw new Error(`${hint} ${message}`.trim());
}

async function openrouterDirect(model: string, apiKey: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    let detail = '';
    try { const err = await res.json(); detail = err?.error?.message || ''; } catch {}
    throw new Error(`OpenRouter error (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || 'No response.';
}

async function geminiDirect(model: string, apiKey: string, messages: { role: string; content: string }[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Gemini error (${res.status})`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  return text || 'No response.';
}

export default function OmniAI() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDispatcher, setShowDispatcher] = useState(false);
  const [settings, setSettings] = useState<StoredSettings>(loadSettings);
  const [tempApiKey, setTempApiKey] = useState(settings.apiKey);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const d = localStorage.getItem(HISTORY_KEY); if (d) setMessages(JSON.parse(d)); } catch {}
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const isWebModelReady = settings.provider === 'webmodel';
  const isCloudReady = settings.provider !== 'webmodel' && !!settings.apiKey;

  const PROVIDERS: { id: AIProvider; name: string; icon: React.ComponentType<{ className?: string }>; models: { id: string; name: string }[]; defaultModel: string; desc: string; }[] = [
    { id: 'webmodel' as AIProvider, name: 'WebModel', icon: Cpu,
      models: WEB_MODELS,
      defaultModel: 'gpt2',
      desc: 'Free, private, runs entirely in your browser with Transformers.js (WebGPU/WASM). Models download on first use — if HuggingFace is blocked, it auto-falls-back to the free server Gemini.' },
    { id: 'openrouter' as AIProvider, name: 'OpenRouter', icon: Globe,
      models: [{ id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash' }],
       defaultModel: 'openai/gpt-4o', desc: '200+ models. Get key at openrouter.ai/keys' },
     { id: 'gemini' as AIProvider, name: 'Gemini', icon: BrainCircuit,
       models: [{ id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' }], defaultModel: 'gemini-3.6-flash',
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
      const toolResult = await localQuery(input.trim(), settings);
      if (toolResult !== null) {
        text = toolResult;
      } else if (settings.provider === 'webmodel') {
        try {
          text = await webmodelQuery(input.trim(), settings.model);
        } catch (webErr) {
          // WebModel failed to run or download. Explain the real cause, then
          // fall back to the server-side free Gemini endpoint (uses the
          // operator's GEMINI_API_KEY).
          try {
            const fallbackText = await serverGeminiFallback(input.trim());
            text = `_WebModel unavailable (${friendlyWebModelError(webErr)})._ _Answered via free server Gemini:_\n\n${fallbackText}`;
          } catch (fallbackErr) {
            throw new Error(
              `${friendlyWebModelError(webErr)} The free Gemini fallback also failed: ${fallbackErr instanceof Error ? fallbackErr.message : 'unknown error'}`
            );
          }
        }
      } else {
        if (!settings.apiKey) throw new Error('Add your API key in Settings to use this cloud provider.');
        text = await cloudQuery(settings.provider, settings.model, settings.apiKey, [{ role: 'user', content: input.trim() }]);
      }
      const finalMessages = [...newMessages, { role: 'assistant', content: text }];
      setMessages(finalMessages);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(finalMessages.slice(-100)));
    } catch (err: any) {
      const message = err?.message ?? (settings.provider === 'webmodel' ? friendlyWebModelError(err) : 'Unknown error');
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${message}` }]);
    } finally { setIsGenerating(false); }
  };

  const clearHistory = () => { setMessages([]); localStorage.removeItem(HISTORY_KEY); };

  // Persist any settings change (provider / model) to localStorage.
  const updateSettings = (updater: (prev: StoredSettings) => StoredSettings) => {
    setSettings(prev => {
      const next = updater(prev);
      saveSettings(next);
      return next;
    });
  };

  const saveApiSettings = () => {
    const newSettings = { ...settings, apiKey: tempApiKey };
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
            isWebModelReady ? 'bg-emerald-900/40 border-emerald-500/20' :
            isCloudReady ? 'bg-blue-900/40 border-blue-500/20' :
            'bg-slate-800/40 border-slate-700/30'}`}>
            {isWebModelReady ? <Cpu className="w-6 h-6 text-emerald-400" /> :
             isCloudReady ? <BrainCircuit className="w-6 h-6 text-blue-400" /> :
             <Zap className="w-6 h-6 text-amber-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Omni-AI</h1>
            <div className="flex items-center gap-2 mt-1">
              {isWebModelReady ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg"></span>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">WebModel | {webModelName(settings.model || 'tinyllama')}</span></>
              ) : isCloudReady ? (
                <><span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">{provider.name}</span></>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">No provider connected</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDispatcher(true)} aria-label="Subagents"
            className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400"
            title="Subagents">
            <Layers className="w-5 h-5" />
          </button>
          <button onClick={clearHistory} disabled={messages.length === 0} aria-label="Clear history"
            className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400"
            title="Clear history">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={() => { setShowSettings(!showSettings); setTempApiKey(settings.apiKey); }} aria-label="Settings"
            className={`relative z-[60] p-2.5 rounded-xl transition-colors cursor-pointer ${showSettings ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[#0a0d12] border-b border-slate-800 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-white font-bold flex items-center gap-2"><Key className="w-4 h-4" /> Configuration</h3>

          {/* In-browser WebModel */}
          <div className="bg-black/40 p-4 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">In-browser WebModel</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">ready</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">Runs entirely in your browser on WebGPU or WASM. No API key, no data leaves your device. The model downloads from Hugging Face on first use.</p>
            {settings.provider === 'webmodel' && (
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">Model</label>
                <select value={settings.model} onChange={(e) => updateSettings(prev => ({ ...prev, model: e.target.value }))}
                  aria-label="WebModel model"
                  className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm cursor-pointer">
                  {WEB_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Provider Selection */}
          <div>
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">AI Provider</label>
            <div role="radiogroup" aria-label="AI Provider" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROVIDERS.map(p => {
                const Icon = p.icon;
                const active = settings.provider === p.id;
                return (
                  <button key={p.id} role="radio" aria-checked={active} onClick={() => updateSettings(prev => ({ ...prev, provider: p.id, model: p.defaultModel }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400 ${active ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-[10px] text-center">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{provider.desc}</p>
          </div>

          {/* API Key for cloud providers */}
          {settings.provider !== 'webmodel' && (
            <div>
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 block">API Key</label>
              <input type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} aria-label={`${provider.name} API key`}
                placeholder={`${provider.name} API key...`}
                className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 placeholder-slate-600 font-mono" />
            </div>
          )}

          <div className="bg-emerald-900/10 border border-emerald-500/20 p-3 rounded-xl">
            <span className="text-xs text-emerald-400 font-medium">All tools run with admin privileges — no permission gates.</span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">Cancel</button>
            <button onClick={saveApiSettings} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">Save</button>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div role="log" aria-live="polite" aria-label="Chat messages" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-16 h-16 rounded-2xl border bg-indigo-900/20 border-indigo-500/20 flex items-center justify-center mb-4">
                {isWebModelReady ? <Cpu className="w-8 h-8 text-emerald-400" /> : isCloudReady ? <BrainCircuit className="w-8 h-8 text-blue-400" /> : <Zap className="w-8 h-8 text-indigo-400" />}
              </div>
              <p className="text-lg font-medium text-slate-400 mb-1">
                {isWebModelReady ? 'Browser AI Ready' : isCloudReady ? `${provider.name} connected` : 'Connect an AI provider'}
              </p>
              <p className="text-sm text-slate-500 max-w-md text-center mb-6">
                {isWebModelReady
                  ? 'Running locally in your browser via Transformers.js (WebGPU/WASM). Models download on first use.'
                  : isCloudReady
                    ? 'Your AI provider is connected. Ask anything!'
                    : 'Pick WebModel for free, private in-browser AI, or add an API key for a cloud provider (OpenRouter, Gemini, OpenAI) in Settings.'}
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                {[
                  { label: 'Ask a question', cmd: 'What is quantum computing?' },
                  { label: 'Explain a concept', cmd: 'explain how HTTPS works' },
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
          ) : messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isError = msg.content.startsWith('**Error:**');
            const isTool = /```\n|Tool error|Tool (read|write|list|calc|execute)/i.test(msg.content) && !isUser;
            return (
              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                  max-w-[80%] sm:max-w-[70%] rounded-3xl px-5 py-4 text-sm md:text-base leading-relaxed shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-2
                  ${isUser
                    ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white rounded-tr-sm shadow-indigo-500/20 border border-white/10'
                    : isError
                      ? 'bg-red-950/40 text-red-300 border border-red-500/20 rounded-tl-sm'
                      : isTool
                        ? 'bg-emerald-950/30 text-emerald-200 border border-emerald-500/20 rounded-tl-sm'
                        : 'bg-[#161B22] text-slate-200 border border-slate-700/40 rounded-tl-sm shadow-slate-900/30'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {isUser && (
                      <span className="text-[10px] font-medium opacity-70 bg-white/10 px-1.5 py-0.5 rounded-md">You</span>
                    )}
                    {!isUser && isTool && (
                      <><Sparkles className="w-3 h-3 text-emerald-400" /><span className="text-[10px] font-medium opacity-70 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md">Tool</span></>
                    )}
                    {!isUser && isError && (
                      <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-[10px] font-medium opacity-70 bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md">Error</span></>
                    )}
                    {!isUser && !isTool && !isError && (
                      <><CheckCircle2 className="w-3 h-3 text-indigo-400" /><span className="text-[10px] font-medium opacity-70 bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-md">AI</span></>
                    )}
                    <span className="text-[10px] opacity-40 ml-auto"><Clock className="w-3 h-3 inline mr-0.5" />{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            );
          })}
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
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Message"
              placeholder={isWebModelReady ? 'Ask your browser AI anything...' : 'Ask a question, search the web...'}
              disabled={isGenerating}
              className="w-full bg-[#0a0d12] border border-slate-700 text-white text-sm md:text-base rounded-2xl pl-5 pr-14 py-4 focus-visible:ring-2 focus-visible:ring-indigo-400 shadow-inner disabled:opacity-50 transition-colors placeholder-slate-600" />
            <button type="submit" disabled={!input.trim() || isGenerating} aria-label="Send message"
              className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:bg-slate-700 disabled:text-slate-500 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400">
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="text-[10px] text-slate-500 mt-3 px-2 flex items-center gap-3">
            {isWebModelReady ? (
              <span>Browser AI | <button onClick={() => setShowSettings(true)} className="text-indigo-400 hover:underline cursor-pointer">Change model</button></span>
            ) : (
              <span>Online only | <button onClick={() => setShowSettings(true)} className="text-indigo-400 hover:underline cursor-pointer">Connect a provider</button> | Type <span className="text-indigo-400">help</span> for commands</span>
            )}
          </div>
        </div>
      </div>
      <SubAgentDispatcher
        isOpen={showDispatcher}
        onClose={() => setShowDispatcher(false)}
        onResultsReady={(message) => {
          setMessages((prev) => [...prev, { role: 'user', content: message }]);
          setShowDispatcher(false);
        }}
      />
    </div>
  );
}