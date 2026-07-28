import { Search, Filter, Download, ExternalLink, Cpu, HardDrive, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import React, { useState } from 'react';

interface ModelFile {
  id: string;
  name: string;
  sizeBytes: number;
  url: string; // Used for external reference now
  author: string;
  architecture: string;
  ollamaTag: string;
}

const REAL_MODELS: ModelFile[] = [
  {
    id: 'llama3',
    name: 'Meta Llama 3 (8B)',
    author: 'Meta',
    sizeBytes: 4700000000,
    url: 'https://ollama.com/library/llama3',
    architecture: 'Llama3',
    ollamaTag: 'llama3'
  },
  {
    id: 'phi3',
    name: 'Phi-3 Mini',
    author: 'Microsoft',
    sizeBytes: 2300000000,
    url: 'https://ollama.com/library/phi3',
    architecture: 'Phi3',
    ollamaTag: 'phi3'
  },
  {
    id: 'gemma2',
    name: 'Gemma 2 (9B)',
    author: 'Google',
    sizeBytes: 5400000000,
    url: 'https://ollama.com/library/gemma2',
    architecture: 'Gemma2',
    ollamaTag: 'gemma2'
  },
  {
    id: 'mistral',
    name: 'Mistral (7B)',
    author: 'Mistral AI',
    sizeBytes: 4100000000,
    url: 'https://ollama.com/library/mistral',
    architecture: 'Mistral',
    ollamaTag: 'mistral'
  },
  {
    id: 'qwen2',
    name: 'Qwen 2 (7B)',
    author: 'Alibaba Cloud',
    sizeBytes: 4400000000,
    url: 'https://ollama.com/library/qwen2',
    architecture: 'Qwen2',
    ollamaTag: 'qwen2'
  },
  {
    id: 'llava',
    name: 'LLaVA (Vision)',
    author: 'Haotian Liu',
    sizeBytes: 4500000000,
    url: 'https://ollama.com/library/llava',
    architecture: 'Vision',
    ollamaTag: 'llava'
  },
  {
    id: 'codellama',
    name: 'Code Llama (7B)',
    author: 'Meta',
    sizeBytes: 4200000000,
    url: 'https://ollama.com/library/codellama',
    architecture: 'Llama2',
    ollamaTag: 'codellama'
  },
  {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    author: 'DeepSeek',
    sizeBytes: 8900000000,
    url: 'https://ollama.com/library/deepseek-coder-v2',
    architecture: 'DeepSeek',
    ollamaTag: 'deepseek-coder-v2'
  },
  {
    id: 'mixtral',
    name: 'Mixtral (8x7B)',
    author: 'Mistral AI',
    sizeBytes: 26000000000,
    url: 'https://ollama.com/library/mixtral',
    architecture: 'MoE',
    ollamaTag: 'mixtral'
  },
  {
    id: 'tinyllama',
    name: 'TinyLlama (1.1B)',
    author: 'Zhang et al.',
    sizeBytes: 637000000,
    url: 'https://ollama.com/library/tinyllama',
    architecture: 'Llama',
    ollamaTag: 'tinyllama'
  }
];

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const ModelCard: React.FC<{ model: ModelFile }> = ({ model }) => {
  const [pullStatus, setPullStatus] = useState<'idle' | 'pulling' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const pullModel = async () => {
    setPullStatus('pulling');
    setErrorMsg('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model.ollamaTag, stream: false }),
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPullStatus('success');
      setTimeout(() => setPullStatus('idle'), 3000);
    } catch {
      setPullStatus('error');
    }
  };

  const copyPullCommand = () => {
    const cmd = `ollama pull ${model.ollamaTag}`;
    navigator.clipboard.writeText(cmd);
    setErrorMsg(`Copied! Run in terminal: ${cmd}`);
    setTimeout(() => { setPullStatus('idle'); setErrorMsg(''); }, 2500);
  };

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <span className="px-2.5 py-1 bg-indigo-500/15 text-indigo-300 text-[10px] font-bold rounded-md uppercase tracking-wider">
            {model.architecture}
          </span>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold bg-[#0a0a0c] px-2 py-1 rounded-md border border-slate-100">
            <HardDrive className="w-3.5 h-3.5" />
            {formatBytes(model.sizeBytes)}
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-600 transition-colors truncate" title={model.name}>
          {model.name}
        </h3>
        <p className="text-sm text-slate-400 mb-6 flex-1">By {model.author}</p>
        
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-2 flex flex-col gap-2">
          <div className="text-xs text-slate-400 font-mono">Terminal Command</div>
          <div className="flex items-center justify-between bg-black/50 p-2 rounded-lg border border-slate-700">
            <code className="text-emerald-400 font-mono text-xs">ollama run {model.ollamaTag}</code>
            <button 
              onClick={() => navigator.clipboard.writeText(`ollama run ${model.ollamaTag}`)}
              className="text-slate-400 hover:text-white transition-colors"
              title="Copy Command"
            >
              <Cpu className="w-4 h-4" />
            </button>
          </div>
          
          {pullStatus === 'error' && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-start gap-2 text-amber-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Run this in your terminal:</span>
              </div>
              <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-slate-700">
                <code className="text-emerald-400 text-[11px] font-mono flex-1 truncate">ollama pull {model.ollamaTag}</code>
                <button onClick={copyPullCommand} className="shrink-0 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded transition-colors">Copy</button>
              </div>
              <p className="text-[10px] text-slate-500">Enable CORS first: <code className="text-amber-400">OLLAMA_ORIGINS=* ollama serve</code></p>
            </div>
          )}
          {pullStatus === 'success' && (
            <div className="flex items-start gap-2 text-emerald-400 text-xs mt-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Model pulled successfully!</span>
            </div>
          )}

          <button
            onClick={pullModel}
            disabled={pullStatus === 'pulling'}
            className="w-full mt-2 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
             {pullStatus === 'pulling' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
             Pull to Local Ollama
          </button>
        </div>
        
        <a 
          href={model.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold rounded-lg transition-colors border border-white/10 mt-2"
        >
          View in Ollama Library <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default function Showcase() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Ollama Model Hub</h2>
          <p className="text-slate-400 mt-1">Discover open-source models and run them instantly via Ollama.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REAL_MODELS.map(model => (
          <ModelCard key={model.id} model={model} />
        ))}
      </div>
    </div>
  );
}
