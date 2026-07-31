import React, { useState } from 'react';
import { Server, Play, RefreshCw, AlertTriangle, CheckCircle2, Terminal, Copy } from 'lucide-react';

interface OllamaModel { name: string; }

export default function OllamaLocal() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const connectToOllama = async () => {
    setStatus('connecting');
    setError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${ollamaUrl}/api/tags`, {
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const modelList: OllamaModel[] = Array.isArray(data?.models) ? data.models : [];
      setModels(modelList);
      setStatus('connected');
      if (modelList.length > 0) setSelectedModel(modelList[0].name);
    } catch (err) {
      setStatus('disconnected');
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Connection timed out — Ollama did not respond. Is the server running?');
      } else if (err instanceof Error && err.message.startsWith('HTTP')) {
        setError(`Ollama returned ${err.message} — the server may be running without CORS enabled.`);
      } else {
        setError('Cannot reach Ollama. To use it, run this in your terminal first:');
      }
    }
  };

  const copySetupCmd = () => {
    const cmd = navigator.userAgent.includes('Windows')
      ? 'set OLLAMA_ORIGINS=* && ollama serve'
      : 'OLLAMA_ORIGINS=* ollama serve';
    navigator.clipboard.writeText(cmd);
    setNotice('Command copied! ' + (navigator.userAgent.includes('Windows') ? 'Run in Command Prompt as Admin' : 'Run in your terminal') + ', then click Retry.');
    setTimeout(() => setNotice(''), 3000);
  };

  const copyTestCmd = () => {
    navigator.clipboard.writeText('curl -s http://localhost:11434/api/tags');
    setNotice('Test command copied! Paste and run in your terminal.');
    setTimeout(() => setNotice(''), 2500);
  };

  const runInference = async () => {
    if (!selectedModel || !prompt.trim()) return;
    setIsGenerating(true);
    setResponse('');
    setError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, prompt, stream: false }),
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResponse(data.response || 'No response.');
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'AbortError' ? 'Request timed out' : err instanceof Error ? err.message : 'Generation failed');
    } finally { setIsGenerating(false); }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-[85vh] animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Ollama Local Engine</h2>
          <p className="text-slate-400 mt-1">Run models locally on your machine.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-sm">
            <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" /> Connection
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="ollama-url" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ollama URL</label>
                <input id="ollama-url" type="text" value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-white/10 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-indigo-500" />
              </div>

              {status !== 'connected' ? (
                <button onClick={connectToOllama} disabled={status === 'connecting'}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                  {status === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                  {status === 'connecting' ? 'Connecting...' : 'Test Connection'}
                </button>
              ) : (
                <button onClick={connectToOllama}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
                  <CheckCircle2 className="w-4 h-4" /> Connected ({models.length} models)
                </button>
              )}

              {notice && (
                <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{notice}</span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs space-y-2">
                  <div className="flex items-start gap-2 text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <p className="text-slate-400 text-[10px]">1. Enable CORS and restart Ollama:</p>
                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-slate-700">
                      <code className="text-emerald-400 font-mono text-[11px] flex-1">set OLLAMA_ORIGINS=* && ollama serve</code>
                      <button onClick={copySetupCmd} aria-label="Copy setup command" className="shrink-0 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-slate-400 text-[10px]">2. In another terminal, test the connection:</p>
                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-slate-700">
                      <code className="text-indigo-400 font-mono text-[11px] flex-1">curl -s http://localhost:11434/api/tags</code>
                      <button onClick={copyTestCmd} aria-label="Copy test command" className="shrink-0 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-slate-500 text-[10px] pt-1">3. Click <strong className="text-white">Test Connection</strong> again after setup.</p>
                  </div>
                </div>
              )}

              {status === 'connected' && (
                <div>
                  <label htmlFor="ollama-model" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Model</label>
                  <select id="ollama-model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0c] border border-white/10 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-indigo-500">
                    {models.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col">
          <div className="bg-[#0a0d12] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-slate-800 bg-[#161b22] flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">Inference</span>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto font-mono text-sm">
               {response ? (
                 <div className="text-emerald-400 whitespace-pre-wrap leading-relaxed">{response}</div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500">
                   <Terminal className="w-12 h-12 mb-4 opacity-30" />
                   <p>Connect to Ollama and select a model.</p>
                 </div>
               )}
               {isGenerating && (
                 <div className="mt-4 flex items-center gap-2">
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-75"></span>
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-150"></span>
                 </div>
               )}
            </div>

            <div className="p-4 bg-[#161b22] border-t border-slate-800">
              <div className="flex gap-2">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  aria-label="Prompt"
                  placeholder="Ask the model..."
                  disabled={status !== 'connected' || isGenerating}
                  className="flex-1 bg-black/40 border border-slate-700 text-slate-300 rounded-lg px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 resize-none h-12 placeholder-slate-600" />
                <button onClick={runInference} aria-label="Run inference"
                  disabled={status !== 'connected' || !prompt.trim() || isGenerating}
                  className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:bg-slate-700 flex items-center justify-center">
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
