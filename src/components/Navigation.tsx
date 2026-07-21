import { ViewState } from '../types';
import { Layers, MessageSquare, Box, BookOpen, Server, Users, Briefcase, Menu, X, TerminalSquare, Shield, ShieldAlert, FileText, BrainCircuit, Activity, Cloud, CloudOff, Code2 , UserPlus, LogIn} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import Logo from './Logo';

interface NavigationProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  userEmail?: string;
  isSynced?: boolean;
  isAdmin?: boolean;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export default function Navigation({ currentView, setCurrentView, userEmail, isSynced = false, isAdmin = false, onSignIn, onSignUp }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { view: 'forum', label: 'Community', icon: <MessageSquare className="w-4 h-4" /> },
    { view: 'showcase', label: 'Models', icon: <Box className="w-4 h-4" /> },
    { view: 'privacy', label: 'Privacy', icon: <FileText className="w-4 h-4" /> },
  ];

  if (isAdmin) {
    navItems.push({ view: 'admin', label: 'Admin Panel', icon: <ShieldAlert className="w-4 h-4" /> });
  }

  return (
    <nav className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between z-50 sticky top-0 shrink-0">
      <div className="flex items-center gap-8">
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={() => setCurrentView('home')}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden text-indigo-400">
            <Logo className="w-8 h-8" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">VantaOS</span>
        </div>
        
        {/* Desktop Nav */}
        <div className="hidden lg:flex gap-1 items-center overflow-x-auto overflow-y-auto whitespace-nowrap scroll-smooth max-w-[50vw] px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}>
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
                currentView === item.view 
                  ? 'bg-indigo-500/20 text-indigo-300' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-slate-300 rounded-full border border-white/10">
               <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">
                 {userEmail.charAt(0).toUpperCase()}
               </div>
               <span className="text-sm font-medium">{userEmail.split('@')[0]}</span>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-3">
            <button 
              onClick={() => onSignIn && onSignIn()}
              className="px-4 py-2 text-sm font-semibold border border-white/10 rounded-full hover:bg-white/5 transition-colors text-slate-300"
            >
              <LogIn className="w-4 h-4 inline-block mr-1"/> Sign In
            </button>
            <button 
              onClick={() => onSignUp && onSignUp()}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600/90 text-white rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all"
            >
              <UserPlus className="w-4 h-4 inline-block mr-1"/> Sign Up
            </button>
          </div>
        )}
        
        {/* Mobile Menu Toggle */}
        <button 
          className="lg:hidden p-2 text-slate-400 hover:bg-white/10 rounded-md"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-[#0a0a0c]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl lg:hidden flex flex-col p-4 gap-2 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain scroll-smooth z-50" style={{ scrollBehavior: 'smooth' }}>
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => {
                setCurrentView(item.view);
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                currentView === item.view 
                  ? 'bg-indigo-500/20 text-indigo-300' 
                  : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div className="h-px bg-white/10 my-2"></div>
          <button 
            onClick={() => { if (onSignIn) onSignIn(); setMobileMenuOpen(false); }}
            className="px-4 py-3 text-sm font-semibold text-slate-300 bg-white/5 rounded-lg text-center"
          >
            <LogIn className="w-4 h-4 inline-block mr-2 mb-0.5"/> Sign In
          </button>
          <button 
            onClick={() => { if (onSignUp) onSignUp(); setMobileMenuOpen(false); }}
            className="px-4 py-3 text-sm font-semibold bg-indigo-600/90 text-white rounded-lg text-center shadow-[0_0_15px_rgba(79,70,229,0.3)]"
          >
            <UserPlus className="w-4 h-4 inline-block mr-2 mb-0.5"/> Sign Up
          </button>
        </div>
      )}
    </nav>
  );
}
