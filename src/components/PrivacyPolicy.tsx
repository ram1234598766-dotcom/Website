import { Shield, CheckCircle, Lock, Eye, Database } from 'lucide-react';
import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col items-center text-center gap-6 py-12 border-b border-white/10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full shadow-sm">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span className="text-xs uppercase tracking-widest font-bold text-indigo-300">VantaOS Trust Center</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-sm">
          Privacy Policy
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          A clear, honest summary of how VantaOS handles your data — no fine print.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 flex flex-col gap-6 hover:border-indigo-500/30 transition-colors">
          <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
            <Lock className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">1. Your data stays local by default</h2>
            <p className="text-slate-400 leading-relaxed">
              Your code workspace and demo account are stored entirely in your browser (localStorage).
              When you connect a Supabase project, your data moves to <em>your own</em> Supabase
              instance, protected by that project's row-level security. No data is ever sent to a
              VantaOS-operated server.
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 flex flex-col gap-6 hover:border-emerald-500/30 transition-colors">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
            <Eye className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">2. AI providers are your choice</h2>
            <p className="text-slate-400 leading-relaxed">
              When you use Omni-AI with a cloud provider (OpenRouter, Gemini, or OpenAI), your prompt is
              sent to the provider you selected using <em>your</em> API key. With a local Ollama setup,
              everything stays on your machine. We do not run or train any global AI models on your data.
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 flex flex-col gap-6 hover:border-purple-500/30 transition-colors">
          <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">3. No tracking, no resale</h2>
            <p className="text-slate-400 leading-relaxed">
              VantaOS includes no advertising SDKs, no analytics trackers, and no telemetry that is sold
              to third parties. This site is served over HTTPS (TLS), and your browser enforces security
              headers (no framing, no sniffing) via the deployment's <code className="text-slate-300">_headers</code>.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded-2xl border border-white/10 p-8 mt-6">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-slate-400 text-sm leading-relaxed">
            <strong className="text-slate-200">Questions?</strong> VantaOS is open source — review the code,
            or open an issue on the repository if you'd like to know exactly how any part of the platform handles data.
          </p>
        </div>
      </div>
    </div>
  );
}
