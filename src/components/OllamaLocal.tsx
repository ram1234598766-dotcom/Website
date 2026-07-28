import React, { useState } from 'react';
import { Server, Play, RefreshCw, AlertTriangle, CheckCircle2, Terminal, Copy } from 'lucide-react';
import { motion } from 'motion/react';

export default function OllamaLocal() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [models, setModels] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCurlHelp, setShowCurlHelp] = useState(false);

  const connectToOllama = async () => {
    setStatus('connecting');
    setError('');
    setShowCurlHelp(false);
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
      setModels(data.models || []);
      setStatus('connected');
      if (data.models && data.models.length > 0) {
        setSelectedModel(data.models[0].name);
      }
    } catch (err: any) {
      console.error(err);
      setStatus('disconnected');
      if (err.name === 'AbortError') {
        setError('Connection timed out. Make sure Ollama is running.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('Browser cannot reach Ollama directly due to CORS restrictions.');
        setShowCurlHelp(true);
      } else {
        setError(err.message || 'Connection failed');
      }
    }
  };

  const curlTestCommand = `curl -s http://localhost:11434/api/tags | head -20`;

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
        body: JSON.stringify({ model: selectedModel, prompt: prompt, stream: false }),
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResponse(data.response || 'No response generated.');
    } catch (err: any) {
      if (err.name === 'AbortError') setError('Request timed out');
      else setError(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCurlCmd = (cmd: string) => navigator.clipboard.writeText(cmd);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-[85vh] animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Ollama Local Engine</h2>
          <p className="text-slate-400 mt-1">Run models locally on your machine via Ollama.</p>
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ollama URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0c] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={connectToOllama}
                disabled={status === 'connecting'}
                className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                  status === 'connected'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {status === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                 status === 'connected' ? <CheckCircle2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {status === 'connecting' ? 'Connecting...' :
                 status === 'connected' ? 'Connected' : 'Connect'}
              </button>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{error}</span>
                    {showCurlHelp && (
                      <div className="mt-2 space-y-2">
                        <p className="text-slate-400">To test, run this in your terminal:</p>
                        <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-slate-700">
                          <code className="text-emerald-400 text-[10px] font-mono flex-1">{curlTestCommand}</code>
                          <button onClick={() => copyCurlCmd(curlTestCommand)} className="text-slate-400 hover:text-white shrink-0">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-slate-500">Enable CORS: <code className="text-amber-400">OLLAMA_ORIGINS=* ollama serve</code></p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {status === 'connected' && (
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-sm">
               <h3 className="font-bold text-slate-200 mb-4">Available Models ({models.length})</h3>
               <select
                 value={selectedModel}
                 onChange={(e) => setSelectedModel(e.target.value)}
                 className="w-full px-3 py-2 bg-[#0a0a0c] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
               >
                 {models.map((m: any) => (
                   <option key={m.name} value={m.name}>{m.name}</option>
                 ))}
               </select>
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col">
          <div className="bg-[#0a0d12] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-slate-800 bg-[#161b22] flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                Inference Playground
              </span>
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
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt..."
                  disabled={status !== 'connected' || isGenerating}
                  className="flex-1 bg-black/40 border border-slate-700 text-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none h-12 placeholder-slate-600"
                />
                <button
                  onClick={runInference}
                  disabled={status !== 'connected' || !prompt.trim() || isGenerating}
                  className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:bg-slate-700 flex items-center justify-center"
                >
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
