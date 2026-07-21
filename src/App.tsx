/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ViewState } from './types';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebase';
import Navigation from './components/Navigation';
import CommandPalette from './components/CommandPalette';
import Home from './components/Home';
import Forum from './components/Forum';
import Showcase from './components/Showcase';
import AdminPanel from './components/AdminPanel';
import PrivacyPolicy from './components/PrivacyPolicy';
import OmniAI from './components/OmniAI';
import CloudOS from './components/CloudOS';
import OllamaLocal from './components/OllamaLocal';
import AuthModal from './components/AuthModal';
import { supabase, checkSupabaseConfig } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import AnimatedBackground from './components/AnimatedBackground';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sessionWarning, setSessionWarning] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<'checking' | 'secure' | 'threat' | 'offline'>('checking');
  const [securityFindings, setSecurityFindings] = useState<string[]>([]);
  const isAdmin = !!session && (session.user?.app_metadata?.role === 'admin' || session.user?.user_metadata?.role === 'admin');
  
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const checkSecurity = async () => {
      setSecurityStatus('checking');
      try {
        const res = await fetch('/api/security/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setSecurityStatus(data.threatsFound ? 'threat' : 'secure');
        setSecurityFindings(Array.isArray(data.findings) ? data.findings.map((f) => f.message) : []);
      } catch {
        setSecurityStatus('offline');
        setSecurityFindings(['Security watchdog is unreachable — server may be offline.']);
      }
    };
    checkSecurity();
    const interval = setInterval(checkSecurity, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Firebase anonymous sign-in for Firestore features
    signInAnonymously(auth).catch(err => {
      console.warn("Firebase anonymous sign-in failed:", err);
    });

    checkSupabaseConfig();
    
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      if (session?.provider_token) {
         localStorage.setItem('github_token', session.provider_token);
      }
      if (error) {
        console.error("Session error:", error);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (session?.provider_token) {
         localStorage.setItem('github_token', session.provider_token);
      }
      
      if (event === 'SIGNED_OUT') {
        setSessionWarning(false);
      }
      
      if (event === 'SIGNED_IN') {
        const hash = window.location.hash;
        if (hash && hash.includes('error_description')) {
           const params = new URLSearchParams(hash.substring(1));
           const errorDesc = params.get('error_description');
           setAuthError(errorDesc ? decodeURIComponent(errorDesc).replace(/\+/g, ' ') : 'OAuth sign-in failed');
           window.location.hash = ''; // Clear the hash
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (session) {
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresInMs = (expiresAt * 1000) - Date.now();
        const warningTimeMs = 5 * 60 * 1000; // 5 minutes before expiration
        
        if (expiresInMs > warningTimeMs) {
          timeoutId = setTimeout(() => {
            setSessionWarning(true);
          }, expiresInMs - warningTimeMs);
        } else if (expiresInMs > 0) {
           setSessionWarning(true);
        }
      }
    }
    
    return () => clearTimeout(timeoutId);
  }, [session]);

  return (
    <AnimatePresence mode="wait">
        <motion.div 
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full min-h-screen bg-[#0a0a0c] text-slate-300 flex flex-col font-sans relative"
        >
        {currentView !== 'ide' && <AnimatedBackground />}
        {sessionWarning && (
           <div className="bg-amber-500/20 border-b border-amber-500/50 px-4 py-2 text-center text-sm font-medium text-amber-200 z-50 relative">
              Your session is about to expire. <button onClick={() => supabase.auth.refreshSession()} className="underline font-bold hover:text-amber-100">Click here to refresh</button>
           </div>
        )}
        <Navigation currentView={currentView} setCurrentView={setCurrentView} userEmail={session?.user?.email} isSynced={!!session} isAdmin={isAdmin} onSignIn={() => { setAuthMode('signin'); setShowAuthModal(true); }} onSignUp={() => { setAuthMode('signup'); setShowAuthModal(true); }} />
        
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
              {currentView === 'home' && <Home setCurrentView={setCurrentView} onSignIn={() => { setAuthMode('signin'); setShowAuthModal(true); }} onSignUp={() => { setAuthMode('signup'); setShowAuthModal(true); }} />}
              {currentView === 'forum' && <Forum />}
              {currentView === 'showcase' && <Showcase />}
              {currentView === 'admin' && <AdminPanel />}
              {currentView === 'privacy' && <PrivacyPolicy />}
              {currentView === 'omni-ai' && <OmniAI />}
              {currentView === 'ide' && <CloudOS  />}
              {currentView === 'ollama' && <OllamaLocal />}
            </motion.div>
          </AnimatePresence>
        </main>
        
        {currentView !== 'ide' && currentView !== 'home' && (
          <footer className="w-full bg-[#0a0a0c]/80 backdrop-blur-xl border-t border-white/10 py-6 mt-auto relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-500">
                VantaOS — the open-source developer cloud
              </div>
              <div className="text-sm text-slate-500 flex items-center gap-3">
                <motion.div 
                animate={ securityStatus === 'secure' ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', scale: [1, 1.05, 1] } : securityStatus === 'threat' ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', scale: [1, 1.1, 1] } : { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8' } }
                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                className="px-3 py-1 rounded-full flex items-center gap-2 font-medium border border-transparent shadow-[0_0_10px_rgba(0,0,0,0.2)]"
              >
                {securityStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin" />}
                {securityStatus === 'secure' && <ShieldCheck className="w-4 h-4" />}
                {securityStatus === 'threat' && <ShieldAlert className="w-4 h-4" />}
                <span>{securityStatus === 'checking' ? 'Checking Security...' : securityStatus === 'secure' ? 'Secure Runtime' : 'Threat Detected'}</span>
              </motion.div>
              <button onClick={() => setCurrentView('privacy')} className="text-slate-500 hover:text-indigo-400 transition-colors">Data Privacy & Ownership</button>
              </div>
            </div>
          </footer>
        )}

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
