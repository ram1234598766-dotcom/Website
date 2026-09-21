import { ArrowRight, Code2, Cpu, FolderSync, Plug2, Sparkles, TerminalSquare } from 'lucide-react';

const FEATURES = [
  {
    title: 'Cloud OS Web IDE',
    description:
      'A full CodeMirror 6 editor with tabs, split views, and syntax highlighting for 15+ languages — right in your browser.',
    Icon: Code2,
  },
  {
    title: 'Omni-AI Assistant',
    description:
      'Chat with cloud providers or an in-browser WebModel. Generate code, refactor, and get answers without leaving the editor.',
    Icon: Sparkles,
  },
  {
    title: 'Built-in Terminal',
    description:
      'A sandboxed xterm.js terminal that runs JavaScript, Python, and more in a secure Web Worker — no setup, no install.',
    Icon: TerminalSquare,
  },
  {
    title: 'GitHub Sync',
    description: 'Import repositories and push your workspace changes straight from the IDE.',
    Icon: FolderSync,
  },
  {
    title: 'On-device Models',
    description: 'Download and run transformer models locally via WebGPU and WASM through the WebModel manager.',
    Icon: Cpu,
  },
  {
    title: 'Extensible Plugins',
    description: 'Extend the workspace with a typed plugin API for editor extensions and service integrations.',
    Icon: Plug2,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#07070b] text-slate-300 font-sans relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[720px] rounded-full opacity-60 blur-[120px]"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.35), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-40 h-[360px] w-[360px] rounded-full opacity-40 blur-[100px]"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.3), transparent 70%)' }}
      />

      {/* Top navigation */}
      <nav className="relative z-10 flex items-center justify-between gap-4 border-b border-white/8 bg-[#07070b]/80 px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <Code2 className="h-4.5 w-4.5" aria-hidden />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">VantaOS</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="/ide" className="hover:text-white transition-colors">
            Cloud OS IDE
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/ide"
            className="text-sm font-semibold text-slate-300 hover:text-white transition-colors px-3 py-2"
          >
            Sign In
          </a>
          <a
            href="/ide"
            className="vanta-btn vanta-btn-primary px-4 py-2 text-sm"
          >
            Get Started
          </a>
        </div>
      </nav>

      <main role="main" className="relative z-10">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 flex flex-col items-center text-center">
          <div className="vanta-chip mb-6">
            <span className="status-dot" aria-hidden />
            Multiplayer Cloud IDE
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.05]">
            The Intelligent
            <br />
            <span className="text-gradient animate-vanta-shimmer">Developer Cloud</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
            Your entire workspace in the browser — a powerful IDE, an Omni-AI assistant,
            and a real terminal, all running where you already are.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <a
              href="/ide"
              className="vanta-btn vanta-btn-primary px-8 py-4 text-base"
            >
              Get Started for Free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="/ide"
              className="vanta-btn vanta-btn-ghost px-8 py-4 text-base"
            >
              Open the Cloud OS IDE
            </a>
          </div>
        </section>

        {/* Preview IDE mockup */}
        <section className="max-w-5xl mx-auto px-6 pb-20" aria-hidden>
          <div className="glass-strong rounded-2xl overflow-hidden shadow-2xl animate-vanta-glow">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-xs text-slate-400 font-mono">Untitled.js — VantaOS Cloud IDE</span>
            </div>
            <div className="grid grid-cols-[180px_1fr] md:grid-cols-[220px_1fr]">
              <div className="border-r border-white/10 p-3 text-xs font-mono text-slate-400 hidden sm:block">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Explorer</div>
                <div className="flex items-center gap-2 py-1 text-indigo-300">
                  <Code2 className="h-3.5 w-3.5" aria-hidden /> Untitled.js
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Code2 className="h-3.5 w-3.5" aria-hidden /> main.py
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Code2 className="h-3.5 w-3.5" aria-hidden /> style.css
                </div>
              </div>
              <div className="p-4 md:p-6 text-xs leading-6 font-mono">
                <div className="text-slate-500">
                  <span className="text-violet-400">import</span> <span className="text-indigo-300">vanta</span>
                </div>
                <div className="text-slate-500">
                  <span className="text-violet-400">const</span> <span className="text-sky-300">hello</span> = <span className="text-emerald-300">"Hello from VantaOS!"</span>
                </div>
                <div className="text-slate-500">
                  <span className="text-violet-400">await</span> <span className="text-indigo-300">vanta</span>.<span className="text-sky-300">log</span>(hello)
                </div>
                <div className="mt-3 border-t border-white/10 pt-3 text-slate-500">
                  <span className="text-emerald-400">$</span> Hello from VantaOS!
                  <span className="ml-1 inline-block h-3 w-1.5 bg-indigo-400 align-middle animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-6 pt-8 pb-20">
          <div className="text-center mb-12">
            <p className="eyebrow mb-3">Everything you need</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
              One browser tab. A full workspace.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ title, description, Icon }) => (
              <div key={title} className="vanta-card p-6 flex flex-col gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-400/20 flex items-center justify-center text-indigo-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA banner */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="animate-float glass-strong rounded-3xl p-12 text-center shadow-2xl">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
              Start building in the cloud today
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              No downloads, no setup. Open the Cloud OS IDE and your workspace is ready.
            </p>
            <a
              href="/ide"
              className="vanta-btn vanta-btn-primary mt-8 px-10 py-4 text-base"
            >
              Launch the IDE
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/8 bg-[#0a0a0f]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white">
              <Code2 className="h-4 w-4" aria-hidden />
            </div>
            <span className="font-bold text-white">VantaOS</span>
            <span className="text-sm text-slate-500">— The Intelligent Developer Cloud</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="/ide" className="hover:text-white transition-colors">
              Cloud OS IDE
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="/ide" className="hover:text-white transition-colors">
              Sign In
            </a>
          </div>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} VantaOS</p>
        </div>
      </footer>
    </div>
  );
}