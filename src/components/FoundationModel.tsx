import React from 'react';
import { Cpu, Network, Database, ShieldCheck, Zap, Layers } from 'lucide-react';

export default function FoundationModel() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-in fade-in duration-500 pb-16">
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 text-xs font-bold tracking-widest uppercase">
          <Zap className="w-4 h-4" /> VantaOS Core Architecture
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight text-white">Foundational AI Model</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          A truly free, open-source foundational intelligence built for infinite extensibility. Our core model leverages a modular neural architecture, designed from the ground up for the decentralization age.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
            <Layers className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-200 mb-2">MoE (Mixture of Experts)</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            The core architecture uses a dynamic sparse routing mechanism. Instead of activating the entire network, tokens are routed to specialized sub-networks (experts) — vastly reducing compute overhead while preserving deep reasoning capabilities.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
            <Cpu className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-200 mb-2">Omni-Modal Ingestion</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Natively process text, vision, audio, and network packets through unified continuous embeddings. The model projects all modalities into a single latent space, allowing cross-modal logic reasoning out of the box.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-4">
            <Network className="w-6 h-6 text-rose-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-200 mb-2">Mesh-Native Distillation</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            The model is structured so large layers can be mathematically distilled into smaller quantizations on the fly. This enables shards of the model to be distributed across peer-to-peer mobile nodes seamlessly.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
            <Database className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-200 mb-2">Continuous Pre-training</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Unlike static weights, the VantaOS Foundation Model supports asynchronous continuous pre-training. Data streams from the global mesh subtly adjust parameter gradients without requiring massive catastrophic forgetting restarts.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-200 mb-2">Homomorphic Weight Safety</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Enterprise integrations can fine-tune the foundational weights over encrypted data streams. The core FHE compatibility ensures that proprietary weights remain completely obscured even to the host hardware.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-cyan-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-200 mb-2">Pluggable Speculative Decoding</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            For maximum inference speed, the model includes a frozen draft-model header that rapidly guesses the next tokens, which the main heavy layers verify in parallel, yielding a 3x speedup on consumer hardware.
          </p>
        </div>
      </div>
      
      <div className="mt-8 bg-slate-900 rounded-2xl p-8 border border-slate-800 text-white">
        <h3 className="text-2xl font-bold mb-4">Extensibility & Open Licensing</h3>
        <p className="text-slate-300 leading-relaxed mb-6">
          The true power of the VantaOS foundational model lies in its open-source DNA. We utilize the MIT License for the inference engine and the Apache 2.0 license for the foundational weights. 
          By offering a modular plugin system at the attention-head level, researchers can hot-swap specific layers or inject custom LoRA (Low-Rank Adaptation) modules at runtime without recompiling the monolithic base.
        </p>
        <div className="bg-black/50 p-4 rounded-xl border border-slate-700 font-mono text-sm text-emerald-400">
          <p>$ vantaos pull foundation-v1 --quantize int4</p>
          <p>$ vantaos attach-lora ./finance-expert.safetensors</p>
          <p>$ vantaos serve --port 8080</p>
        </div>
      </div>
    </div>
  );
}
