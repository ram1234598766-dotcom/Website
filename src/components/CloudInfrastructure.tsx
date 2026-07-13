import { Server, Cpu, HardDrive, Network, Zap, CheckCircle2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { aiTrainerStore } from '../utils/aiTrainerWorker';

export default function CloudInfrastructure() {
  const [stats, setStats] = useState(aiTrainerStore.getStats());

  useEffect(() => {
    const unsubscribe = aiTrainerStore.subscribe((newStats) => {
      setStats(newStats);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col gap-10 w-full max-w-5xl mx-auto animate-in fade-in duration-500 pb-16">
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full mb-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">100% Free Forever Tier</span>
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Global Free Cloud Infrastructure</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          We believe AI compute is a fundamental right. Our distributed cloud infrastructure allows any developer to deploy custom models at near-zero cost.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Compute', value: '100 GB RAM', sub: 'Burstable DDR5', icon: <Cpu className="w-5 h-5 text-indigo-500" /> },
          { title: 'Storage', value: '50 TB', sub: 'NVMe Gen5', icon: <HardDrive className="w-5 h-5 text-indigo-500" /> },
          { title: 'Accelerator', value: 'Premium GPU', sub: 'Dedicated Node', icon: <Zap className="w-5 h-5 text-amber-500" /> },
          { title: 'Bandwidth', value: 'Unlimited', sub: 'Global CDN edges', icon: <Network className="w-5 h-5 text-emerald-500" /> },
        ].map((spec, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-start gap-3">
            <div className="p-2 bg-slate-50 rounded-lg">{spec.icon}</div>
            <div>
              <p className="text-sm font-medium text-slate-500">{spec.title}</p>
              <p className="text-2xl font-bold text-slate-900">{spec.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{spec.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 md:p-12 text-white overflow-hidden relative shadow-2xl">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-2xl font-bold mb-4">Zero-Friction Deployment</h3>
            <p className="text-slate-300 leading-relaxed mb-8">
              Deploying a model shouldn't require DevOps expertise. With OpenLayer, you can deploy a Lion model to our edge network with a single command. The infrastructure automatically handles load balancing, cold starts, and hardware acceleration.
            </p>
            <div className="space-y-4">
              {[
                'Automated Docker containerization',
                'Native ONNX/TensorRT optimization',
                'Global Edge routing (Sub 50ms latency)',
                'DDoS protection included'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-200">{feature}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 backdrop-blur-md font-mono text-sm shadow-xl">
            <div className="flex gap-2 mb-4 border-b border-slate-700 pb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
            </div>
            <div className="text-slate-300 space-y-2">
              <p><span className="text-indigo-400">$</span> lion deploy ./my-model</p>
              <p className="text-slate-500">&gt; Analyzing model architecture...</p>
              <p className="text-slate-500">&gt; Optimizing for T4 GPU...</p>
              <p className="text-slate-500">&gt; Provisioning container...</p>
              <p className="text-emerald-400 mt-4 font-bold mb-2">✓ Deployed successfully in 4.2s</p>
              <div className="flex items-center gap-2 mt-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                <a href="/deployed/my-model" target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200 hover:underline cursor-pointer flex-1 truncate text-xs sm:text-sm">
                  {window.location.origin}/deployed/my-model
                </a>
                <button 
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/deployed/my-model`)}
                  className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
      </div>

      <div className="bg-[#161B22] rounded-3xl p-8 md:p-12 text-white border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full mb-4">
            <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-rose-400">Live Background Engine</span>
          </div>
          <h3 className="text-3xl font-extrabold mb-6 text-center text-slate-100">AI Model Trainer</h3>
          <p className="text-slate-400 max-w-2xl text-center mb-10 text-sm leading-relaxed">
            A background mechanism is actively scraping real-life data, processing network payloads, and continuously fine-tuning the foundational OpenLayer models in real-time. This ensures that every node connected to the mesh benefits from up-to-the-second knowledge adaptation.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Live Datapoints Scraped</div>
              <div className="text-2xl font-black text-emerald-400 font-mono flex items-center gap-2">
                <span className="animate-pulse">●</span> {stats.datapoints.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Model Parameters Adjusted</div>
              <div className="text-2xl font-black text-indigo-400 font-mono">
                +{stats.parameters}/sec
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Mesh Synchronization</div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {stats.latency.toFixed(1)}ms Latency
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
