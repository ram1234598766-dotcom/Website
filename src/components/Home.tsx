import { ViewState } from '../types';

interface HomeProps {
  setCurrentView: (view: ViewState) => void;
}

export default function Home({ setCurrentView }: HomeProps) {
  return (
    <>
      {/* Hero & Value Prop Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6 mt-4 sm:mt-8 mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full">
          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-indigo-700">OpenLayer V2.0 &bull; Global Accessibility</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          The world's first <span className="text-indigo-600">open AI stack</span>.
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Build with <b>Lion</b>, the most intuitive neural network language. 
          Deploy on our <b>Free Tier Cloud</b>. Own 100% of your weights and data.
        </p>
      </section>

      {/* Interactive Workspace Mockup */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 min-h-0">
        {/* Code Editor (The 'Lion' Language) */}
        <div className="lg:col-span-7 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 flex flex-col border border-slate-800 overflow-hidden min-h-[350px]">
          <div className="h-12 flex items-center justify-between px-4 bg-slate-800/80 border-b border-slate-700/50 backdrop-blur-sm">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-400 transition-colors cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-400 transition-colors cursor-pointer"></div>
            </div>
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400 font-medium">lion-compiler // example.lion</span>
            <div className="w-16"></div>
          </div>
          <div className="flex-1 p-4 sm:p-6 font-mono text-sm leading-loose overflow-x-auto selection:bg-indigo-500/30">
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">1</span>
              <span className="whitespace-pre"><span className="text-indigo-400 font-bold">import</span> <span className="text-slate-300">StandardNN</span></span>
            </div>
            <div className="flex gap-4 sm:gap-6 px-2 -mx-2">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">2</span>
              <span></span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">3</span>
              <span className="whitespace-pre"><span className="text-emerald-400 font-bold">network</span> <span className="text-indigo-300 italic text-white">ImageBrain</span> <span className="text-slate-300">{`{`}</span></span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">4</span>
              <span className="text-slate-500 ml-4 whitespace-pre">// Defined with simplified architectural blocks</span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">5</span>
              <span className="text-slate-300 ml-4 whitespace-pre">input: Image(224, 224, RGB)</span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">6</span>
              <span className="text-slate-300 ml-4 whitespace-pre">architecture: Dense(512) <span className="text-indigo-400">-&gt;</span> Relu <span className="text-indigo-400">-&gt;</span> Dropout(0.2) <span className="text-indigo-400">-&gt;</span> Softmax(10)</span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">7</span>
              <span className="text-slate-300 whitespace-pre">{`}`}</span>
            </div>
            <div className="flex gap-4 sm:gap-6 mt-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">8</span>
              <span className="whitespace-pre"><span className="text-indigo-400">run</span> <span className="text-white italic">deploy_free</span><span className="text-slate-300">(ImageBrain, region: "EU-West-1")</span><span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse align-middle"></span></span>
            </div>
          </div>
        </div>

        {/* Cloud Dashboard & Status */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div 
            onClick={() => setCurrentView('cloud')}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg shadow-slate-200/40 hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">Free Cloud Instance</h3>
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-md uppercase tracking-wide">Active</span>
            </div>
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Model Health</span>
                <span className="text-sm font-bold text-slate-700">99.98%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 w-[92%] h-full rounded-full"></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/80">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Latency</p>
                  <p className="text-2xl font-bold text-indigo-600">14<span className="text-base text-indigo-400 ml-0.5">ms</span></p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/80">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Cost</p>
                  <p className="text-2xl font-bold text-slate-900">$0<span className="text-base text-slate-400 ml-0.5">.00</span></p>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => setCurrentView('governance')}
            className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden flex-1 shadow-lg shadow-indigo-600/20 group cursor-pointer"
          >
            <div className="relative z-10 h-full flex flex-col justify-center">
              <h3 className="font-bold text-lg mb-3 group-hover:text-indigo-100 transition-colors">Data Privacy Promise</h3>
              <p className="text-sm text-indigo-100/90 leading-relaxed max-w-sm">
                Your training data never leaves your private vault. OpenLayer cannot access your model weights without explicit cryptographical keys.
              </p>
              <div className="mt-6 inline-flex items-center gap-3 w-fit">
                <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 group-hover:bg-white/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-50">Encryption Active</span>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-150"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          </div>
        </div>
      </div>

      {/* Bottom Transparency Ticker */}
      <footer className="py-5 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 border-t border-slate-200 mt-4 sm:mt-auto">
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          <span>Training Transparency Ledger</span>
          <span className="hidden md:block w-1 h-1 bg-slate-300 rounded-full"></span>
        </div>
        <div className="flex-1 flex flex-wrap md:flex-nowrap gap-x-6 gap-y-3 w-full">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs font-medium">Model v4 Training:</span>
            <span className="text-slate-900 text-xs font-semibold border-b border-slate-900">100% Verified Clean Sets</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs font-medium">Compute Source:</span>
            <span className="text-slate-900 text-xs font-semibold">100% Renewable</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs font-medium">Governance:</span>
            <span className="text-slate-900 text-xs font-semibold italic">DAO-Open Source</span>
          </div>
        </div>
        <div className="text-slate-500 text-xs font-medium shrink-0 pt-2 md:pt-0 border-t border-slate-100 md:border-none w-full md:w-auto mt-2 md:mt-0">
          Global Nodes: <span className="text-indigo-600 font-bold ml-1">4,281</span>
        </div>
      </footer>
    </>
  );
}
