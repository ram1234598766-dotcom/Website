import React, { useState } from 'react';
import { Server, Play, StopCircle, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

  const connectToOllama = async () => {
    setStatus('connecting');
    setError('');
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setModels(data.models || []);
      setStatus('connected');
      if (data.models && data.models.length > 0) {
        setSelectedModel(data.models[0].name);
      }
    } catch (err: any) {
      console.error(err);
      setStatus('disconnected');
      setError('Connection to local daemon failed. Switching to Cloud Fallback via Backend Software...');
      
      // Fallback to Gemini
      setTimeout(() => {
        setModels([{ name: 'gemini-fallback', size: 0, digest: '', modified_at: '' }]);
        setSelectedModel('gemini-fallback');
        setStatus('connected');
        setError(null);
      }, 1500);
    }
  };

  const runInference = async () => {
    if (!selectedModel || !prompt.trim()) return;
    setIsGenerating(true);
    setResponse('');
    setError('');

    try {
      let res;
      let isFallback = selectedModel === 'gemini-fallback';
      
      if (isFallback) {
          res = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
          });
          if (!res.ok) throw new Error('Generation failed');
          const data = await res.json();
          if (data.text) {
              setResponse(data.text);
          }
          return;
      } else {
          res = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: selectedModel,
              prompt: prompt,
              stream: true,
            }),
          });
      }

      if (!res.ok) throw new Error('Generation failed');
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(l => l.trim() !== '');
          for (const line of lines) {
            const data = JSON.parse(line);
            if (data.response) {
              setResponse(prev => prev + data.response);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-[85vh] animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Ollama Local Engine</h2>
          <p className="text-slate-400 mt-1">Connect to your local Ollama instance for private inference.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-sm">
            <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" /> Connection settings
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
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {status === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                 status === 'connected' ? <CheckCircle2 className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {status === 'connecting' ? 'Connecting...' : 
                 status === 'connected' ? 'Connected' : 'Connect'}
              </button>
              
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-xs text-rose-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
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
                 {models.map(m => (
                   <option key={m.name} value={m.name}>{m.name} ({(m.size / 1024 / 1024 / 1024).toFixed(2)} GB)</option>
                 ))}
               </select>
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-slate-800 bg-[#161b22] flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                Local Inference Playground
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
                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                   <Server className="w-12 h-12 mb-4 opacity-50" />
                   <p>Connect to Ollama and select a model to begin.</p>
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
                  className="flex-1 bg-slate-950 border border-slate-700 text-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none h-12"
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

// Ensure CheckCircle2 is imported, I forgot it in the import list. I'll add it.
