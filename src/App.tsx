/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ViewState } from './types';
import ErrorBoundary from './components/ErrorBoundary';
import Navigation from './components/Navigation';
import CommandPalette from './components/CommandPalette';
import Home from './components/Home';
import CloudOS from './components/CloudOS';
import OmniAI from './components/OmniAI';
import AdminPanel from './components/AdminPanel';
import ModelManager from './components/ModelManager';
import PluginManager from './components/PluginManager';
import AuthModal from './components/AuthModal';
import PWARegister from './components/PWARegister';
import { client } from './lib/client';
import { WorkspaceProvider } from './lib/workspace/workspace';
import { X } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [pluginTab, setPluginTab] = useState<'installed' | 'marketplace'>('installed');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: 'installed' | 'marketplace' } | undefined;
      setPluginTab(detail?.tab ?? 'marketplace');
      setCurrentView('plugins');
    };
    window.addEventListener('vantaos:open-plugins', handler);
    return () => window.removeEventListener('vantaos:open-plugins', handler);
  }, []);

  useEffect(() => {
    if (currentView !== 'plugins') {
      setPluginTab('installed');
    }
  }, [currentView]);
  const [session, setSession] = useState<any>(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [appLoadPhase, setAppLoadPhase] = useState<'init' | 'auth' | 'ready'>('init');
  const appLoadStartTime = useRef(Date.now());
  const [showSlowLoadMsg, setShowSlowLoadMsg] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const onSignIn = useCallback(() => { setAuthMode('signin'); setShowAuthModal(true); }, []);
  const onSignUp = useCallback(() => { setAuthMode('signup'); setShowAuthModal(true); }, []);
  const onSignOut = useCallback(() => { client.auth.signOut(); }, []);
  const handleCloseCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const handleCloseAuthModal = useCallback(() => setShowAuthModal(false), []);
  const handleRefreshSession = useCallback(() => client.auth.refreshSession?.(), []);
  const handleCloseShortcutsHelp = useCallback(() => setShowShortcutsHelp(false), []);

  const isAdmin = useMemo(() => !!session && (session.user?.app_metadata?.role === 'admin' || session.user?.user_metadata?.role === 'admin' || session.role === 'admin'), [session]);

  useEffect(() => {
    const slowTimer = setTimeout(() => setShowSlowLoadMsg(true), 5000);
    return () => clearTimeout(slowTimer);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        const isEditorFocused = (document.activeElement?.closest('.cm-editor') || document.activeElement?.closest('[data-editor-focus]')) !== null;
        if (isEditorFocused) return;
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setAppLoadPhase('auth');
    client.auth
      .getSession()
      .then(({ data: { session } }: any) => {
        setSession(session);
        setAppLoadPhase('ready');
        setAppReady(true);
      })
      .catch((err: any) => {
        console.warn('[VantaOS] Auth init failed:', err);
        setAppLoadPhase('ready');
        setAppReady(true);
      });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event: string, session: any) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (session?.expires_at) {
      const expiresInMs = session.expires_at * 1000 - Date.now();
      const warningTimeMs = 5 * 60 * 1000;
      if (expiresInMs > warningTimeMs) {
        timeoutId = setTimeout(() => setSessionWarning(true), expiresInMs - warningTimeMs);
      } else if (expiresInMs > 0) {
        setSessionWarning(true);
      }
    }
    return () => clearTimeout(timeoutId);
  }, [session]);

  if (!appReady) {
    return <AppLoading phase={appLoadPhase} elapsed={Date.now() - appLoadStartTime.current} showSlowMsg={showSlowLoadMsg} />;
  }

  return (
    <ErrorBoundary>
    <MotionConfig reducedMotion="user">
      <WorkspaceProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full min-h-screen bg-[#0a0a0c] text-slate-300 flex flex-col font-sans relative"
        >
          {sessionWarning && (
            <div role="alert" className="bg-amber-500/20 border-b border-amber-500/50 px-4 py-2 text-center text-sm font-medium text-amber-200 z-50 relative">
              Your session is about to expire.{' '}
              <button onClick={handleRefreshSession} className="underline font-bold hover:text-amber-100">Click here to refresh</button>
            </div>
          )}

          <Navigation
            currentView={currentView}
            setCurrentView={setCurrentView}
            userEmail={session?.email || session?.user?.email}
            isSynced={!!session}
            isAdmin={isAdmin}
            onSignIn={onSignIn}
            onSignUp={onSignUp}
            onSignOut={onSignOut}
          />

          <main role="main" aria-label="Main content" className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-8 relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                role="region"
                aria-label={`${currentView} view`}
                className="w-full flex-1 flex flex-col"
              >
                {currentView === 'home' && (
                  <Home setCurrentView={setCurrentView}
                    onSignIn={onSignIn}
                    onSignUp={onSignUp}
                  />
                )}
                {currentView === 'ide' && <CloudOS />}
                {currentView === 'omni-ai' && <OmniAI />}
                {currentView === 'admin' && <AdminPanel />}
                {currentView === 'models' && <ModelManager />}
                {currentView === 'plugins' && <PluginManager onClose={() => setCurrentView('home')} defaultTab={pluginTab} />}
              </motion.div>
            </AnimatePresence>
          </main>

          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={handleCloseCommandPalette}
            setCurrentView={setCurrentView}
          />

          <AuthModal isOpen={showAuthModal} onClose={handleCloseAuthModal} initialMode={authMode} />

          {showShortcutsHelp && (
            <ShortcutsHelpModal onClose={handleCloseShortcutsHelp} />
          )}
        </motion.div>
      </AnimatePresence>
      </WorkspaceProvider>
      <PWARegister />
    </MotionConfig>
    </ErrorBoundary>
  );
}

function AppLoading({ phase, elapsed, showSlowMsg }: { phase: 'init' | 'auth' | 'ready'; elapsed: number; showSlowMsg: boolean }) {
  const phaseLabel = phase === 'init' ? 'Initializing environment' : phase === 'auth' ? 'Authenticating session' : 'Loading features';
  const phaseSublabel = phase === 'init' ? 'Setting up workspace' : phase === 'auth' ? 'Verifying credentials' : 'Preparing everything';

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 bg-[#07070b] flex flex-col items-center justify-center gap-8 z-[9999] p-4">
      <div className="relative" style={{ width: 80, height: 80 }} aria-hidden>
        <div className="absolute inset-0 border-2 border-transparent border-t-indigo-500 rounded-full" style={{ animation: 'spin 1.2s cubic-bezier(0.5,0,0.5,1) infinite' }} />
        <div className="absolute inset-2 border-2 border-transparent border-r-indigo-400 rounded-full" style={{ animation: 'spin 1.8s cubic-bezier(0.5,0,0.5,1) infinite reverse' }} />
        <div className="absolute inset-4 border-2 border-transparent border-b-indigo-300 rounded-full" style={{ animation: 'spin 2.4s cubic-bezier(0.5,0,0.5,1) infinite' }} />
      </div>
      <div className="text-indigo-400 font-black tracking-widest text-sm">VANTA.OS</div>
      <div className="text-slate-500 text-xs tracking-widest text-center">{phaseLabel}…</div>
      <div className="text-slate-600 text-[11px]">{phaseSublabel}</div>

      <div className="w-64 max-w-[80vw] mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-indigo-500/60 rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {showSlowMsg && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-4 max-w-sm"
        >
          <p className="text-amber-400/80 text-sm font-medium">This is taking longer than usual.</p>
          <p className="text-slate-500 text-xs mt-1">Check your connection. If the problem persists, try refreshing the page.</p>
        </motion.div>
      )}
    </div>
  );
}

function ShortcutsHelpModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: 'Ctrl + K', desc: 'Open command palette (anywhere)' },
    { keys: 'Ctrl + /', desc: 'Toggle keyboard shortcuts help' },
    { keys: 'Ctrl + P', desc: 'Search files & content (in the IDE)' },
    { keys: 'Ctrl + S', desc: 'Save & format the active file' },
    { keys: 'Ctrl + `', desc: 'Toggle the terminal panel' },
    { keys: 'Ctrl + Enter', desc: 'Run the active file (in the IDE)' },
    { keys: 'Escape', desc: 'Close modals and dialogs' },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-[#0c0c12] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          {shortcuts.map(({ keys, desc }) => (
            <div key={keys} className="flex items-center justify-between gap-4 py-2">
              <span className="text-sm text-slate-300">{desc}</span>
              <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded border border-white/10 text-white whitespace-nowrap">{keys}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-4 pt-4 border-t border-white/5">
          Shortcuts work across the entire app. Some shortcuts have different behavior when the editor is focused.
        </p>
      </motion.div>
    </div>
  );
}
