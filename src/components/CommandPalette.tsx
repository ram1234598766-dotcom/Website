import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Compass, Puzzle, File, Folder, Plus, Save, LogOut, Settings as SettingsIcon, Terminal } from 'lucide-react';
import { ViewState } from '../types';
import { supabase } from '../lib/supabase';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setCurrentView: (view: ViewState) => void;
}

type ActionType = 'view' | 'file' | 'open-file' | 'action' | 'plugin';

interface PaletteItem {
  id: string;
  type: ActionType;
  name: string;
  description?: string;
  icon: any;
  onSelect: () => void;
}

export default function CommandPalette({ isOpen, onClose, setCurrentView }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Get IDE state if available
  const ideState = (window as any).vantaosIDE;
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setQuery(''); // Reset query on open
      setSelectedIndex(0);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  const views: { id: ViewState; name: string; icon: any }[] = [
    { id: 'home', name: 'Home', icon: Compass },
    { id: 'ide', name: 'CloudOS IDE', icon: Terminal },
    { id: 'forum', name: 'Community Forum', icon: Compass },
    { id: 'showcase', name: 'Models Showcase', icon: Compass },
    { id: 'privacy', name: 'Data Privacy', icon: Compass },
    { id: 'omni-ai', name: 'Omni AI', icon: Compass },
    { id: 'foundation', name: 'AI Foundation', icon: Compass },
    { id: 'ollama', name: 'Ollama Local', icon: Compass },
  ];
  
  const actions: PaletteItem[] = [
    {
      id: 'action-new-file',
      type: 'action',
      name: 'New File',
      description: 'Create a new file in CloudOS',
      icon: Plus,
      onSelect: () => {
        setCurrentView('ide');
        if (ideState?.newFile) ideState.newFile();
        onClose();
      }
    },
    {
      id: 'action-save',
      type: 'action',
      name: 'Save',
      description: 'Save active file',
      icon: Save,
      onSelect: () => {
        if (ideState?.saveFile) ideState.saveFile();
        onClose();
      }
    },
    
    {
      id: 'action-sign-out',
      type: 'action',
      name: 'Sign Out',
      description: 'Sign out of VantaOS',
      icon: LogOut,
      onSelect: () => {
        supabase.auth.signOut();
        onClose();
      }
    }
  ];

  let items: PaletteItem[] = [];
  
  // 1. Add Views
  views.forEach(v => {
    items.push({
      id: `view-${v.id}`,
      type: 'view',
      name: `Open ${v.name}`,
      icon: v.icon,
      onSelect: () => {
        setCurrentView(v.id);
        onClose();
      }
    });
  });
  
  // 2. Add Actions
  items.push(...actions);
  
  // 3. Add IDE Files if available
  if (ideState) {
    const files = ideState.files || [];
    const openTabs = ideState.openTabs || [];
    
    // Open files
    files.filter((f: any) => openTabs.includes(f.id)).forEach((f: any) => {
      items.push({
        id: `openfile-${f.id}`,
        type: 'open-file',
        name: f.name,
        description: 'Open file (Currently Active)',
        icon: File,
        onSelect: () => {
          ideState.setActiveFileId(f.id);
          onClose();
        }
      });
    });
    
    // File tree
    files.filter((f: any) => !f.isFolder).forEach((f: any) => {
      items.push({
        id: `file-${f.id}`,
        type: 'file',
        name: f.name,
        description: 'File tree',
        icon: File,
        onSelect: () => {
          ideState.setActiveFileId(f.id);
          onClose();
        }
      });
    });
  }
  
  
  
  const fuzzyMatch = (str: string, pattern: string) => {
    let i = 0, j = 0;
    const s = str.toLowerCase();
    const p = pattern.toLowerCase();
    while (i < s.length && j < p.length) {
      if (s[i] === p[j]) j++;
      i++;
    }
    return j === p.length;
  };

  let filteredItems = items;
  if (query) {
    filteredItems = items.filter(item => 
      fuzzyMatch(item.name, query) || 
      (item.description && fuzzyMatch(item.description, query))
    );
  }
  
  // De-duplicate file items (if a file is open, it appears in open files and file tree, prefer open-file)
  const uniqueItems = new Map<string, PaletteItem>();
  filteredItems.forEach(item => {
    if (item.type === 'file') {
      const openFileId = item.id.replace('file-', 'openfile-');
      if (uniqueItems.has(openFileId)) return;
    }
    uniqueItems.set(item.id, item);
  });
  filteredItems = Array.from(uniqueItems.values());
  
  

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].onSelect();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);
  
  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: -20, x: '-50%' }}
            className="fixed top-[15vh] left-1/2 w-full max-w-2xl bg-[#0a0a0c]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-[101] flex flex-col"
          >
            <div className="flex items-center px-4 py-3 border-b border-white/10">
              <Search className="w-5 h-5 text-slate-400 mr-3" />
              <input
                type="text"
                autoFocus
                placeholder="Search files, views, actions, ..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-white text-lg placeholder-slate-500"
              />
              <button onClick={onClose} className="text-slate-400 hover:text-white ml-3">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded">Esc</span>
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-2" ref={listRef}>
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={item.onSelect}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors ${
                        isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.description && (
                        <span className="text-xs text-slate-500">{item.description}</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-sm text-slate-500">No results found</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
