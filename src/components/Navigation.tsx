import { ViewState } from '../types';
import { Layers, MessageSquare, Box, BookOpen, Server, Users, Briefcase, Menu, X, TerminalSquare, Shield, ShieldAlert, FileText, BrainCircuit, Activity, Cloud, CloudOff, Code2 , UserPlus, LogIn} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { aiTrainerStore } from '../utils/aiTrainerWorker';

interface NavigationProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  userEmail?: string;
  isSynced?: boolean;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export default function Navigation({ currentView, setCurrentView, userEmail, isSynced = false, onSignIn, onSignUp }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [livePulse, setLivePulse] = useState(aiTrainerStore.getStats().datapoints);
  
  useEffect(() => {
    const unsubscribe = aiTrainerStore.subscribe((stats) => {
      setLivePulse(stats.datapoints);
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navItems: { view: ViewState; label: string | React.ReactNode; icon: React.ReactNode }[] = [
    { view: 'ide', label: 'Cloud OS IDE', icon: <Code2 className="w-4 h-4" /> },
    { view: 'omni-ai', label: 'Omni-AI', icon: <BrainCircuit className="w-4 h-4" /> },
    { view: 'ollama', label: 'Ollama Local', icon: <TerminalSquare className="w-4 h-4" /> },
    { view: 'foundation', label: 'AI Foundation', icon: <Layers className="w-4 h-4" /> },
    { view: 'forum', label: 'Community', icon: <MessageSquare className="w-4 h-4" /> },
    { view: 'showcase', label: 'Models', icon: <Box className="w-4 h-4" /> },
    { view: 'privacy', label: 'Privacy', icon: <FileText className="w-4 h-4" /> },
  ];

  if (userEmail === 'ram1234598766@gmail.com') {
    navItems.push({ view: 'admin', label: 'Admin Panel', icon: <ShieldAlert className="w-4 h-4" /> });
  }

  return (
    <nav className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-50 sticky top-0 shrink-0">
      <div className="flex items-center gap-8">
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={() => setCurrentView('home')}
        >
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden border border-slate-700">
            <img src="/favicon.svg" alt="Thessvar Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-indigo-900 transition-colors">Thessvar</span>
        </div>
        
        {/* Desktop Nav */}
        <div className="hidden lg:flex gap-1 items-center overflow-x-auto overflow-y-auto whitespace-nowrap scroll-smooth max-w-[50vw] px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}>
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
                currentView === item.view 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {userEmail ? (
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
               <div className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold">
                 {userEmail.charAt(0).toUpperCase()}
               </div>
               <span className="text-sm font-medium">{userEmail.split('@')[0]}</span>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-3">
            <button 
              onClick={() => onSignIn && onSignIn()}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-full hover:bg-slate-100 transition-colors text-slate-700"
            >
              <LogIn className="w-4 h-4 inline-block mr-1"/> Sign In
            </button>
            <button 
              onClick={() => onSignUp && onSignUp()}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-full shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all"
            >
              <UserPlus className="w-4 h-4 inline-block mr-1"/> Sign Up
            </button>
          </div>
        )}
        
        {/* Mobile Menu Toggle */}
        <button 
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-md"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-lg lg:hidden flex flex-col p-4 gap-2 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain scroll-smooth z-50" style={{ scrollBehavior: 'smooth' }}>
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => {
                setCurrentView(item.view);
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                currentView === item.view 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="h-px bg-slate-100 my-2"></div>
          <button 
            onClick={() => { if (onSignIn) onSignIn(); setMobileMenuOpen(false); }}
            className="px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg text-center"
          >
            <LogIn className="w-4 h-4 inline-block mr-2 mb-0.5"/> Sign In
          </button>
          <button 
            onClick={() => { if (onSignUp) onSignUp(); setMobileMenuOpen(false); }}
            className="px-4 py-3 text-sm font-semibold bg-indigo-600 text-white rounded-lg text-center"
          >
            <UserPlus className="w-4 h-4 inline-block mr-2 mb-0.5"/> Sign Up
          </button>
        </div>
      )}
    </nav>
  );
}
