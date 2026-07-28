/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ViewState } from './types';
import Navigation from './components/Navigation';
import CommandPalette from './components/CommandPalette';
import Home from './components/Home';
import Showcase from './components/Showcase';
import PrivacyPolicy from './components/PrivacyPolicy';
import CloudOS from './components/CloudOS';
import AuthModal from './components/AuthModal';
import { supabase } from './lib/supabase';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [session, setSession] = useState<any>(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const isAdmin = !!session && (session.user?.app_metadata?.role === 'admin' || session.user?.user_metadata?.role === 'admin' || session.role === 'admin');

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }: any) => {
        setSession(session);
        setAppReady(true);
      })
      .catch((err: any) => {
        console.warn('[VantaOS] Auth init failed:', err);
        setAppReady(true);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
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
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#07070b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, zIndex: 9999 }}>
        <div style={{ position: 'relative', width: 80, height: 80 }} aria-hidden>
          <div style={{ position: 'absolute', inset: 0, border: '2px solid transparent', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1.2s cubic-bezier(0.5,0,0.5,1) infinite' }} />
          <div style={{ position: 'absolute', inset: 10, border: '2px solid transparent', borderRightColor: '#818cf8', borderRadius: '50%', animation: 'spin 1.8s cubic-bezier(0.5,0,0.5,1) infinite reverse' }} />
          <div style={{ position: 'absolute', inset: 20, border: '2px solid transparent', borderBottomColor: '#a5b4fc', borderRadius: '50%', animation: 'spin 2.4s cubic-bezier(0.5,0,0.5,1) infinite' }} />
        </div>
        <div style={{ color: '#818cf8', fontFamily: 'system-ui, sans-serif', fontWeight: 900, letterSpacing: 6, fontSize: 14 }}>VANTA.OS</div>
        <div style={{ color: '#646a80', fontFamily: 'system-ui, sans-serif', fontSize: 12, letterSpacing: 2 }}>Loading cloud environment...</div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="app"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full min-h-screen bg-[#0a0a0c] text-slate-300 flex flex-col font-sans relative"
      >
        {sessionWarning && (
          <div className="bg-amber-500/20 border-b border-amber-500/50 px-4 py-2 text-center text-sm font-medium text-amber-200 z-50 relative">
            Your session is about to expire.{' '}
            <button onClick={() => supabase.auth.refreshSession?.()} className="underline font-bold hover:text-amber-100">Click here to refresh</button>
          </div>
        )}

        <Navigation
          currentView={currentView}
          setCurrentView={setCurrentView}
          userEmail={session?.email || session?.user?.email}
          isSynced={!!session}
          isAdmin={isAdmin}
          onSignIn={() => { setAuthMode('signin'); setShowAuthModal(true); }}
          onSignUp={() => { setAuthMode('signup'); setShowAuthModal(true); }}
        />

        <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-8 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full flex-1 flex flex-col"
            >
              {currentView === 'home' && (
                <Home setCurrentView={setCurrentView}
                  onSignIn={() => { setAuthMode('signin'); setShowAuthModal(true); }}
                  onSignUp={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                />
              )}
              {currentView === 'showcase' && <Showcase />}
              {currentView === 'privacy' && <PrivacyPolicy />}
              {currentView === 'ide' && <CloudOS />}
            </motion.div>
          </AnimatePresence>
        </main>

        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          setCurrentView={setCurrentView}
        />

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode={authMode} />
      </motion.div>
    </AnimatePresence>
  );
}
