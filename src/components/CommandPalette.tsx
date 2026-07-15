import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Compass, Puzzle } from 'lucide-react';
import { ViewState } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setCurrentView: (view: ViewState) => void;
  onSearchPlugins?: (query: string) => void;
}

export default function CommandPalette({ isOpen, onClose, setCurrentView, onSearchPlugins }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setQuery(''); // Reset query on open
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const views: { id: ViewState; name: string; icon: any }[] = [
    { id: 'home', name: 'Home', icon: Compass },
    { id: 'ide', name: 'CloudOS IDE', icon: Compass },
    { id: 'forum', name: 'Community', icon: Compass },
    { id: 'showcase', name: 'Models', icon: Compass },
    { id: 'privacy', name: 'Data Privacy', icon: Compass },
    { id: 'omni-ai', name: 'Omni AI', icon: Compass },
    { id: 'foundation', name: 'AI Foundation', icon: Compass },
    { id: 'ollama', name: 'Ollama Local', icon: Compass },
  ];

  const filteredViews = views.filter(v => v.name.toLowerCase().includes(query.toLowerCase()));
  const isPluginSearch = query.toLowerCase().startsWith('plugin ');
  const pluginQuery = isPluginSearch ? query.slice(7) : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
            className="fixed top-[15vh] left-1/2 w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[101] flex flex-col"
          >
            <div className="flex items-center px-4 py-3 border-b border-slate-800">
              <Search className="w-5 h-5 text-slate-400 mr-3" />
              <input
                type="text"
                autoFocus
                placeholder="Search views, or type 'plugin <name>'..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-slate-200 text-lg placeholder-slate-500"
              />
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 ml-3">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-800 px-1.5 py-0.5 rounded">Esc</span>
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!isPluginSearch ? (
                <>
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Navigation</div>
                  {filteredViews.length > 0 ? (
                    filteredViews.map(view => (
                      <button
                        key={view.id}
                        onClick={() => {
                          setCurrentView(view.id);
                          onClose();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-800 rounded-lg text-left text-slate-300 transition-colors"
                      >
                        <view.icon className="w-4 h-4 text-slate-400" />
                        <span>{view.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-sm text-slate-500">No views found</div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    setCurrentView('ide');
                    if (onSearchPlugins) onSearchPlugins(pluginQuery);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-4 hover:bg-slate-800 rounded-lg text-left text-indigo-300 transition-colors bg-indigo-500/10 border border-indigo-500/20"
                >
                  <Puzzle className="w-5 h-5" />
                  <span>Search for plugin: <strong className="text-indigo-200">{pluginQuery}</strong> in CloudOS</span>
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
