import { ViewState } from '../types';
import { Layers, MessageSquare, Box, BookOpen, Server, Users, Briefcase, Menu, X, TerminalSquare } from 'lucide-react';
import { useState } from 'react';

interface NavigationProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
}

export default function Navigation({ currentView, setCurrentView }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { view: ViewState; label: string; icon: React.ReactNode }[] = [
    { view: 'lion-suite', label: 'Lion Suite', icon: <TerminalSquare className="w-4 h-4" /> },
    { view: 'forum', label: 'Community', icon: <MessageSquare className="w-4 h-4" /> },
    { view: 'showcase', label: 'Models', icon: <Box className="w-4 h-4" /> },
    { view: 'learn', label: 'Learn', icon: <BookOpen className="w-4 h-4" /> },
    { view: 'cloud', label: 'Free Cloud', icon: <Server className="w-4 h-4" /> },
    { view: 'governance', label: 'Governance', icon: <Users className="w-4 h-4" /> },
    { view: 'enterprise', label: 'Enterprise', icon: <Briefcase className="w-4 h-4" /> },
  ];

  return (
    <nav className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-50 sticky top-0 shrink-0">
      <div className="flex items-center gap-8">
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={() => setCurrentView('home')}
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-700 transition-colors">
            <span className="text-white font-bold text-lg leading-none">O</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-indigo-900 transition-colors">OpenLayer</span>
        </div>
        
        {/* Desktop Nav */}
        <div className="hidden lg:flex gap-1 items-center">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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
        <button className="hidden sm:block px-4 py-2 text-sm font-semibold border border-slate-200 rounded-full hover:bg-slate-100 transition-colors text-slate-700">
          Sign In
        </button>
        <button className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-full shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all hidden sm:block">
          Join OpenLayer
        </button>
        
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
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-lg lg:hidden flex flex-col p-4 gap-2">
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
          <button className="px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg text-center">
            Sign In
          </button>
          <button className="px-4 py-3 text-sm font-semibold bg-indigo-600 text-white rounded-lg text-center">
            Join OpenLayer
          </button>
        </div>
      )}
    </nav>
  );
}
