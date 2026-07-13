import { Server, Shield, Zap, Network, Globe2, Lock } from 'lucide-react';

export default function DecentralizedMesh() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col items-center text-center gap-6 py-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-2 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <Globe2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] uppercase tracking-widest font-bold text-emerald-400">Zero-Cost Global Infrastructure</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
          Decentralized Compute Mesh
        </h1>
        
        <p className="text-xl text-slate-300 max-w-3xl leading-relaxed">
          OpenLayer is powered by a Peer-to-Peer (P2P) distributed network. Share idle GPU/CPU power in a secure mesh to host and train models for free. <span className="text-emerald-400 font-bold">100% Free, forever. Zero paywalls.</span>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-[#0a0d12]/80 backdrop-blur-xl border border-emerald-900/50 p-8 rounded-3xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors shadow-[0_0_30px_rgba(16,185,129,0.05)]">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Network className="w-32 h-32 text-emerald-500" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="w-14 h-14 bg-emerald-950/50 border border-emerald-800 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Zap className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">Contribute Compute</h3>
            <p className="text-slate-400 leading-relaxed">
              Donate your unused machine power to the global mesh. Our Post-Quantum resilient protocols ensure your device remains perfectly isolated and secure while processing encrypted network shards.
            </p>
            <button className="px-6 py-3 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold rounded-xl transition-all border border-emerald-500/30 flex items-center gap-2">
              <Server className="w-5 h-5" /> Start Node
            </button>
          </div>
        </div>

        <div className="bg-[#0a0d12]/80 backdrop-blur-xl border border-indigo-900/50 p-8 rounded-3xl relative overflow-hidden group hover:border-indigo-500/50 transition-colors shadow-[0_0_30px_rgba(99,102,241,0.05)]">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Shield className="w-32 h-32 text-indigo-500" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="w-14 h-14 bg-indigo-950/50 border border-indigo-800 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Lock className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">Fortress Mode</h3>
            <p className="text-slate-400 leading-relaxed">
              All data processed on the mesh uses Fully Homomorphic Encryption (FHE). The network trains AI models on mathematically encrypted data. 100% data ownership, zero privacy breaches.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-mono text-indigo-300">Quantum-Secure Status: ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
