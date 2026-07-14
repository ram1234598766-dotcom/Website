import { ViewState } from '../types';
import { motion } from 'motion/react';
import ActivityLogFeed from './ActivityLogFeed';

interface HomeProps {
  setCurrentView: (view: ViewState) => void;
}

export default function Home({ setCurrentView }: HomeProps) {
  return (
    <>
      {/* Hero & Value Prop Section */}
      <motion.section 
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.2,
              delayChildren: 0.1
            }
          }
        }}
        className="text-center max-w-3xl mx-auto space-y-6 mt-4 sm:mt-8 mb-4"
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-indigo-700">Novalith V2.0 &bull; Global Accessibility</span>
          </div>
        </motion.div>
        
        <motion.h1 variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }} className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          The world's first <span className="text-indigo-600">open AI stack</span>.
        </motion.h1>
        
        <motion.p variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }} className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Build powerful neural network architectures intuitively. 
          Deploy on our <b>Free Tier Cloud</b>. Own 100% of your weights and data.
        </motion.p>
      </motion.section>

      {/* Interactive Workspace Mockup */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 min-h-0">
        {/* Code Editor */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.8, delay: 0.2 }} 
          className="lg:col-span-7 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 flex flex-col border border-slate-800 overflow-hidden min-h-[350px]"
        >
          <div className="h-12 flex items-center justify-between px-4 bg-slate-800/80 border-b border-slate-700/50 backdrop-blur-sm">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-400 transition-colors cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-400 transition-colors cursor-pointer"></div>
            </div>
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400 font-medium">omni-compiler // example.ts</span>
            <div className="w-16"></div>
          </div>
          <div className="flex-1 p-4 sm:p-6 font-mono text-sm leading-loose overflow-x-auto selection:bg-indigo-500/30">
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">1</span>
              <span className="text-emerald-400">Mesh<span className="text-slate-400">.</span><span className="text-indigo-400">connect</span><span className="text-slate-300">(</span><span className="text-slate-400">Network: </span><span className="text-rose-400">"Novalith-Global"</span><span className="text-slate-300">)</span></span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">2</span>
              <span className="text-slate-400"></span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">3</span>
              <span className="text-slate-500 italic">// Initialize a 3-layer Transformer Block</span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">4</span>
              <span className="text-emerald-400">Model<span className="text-slate-400">.</span><span className="text-indigo-400">create</span><span className="text-slate-300">(</span><span className="text-slate-400">Architecture: </span><span className="text-rose-400">"Transformer"</span><span className="text-slate-300">, </span><span className="text-slate-400">Layers: </span><span className="text-amber-400">3</span><span className="text-slate-300">)</span></span>
            </div>
            <div className="flex gap-4 sm:gap-6 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
              <span className="text-slate-600 w-4 text-right select-none shrink-0">5</span>
              <span className="text-emerald-400">Model<span className="text-slate-400">.</span><span className="text-indigo-400">train</span><span className="text-slate-300">(</span><span className="text-slate-400">Data: </span><span className="text-rose-400">"Encrypted_Set"</span><span className="text-slate-300">, </span><span className="text-slate-400">FHE: </span><span className="text-rose-400">"Active"</span><span className="text-slate-300">)</span></span>
            </div>
          </div>
          <div className="border-t border-slate-800 bg-[#0d1117] p-3 flex justify-between items-center px-4">
            <span className="text-[10px] text-emerald-400/80 font-mono flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Node Synced</span>
            <button onClick={() => setCurrentView('omni-ai')} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded uppercase font-bold tracking-widest transition-colors font-sans">
              Launch Omni-AI
            </button>
          </div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.8, delay: 0.4 }} 
          className="lg:col-span-5 flex flex-col gap-6 sm:gap-8 min-h-0"
        >
          {/* AI Mesh Stats */}
          <div 
            onClick={() => setCurrentView('ai-training')}
            className="bg-white rounded-2xl p-6 border border-slate-200 flex-1 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <h3 className="font-bold text-slate-800 text-lg">Decentralized Mesh</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">Tap into idle GPUs worldwide. No centralized AWS bills. Deploy inferences completely free.</p>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tighter">142M+</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Nodes</div>
              </div>
              <div className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded text-xs font-bold font-mono">100% Uptime</div>
            </div>
          </div>

          {/* Security & FHE */}
          <div 
            onClick={() => setCurrentView('governance')}
            className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden flex-1 shadow-lg shadow-indigo-600/20 group cursor-pointer"
          >
            <div className="relative z-10 h-full flex flex-col justify-center">
              <h3 className="font-bold text-lg mb-3 group-hover:text-indigo-100 transition-colors">Data Privacy Promise</h3>
              <p className="text-sm text-indigo-100/90 leading-relaxed max-w-sm">
                Your training data never leaves your private vault. Novalith cannot access your model weights without explicit cryptographical keys.
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
          
          <ActivityLogFeed />
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 50 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.8, delay: 0.6 }} 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6"
      >
        <div onClick={() => setCurrentView('omni-ai')} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-colors group">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h4 className="text-white font-bold mb-2">Omni-AI Terminal</h4>
          <p className="text-slate-400 text-sm">Deep-thinking assistant that hooks into live data and web searches instantly.</p>
        </div>

        <div onClick={() => setCurrentView('showcase')} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition-colors group">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
             <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
          </div>
          <h4 className="text-white font-bold mb-2">Model Hub</h4>
          <p className="text-slate-400 text-sm">Directly download and load local inference for Llama, Mistral, and more.</p>
        </div>

        <div onClick={() => setCurrentView('fortress')} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl cursor-pointer hover:border-rose-500/50 transition-colors group">
          <div className="w-10 h-10 bg-rose-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-rose-500/20 transition-colors">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
          <h4 className="text-white font-bold mb-2">Fortress Mode</h4>
          <p className="text-slate-400 text-sm">Mathematically encrypted processing with Fully Homomorphic Encryption.</p>
        </div>

        <div onClick={() => setCurrentView('foundation')} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl cursor-pointer hover:border-amber-500/50 transition-colors group">
          <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
          </div>
          <h4 className="text-white font-bold mb-2">MoE Foundation</h4>
          <p className="text-slate-400 text-sm">State-of-the-art open source sparse architecture built for the edge.</p>
        </div>
      </motion.div>

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
        </div>
        <div className="text-slate-500 text-xs font-medium shrink-0 pt-2 md:pt-0 border-t border-slate-100 md:border-none w-full md:w-auto mt-2 md:mt-0">
          Global Nodes: <span className="text-indigo-600 font-bold ml-1">4,281</span>
        </div>
      </footer>
    </>
  );
}
