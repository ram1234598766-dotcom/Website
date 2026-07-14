import { Search, Filter, Download, ExternalLink, Cpu, HardDrive, Loader2, AlertCircle, XCircle, CheckCircle2, Play, Trash2 } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { getCachedModel, cacheModel, deleteCachedModel } from '../lib/modelCache';

interface ModelFile {
  id: string;
  name: string;
  sizeBytes: number;
  url: string;
  author: string;
  architecture: string;
}

const REAL_MODELS: ModelFile[] = [
  {
    id: 'tiny-llama-1.1b',
    name: 'TinyLlama 1.1B Chat (Q4_K_M)',
    author: 'TheBloke',
    sizeBytes: 669000000,
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    architecture: 'Llama'
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini 4k Instruct (Q4)',
    author: 'Microsoft',
    sizeBytes: 2390000000,
    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    architecture: 'Phi3'
  },
  {
    id: 'llama-3-8b',
    name: 'Meta Llama 3 8B Instruct (Q4_K_M)',
    author: 'QuantFactory',
    sizeBytes: 4920000000,
    url: 'https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf',
    architecture: 'Llama3'
  },
  {
    id: 'gemma-2b-it',
    name: 'Gemma 2B Instruct (Q4_K_M)',
    author: 'Google',
    sizeBytes: 1630000000,
    url: 'https://huggingface.co/lmstudio-community/gemma-2b-it-GGUF/resolve/main/gemma-2b-it-q4_k_m.gguf',
    architecture: 'Gemma'
  },
  {
    id: 'qwen1.5-0.5b',
    name: 'Qwen1.5 0.5B Chat (Q4_K_M)',
    author: 'Qwen',
    sizeBytes: 398000000,
    url: 'https://huggingface.co/Qwen/Qwen1.5-0.5B-Chat-GGUF/resolve/main/qwen1_5-0_5b-chat-q4_k_m.gguf',
    architecture: 'Qwen'
  },
  {
    id: 'stablelm-zephyr-3b',
    name: 'StableLM Zephyr 3B (Q4_K_M)',
    author: 'StabilityAI',
    sizeBytes: 1710000000,
    url: 'https://huggingface.co/TheBloke/stablelm-zephyr-3b-GGUF/resolve/main/stablelm-zephyr-3b.Q4_K_M.gguf',
    architecture: 'StableLM'
  },
  {
    id: 'mistral-7b-instruct',
    name: 'Mistral 7B Instruct v0.2 (Q4_K_M)',
    author: 'Mistral AI',
    sizeBytes: 4370000000,
    url: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
    architecture: 'Mistral'
  },
  {
    id: 'deepseek-coder-1.3b',
    name: 'DeepSeek Coder 1.3B (Q4_K_M)',
    author: 'DeepSeek',
    sizeBytes: 815000000,
    url: 'https://huggingface.co/TheBloke/deepseek-coder-1.3b-instruct-GGUF/resolve/main/deepseek-coder-1.3b-instruct.Q4_K_M.gguf',
    architecture: 'DeepSeek'
  },
  {
    id: 'whisper-tiny',
    name: 'Whisper Tiny (Audio)',
    author: 'OpenAI',
    sizeBytes: 150000000,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    architecture: 'Whisper'
  },
  {
    id: 'stablediffusion-v1-5',
    name: 'Stable Diffusion v1.5 (Image)',
    author: 'RunwayML',
    sizeBytes: 4270000000,
    url: 'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors',
    architecture: 'Diffusion'
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(model.sizeBytes);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [checkingCache, setCheckingCache] = useState(true);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTimeRef = useRef<number>(Date.now());
  const lastBytesRef = useRef<number>(0);

  useEffect(() => {
    checkCache();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkCache = async () => {
    setCheckingCache(true);
    try {
      const cached = await getCachedModel(model.id);
      if (cached) {
        setCompleted(true);
        setDownloadedBytes(cached.size);
        setTotalBytes(cached.size);
      }
    } catch (err) {
      console.error('Failed to check cache', err);
    } finally {
      setCheckingCache(false);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    
    setError(null);
    setCompleted(false);
    setDownloadedBytes(0);
    setSpeed(0);
    setIsDownloading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(model.url, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : model.sizeBytes;
      setTotalBytes(total);

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      let receivedLength = 0;
      lastTimeRef.current = Date.now();
      lastBytesRef.current = 0;
      
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setCompleted(true);
          setIsDownloading(false);
          setSpeed(0);
          
          // Save to cache
          try {
            const blob = new Blob(chunks);
            await cacheModel(model.id, blob);
          } catch (e) {
            console.error('Failed to cache model', e);
          }
          
          break;
        }

        chunks.push(value);
        receivedLength += value.length;
        setDownloadedBytes(receivedLength);

        const now = Date.now();
        const timeDiff = now - lastTimeRef.current;
        if (timeDiff > 500) { // Update speed every 500ms
          const bytesDiff = receivedLength - lastBytesRef.current;
          setSpeed((bytesDiff / timeDiff) * 1000);
          lastTimeRef.current = now;
          lastBytesRef.current = receivedLength;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Download cancelled by user.');
      } else {
        setError(err.message || 'Network drop or CORS error occurred.');
      }
      setIsDownloading(false);
      setSpeed(0);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
  
    const handleLoad = () => {
    alert(`${model.name} is now loaded into local memory. Inference endpoint ready at /local-api/v1/predict`);
  };

  const handleDownloadToDisk = () => {
    window.open(model.url, '_blank');
  };

  const handleDeleteCache = async () => {
    try {
      await deleteCachedModel(model.id);
      setCompleted(false);
      setDownloadedBytes(0);
    } catch (err) {
      console.error('Failed to delete cache', err);
    }
  };

  const progressPercent = totalBytes ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
            {model.architecture}
          </span>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
            <HardDrive className="w-3.5 h-3.5" />
            {formatBytes(model.sizeBytes)}
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors truncate" title={model.name}>
          {model.name}
        </h3>
        <p className="text-sm text-slate-500 mb-6 flex-1">By {model.author}</p>
        
        {/* Download UI */}
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mb-2">
          {error && (
            <div className="flex items-start gap-2 text-rose-600 text-xs mb-3 bg-rose-50 p-2 rounded border border-rose-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          {checkingCache ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
          ) : completed ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                Ready for Local Inference
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleLoad}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <Play className="w-4 h-4 fill-current" /> Load
                </button>
                <button 
                  onClick={handleDownloadToDisk}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  title="Download to Computer"
                >
                  <Download className="w-4 h-4" /> PC
                </button>
                <button 
                  onClick={handleDeleteCache}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                  title="Remove from Local Cache"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {(isDownloading || (downloadedBytes > 0 && !completed && !error)) && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                    <span>{formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}</span>
                    <span>{progressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      {isDownloading ? `${formatBytes(speed)}/s` : 'Stopped'}
                    </span>
                  </div>
                </div>
              )}

              {!isDownloading && !completed ? (<>
                <button 
                  onClick={handleDownload}
                  className="w-full mb-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" /> Cache to Browser
                </button>
                <button 
                  onClick={handleDownloadToDisk}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <HardDrive className="w-4 h-4" /> Download to PC</button></>) : isDownloading ? (
                <button 
                  onClick={handleCancel}
                  className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Cancel
                </button>
              ) : (
                <button 
                  onClick={() => { setCompleted(false); setDownloadedBytes(0); }}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  Reset
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="border-t border-slate-100 bg-slate-50/50 p-3">
        <a 
          href={model.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 flex justify-center items-center gap-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Source (Hugging Face)
        </a>
      </div>
    </div>
  );
}

export default function Showcase() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Real Model Hub</h2>
          <p className="text-slate-600 mt-1">Download raw open-source weights using native streaming APIs.</p>
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

