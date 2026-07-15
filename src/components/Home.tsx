import { ViewState } from '../types';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import FiveDShapeAnimation from './FiveDShapeAnimation';

interface HomeProps {
  setCurrentView: (view: ViewState) => void;
}

export default function Home({ setCurrentView }: HomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });
  
  const yHero = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const yShape = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const yCards = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div ref={containerRef} className="relative min-h-screen">
      {/* Hero & Value Prop Section */}
      <motion.section 
        style={{ y: yHero, opacity: opacityFade }}
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
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-indigo-700">Thessvar V2.0 &bull; Global Accessibility</span>
          </div>
        </motion.div>
        
        <motion.h1 variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }} className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          The world's first <span className="text-indigo-600">open AI stack</span>.
        </motion.h1>
        
        <motion.p variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }} className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          At Thessvar, we believe your data belongs to you. Our architecture ensures absolute data sovereignty, transparent model training, and zero-trust execution.
        </motion.p>
      </motion.section>

      {/* Animation Section */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 min-h-0">
        <motion.div 
          style={{ y: yShape }}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.8, delay: 0.2 }} 
          className="lg:col-span-7 flex flex-col"
        >
          <FiveDShapeAnimation />
        </motion.div>

        {/* Feature Cards */}
        <motion.div 
          style={{ y: yCards }}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.8, delay: 0.4 }} 
          className="lg:col-span-5 flex flex-col gap-6 sm:gap-8 min-h-0"
        >          {/* CloudOS IDE */}
          <div 
            onClick={() => setCurrentView('ide')}
            className="bg-white rounded-2xl p-6 border border-slate-200 flex-1 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group cursor-pointer flex flex-col justify-between relative"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                <h3 className="font-bold text-slate-800 text-lg">CloudOS Web IDE</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">Full-stack browser development environment. Real-time compilation, multi-language support, and cloud persistence.</p>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tighter">0ms</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Setup Time</div>
              </div>
              <div className="text-indigo-500 bg-indigo-50 px-2 py-1 rounded text-xs font-bold font-mono">Zero Config</div>
            </div>
            {/* Tooltip */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none whitespace-nowrap z-50">
              Access the CloudOS IDE with 25+ language plugins
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>

          {/* Security & FHE */}
          <div 
            onClick={() => setCurrentView('governance')}
            className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden flex-1 shadow-lg shadow-indigo-600/20 group cursor-pointer"
          >
            <div className="relative z-10 h-full flex flex-col justify-center">
              <h3 className="font-bold text-lg mb-3 group-hover:text-indigo-100 transition-colors">Absolute Data Sovereignty</h3>
              <p className="text-sm text-indigo-100/90 leading-relaxed max-w-sm">
                You retain 100% ownership of your weights, datasets, and runtime code. We utilize Fully Homomorphic Encryption (FHE).
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
            {/* Tooltip */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none whitespace-nowrap z-50">
              Zero-trust architecture with end-to-end encryption
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>
          
          
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 50 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.8, delay: 0.6 }} 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6"
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
    </div>
  );
}
