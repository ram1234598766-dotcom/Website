import React, { useRef } from 'react';
import { ViewState } from '../types';
import { motion, useScroll, useTransform } from 'motion/react';
import { Terminal, GitBranch, MessageSquareText, Users, Shield, Zap, ArrowRight, LogIn, Code2, Globe } from 'lucide-react';
import Logo from './Logo';

interface HomeProps {
  setCurrentView: (view: ViewState) => void;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export default function Home({ setCurrentView, onSignIn, onSignUp }: HomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });
  const yHero = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const features = [
    {
      icon: <Terminal className="w-6 h-6 text-indigo-400" />,
      title: "Cloud OS Web IDE",
      description: "A full-featured, zero-config development environment running entirely in your browser with real-time preview."
    },
    {
      icon: <GitBranch className="w-6 h-6 text-purple-400" />,
      title: "GitHub Synchronization",
      description: "Seamlessly import, modify, and commit changes back to your GitHub repositories without ever leaving the workspace."
    },
    {
      icon: <MessageSquareText className="w-6 h-6 text-emerald-400" />,
      title: "Omni-AI Terminal",
      description: "An integrated intelligence layer that writes code, debugs errors, and searches the web alongside you."
    },
    {
      icon: <Users className="w-6 h-6 text-amber-400" />,
      title: "Live Collaboration",
      description: "Code together in real-time with multiplayer cursors, shared terminal sessions, and instant state sync."
    },
    {
      icon: <Shield className="w-6 h-6 text-rose-400" />,
      title: "Zero-Trust Architecture",
      description: "Your data remains yours. Built with end-to-end security principles to protect your intellectual property."
    },
    {
      icon: <Zap className="w-6 h-6 text-cyan-400" />,
      title: "Instant Edge Deploy",
      description: "Push your full-stack applications to edge networks instantly with one click, scaling globally by default."
    }
  ];

  return (
    <div ref={containerRef} className="relative min-h-screen pt-12 pb-8 flex flex-col items-center overflow-hidden">

      {/* Animated gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/5 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-emerald-500/3 blur-[80px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
      </div>

      {/* 1. Hero Section */}
      <motion.section
        style={{ y: yHero, opacity: opacityFade }}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2, delayChildren: 0.1 }
          }
        }}
        className="text-center max-w-4xl mx-auto space-y-8 mt-12 sm:mt-24 mb-32 px-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex justify-center mb-8"
        >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-[0_0_40px_rgba(99,102,241,0.25)]"
            >
                <Logo className="w-12 h-12" />
            </motion.div>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md rounded-full shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"></span>
            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-indigo-300">VantaOS is now in Public Beta</span>
          </div>
        </motion.div>
        
        <motion.h1 variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }} className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter text-white leading-[1.1]">
          The Intelligent <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Developer Cloud</span>
        </motion.h1>
        
        <motion.p variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }} className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
          Write, build, and deploy full-stack applications entirely in the browser. Powered by an omnipresent AI layer and zero-trust security.
        </motion.p>

        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } } }} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <button 
              onClick={onSignUp}
              className="w-full sm:w-auto px-8 py-4 text-base font-bold bg-indigo-600/90 text-white rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] transition-all flex items-center justify-center gap-2 group"
            >
              Get Started for Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onSignIn}
              className="w-full sm:w-auto px-8 py-4 text-base font-bold bg-white/5 text-slate-200 border border-white/10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Sign In <LogIn className="w-5 h-5 opacity-70" />
            </button>
        </motion.div>
      </motion.section>

      {/* 2. Live Preview Section */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="w-full max-w-6xl mx-auto mb-32 relative z-10 px-4"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-2xl opacity-20"></div>
        <div className="relative rounded-2xl border border-white/10 bg-[#0d0d12] overflow-hidden shadow-2xl flex flex-col">
            {/* Fake macOS Window Header */}
            <div className="h-12 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2 shrink-0">
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                </div>
                <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 rounded-md bg-black/40 border border-white/5 flex items-center gap-2 text-xs font-medium text-slate-400">
                        <Globe className="w-3.5 h-3.5" /> vantaos.dev/workspace
                    </div>
                </div>
            </div>
            
            {/* Fake IDE Interface */}
            <div className="flex flex-1 min-h-[400px] md:min-h-[500px]">
                {/* Sidebar */}
                <div className="hidden md:flex w-64 border-r border-white/10 bg-black/20 p-4 flex-col gap-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Explorer</div>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm text-slate-300 bg-white/5 px-2 py-1.5 rounded"><Terminal className="w-4 h-4 text-indigo-400" /> server.ts</div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 px-2 py-1.5 hover:bg-white/5 rounded transition-colors"><Code2 className="w-4 h-4 text-emerald-400" /> App.tsx</div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 px-2 py-1.5 hover:bg-white/5 rounded transition-colors"><MessageSquareText className="w-4 h-4 text-purple-400" /> types.ts</div>
                    </div>
                </div>
                {/* Editor Area */}
                <div className="flex-1 p-6 font-mono text-sm leading-relaxed overflow-hidden bg-[#0a0a0c]">
                    <div className="text-slate-400"><span className="text-purple-400">import</span> { '{' } serve { '}' } <span className="text-purple-400">from</span> <span className="text-emerald-300">'@vantaos/runtime'</span>;</div>
                    <br/>
                    <div className="text-slate-400"><span className="text-purple-400">const</span> app = <span className="text-indigo-300">serve</span>({'{'}</div>
                    <div className="text-slate-400 pl-4">port: <span className="text-amber-300">3000</span>,</div>
                    <div className="text-slate-400 pl-4">fetch(req) {'{'}</div>
                    <div className="text-slate-400 pl-8"><span className="text-purple-400">return new</span> <span className="text-indigo-300">Response</span>(<span className="text-emerald-300">'Hello from VantaOS Edge!'</span>);</div>
                    <div className="text-slate-400 pl-4">{'}'}</div>
                    <div className="text-slate-400">{'}'});</div>
                    <br/>
                    <div className="text-slate-500 italic">// Real-time compilation active...</div>
                    <div className="flex items-center gap-2 mt-4 text-emerald-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        Server running perfectly.
                    </div>
                </div>
            </div>
        </div>
      </motion.section>

      {/* 3. Feature Highlights Section */}
      <motion.section 
        className="w-full max-w-6xl mx-auto mb-32 px-4 z-10 relative"
      >
        <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">Everything you need. <br/> Nothing you don't.</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">VantaOS brings the entire development lifecycle into a single, cohesive interface built for speed and focus.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6, delay: idx * 0.1, ease: "easeOut" }}
                    className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-3xl hover:bg-white/10 hover:border-indigo-500/30 transition-all group shadow-lg flex flex-col"
                >
                    <div className="w-14 h-14 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/40 transition-all duration-300">
                        {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{feature.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </motion.div>
            ))}
        </div>
      </motion.section>

      {/* 5. Footer */}
      <footer className="w-full max-w-6xl mx-auto border-t border-white/10 pt-12 pb-8 px-4 z-10 relative">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
                <Logo className="w-6 h-6 text-indigo-400" />
                <span className="font-bold text-white tracking-tight text-lg">VantaOS</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium">
                
                <button onClick={onSignIn} className="text-slate-400 hover:text-white transition-colors">Sign In</button>
                <button onClick={onSignUp} className="text-indigo-400 hover:text-indigo-300 transition-colors">Get Started</button>
            </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} VantaOS. All rights reserved.</p>
            <p className="flex items-center gap-1">Built with <Logo className="w-3 h-3 text-indigo-400 mx-1"/> VantaOS</p>
        </div>
      </footer>
    </div>
  );
}

