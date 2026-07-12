import { Building2, ShieldCheck, Zap, Server, Globe2, Briefcase } from 'lucide-react';

export default function Monetization() {
  return (
    <div className="flex flex-col gap-12 w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="text-center space-y-4 pt-4 max-w-3xl mx-auto">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Sustainable Open Source</h2>
        <p className="text-lg text-slate-600 leading-relaxed">
          Our core mission is accessibility. The Lion language, Free Cloud tier, and open models will always be free. We sustain our mission by providing premium infrastructure, governance, and support for enterprise scale.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tier 1 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col relative overflow-hidden">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-slate-900">Community</h3>
            <p className="text-slate-500 mt-2">For individuals and open-source projects.</p>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-6">$0<span className="text-lg font-medium text-slate-500">/mo</span></div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-start gap-3"><Zap className="w-5 h-5 text-indigo-500 shrink-0" /><span className="text-sm text-slate-700">Lion Language Compiler</span></li>
            <li className="flex items-start gap-3"><Server className="w-5 h-5 text-indigo-500 shrink-0" /><span className="text-sm text-slate-700">Free Cloud Instance (T4 GPU)</span></li>
            <li className="flex items-start gap-3"><Globe2 className="w-5 h-5 text-indigo-500 shrink-0" /><span className="text-sm text-slate-700">Community Forum Support</span></li>
          </ul>
          <button className="w-full py-3 px-4 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
            Current Plan
          </button>
        </div>

        {/* Tier 2 */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-8 flex flex-col relative overflow-hidden transform md:-translate-y-4">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <div className="mb-6 z-10">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full uppercase tracking-wider mb-4 inline-block border border-indigo-500/30">Most Popular</span>
            <h3 className="text-2xl font-bold text-white">Pro Compute</h3>
            <p className="text-slate-400 mt-2">For startups scaling production models.</p>
          </div>
          <div className="text-4xl font-black text-white mb-6 z-10">$49<span className="text-lg font-medium text-slate-500">/mo</span></div>
          <ul className="space-y-4 mb-8 flex-1 z-10">
            <li className="flex items-start gap-3"><Zap className="w-5 h-5 text-indigo-400 shrink-0" /><span className="text-sm text-slate-300">Priority Build Queue</span></li>
            <li className="flex items-start gap-3"><Server className="w-5 h-5 text-indigo-400 shrink-0" /><span className="text-sm text-slate-300">Dedicated A100 GPU slices</span></li>
            <li className="flex items-start gap-3"><ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" /><span className="text-sm text-slate-300">Private Model Registry</span></li>
          </ul>
          <button className="w-full py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-colors z-10">
            Upgrade to Pro
          </button>
          
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-600/20 rounded-full blur-[60px] pointer-events-none"></div>
        </div>

        {/* Tier 3 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-slate-900">Enterprise</h3>
            <p className="text-slate-500 mt-2">Custom infrastructure and compliance.</p>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-6">Custom</div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-start gap-3"><Building2 className="w-5 h-5 text-slate-700 shrink-0" /><span className="text-sm text-slate-700">On-Premises Lion Deployment</span></li>
            <li className="flex items-start gap-3"><Server className="w-5 h-5 text-slate-700 shrink-0" /><span className="text-sm text-slate-700">Dedicated Hardware Clusters</span></li>
            <li className="flex items-start gap-3"><Briefcase className="w-5 h-5 text-slate-700 shrink-0" /><span className="text-sm text-slate-700">24/7 SLA & Architecture Consulting</span></li>
          </ul>
          <button className="w-full py-3 px-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
            Contact Sales
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8 md:p-12 text-center">
        <h3 className="text-2xl font-bold text-indigo-900 mb-4">Open Model Marketplace</h3>
        <p className="text-indigo-800 max-w-2xl mx-auto mb-8">
          We are launching a specialized marketplace where creators can monetize their fine-tuned models and datasets directly to enterprise clients, with OpenLayer taking a minimal 5% infrastructure fee.
        </p>
        <button className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-sm border border-indigo-200 hover:bg-indigo-50 transition-colors">
          Read the Marketplace Whitepaper
        </button>
      </div>
    </div>
  );
}
