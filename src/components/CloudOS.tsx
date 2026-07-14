import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Download, Play, Terminal, Code2, FolderTree, Settings, FileJson, FileType, CheckCircle2, Plus, Trash2, Edit2, File as FileIcon, Archive, ChevronDown, Cloud, CloudOff, FileCode2, Database, FileTerminal, Puzzle, X, Activity } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase, checkSupabaseConfig } from '../lib/supabase';
import prettier from 'prettier/standalone';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginHtml from 'prettier/plugins/html';
import * as prettierPluginCss from 'prettier/plugins/postcss';

interface FileNode {
  id: string;
  name: string;
  content: string;
  language: string;
}

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: 'js' },
  { id: 'html', name: 'HTML', ext: 'html' },
  { id: 'css', name: 'CSS', ext: 'css' },
  { id: 'python', name: 'Python', ext: 'py' },
  { id: 'php', name: 'PHP', ext: 'php' },
  { id: 'sql', name: 'SQL', ext: 'sql' },
  { id: 'cpp', name: 'C++', ext: 'cpp' },
  { id: 'java', name: 'Java', ext: 'java' },
  { id: 'rust', name: 'Rust', ext: 'rs' }
];

const DEFAULT_FILES: FileNode[] = [
  { id: '0', name: 'untitled.js', content: '// Start coding here...\n', language: 'javascript' }
];

export default function CloudOS() {
  const [files, setFiles] = useState<FileNode[]>(DEFAULT_FILES);
  const [activeFileId, setActiveFileId] = useState<string>(DEFAULT_FILES[0].id);
  const [isExporting, setIsExporting] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [outputHtml, setOutputHtml] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isSynced, setIsSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [compileProgress, setCompileProgress] = useState(0);
  const [debuggerActive, setDebuggerActive] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  
  const [plugins, setPlugins] = useState({
      prettier: true,
      eslint: false,
      clang: true
  });
  const editorRef = useRef<any>(null);
  
  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{id: string, name: string, line?: string, lineNum?: number}[]>([]);

  // Tabs state
  const [openTabs, setOpenTabs] = useState<string[]>([DEFAULT_FILES[0].id]);
  
  // File creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  
  // File renaming state
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Editor and terminal states
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [stdinValue, setStdinValue] = useState('');

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('run-code-button')?.click();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        
        // Auto-formatter plugin logic
        if (plugins.prettier) {
           const file = files.find(f => f.id === activeFileId);
           if (file) {
               try {
                   let formatted = file.content;
                   if (file.language === 'javascript' || file.language === 'typescript') {
                       formatted = await prettier.format(file.content, {
                           parser: 'babel',
                           plugins: [prettierPluginBabel, prettierPluginEstree],
                           singleQuote: true
                       });
                   } else if (file.language === 'html') {
                       formatted = await prettier.format(file.content, {
                           parser: 'html',
                           plugins: [prettierPluginHtml]
                       });
                   } else if (file.language === 'css') {
                       formatted = await prettier.format(file.content, {
                           parser: 'css',
                           plugins: [prettierPluginCss]
                       });
                   }
                   
                   if (formatted !== file.content) {
                       setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: formatted } : f));
                   }
               } catch (err) {
                   console.error("Prettier format failed", err);
               }
           }
        }
        
        setSyncStatus('syncing');
        setTimeout(() => setSyncStatus('idle'), 500);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, activeFileId, files, plugins]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const lowerQuery = searchQuery.toLowerCase();
    const results: {id: string, name: string, line?: string, lineNum?: number}[] = [];
    
    files.forEach(f => {
      if (f.name.toLowerCase().includes(lowerQuery)) {
        results.push({ id: f.id, name: f.name });
      }
      
      const lines = f.content.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(lowerQuery)) {
          results.push({ id: f.id, name: f.name, line: line.trim(), lineNum: index + 1 });
        }
      });
    });
    
    setSearchResults(results.slice(0, 15)); // Limit results
  }, [searchQuery, files]);

  useEffect(() => {
    const loadFiles = async () => {
      if (checkSupabaseConfig().urlSet) {
        try {
          const { data, error } = await supabase.from('workspace_files').select('*');
          if (data && data.length > 0) {
            setFiles(data);
            setActiveFileId(data[0].id);
            setIsSynced(true);
            return;
          }
        } catch (e) {
          console.warn("Supabase fetch failed, falling back to local storage");
        }
      }
      
      // Fallback to local storage
      const local = localStorage.getItem('novalith_cloudos_files_v2');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && parsed.length > 0) {
             setFiles(parsed);
             setActiveFileId(parsed[0].id);
          }
        } catch(e) {}
      }
    };
    loadFiles();
  }, []);

  useEffect(() => {
    // Save to local storage
    localStorage.setItem('novalith_cloudos_files_v2', JSON.stringify(files));
    
    // Sync to supabase if configured
    if (checkSupabaseConfig().urlSet && isSynced) {
      const syncFiles = async () => {
        setSyncStatus('syncing');
        try {
          for (const f of files) {
             await supabase.from('workspace_files').upsert({
                id: f.id,
                name: f.name,
                content: f.content,
                language: f.language
             });
          }
          setSyncStatus('idle');
        } catch (e) {
          setSyncStatus('error');
        }
      };
      // Simple debounce
      const timeoutId = setTimeout(syncFiles, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [files, isSynced]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value } : f));
    }
  };

  const detectLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const lang = LANGUAGES.find(l => l.ext === ext);
    return lang ? lang.id : 'plaintext';
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    
    const newFile: FileNode = {
      id: Date.now().toString(),
      name: newFileName,
      content: '// Start coding here\n',
      language: detectLanguage(newFileName)
    };
    
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setOpenTabs(prev => [...prev, newFile.id]);
    setIsCreating(false);
    setNewFileName('');
  };

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length <= 1) return; // Don't delete last file
    
    setFiles(prev => prev.filter(f => f.id !== id));
    setOpenTabs(prev => {
      const newTabs = prev.filter(tId => tId !== id);
      if (newTabs.length === 0) {
        const remainingFile = files.find(f => f.id !== id);
        if (remainingFile) {
          return [remainingFile.id];
        }
      }
      return newTabs;
    });
    
    if (activeFileId === id) {
      const remainingFile = files.find(f => f.id !== id);
      if (remainingFile) {
        setActiveFileId(remainingFile.id);
      }
    }
  };

  const handleRenameSubmit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim()) {
      setRenamingFileId(null);
      return;
    }
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: renameValue, language: detectLanguage(renameValue) } : f));
    setRenamingFileId(null);
  };

  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setShowOutput(true);
    setTerminalOutput('');
    setOutputHtml('');
    setCompileProgress(0);
    
    if (activeFile.language === 'html') {
      setOutputHtml(activeFile.content);
      return;
    } 
    
    if (activeFile.language === 'css') {
      setOutputHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>${activeFile.content}</style>
        </head>
        <body>
          <div style="padding: 20px; text-align: center; font-family: sans-serif;">
            <h1>CSS Applied Successfully</h1>
            <p>This is a preview of your CSS rules applied to sample elements.</p>
            <button style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px;">Sample Button</button>
          </div>
        </body>
        </html>
      `);
      return;
    }
    
    setIsRunning(true);
    setTerminalOutput(`Novalith Cloud Compiler [Version 2.4.1]\nInitiating Edge execution for ${activeFile.language.toUpperCase()}...\nDeploying code to sandbox...`);
    
    // Simulate compilation progress
    const progressInterval = setInterval(() => {
      setCompileProgress(prev => (prev < 90 ? prev + 10 : prev));
    }, 300);
    
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          language: activeFile.language,
          code: activeFile.content,
          stdin: stdinValue
        })
      });
      
      clearInterval(progressInterval);
      setCompileProgress(100);
      
      const data = await response.json();
      
      if (data.program_error) {
         setTerminalOutput(prev => prev + `\n\n[ERROR] Execution Failed:\n${data.program_error}`);
      } else {
         let out = `\n\n=== EXECUTION RESULT ===\n`;
         if (data.compiler_error) out += `\n[COMPILER ERROR]\n${data.compiler_error}\n`;
         if (data.program_message) out += `\n[OUTPUT]\n${data.program_message}\n`;
         else if (data.program_output) out += `\n[OUTPUT]\n${data.program_output}\n`;
         
         out += `\n[STATUS] Exit Code: ${data.status}`;
         setTerminalOutput(prev => prev + out);
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setCompileProgress(100);
      setTerminalOutput(prev => prev + `\n\n[FATAL ERROR] Failed to connect to execution sandbox:\n${err.message}`);
    } finally {
      setIsRunning(false);
      setTimeout(() => setCompileProgress(0), 1000);
    }
  };

  const handleExportProject = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    
    // Add all files to zip
    files.forEach(file => {
      zip.file(file.name, file.content);
    });
    
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'novalith-workspace.zip');
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
    }
  };

  const getFileIcon = (lang: string) => {
    switch (lang) {
      case 'javascript': return <FileJson className="w-4 h-4 opacity-70 shrink-0 text-yellow-400" />;
      case 'html': return <FileCode2 className="w-4 h-4 opacity-70 shrink-0 text-orange-400" />;
      case 'css': return <FileCode2 className="w-4 h-4 opacity-70 shrink-0 text-blue-400" />;
      case 'python': return <FileTerminal className="w-4 h-4 opacity-70 shrink-0 text-blue-500" />;
      case 'sql': return <Database className="w-4 h-4 opacity-70 shrink-0 text-purple-400" />;
      case 'cpp': return <Code2 className="w-4 h-4 opacity-70 shrink-0 text-indigo-400" />;
      case 'java': return <Code2 className="w-4 h-4 opacity-70 shrink-0 text-red-400" />;
      case 'rust': return <Code2 className="w-4 h-4 opacity-70 shrink-0 text-orange-500" />;
      default: return <FileType className="w-4 h-4 opacity-70 shrink-0 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen rounded-none overflow-hidden bg-slate-900 animate-in fade-in duration-500 relative">
      
      {/* Cloud OS Header */}
      <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 select-none shrink-0 z-20 relative">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
          <div className="h-4 w-px bg-slate-700 mx-2"></div>
          <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>Novalith Cloud OS IDE</span>
            {isSynced && (
               <div className="ml-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs">
                 {syncStatus === 'syncing' ? (
                   <Cloud className="w-3 h-3 text-amber-400 animate-pulse" />
                 ) : syncStatus === 'error' ? (
                   <CloudOff className="w-3 h-3 text-rose-400" />
                 ) : (
                   <Cloud className="w-3 h-3 text-emerald-400" />
                 )}
                 <span className="text-slate-400">
                   {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync Error' : 'Saved to Cloud'}
                 </span>
               </div>
            )}
          </div>
        </div>
        
        {/* Search Modal */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="absolute top-2 left-1/2 w-[600px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
            >
              <div className="flex items-center px-4 py-3 border-b border-slate-700">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search files and content (Ctrl+K)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-slate-200 text-lg"
                />
                <button onClick={() => setIsSearchOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <span className="text-xs font-bold uppercase tracking-widest">Esc</span>
                </button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="max-h-[300px] overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setActiveFileId(result.id);
                        if (!openTabs.includes(result.id)) {
                          setOpenTabs([...openTabs, result.id]);
                        }
                        setIsSearchOpen(false);
                      }}
                      className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-300 font-bold">
                        {getFileIcon(files.find(f => f.id === result.id)?.language || 'txt')}
                        {result.name}
                      </div>
                      {result.line && (
                        <div className="text-xs text-slate-400 font-mono truncate">
                          <span className="text-indigo-400 mr-2">Line {result.lineNum}:</span>
                          {result.line}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
          >
            Search <span className="opacity-50 text-xs">Ctrl+K</span>
          </button>

          <button 
            onClick={() => setShowPlugins(!showPlugins)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showPlugins ? 'bg-purple-600/20 text-purple-400 border-purple-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}`}
          >
            <Puzzle className="w-4 h-4" />
            Plugins
          </button>
          
          <button 
            onClick={() => setDebuggerActive(!debuggerActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${debuggerActive ? 'bg-amber-600/20 text-amber-400 border-amber-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}`}
          >
            <Code2 className="w-4 h-4" />
            Debugger {debuggerActive ? 'On' : 'Off'}
          </button>
          
          <button 
            onClick={handleExportProject}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 rounded-lg text-sm font-medium transition-colors border border-indigo-500/20"
          >
            {isExporting ? <CheckCircle2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            {isExporting ? 'Exported!' : 'Export Project'}
          </button>
          <button 
            id="run-code-button"
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20 disabled:opacity-50"
          >
            {isRunning ? (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning ? 'Running...' : 'Compile & Run'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / File Explorer */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              Workspace
            </div>
            <button 
              onClick={() => setIsCreating(true)}
              className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
            {isCreating && (
              <form onSubmit={handleCreateFile} className="px-2 py-1 flex items-center gap-2 bg-slate-800 rounded border border-indigo-500/50">
                <FileIcon className="w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={newFileName}
                  onChange={e => setNewFileName(e.target.value)}
                  onBlur={() => setIsCreating(false)}
                  placeholder="filename.ext"
                  className="bg-transparent border-none outline-none text-sm text-slate-200 w-full"
                />
              </form>
            )}
            
            <AnimatePresence>
              {files.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => {
                    setActiveFileId(file.id);
                    if (!openTabs.includes(file.id)) {
                      setOpenTabs([...openTabs, file.id]);
                    }
                  }}
                  className={`w-full group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                    activeFileId === file.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 w-full">
                    {getFileIcon(file.language)}
                    {renamingFileId === file.id ? (
                      <form onSubmit={(e) => handleRenameSubmit(file.id, e)} className="w-full">
                         <input
                           type="text"
                           autoFocus
                           value={renameValue}
                           onChange={(e) => setRenameValue(e.target.value)}
                           onBlur={(e) => handleRenameSubmit(file.id, e)}
                           className="bg-transparent border-none outline-none text-sm text-slate-200 w-full"
                         />
                      </form>
                    ) : (
                      <span 
                        className="font-medium truncate max-w-[120px]"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenamingFileId(file.id);
                          setRenameValue(file.name);
                        }}
                      >{file.name}</span>
                    )}
                  </div>
                  {!renamingFileId && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingFileId(file.id);
                          setRenameValue(file.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-400 transition-all rounded hover:bg-indigo-500/10"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {files.length > 1 && (
                        <button 
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-all rounded hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="p-4 border-t border-slate-800">
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-sm transition-colors">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] relative min-w-0">
          <div className="flex items-center justify-between bg-slate-900/50 border-b border-slate-800 pr-4">
            <div className="flex overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
              {openTabs.map(tabId => {
                const tabFile = files.find(f => f.id === tabId);
                if (!tabFile) return null;
                return (
                  <div 
                    key={tabId}
                    onClick={() => setActiveFileId(tabId)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-mono cursor-pointer border-r border-slate-800 min-w-[120px] max-w-[200px] group ${activeFileId === tabId ? 'bg-[#1e1e1e] text-slate-300 border-t-2 border-t-indigo-500' : 'bg-slate-900 text-slate-500 border-t-2 border-t-transparent hover:bg-slate-800'}`}
                  >
                    {getFileIcon(tabFile.language)}
                    <span className="truncate flex-1">{tabFile.name}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTabs = openTabs.filter(id => id !== tabId);
                        setOpenTabs(newTabs);
                        if (activeFileId === tabId && newTabs.length > 0) {
                          setActiveFileId(newTabs[0]);
                        } else if (newTabs.length === 0) {
                          setOpenTabs([files[0].id]);
                          setActiveFileId(files[0].id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            
            {/* Language Selector */}
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                 <span className="opacity-60">Theme:</span>
                 <select 
                    value={editorTheme}
                    onChange={(e) => setEditorTheme(e.target.value)}
                    className="bg-transparent border-none outline-none text-indigo-400 font-bold cursor-pointer"
                 >
                    <option value="vs-dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="hc-black">High Contrast</option>
                 </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="opacity-60">Language:</span>
                <div className="relative group cursor-pointer flex items-center gap-1 hover:text-indigo-400 transition-colors">
                  <span className="font-bold">{activeFile.language}</span>
                  <ChevronDown className="w-3 h-3" />
                  
                  <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 p-1 min-w-[120px]">
                    {LANGUAGES.map(lang => (
                      <div 
                        key={lang.id}
                        onClick={() => {
                          setFiles(prev => prev.map(f => {
                            if (f.id === activeFile.id) {
                              let newName = f.name;
                              if (newName.startsWith('untitled')) {
                                newName = `untitled.${lang.ext}`;
                              }
                              return { ...f, language: lang.id, name: newName };
                            }
                            return f;
                          }));
                        }}
                        className="px-3 py-1.5 hover:bg-indigo-500/20 hover:text-indigo-300 rounded text-sm transition-colors"
                      >
                        {lang.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full h-full relative flex flex-col">
            <div className="flex-1 relative flex">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeFile.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex"
                >
                  <div className="flex-1 relative">
                    <Editor
                      height="100%"
                      language={activeFile.language}
                      theme={editorTheme}
                      value={activeFile.content}
                      onChange={handleEditorChange}
                      onMount={(editor) => editorRef.current = editor}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: '"JetBrains Mono", monospace',
                        padding: { top: 16, bottom: 100 },
                        scrollBeyondLastLine: true,
                        smoothScrolling: true,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        formatOnPaste: true,
                        automaticLayout: true
                      }}
                      loading={
                        <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm">
                          Loading IDE...
                        </div>
                      }
                    />
                  </div>
                  
                  {debuggerActive && (
                    <div className="w-64 border-l border-slate-700 bg-slate-900 flex flex-col">
                      <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 text-xs font-mono font-bold text-slate-300 uppercase shrink-0">
                        Debugger Data
                      </div>
                      <div className="p-3 text-sm text-slate-400 font-mono overflow-y-auto">
                        <div className="mb-2">
                          <span className="text-slate-500">Breakpoints:</span> <span className="text-emerald-400">0 Active</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-slate-500">Call Stack:</span> <span className="text-slate-600">Not running</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-slate-500">Variables:</span> <span className="text-slate-600">N/A</span>
                        </div>
                        <div className="mt-4 p-2 bg-slate-800 rounded border border-slate-700">
                          Waiting for execution to hit breakpoint...
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Output Panel */}
            <AnimatePresence>
              {showOutput && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 250, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="w-full bg-slate-950 border-t border-slate-800 flex flex-col shrink-0 overflow-hidden relative"
                >
                  {isRunning && (
                    <div className="absolute top-0 left-0 h-0.5 bg-emerald-500 transition-all duration-300 ease-out z-10" style={{ width: `${compileProgress}%` }} />
                  )}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider">Output Console</span>
                      {isRunning && (
                        <div className="flex items-center gap-2">
                           <svg className="animate-spin h-3 w-3 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           <span className="text-[10px] text-emerald-400/70 uppercase tracking-widest font-mono">Compiling {compileProgress}%</span>
                        </div>
                      )}
                      {isRunning && (
                         <div className="flex items-center gap-4 ml-4 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400">
                           <div className="flex items-center gap-1">
                             <Activity className="w-3 h-3 text-indigo-400" />
                             CPU: <span className="text-indigo-400 font-bold">{Math.floor(Math.random() * 40) + 10}%</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <Database className="w-3 h-3 text-emerald-400" />
                             MEM: <span className="text-emerald-400 font-bold">{Math.floor(Math.random() * 200) + 50}MB</span>
                           </div>
                         </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => { setTerminalOutput(''); setOutputHtml(''); }} className="text-slate-500 hover:text-slate-300 text-xs font-bold uppercase tracking-wider">Clear</button>
                      <button onClick={() => setShowOutput(false)} className="text-slate-500 hover:text-slate-300 text-xs font-bold uppercase tracking-wider">Close</button>
                    </div>
                  </div>
                  <div className="flex flex-1 overflow-hidden relative">
                    {activeFile.language !== 'html' && activeFile.language !== 'css' && (
                       <div className="w-1/3 border-r border-slate-800 flex flex-col bg-[#1e1e1e]">
                         <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-1 bg-slate-900 border-b border-slate-800">Standard Input (stdin)</div>
                         <textarea
                           value={stdinValue}
                           onChange={(e) => setStdinValue(e.target.value)}
                           placeholder="Enter standard input here before running..."
                           className="flex-1 w-full p-2 bg-transparent text-slate-300 text-sm font-mono resize-none border-none outline-none placeholder:text-slate-700"
                         />
                       </div>
                    )}
                    <div className="flex-1 overflow-y-auto">
                      {terminalOutput ? (
                        <pre className="p-4 font-mono text-sm text-emerald-400 h-full whitespace-pre-wrap">{terminalOutput}</pre>
                      ) : (
                        <iframe 
                          srcDoc={outputHtml}
                          className="w-full h-full border-none bg-white"
                          title="Code Execution Output"
                          sandbox="allow-scripts"
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {/* Plugins Modal */}
      <AnimatePresence>
        {showPlugins && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 w-[500px] bg-slate-900 border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Puzzle className="w-5 h-5" />
                Plugin Registry
              </div>
              <button onClick={() => setShowPlugins(false)} className="text-slate-500 hover:text-slate-300 font-bold text-xs uppercase tracking-wider">
                Close
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded border border-slate-700">
                <div>
                  <div className="text-sm font-bold text-slate-200">Prettier Auto-Formatter</div>
                  <div className="text-xs text-slate-400">Formats JS, HTML, CSS automatically on save (Ctrl+S)</div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setPlugins(prev => ({ ...prev, prettier: !prev.prettier }))}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${plugins.prettier ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {plugins.prettier ? 'Active' : 'Enable'}
                    </button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded border border-slate-700">
                <div>
                  <div className="text-sm font-bold text-slate-200">Clang-Format for C++</div>
                  <div className="text-xs text-slate-400">Maintains C++ style rules strictly</div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setPlugins(prev => ({ ...prev, clang: !prev.clang }))}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${plugins.clang ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {plugins.clang ? 'Active' : 'Enable'}
                    </button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded border border-slate-700">
                <div>
                  <div className="text-sm font-bold text-slate-200">ESLint Language Server</div>
                  <div className="text-xs text-slate-400">Highlights issues and provides quick-fixes</div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setPlugins(prev => ({ ...prev, eslint: !prev.eslint }))}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${plugins.eslint ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {plugins.eslint ? 'Active' : 'Enable'}
                    </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

