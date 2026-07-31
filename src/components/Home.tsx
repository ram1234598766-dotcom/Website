import React, { useRef } from 'react';
import { ViewState } from '../types';
import { motion, useScroll, useTransform } from 'motion/react';
import { Terminal, GitBranch, MessageSquareText, Users, Zap, ArrowRight, LogIn, Code2, Globe, BookOpen, Compass, Keyboard, FolderTree, FileCode2, Sparkles } from 'lucide-react';
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
      description: "A full-featured, zero-config development environment running entirely in your browser with a Monaco editor, file explorer, split views, and a live diff."
    },
    {
      icon: <GitBranch className="w-6 h-6 text-purple-400" />,
      title: "GitHub Synchronization",
      description: "Sign in with a GitHub token, clone any of your repositories, edit files, and commit & push your changes back without leaving the workspace."
    },
    {
      icon: <MessageSquareText className="w-6 h-6 text-emerald-400" />,
      title: "Omni-AI Assistant",
      description: "A chat interface that connects to the AI provider of your choice — local Ollama models or cloud APIs like OpenRouter, Gemini, and OpenAI."
    },
    {
      icon: <Terminal className="w-6 h-6 text-cyan-400" />,
      title: "Built-in Terminal",
      description: "An xterm.js terminal with a real virtual file system. Run JavaScript inline, navigate directories, create files, and test code as you write."
    },
    {
      icon: <Users className="w-6 h-6 text-amber-400" />,
      title: "Local Model Hub",
      description: "Browse real open-source models (Llama, Phi, Mistral, Gemma and more), pull them to your local Ollama daemon, and run them with one command."
    },
    {
      icon: <Zap className="w-6 h-6 text-rose-400" />,
      title: "One-Click Export",
      description: "Export your entire workspace as a ZIP archive preserving your folder structure — perfect for backups or moving to another environment."
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
          Write, build, and deploy full-stack applications entirely in the browser. An in-browser IDE, AI assistant, terminal, and model hub — all in one workspace.
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

      {/* 4. Tech Stack Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-6xl mx-auto mb-32 px-4 z-10 relative text-center"
      >
        <div className="mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">Powered by a modern stack</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">Built on battle-tested open-source technology, engineered to run entirely in your browser.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {['React 19', 'TypeScript', 'Next.js', 'Monaco', 'Tailwind CSS', 'Motion', 'Supabase', 'Ollama', 'Cloudflare'].map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-slate-300 hover:border-indigo-500/40 hover:text-white transition-colors"
            >
              {tech}
            </span>
          ))}
        </div>
      </motion.section>

      {/* 4.5 About VantaOS Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-6xl mx-auto mb-32 px-4 z-10 relative"
        id="about"
      >
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span className="text-xs uppercase tracking-widest font-bold text-indigo-300">About VantaOS</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">A complete development cloud, in your browser</h2>
          <p className="text-slate-400 text-lg max-w-3xl mx-auto leading-relaxed">
            VantaOS is a browser-based development environment designed and architected by Mrityunjay K. It combines a
            full web IDE, an AI assistant, a local model hub, GitHub integration, and a built-in terminal into one
            cohesive workspace — no installs, no setup, just a browser tab.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-3xl flex flex-col gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">What VantaOS actually does</h3>
            <ul className="text-slate-400 text-sm leading-relaxed space-y-2.5">
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">•</span> <span><strong className="text-slate-200">Cloud OS IDE</strong> — edit code in a Monaco editor with 35+ languages, folder tree, tabbed files, split views, and a diff view against your saved version.</span></li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">•</span> <span><strong className="text-slate-200">Built-in Terminal</strong> — a working xterm.js shell with a virtual file system, command history, and inline JavaScript execution.</span></li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">•</span> <span><strong className="text-slate-200">Omni-AI Assistant</strong> — chat with local Ollama models or cloud providers (OpenRouter, Gemini, OpenAI).</span></li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">•</span> <span><strong className="text-slate-200">GitHub Sync</strong> — clone a repo, edit, and push commits directly from the IDE using your GitHub token.</span></li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">•</span> <span><strong className="text-slate-200">Model Hub</strong> — browse and pull real open-source models (Llama, Phi, Mistral, Gemma…) to your local Ollama.</span></li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">•</span> <span><strong className="text-slate-200">Offline-first data</strong> — your workspace auto-saves to your browser, and demo accounts store locally when Supabase isn't connected.</span></li>
            </ul>
          </div>

          <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-3xl flex flex-col gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
              <Compass className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">How it's built</h3>
            <ul className="text-slate-400 text-sm leading-relaxed space-y-2.5">
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> <span><strong className="text-slate-200">Next.js 15 + React 19</strong> with static export for fast, cacheable deployment.</span></li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> <span><strong className="text-slate-200">TypeScript</strong> across the whole codebase.</span></li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> <span><strong className="text-slate-200">Monaco Editor</strong> — the same engine that powers VS Code.</span></li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> <span><strong className="text-slate-200">xterm.js</strong> for the terminal with a virtual file system.</span></li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> <span><strong className="text-slate-200">Supabase</strong> (optional) for real auth and forum when configured.</span></li>
              <li className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> <span><strong className="text-slate-200">Deployed on Cloudflare</strong> as a static export with a Workers proxy for AI calls.</span></li>
            </ul>
          </div>
        </div>
      </motion.section>

      {/* 4.6 User Guide Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-6xl mx-auto mb-32 px-4 z-10 relative"
        id="guide"
      >
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6">
            <Keyboard className="w-4 h-4 text-purple-400" />
            <span className="text-xs uppercase tracking-widest font-bold text-purple-300">User Guide</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">Get started in minutes</h2>
          <p className="text-slate-400 text-lg max-w-3xl mx-auto">Everything you need to know to use VantaOS effectively — from the editor to the terminal, AI, and GitHub.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor guide */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-8 pt-8 pb-5 border-b border-white/10 flex items-center gap-3">
              <FolderTree className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Cloud OS IDE</h3>
            </div>
            <div className="p-8 space-y-4 text-sm text-slate-400 leading-relaxed">
              <p><strong className="text-slate-200">Create files & folders</strong> — use the + buttons in the Workspace sidebar, or right-side actions to create files and folders in any directory.</p>
              <p><strong className="text-slate-200">Edit & manage</strong> — click a file to open it in a tab. Rename with the pencil icon, delete with the trash icon, and move files with the arrow icon (choose a destination folder).</p>
              <p><strong className="text-slate-200">Format on save</strong> — press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-200">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-200">S</kbd> to auto-format JS, TS, HTML and CSS with Prettier.</p>
              <p><strong className="text-slate-200">Run your code</strong> — hit <strong className="text-slate-200">Compile &amp; Run</strong> to execute the active file's JavaScript in the terminal (first 500 chars).</p>
              <p><strong className="text-slate-200">Diff view</strong> — toggle <strong className="text-slate-200">Diff</strong> to compare the current file against the last saved version side by side.</p>
              <p><strong className="text-slate-200">Split view</strong> — use the three split buttons to edit two files side-by-side or stacked.</p>
              <p><strong className="text-slate-200">Export</strong> — <strong className="text-slate-200">Export Project</strong> downloads your whole workspace as a ZIP.</p>
            </div>
          </div>

          {/* Terminal guide */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-8 pt-8 pb-5 border-b border-white/10 flex items-center gap-3">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Terminal commands</h3>
            </div>
            <div className="p-8 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['help', 'Show all commands'],
                  ['ls', 'List files'],
                  ['cd <path>', 'Change directory'],
                  ['pwd', 'Print working dir'],
                  ['cat <file>', 'View file contents'],
                  ['echo <text>', 'Print text'],
                  ['date', 'Show current time'],
                  ['whoami', 'Show user'],
                  ['js <code>', 'Run JS inline'],
                  ['node <file>', 'Run a JS file'],
                  ['mkdir <dir>', 'Create directory'],
                  ['touch <file>', 'Create file'],
                  ['rm <path>', 'Remove file/dir'],
                  ['clear', 'Clear terminal'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-white/5">
                    <code className="text-emerald-400 font-mono text-xs shrink-0">{cmd}</code>
                    <span className="text-slate-500 text-xs">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-xs mt-2">Use <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑</kbd>/<kbd className="px-1.5 py-0.5 bg-white/10 rounded">↓</kbd> to navigate command history, and <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white/10 rounded">`</kbd> to toggle the terminal panel.</p>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-8 pt-8 pb-5 border-b border-white/10 flex items-center gap-3">
              <Keyboard className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">Keyboard shortcuts</h3>
            </div>
            <div className="p-8 space-y-2.5 text-sm">
              {[
                ['Ctrl + K', 'Open the command palette (anywhere)'],
                ['Ctrl + P', 'Search files & content (in the IDE)'],
                ['Ctrl + S', 'Save & format the active file'],
                ['Ctrl + `', 'Toggle the terminal panel'],
                ['Ctrl + /', 'Show keyboard shortcuts (in the IDE)'],
                ['Ctrl + Enter', 'Run the active file (in the IDE)'],
              ].map(([keys, desc]) => (
                <div key={keys} className="flex items-center justify-between gap-4 py-1">
                  <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded border border-white/10 text-slate-200 whitespace-nowrap">{keys}</span>
                  <span className="text-slate-400 text-xs text-right">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Omni-AI guide */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-8 pt-8 pb-5 border-b border-white/10 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Omni-AI assistant</h3>
            </div>
            <div className="p-8 space-y-4 text-sm text-slate-400 leading-relaxed">
              <p><strong className="text-slate-200">Choose a provider</strong> — open ⚙️ Settings in Omni-AI. Pick a provider: <strong className="text-slate-200">Local Ollama</strong> (models on your machine), or a cloud provider like <strong className="text-slate-200">OpenRouter</strong>, <strong className="text-slate-200">Gemini</strong>, or <strong className="text-slate-200">OpenAI</strong> (paste your API key).</p>
              <p><strong className="text-slate-200">Connect Ollama</strong> — for local models, run <code className="text-emerald-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">set OLLAMA_ORIGINS=* && ollama serve</code> (Windows) or <code className="text-emerald-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">OLLAMA_ORIGINS=* ollama serve</code> (Mac/Linux), then press refresh in Omni-AI.</p>
              <p><strong className="text-slate-200">Quick commands</strong> — <code className="text-indigo-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">calc 2^10</code> for math, <code className="text-indigo-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">js code...</code> to run JavaScript, <code className="text-indigo-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">weather in London</code> for weather, or just type <code className="text-indigo-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">help</code>.</p>
              <p><strong className="text-slate-200">Offline mode</strong> — Omni-AI requires a connected provider. Without one, you'll see a clear message instead of offline answers.</p>
            </div>
          </div>

          {/* GitHub guide */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-8 pt-8 pb-5 border-b border-white/10 flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">GitHub sync</h3>
            </div>
            <div className="p-8 space-y-4 text-sm text-slate-400 leading-relaxed">
              <p><strong className="text-slate-200">Connect</strong> — open the IDE, click <strong className="text-slate-200">GitHub</strong>, then <strong className="text-slate-200">Connect GitHub</strong>. Use a fine-grained personal access token with repo access (or Supabase OAuth if configured).</p>
              <p><strong className="text-slate-200">Clone a repo</strong> — pick any repository from the list. Its files load into your workspace (up to 200 files).</p>
              <p><strong className="text-slate-200">Commit &amp; push</strong> — edit files, write a commit message, and click <strong className="text-slate-200">Commit &amp; Push</strong> to push your changes to the branch.</p>
            </div>
          </div>

          {/* Models guide */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="px-8 pt-8 pb-5 border-b border-white/10 flex items-center gap-3">
              <FileCode2 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Local model hub</h3>
            </div>
            <div className="p-8 space-y-4 text-sm text-slate-400 leading-relaxed">
              <p><strong className="text-slate-200">Browse models</strong> — open <strong className="text-slate-200">Models</strong> in the navigation to explore real open-source models with their actual sizes.</p>
              <p><strong className="text-slate-200">Pull to Ollama</strong> — with Ollama running locally, click <strong className="text-slate-200">Pull to Local Ollama</strong> to download a model, or copy the <code className="text-emerald-400 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">ollama run &lt;tag&gt;</code> command.</p>
              <p><strong className="text-slate-200">Chat with it</strong> — once pulled, the model appears in Omni-AI's model list, ready to use.</p>
              <p className="text-xs text-slate-500">Tip: for CORS, start Ollama with <code className="text-amber-400 font-mono bg-black/30 px-1.5 py-0.5 rounded">OLLAMA_ORIGINS=*</code>.</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 5. CTA Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-4xl mx-auto mb-32 px-4 z-10 relative"
      >
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 p-10 md:p-16 text-center overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px]" aria-hidden></div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 relative">Ready to build in the cloud?</h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto relative">Spin up your workspace in seconds. No installs, no setup — just your browser.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
            <button
              onClick={onSignUp}
              className="w-full sm:w-auto px-8 py-4 text-base font-bold bg-indigo-600/90 text-white rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] transition-all flex items-center justify-center gap-2 group"
            >
              Launch VantaOS <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setCurrentView('ide')}
              className="w-full sm:w-auto px-8 py-4 text-base font-bold bg-white/5 text-slate-200 border border-white/10 rounded-full hover:bg-white/10 transition-colors"
            >
              Open the IDE
            </button>
          </div>
        </div>
      </motion.section>

      {/* 6. Footer */}
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
            <p className="flex items-center gap-1 text-slate-600">Designed &amp; Architected by <span className="text-indigo-400 font-medium">Mrityunjay K</span></p>
        </div>
      </footer>
    </div>
  );
}

