/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { startAiTrainerWorker } from './utils/aiTrainerWorker';
import { ViewState } from './types';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Forum from './components/Forum';
import Showcase from './components/Showcase';
import DecentralizedMesh from './components/DecentralizedMesh';
import FortressMode from './components/FortressMode';
import AdminPanel from './components/AdminPanel';
import PrivacyPolicy from './components/PrivacyPolicy';
import OmniAI from './components/OmniAI';
import FoundationModel from './components/FoundationModel';
import CloudOS from './components/CloudOS';
import GlobalHelperBot from './components/GlobalHelperBot';
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
  const userEmail = "ram1234598766@gmail.com";

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
          <Navigation currentView={currentView} setCurrentView={setCurrentView} userEmail={session?.user?.email || userEmail} isSynced={!!session} />
          
          <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-8">
            {currentView === 'home' && <Home setCurrentView={setCurrentView} />}
            {currentView === 'forum' && <Forum />}
            {currentView === 'showcase' && <Showcase />}
            {currentView === 'mesh' && <DecentralizedMesh />}
            {currentView === 'fortress' && <FortressMode />}
            {currentView === 'admin' && <AdminPanel />}
            {currentView === 'privacy' && <PrivacyPolicy />}
            {currentView === 'omni-ai' && <OmniAI />}
            {currentView === 'foundation' && <FoundationModel />}
            {currentView === 'ide' && <CloudOS />}
          </main>
          <footer className="w-full bg-white border-t border-slate-200 py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-500">
                Novalith ecosystem architected by <span className="font-bold text-slate-800">Mrityunjay K</span>
              </div>
              <div className="text-sm text-slate-500 flex items-center gap-3">
                <span>Contact: <a href="mailto:ram1234598766@gmail.com" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">ram1234598766@gmail.com</a></span>
                <span className="text-slate-300">|</span>
                <span>Phone: <a href="tel:7981344431" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">7981344431</a></span>
              </div>
            </div>
          </footer>

          <GlobalHelperBot />
        </motion.div>
    </AnimatePresence>
  );
}
