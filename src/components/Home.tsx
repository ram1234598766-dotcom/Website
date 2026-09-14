import React, { useRef } from 'react';
import { ViewState } from '../types';
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  Terminal,
  GitBranch,
  MessageSquareText,
  Cpu,
  Puzzle,
  Zap,
  ArrowRight,
  LogIn,
  HardDrive,
  Code2,
  Globe,
  BookOpen,
  Compass,
  Keyboard,
  FolderTree,
  FileCode2,
  Sparkles,
  Lock,
  Play,
  Braces,
  BrainCircuit,
} from 'lucide-react';
import Logo from './Logo';

interface HomeProps {
  setCurrentView: (view: ViewState) => void;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

type FeatureView = 'ide' | 'omni-ai' | 'models' | 'plugins';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  view: FeatureView;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

export default function Home({ setCurrentView, onSignIn, onSignUp }: HomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const yHero = useTransform(scrollYProgress, [0, 0.4], [0, 90]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const glowX = useTransform(smoothProgress, [0, 1], ['-30%', '30%']);

  const features: Feature[] = [
    {
      icon: <Terminal className="w-6 h-6" />,
      title: 'Cloud OS Web IDE',
      description:
        'A full-featured, zero-config development environment running entirely in your browser with a CodeMirror-based editor, file explorer, split views, and a live diff.',
      view: 'ide',
    },
    {
      icon: <GitBranch className="w-6 h-6" />,
      title: 'GitHub Synchronization',
      description:
        'Sign in with a GitHub token, clone any of your repositories, edit files, and commit & push your changes back without leaving the workspace.',
      view: 'ide',
    },
    {
      icon: <HardDrive className="w-6 h-6" />,
      title: 'Google Drive Sync',
      description:
        'Connect Google Drive from the IDE to browse, open, and save files. Edits go into a dedicated VantaOS folder, and your own Drive files stay read-only.',
      view: 'ide',
    },
    {
      icon: <MessageSquareText className="w-6 h-6" />,
      title: 'Omni-AI Assistant',
      description:
        'A chat interface that runs AI in your browser — in-browser WebModel, or cloud APIs like OpenRouter, Gemini, and OpenAI.',
      view: 'omni-ai',
    },
    {
      icon: <Terminal className="w-6 h-6" />,
      title: 'Built-in Terminal',
      description:
        'An xterm.js terminal with a real virtual file system. Run JavaScript inline, navigate directories, create files, and test code as you write.',
      view: 'ide',
    },
    {
      icon: <Cpu className="w-6 h-6" />,
      title: 'In-browser Model Manager',
      description:
        'Browse, download, and manage WebModel packages that run entirely in your browser on WebGPU/WASM — no daemons, no installs, nothing leaves your device.',
      view: 'models',
    },
    {
      icon: <Puzzle className="w-6 h-6" />,
      title: 'Plugin Ecosystem',
      description:
        'Install, enable, and manage signed extensions. Plugins run sandboxed and can only access the capabilities they declare.',
      view: 'plugins',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'One-Click Export',
      description:
        'Export your entire workspace as a ZIP archive preserving your folder structure — perfect for backups or moving to another environment.',
      view: 'ide',
    },
  ];

  const open = (view: FeatureView) => setCurrentView(view);

  return (
    <div ref={containerRef} className="relative min-h-screen pt-12 pb-8 flex flex-col items-center overflow-hidden">
        {/* Scroll progress — a quiet brand accent along the top edge */}
        <motion.div
          className="fixed top-0 left-0 right-0 h-[2px] origin-left z-[60] bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400 opacity-70"
          style={{ scaleX: smoothProgress }}
          aria-hidden
        />

        {/* Aurora backdrop */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 60% 45% at 50% -5%, rgba(99,102,241,0.18), transparent), radial-gradient(ellipse 45% 40% at 85% 25%, rgba(168,85,247,0.10), transparent), radial-gradient(ellipse 40% 40% at 8% 45%, rgba(52,211,153,0.05), transparent)',
            }}
          />
          <motion.div
            className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[70%] h-[55%] rounded-full bg-indigo-500/[0.07] blur-[110px]"
            style={{ x: glowX }}
          />
          <div className="absolute bottom-[-15%] right-[-8%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[100px]" />
          <div className="absolute top-[45%] right-[22%] w-[30%] h-[30%] rounded-full bg-emerald-500/3 blur-[80px]" />
          {/* Subtle dot grid, masked toward the edges */}
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage: 'radial-gradient(rgba(148,153,173,0.14) 1px, transparent 1px)',
              backgroundSize: '34px 34px',
              maskImage: 'radial-gradient(ellipse 60% 45% at 50% 18%, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 60% 45% at 50% 18%, black 30%, transparent 75%)',
            }}
          />
        </div>

        {/* 1. Hero Section */}
        <motion.section
          style={{ y: yHero, opacity: opacityFade }}
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="text-center max-w-4xl mx-auto space-y-8 mt-8 sm:mt-16 mb-24 sm:mb-32 px-4 relative z-10"
        >
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16 }} className="flex justify-center">
            <div className="relative animate-float">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 to-accent opacity-40 blur-2xl" aria-hidden />
              <div className="relative w-24 h-24 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl flex items-center justify-center text-indigo-400 shadow-[0_0_60px_rgba(99,102,241,0.35)]">
                <Logo className="w-14 h-14" />
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-strong text-xs font-bold tracking-[0.18em] uppercase text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
              <span className="status-dot" aria-hidden />
              VantaOS is now in Public Beta
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white leading-[1.04]"
          >
            The Intelligent
            <br />
            <span className="text-gradient animate-vanta-shimmer">Developer Cloud</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-3 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-[#646a80]"
          >
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-indigo-400/60" aria-hidden />
            <span>by <span className="text-indigo-300">Mrityunjay K</span></span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-400/60" aria-hidden />
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="text-lg sm:text-xl text-[#9499ad] max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Write, build, and deploy full-stack applications entirely in the browser.
            An in-browser IDE, AI assistant, terminal, and model hub — all in one clean workspace.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
          >
            <button
              onClick={onSignUp}
              className="vanta-btn vanta-btn-primary w-full sm:w-auto px-9 py-4 text-base"
            >
              Get Started for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onSignIn}
              className="vanta-btn vanta-btn-ghost w-full sm:w-auto px-9 py-4 text-base"
            >
              Sign In
              <LogIn className="w-5 h-5 opacity-70" />
            </button>
          </motion.div>

          <motion.p variants={fadeUp} className="text-xs text-[#646a80] font-medium tracking-wide pt-2">
            No installs · No credit card · Works in your browser tab
          </motion.p>
        </motion.section>

        {/* 2. Live Preview Section */}
        <motion.section
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: EASE }}
          className="w-full max-w-6xl mx-auto mb-24 sm:mb-32 relative z-10 px-4"
        >
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-accent rounded-[2rem] blur-3xl opacity-15 animate-vanta-glow" aria-hidden />

            <div className="relative glass-strong rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              {/* Window header */}
              <div className="h-12 bg-white/[0.028] border-b border-white/[0.08] flex items-center px-4 gap-4 shrink-0">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 flex justify-center -ml-16">
                  <div className="px-4 py-1.5 rounded-lg bg-black/40 border border-white/5 flex items-center gap-2 text-xs font-medium text-[#9499ad]">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    vantaos.app/workspace
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-[#646a80]">
                  <span className="status-dot" aria-hidden />
                  Live
                </div>
              </div>

              <div className="flex flex-1 min-h-[400px] md:min-h-[500px]">
                {/* Explorer sidebar */}
                <div className="hidden md:flex w-64 border-r border-white/[0.08] bg-black/20 p-4 flex-col gap-4 shrink-0">
                  <div className="eyebrow">Explorer</div>
                  <div className="flex flex-col gap-1">
                    {[
                      { icon: <Terminal className="w-4 h-4" />, name: 'server.ts', active: true, color: 'text-[#818cf8]' },
                      { icon: <Code2 className="w-4 h-4" />, name: 'App.tsx', active: false, color: 'text-[#34d399]' },
                      { icon: <Braces className="w-4 h-4" />, name: 'types.ts', active: false, color: 'text-accent' },
                    ].map(({ icon, name, active, color }) => (
                      <div
                        key={name}
                        className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg transition-colors ${
                          active ? 'bg-white/[0.06] text-white' : 'text-[#9499ad] hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className={color}>{icon}</span>
                        {name}
                      </div>
                    ))}
                  </div>
                  <div className="eyebrow mt-6">Terminal</div>
                  <div className="flex items-center gap-2 text-sm text-[#9499ad] px-2 py-1.5 rounded-lg">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    bash — workspace
                  </div>
                </div>

                {/* Editor area */}
                <div className="flex-1 min-w-0 flex flex-col bg-black/10">
                  {/* Tabs */}
                  <div className="flex items-center border-b border-white/[0.08] text-xs shrink-0">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-r border-white/[0.08] bg-black/20 text-white font-medium">
                      <span className="text-indigo-400"><Code2 className="w-3.5 h-3.5" /></span>
                      server.ts
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-[#646a80] border-r border-white/[0.08]">
                      <span className="text-emerald-400"><Braces className="w-3.5 h-3.5" /></span>
                      App.tsx
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-[#646a80]">
                      <span className="text-green-400"><Terminal className="w-3.5 h-3.5" /></span>
                      shell
                    </div>
                  </div>

                  {/* Code */}
                  <div className="flex-1 overflow-hidden font-mono text-[13px] leading-7 p-6">
                    <div className="text-[#9499ad]">
                      <span className="text-accent">import</span> {'{'} serve {'}'} <span className="text-accent">from</span>{' '}
                      <span className="text-[#34d399]">'@vantaos/runtime'</span>;
                    </div>
                    <div className="text-[#9499ad]">
                      <span className="text-accent">const</span> app = <span className="text-[#818cf8]">serve</span>({'{'}
                    </div>
                    <div className="text-[#9499ad] pl-5">
                      port: <span className="text-amber-300">3000</span>,
                    </div>
                    <div className="text-[#9499ad] pl-5">
                      fetch(req) {'{'}
                    </div>
                    <div className="text-[#9499ad] pl-10">
                      <span className="text-accent">return new</span> <span className="text-[#818cf8]">Response</span>(
                      <span className="text-[#34d399]">'Hello from VantaOS Edge!'</span>);
                    </div>
                    <div className="text-[#9499ad] pl-5">{'}'}</div>
                    <div className="text-[#9499ad]">{'}'});</div>
                    <br />
                    <div className="text-[#646a80] italic">// Real-time compilation active…</div>
                    <div className="flex items-center gap-2 mt-4 text-emerald-400 font-sans text-sm font-semibold">
                      <span className="status-dot" aria-hidden />
                      Server running perfectly.
                    </div>
                  </div>

                  {/* Status bar */}
                  <div className="h-8 border-t border-white/[0.08] bg-black/25 flex items-center px-4 gap-4 text-[11px] text-[#646a80] font-medium shrink-0">
                    <span className="flex items-center gap-1.5 text-[#34d399]"><GitBranch className="w-3 h-3" /> main</span>
                    <span className="hidden sm:inline">0 errors · 0 warnings</span>
                    <span className="hidden sm:inline ml-auto">TypeScript</span>
                    <span className="hidden md:inline">Ln 5, Col 24</span>
                    <span className="flex items-center gap-1.5"><Play className="w-3 h-3" /> vantaos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 3. Feature Highlights Section */}
        <motion.section
          className="w-full max-w-6xl mx-auto mb-24 sm:mb-32 px-4 z-10 relative"
        >
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-14"
          >
            <motion.div variants={fadeUp}>
              <span className="eyebrow inline-flex items-center gap-2 mb-3 text-indigo-400">
                <Sparkles className="w-4 h-4" /> Everything built in
              </span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              Everything you need. <br className="hidden sm:block" /> Nothing you don't.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#9499ad] text-lg max-w-2xl mx-auto">
              VantaOS brings the entire development lifecycle into a single, cohesive
              interface built for speed and focus.
            </motion.p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((feature) => (
              <motion.button
                key={feature.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
                onClick={() => open(feature.view)}
                className="vanta-card group text-left p-7 flex flex-col gap-4 hover:shadow-[0_18px_50px_rgba(79,70,229,0.18)] cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-indigo-400 transition-all duration-300 group-hover:scale-110 group-hover:bg-indigo-500/15 group-hover:border-indigo-400/40 group-hover:text-indigo-300 group-hover:shadow-[0_0_28px_rgba(99,102,241,0.35)]">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 tracking-tight flex items-center gap-2">
                    {feature.title}
                    <ArrowRight className="w-4 h-4 text-[#646a80] transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-400" />
                  </h3>
                  <p className="text-sm text-[#9499ad] leading-relaxed">{feature.description}</p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </motion.section>

        {/* 4. Tech Stack Section */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="w-full max-w-6xl mx-auto mb-24 sm:mb-32 px-4 z-10 relative text-center"
        >
          <div className="mb-10">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              Powered by a modern stack
            </h2>
            <p className="text-[#9499ad] text-lg max-w-2xl mx-auto">
              Built on battle-tested open-source technology, engineered to run
              entirely in your browser.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['React 19', 'TypeScript', 'Next.js', 'CodeMirror', 'Tailwind CSS', 'Motion', 'xterm.js', 'Firebase', 'Cloudflare'].map((tech, i) => (
              <motion.span
                key={tech}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                whileHover={{ scale: 1.07, transition: { duration: 0.2, ease: 'easeOut' } }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
                className="px-4 py-2 rounded-full glass text-sm font-semibold text-[#9499ad] hover:text-white hover:border-indigo-400/40 transition-colors"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </motion.section>

        {/* 5. About VantaOS Section */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="w-full max-w-6xl mx-auto mb-24 sm:mb-32 px-4 z-10 relative"
          id="about"
        >
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 glass-strong rounded-full mb-6">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span className="text-xs uppercase tracking-widest font-bold text-indigo-300">About VantaOS</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              A complete development cloud, in your browser
            </h2>
            <p className="text-[#9499ad] text-lg max-w-3xl mx-auto leading-relaxed">
              VantaOS is a browser-based development environment designed and architected by
              Mrityunjay K. It combines a full web IDE, an AI assistant, in-browser AI models,
              GitHub integration, and a built-in terminal into one cohesive workspace — no
              installs, no setup, just a browser tab.
            </p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            <motion.div variants={fadeUp} className="vanta-card p-8 flex flex-col gap-5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">What VantaOS actually does</h3>
              <ul className="text-sm text-[#9499ad] leading-relaxed space-y-3">
                <li className="flex gap-2.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Cloud OS IDE</strong> — edit code in a CodeMirror-based editor with 35+ languages, folder tree, tabbed files, split views, and a diff view against your saved version.</span></li>
                <li className="flex gap-2.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Built-in Terminal</strong> — a working xterm.js shell with a virtual file system, command history, and inline JavaScript execution.</span></li>
                <li className="flex gap-2.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Omni-AI Assistant</strong> — chat in-browser or via cloud providers (OpenRouter, Gemini, OpenAI).</span></li>
                <li className="flex gap-2.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-white">GitHub Sync</strong> — clone a repo, edit, and push commits directly from the IDE using your GitHub token.</span></li>
                <li className="flex gap-2.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Model Manager</strong> — browse, download, and manage WebModel packages with verified sources, running entirely on your device.</span></li>
                <li className="flex gap-2.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Offline-first data</strong> — your workspace auto-saves to your browser, and demo accounts store locally when Firebase isn't connected.</span></li>
              </ul>
            </motion.div>

            <motion.div variants={fadeUp} className="vanta-card p-8 flex flex-col gap-5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                <Compass className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">How it's built</h3>
              <ul className="text-sm text-[#9499ad] leading-relaxed space-y-3">
                <li className="flex gap-2.5"><span className="text-emerald-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Next.js 15 + React 19</strong> with static export for fast, cacheable deployment.</span></li>
                <li className="flex gap-2.5"><span className="text-emerald-400 font-bold mt-0.5">•</span> <span><strong className="text-white">TypeScript</strong> across the whole codebase.</span></li>
                <li className="flex gap-2.5"><span className="text-emerald-400 font-bold mt-0.5">•</span> <span><strong className="text-white">CodeMirror 6</strong> — a fast, dependency-light editor core that ships in the bundle (no CDN, no ~3MB runtime).</span></li>
                <li className="flex gap-2.5"><span className="text-emerald-400 font-bold mt-0.5">•</span> <span><strong className="text-white">xterm.js</strong> for the terminal with a virtual file system.</span></li>
                <li className="flex gap-2.5"><span className="text-emerald-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Firebase</strong> (optional) for real auth, forum, and admin data when configured.</span></li>
                <li className="flex gap-2.5"><span className="text-emerald-400 font-bold mt-0.5">•</span> <span><strong className="text-white">Deployed on Cloudflare</strong> as a static export with a Workers proxy for AI calls.</span></li>
              </ul>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* 6. User Guide Section */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="w-full max-w-6xl mx-auto mb-24 sm:mb-32 px-4 z-10 relative"
          id="guide"
        >
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 glass-strong rounded-full mb-6">
              <Keyboard className="w-4 h-4 text-accent" />
              <span className="text-xs uppercase tracking-widest font-bold text-purple-300">User Guide</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">Get started in minutes</h2>
            <p className="text-[#9499ad] text-lg max-w-3xl mx-auto">
              Everything you need to know to use VantaOS effectively — from the editor to the terminal, AI, and GitHub.
            </p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-5"
          >
            {/* Editor guide */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <FolderTree className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Cloud OS IDE</h3>
              </div>
              <div className="p-7 space-y-3.5 text-sm text-[#9499ad] leading-relaxed flex-1">
                <p><strong className="text-white">Create files & folders</strong> — use the + buttons in the Workspace sidebar, or right-side actions to create files and folders in any directory.</p>
                <p><strong className="text-white">Edit & manage</strong> — click a file to open it in a tab. Rename with the pencil icon, delete with the trash icon, and move files with the arrow icon.</p>
                <p><strong className="text-white">Format on save</strong> — press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">S</kbd> to auto-format JS, TS, HTML and CSS with Prettier.</p>
                <p><strong className="text-white">Run your code</strong> — hit <strong className="text-white">Compile &amp; Run</strong> to execute the active file's JavaScript in the terminal.</p>
                <p><strong className="text-white">Diff &amp; split</strong> — toggle <strong className="text-white">Diff</strong> to compare against the last save, or use the split buttons for side-by-side editing.</p>
              </div>
            </motion.div>

            {/* Terminal guide */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Terminal commands</h3>
              </div>
              <div className="p-7 space-y-3 flex-1">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['help', 'Show all commands'],
                    ['ls', 'List files'],
                    ['cd <path>', 'Change directory'],
                    ['pwd', 'Print working dir'],
                    ['cat <file>', 'View file contents'],
                    ['echo <text>', 'Print text'],
                    ['js <code>', 'Run JS inline'],
                    ['node <file>', 'Run a JS file'],
                    ['mkdir <dir>', 'Create directory'],
                    ['touch <file>', 'Create file'],
                    ['rm <path>', 'Remove file/dir'],
                    ['clear', 'Clear terminal'],
                  ].map(([cmd, desc]) => (
                    <div key={cmd} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 border border-white/5">
                      <code className="text-emerald-400 font-mono text-xs shrink-0">{cmd}</code>
                      <span className="text-[#646a80] text-xs">{desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[#646a80] text-xs mt-1">Use <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">↑</kbd>/<kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">↓</kbd> for history, <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">`</kbd> to toggle the panel.</p>
              </div>
            </motion.div>

            {/* Keyboard shortcuts */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <Keyboard className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Keyboard shortcuts</h3>
              </div>
              <div className="p-7 space-y-3 flex-1">
                {[
                  ['Ctrl + K', 'Open the command palette (anywhere)'],
                  ['Ctrl + P', 'Search files & content (in the IDE)'],
                  ['Ctrl + S', 'Save & format the active file'],
                  ['Ctrl + `', 'Toggle the terminal panel'],
                  ['Ctrl + /', 'Show keyboard shortcuts (in the IDE)'],
                  ['Ctrl + Enter', 'Run the active file (in the IDE)'],
                ].map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between gap-4 py-1">
                    <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded border border-white/10 text-white whitespace-nowrap">{keys}</span>
                    <span className="text-[#9499ad] text-xs text-right">{desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Omni-AI guide */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Omni-AI assistant</h3>
              </div>
              <div className="p-7 space-y-3.5 text-sm text-[#9499ad] leading-relaxed flex-1">
                <p><strong className="text-white">Choose a provider</strong> — open ⚙️ Settings in Omni-AI. Pick <strong className="text-white">WebModel</strong> to run AI entirely in your browser (no API key), or a cloud provider like <strong className="text-white">OpenRouter</strong>, <strong className="text-white">Gemini</strong>, or <strong className="text-white">OpenAI</strong> with an API key.</p>
                <p><strong className="text-white">In-browser WebModel</strong> — runs on WebGPU/WASM via Transformers.js. No server needed; the model downloads from Hugging Face on first use and nothing leaves your device.</p>
                <p><strong className="text-white">Quick commands</strong> — <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">calc 2^10</code>, <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">js code...</code>, <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">weather in London</code>, or just <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">help</code>.</p>
                <p><strong className="text-white">No account needed</strong> — WebModel works out of the box with zero setup. Tool commands (<code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">calc</code>, <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">js</code>, <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">weather</code>) respond instantly even without an AI model loaded.</p>
              </div>
            </motion.div>

            {/* GitHub guide */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <GitBranch className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">GitHub sync</h3>
              </div>
              <div className="p-7 space-y-3.5 text-sm text-[#9499ad] leading-relaxed flex-1">
                <p><strong className="text-white">Connect</strong> — open the IDE, click <strong className="text-white">GitHub</strong>, then <strong className="text-white">Connect GitHub</strong>. Use a fine-grained personal access token with repo access (or Firebase OAuth if configured).</p>
                <p><strong className="text-white">Clone a repo</strong> — pick any repository from the list. Its files load into your workspace (up to 200 files).</p>
                <p><strong className="text-white">Commit &amp; push</strong> — edit files, write a commit message, and click <strong className="text-white">Commit &amp; Push</strong> to push your changes to the branch.</p>
              </div>
            </motion.div>

            {/* Models guide */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <FileCode2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">In-browser model manager</h3>
              </div>
              <div className="p-7 space-y-3.5 text-sm text-[#9499ad] leading-relaxed flex-1">
                <p><strong className="text-white">Browse models</strong> — open <strong className="text-white">WebModels</strong> in the navigation to discover model packages that run locally in your browser.</p>
                <p><strong className="text-white">Download &amp; verify</strong> — downloads are content-hash verified against trusted sources (Hugging Face, VantaOS Official) before they install.</p>
                <p><strong className="text-white">Use them in Omni-AI</strong> — select <strong className="text-white">WebModel</strong> in Omni-AI Settings to chat with an in-browser model. No API key, no data leaves your device.</p>
              </div>
            </motion.div>

            {/* Sign-in options */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Sign in to VantaOS</h3>
              </div>
              <div className="p-7 space-y-3.5 text-sm text-[#9499ad] leading-relaxed flex-1">
                <p><strong className="text-white">Continue with Google</strong> — click the Google button on the sign-in page to authenticate with your Google account via OAuth. Quick, secure, no password to remember.</p>
                <p><strong className="text-white">Continue with GitHub</strong> — click the GitHub button to sign in with your GitHub account. Gets you straight into the IDE with your repos synced.</p>
                <p><strong className="text-white">Email &amp; password</strong> — create an account with your email and a password. Works everywhere, even offline.</p>
                <p><strong className="text-white">Guest mode</strong> — try VantaOS instantly with zero setup. Sign in anytime to unlock cloud sync, GitHub, and AI features.</p>
              </div>
            </motion.div>

            {/* Gemini AI section */}
            <motion.div variants={fadeUp} className="vanta-card overflow-hidden flex flex-col">
              <div className="px-7 pt-6 pb-4 border-b border-white/[0.08] flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">Gemini AI integration</h3>
              </div>
              <div className="p-7 space-y-3.5 text-sm text-[#9499ad] leading-relaxed flex-1">
                <p><strong className="text-white">Google Gemini</strong> — VantaOS integrates directly with Google's Gemini AI models through the Generative Language API. Add your Gemini API key in Omni-AI Settings (<strong className="text-white">⚙️ → Gemini</strong>) to unlock cloud AI without leaving your workspace.</p>
                <p><strong className="text-white">How it works</strong> — when you select Gemini as your provider in Omni-AI, prompts are sent to <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">generativelanguage.googleapis.com</code> with your API key. Responses stream back into the chat panel instantly.</p>
                <p><strong className="text-white">Models available</strong> — <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">gemini-2.5-flash</code> for fast everyday tasks, plus access to the latest Gemini family models as they release.</p>
                <p><strong className="text-white">Privacy</strong> — your API key stays in your browser's local storage. VantaOS never stores or transmits it to our servers. Get a free key at <code className="text-[#818cf8] font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">aistudio.google.com</code>.</p>
              </div>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* 7. CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="w-full max-w-4xl mx-auto mb-24 sm:mb-32 px-4 z-10 relative"
        >
          <div className="relative rounded-3xl glass-strong p-10 md:p-16 text-center overflow-hidden">
            <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[110%] h-72 bg-gradient-to-r from-indigo-500/25 via-accent/25 to-indigo-500/25 blur-[100px] animate-vanta-glow" aria-hidden />
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 relative">
              Ready to build in the cloud?
            </h2>
            <p className="text-[#9499ad] text-lg mb-8 max-w-xl mx-auto relative">
              Spin up your workspace in seconds. No installs, no setup — just your browser.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
              <button
                onClick={onSignUp}
                className="vanta-btn vanta-btn-primary px-9 py-4 text-base w-full sm:w-auto"
              >
                Launch VantaOS
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => open('ide')}
                className="vanta-btn vanta-btn-ghost px-9 py-4 text-base w-full sm:w-auto"
              >
                <Globe className="w-5 h-5 opacity-70" />
                Open the IDE
              </button>
            </div>
          </div>
        </motion.section>

        {/* 8. Footer */}
        <footer className="w-full max-w-6xl mx-auto border-t border-white/[0.08] pt-12 pb-8 px-4 z-10 relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo className="w-6 h-6 text-indigo-400" />
              <span className="font-bold text-white tracking-tight text-lg">VantaOS</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium">
              <button onClick={onSignIn} className="text-[#9499ad] hover:text-white transition-colors">Sign In</button>
              <button onClick={onSignUp} className="text-indigo-400 hover:text-indigo-300 transition-colors">Get Started</button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#646a80]">
            <p>&copy; {new Date().getFullYear()} VantaOS. All rights reserved.</p>
            <p className="flex items-center gap-1 text-[#646a80]">
              Designed &amp; Architected by <span className="text-indigo-400 font-medium">Mrityunjay K</span>
            </p>
          </div>
        </footer>
    </div>
  );
}