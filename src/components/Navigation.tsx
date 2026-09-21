import { ViewState } from '../types';
import { Menu, X, Code2, BrainCircuit, ShieldAlert, UserPlus, LogIn, LogOut, Cpu, Puzzle, Bell, Activity, Settings, Shield, Wifi, FileText, BookOpen, Folder, Mail, MessageSquare } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

interface NavigationProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  userEmail?: string;
  isSynced?: boolean;
  isAdmin?: boolean;
  onSignIn?: () => void;
  onSignUp?: () => void;
  onSignOut?: () => void;
}

const Navigation = React.memo(function Navigation({ currentView, setCurrentView, userEmail, isSynced = false, isAdmin = false, onSignIn, onSignUp, onSignOut }: NavigationProps) {
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

  const handleNavClick = useCallback((view: ViewState) => {
    setCurrentView(view);
  }, [setCurrentView]);

  const handleMobileToggle = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const navItems = useMemo(() => {
    const items: { view: ViewState; label: string | React.ReactNode; icon: React.ReactNode }[] = [
      { view: 'dashboard', label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
      { view: 'network', label: 'Network', icon: <Wifi className="w-4 h-4" /> },
      { view: 'files', label: 'Files', icon: <Folder className="w-4 h-4" /> },
      { view: 'docs', label: 'Docs', icon: <BookOpen className="w-4 h-4" /> },
      { view: 'ide', label: 'Cloud OS IDE', icon: <Code2 className="w-4 h-4" /> },
      { view: 'omni-ai', label: 'Omni-AI', icon: <BrainCircuit className="w-4 h-4" /> },
      { view: 'models', label: 'WebModels', icon: <Cpu className="w-4 h-4" /> },
      { view: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
      { view: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
      { view: 'notifications', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
      { view: 'plugins', label: 'Plugins', icon: <Puzzle className="w-4 h-4" /> },
      { view: 'messaging', label: 'Messaging', icon: <MessageSquare className="w-4 h-4" /> },
      { view: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    ];
    if (isAdmin) {
      items.push({ view: 'admin', label: 'Admin', icon: <ShieldAlert className="w-4 h-4" /> });
    }
    return items;
  }, [isAdmin]);

  return (
    <nav aria-label="Primary" className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between z-50 sticky top-0 shrink-0">
      <div className="flex items-center gap-8">
        <button
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => setCurrentView('home')}
          aria-label="Go to Home"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden text-indigo-400">
            <Logo className="w-8 h-8" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">VantaOS</span>
        </button>
        
        {/* Desktop Nav */}
        <div className="hidden lg:flex gap-1 items-center overflow-x-auto overflow-y-auto whitespace-nowrap scroll-smooth max-w-[50vw] px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}>
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0 min-h-[44px] min-w-[44px] ${
                  isActive
                    ? 'text-indigo-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-md bg-indigo-500/20"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {userEmail ? (
          <>
            <button
              className="relative p-2 text-slate-400 hover:bg-white/10 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Notifications (3 unread)"
              title="Notifications"
            >
              <Bell className="w-5 h-5" aria-hidden />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" aria-hidden />
            </button>
            <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-slate-300 rounded-full border border-white/10">
               <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">
                 {userEmail.charAt(0).toUpperCase()}
               </div>
               <span className="text-sm font-medium">{userEmail.split('@')[0]}</span>
             </div>
             <button
               onClick={() => onSignOut && onSignOut()}
               title="Sign out"
               aria-label="Sign out"
               className="vanta-signout-btn px-3.5 py-2 text-sm shrink-0"
             >
               <LogOut className="w-4 h-4" aria-hidden />
               <span>Sign out</span>
              </button>
           </div>
           </>
         ) : (
          <div className="hidden sm:flex items-center gap-3">
            <button 
              onClick={() => onSignIn && onSignIn()}
              aria-label="Sign in"
              className="px-4 py-2.5 text-sm font-semibold border border-white/10 rounded-full hover:bg-white/5 transition-colors text-slate-300 min-h-[44px]"
            >
              <LogIn className="w-4 h-4 inline-block mr-1"/> Sign In
            </button>
            <button 
              onClick={() => onSignUp && onSignUp()}
              aria-label="Sign up"
              className="px-4 py-2.5 text-sm font-semibold bg-indigo-600/90 text-white rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all min-h-[44px]"
            >
              <UserPlus className="w-4 h-4 inline-block mr-1"/> Sign Up
            </button>
          </div>
        )}
        
        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden p-2 text-slate-400 hover:bg-white/10 rounded-md"
          onClick={handleMobileToggle}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-nav-menu"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-16 left-0 right-0 bg-[#0a0a0c]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl lg:hidden flex flex-col p-4 gap-2 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain scroll-smooth z-50" style={{ scrollBehavior: 'smooth' }}>
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => {
                handleNavClick(item.view);
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[48px] ${
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
          {userEmail ? (
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 bg-white/5 text-slate-300 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-sm font-bold">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium truncate">{userEmail}</span>
              </div>
              <button
                onClick={() => { if (onSignOut) onSignOut(); setMobileMenuOpen(false); }}
                className="w-full px-4 py-3 text-sm font-semibold text-red-400 bg-red-500/10 rounded-lg text-center"
              >
                <LogOut className="w-4 h-4 inline-block mr-2 mb-0.5"/> Sign Out
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
});
export default Navigation;
