/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { startAiTrainerWorker } from './utils/aiTrainerWorker';
import { ViewState } from './types';
import Navigation from './components/Navigation';
import CommandPalette from './components/CommandPalette';
import Home from './components/Home';
import Forum from './components/Forum';
import Showcase from './components/Showcase';
import AdminPanel from './components/AdminPanel';
import PrivacyPolicy from './components/PrivacyPolicy';
import OmniAI from './components/OmniAI';
import FoundationModel from './components/FoundationModel';
import CloudOS from './components/CloudOS';
import OllamaLocal from './components/OllamaLocal';
import GlobalHelperBot from './components/GlobalHelperBot';
import AuthModal from './components/AuthModal';
import { supabase, checkSupabaseConfig } from './lib/supabase';
import { Session } from '@supabase/supabase-js';

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
  const [pluginSearchQuery, setPluginSearchQuery] = useState('');
  const [securityStatus, setSecurityStatus] = useState<'checking' | 'secure' | 'threat'>('checking');
  
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
    const checkSecurity = () => {
      setSecurityStatus('checking');
      fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'ping' })
      }).then(res => res.json()).then(data => {
        setSecurityStatus(data.threatsFound ? 'threat' : 'secure');
      }).catch(() => setSecurityStatus('threat'));
    };
    checkSecurity();
    const interval = setInterval(checkSecurity, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    startAiTrainerWorker();
    checkSupabaseConfig();
    
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      if (error) {
        console.error("Session error:", error);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
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
          className="w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans"
        >
          {sessionWarning && (
             <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-center text-sm font-medium text-amber-800">
                Your session is about to expire. <button onClick={() => supabase.auth.refreshSession()} className="underline font-bold">Click here to refresh</button>
             </div>
          )}
          <Navigation currentView={currentView} setCurrentView={setCurrentView} userEmail={session?.user?.email} isSynced={!!session} onSignIn={() => { setAuthMode('signin'); setShowAuthModal(true); }} onSignUp={() => { setAuthMode('signup'); setShowAuthModal(true); }} />
          
          <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-8 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.3 }}
                className="w-full flex-1 flex flex-col"
              >
                {currentView === 'home' && <Home setCurrentView={setCurrentView} />}
                {currentView === 'forum' && <Forum />}
                {currentView === 'showcase' && <Showcase />}
                {currentView === 'admin' && <AdminPanel />}
                {currentView === 'privacy' && <PrivacyPolicy />}
                {currentView === 'omni-ai' && <OmniAI />}
                {currentView === 'foundation' && <FoundationModel />}
                {currentView === 'ide' && <CloudOS initialPluginSearch={pluginSearchQuery} />}
                {currentView === 'ollama' && <OllamaLocal />}
              </motion.div>
            </AnimatePresence>
          </main>
          <footer className="w-full bg-white border-t border-slate-200 py-6 mt-auto relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-500">
                Thessvar ecosystem architected by <span className="font-bold text-slate-800">Mrityunjay K</span>
              </div>
              <div className="text-sm text-slate-500 flex items-center gap-3">
                <motion.div 
                animate={ securityStatus === 'secure' ? { backgroundColor: '#dcfce7', color: '#166534', scale: [1, 1.05, 1] } : securityStatus === 'threat' ? { backgroundColor: '#fee2e2', color: '#991b1b', scale: [1, 1.1, 1] } : { backgroundColor: '#f1f5f9', color: '#475569' } }
                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                className="px-3 py-1 rounded-full flex items-center gap-2 font-medium border border-transparent"
              >
                {securityStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin" />}
                {securityStatus === 'secure' && <ShieldCheck className="w-4 h-4" />}
                {securityStatus === 'threat' && <ShieldAlert className="w-4 h-4" />}
                <span>{securityStatus === 'checking' ? 'Checking Security...' : securityStatus === 'secure' ? 'Secure Runtime' : 'Threat Detected'}</span>
              </motion.div>
              <button onClick={() => setCurrentView('privacy')} className="text-slate-600 hover:text-indigo-600 transition-colors">Data Privacy & Ownership</button>
              </div>
            </div>
          </footer>

          <GlobalHelperBot />
          <CommandPalette 
            isOpen={isCommandPaletteOpen} 
            onClose={() => setIsCommandPaletteOpen(false)} 
            setCurrentView={setCurrentView}
            onSearchPlugins={(q) => setPluginSearchQuery(q)}
          />
          
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode={authMode} />
        </motion.div>
    </AnimatePresence>
  );
}
