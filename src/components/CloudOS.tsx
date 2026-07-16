import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Virtuoso } from 'react-virtuoso';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';
import { Download, Play, Terminal, Code2, FolderTree, Settings, FileJson, FileType, CheckCircle2, Plus, Trash2, Edit2, File as FileIcon, Archive, ChevronDown, ChevronRight, Folder, FolderOpen, ArrowRight, Cloud, CloudOff, FileCode2, Database, FileTerminal, Puzzle, X, Activity } from 'lucide-react';
import { Keyboard, GitMerge } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { supabase } from '../lib/supabase';

interface PluginMeta {
  name: string;
  description: string;
  active: boolean;
  version?: string;
}

const DEFAULT_PLUGINS: Record<string, PluginMeta> = {
  prettier: { name: 'Prettier', description: 'Auto-formatter for JS, HTML, CSS', active: true },
  eslint: { name: 'ESLint', description: 'JavaScript Linter', active: false },
  clang: { name: 'Clang-Format', description: 'C++ style rules', active: true },
  gitlens: { name: 'GitLens', description: 'Supercharge Git', active: false },
  liveServer: { name: 'Live Server', description: 'Launch a local dev server', active: false },
  vscodeIcons: { name: 'VSCode Icons', description: 'Icons for Visual Studio Code', active: true },
  materialIcon: { name: 'Material Icon Theme', description: 'Material Design Icons', active: false },
  python: { name: 'Python Extension', description: 'IntelliSense, linting, debugging', active: true },
  cpp: { name: 'C/C++ Extension', description: 'C/C++ IntelliSense, debugging', active: true },
  java: { name: 'Java Extension Pack', description: 'Popular extensions for Java', active: false },
  docker: { name: 'Docker', description: 'Build, manage Docker containers', active: false },
  kubernetes: { name: 'Kubernetes', description: 'Develop, deploy K8s applications', active: false },
  restClient: { name: 'REST Client', description: 'REST Client for IDE', active: true },
  thunderClient: { name: 'Thunder Client', description: 'Lightweight API Client', active: false },
  spellChecker: { name: 'Code Spell Checker', description: 'Spell checker for source code', active: true },
  pathIntellisense: { name: 'Path Intellisense', description: 'Visual Studio Code plugin that autocompletes filenames', active: true },
  reactSnippets: { name: 'React Snippets', description: 'ES7 React/Redux/GraphQL/React-Native snippets', active: true },
  autoCloseTag: { name: 'Auto Close Tag', description: 'Auto add HTML/XML close tag', active: true },
  autoRenameTag: { name: 'Auto Rename Tag', description: 'Auto rename paired HTML/XML tag', active: true },
  bracketPair: { name: 'Bracket Pair Colorizer', description: 'A customizable extension for colorizing matching brackets', active: true },
  settingsSync: { name: 'Settings Sync', description: 'Synchronize Settings, Snippets, Themes', active: false },
  remoteSsh: { name: 'Remote - SSH', description: 'Open any folder on a remote machine', active: false },
  vim: { name: 'Vim', description: 'Vim emulation', active: false },
  jupyter: { name: 'Jupyter', description: 'Jupyter notebook support', active: true },
  markdown: { name: 'Markdown All in One', description: 'All you need to write Markdown', active: true },
  tailwind: { name: 'Tailwind CSS IntelliSense', description: 'Intelligent Tailwind CSS tooling', active: true }
};
import * as prettier from 'prettier/standalone';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginHtml from 'prettier/plugins/html';
import * as prettierPluginCss from 'prettier/plugins/postcss';

interface FileNode {
  id: string;
  name: string;
  content: string;
  language: string;
  isFolder?: boolean;
  parentId?: string | null;
  isOpen?: boolean;
}

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: 'js' },
  { id: 'typescript', name: 'TypeScript', ext: 'ts' },
  { id: 'html', name: 'HTML', ext: 'html' },
  { id: 'css', name: 'CSS', ext: 'css' },
  { id: 'python', name: 'Python', ext: 'py' },
  { id: 'php', name: 'PHP', ext: 'php' },
  { id: 'sql', name: 'SQL', ext: 'sql' },
  { id: 'cpp', name: 'C++', ext: 'cpp' },
  { id: 'c', name: 'C', ext: 'c' },
  { id: 'csharp', name: 'C#', ext: 'cs' },
  { id: 'java', name: 'Java', ext: 'java' },
  { id: 'rust', name: 'Rust', ext: 'rs' },
  { id: 'go', name: 'Go', ext: 'go' },
  { id: 'ruby', name: 'Ruby', ext: 'rb' },
  { id: 'swift', name: 'Swift', ext: 'swift' },
  { id: 'kotlin', name: 'Kotlin', ext: 'kt' },
  { id: 'dart', name: 'Dart', ext: 'dart' },
  { id: 'json', name: 'JSON', ext: 'json' },
  { id: 'yaml', name: 'YAML', ext: 'yaml' },
  { id: 'markdown', name: 'Markdown', ext: 'md' },
  { id: 'shell', name: 'Shell Script', ext: 'sh' },
  { id: 'objective-c', name: 'Objective-C', ext: 'm' },
  { id: 'scala', name: 'Scala', ext: 'scala' },
  { id: 'perl', name: 'Perl', ext: 'pl' },
  { id: 'lua', name: 'Lua', ext: 'lua' },
  { id: 'haskell', name: 'Haskell', ext: 'hs' },
  { id: 'elixir', name: 'Elixir', ext: 'ex' },
  { id: 'r', name: 'R', ext: 'r' },
  { id: 'powershell', name: 'PowerShell', ext: 'ps1' },
  { id: 'clojure', name: 'Clojure', ext: 'clj' },
  { id: 'fsharp', name: 'F#', ext: 'fs' },
  { id: 'pascal', name: 'Pascal', ext: 'pas' },
  { id: 'julia', name: 'Julia', ext: 'jl' },
  { id: 'groovy', name: 'Groovy', ext: 'groovy' },
  { id: 'matlab', name: 'MATLAB', ext: 'm' }
];

const DEFAULT_FILES: FileNode[] = [
  { id: 'f-src', name: 'src', content: '', language: 'folder', isFolder: true, parentId: null, isOpen: true },
  { id: '0', name: 'main.js', content: '// Start coding here...\nconsole.log("Hello VantaOS!");\n', language: 'javascript', parentId: 'f-src' },
  { id: 'f-utils', name: 'utils', content: '', language: 'folder', isFolder: true, parentId: 'f-src', isOpen: false },
  { id: '1', name: 'math.js', content: '// Math utilities\nexport function add(a, b) {\n  return a + b;\n}\n', language: 'javascript', parentId: 'f-utils' },
  { id: '2', name: 'styles.css', content: '/* Application Styles */\nbody {\n  margin: 0;\n  background: #0f172a;\n}\n', language: 'css', parentId: 'f-src' },
  { id: '3', name: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="src/styles.css">\n</head>\n<body>\n  <script src="src/main.js"></script>\n</body>\n</html>\n', language: 'html', parentId: null },
  { id: '4', name: 'README.md', content: '# VantaOS Cloud Project\n\nWelcome to your browser-isolated workspace. Build, compile, and execute with absolute sovereignty.\n', language: 'markdown', parentId: null }
];

interface CloudOSProps {
  initialPluginSearch?: string;
}

export default function CloudOS({ initialPluginSearch }: CloudOSProps) {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [files, setFiles] = useState<FileNode[]>(DEFAULT_FILES);
  const [originalFiles, setOriginalFiles] = useState<Record<string, string>>({});
  const [showDiff, setShowDiff] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string>('0');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [movingFileId, setMovingFileId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [outputHtml, setOutputHtml] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [isSynced, setIsSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [compileProgress, setCompileProgress] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [debuggerActive, setDebuggerActive] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  const [plugins, setPlugins] = useState<Record<string, PluginMeta>>(DEFAULT_PLUGINS);
  const [pluginSearch, setPluginSearch] = useState(initialPluginSearch || '');
  const [registryLoading, setRegistryLoading] = useState(false);
  

  
  // Plugin Store Fetch
  useEffect(() => {
    if (showPlugins && !registryLoading) {
      setRegistryLoading(true);
      // Simulate fetching open-source package metadata from a remote JSON registry
      fetch('https://registry.npmjs.org/-/v1/search?text=keywords:prettier,eslint,monaco-plugin&size=15')
        .then(res => res.json())
        .then(data => {
          if (data.objects) {
            setPlugins(prev => {
              const next = { ...prev };
              data.objects.forEach((obj: any) => {
                const pkg = obj.package;
                if (!next[pkg.name]) {
                  next[pkg.name] = {
                    name: pkg.name,
                    description: pkg.description || 'Remote plugin module',
                    active: false,
                    version: pkg.version
                  };
                }
              });
              return next;
            });
          }
        })
        .catch(err => console.error("Plugin fetch failed", err))
        .finally(() => setRegistryLoading(false));
    }
  }, [showPlugins]);
  
  const [remoteCursors, setRemoteCursors] = useState<Record<string, {line: number, column: number, color: string}>>({});
  const decorationsRef = useRef<string[]>([]);
  
  useEffect(() => {
    if (!auth.currentUser) return;
    const sessionRef = doc(db, 'collaboration', activeFileId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.cursors) {
          const others = { ...data.cursors };
          delete others[auth.currentUser.uid];
          setRemoteCursors(others);
        }
      }
    });
    return () => unsubscribe();
  }, [activeFileId]);

  useEffect(() => {
    if (editorRef.current && monaco) {
      const decorations = Object.values(remoteCursors).map((cursor: any) => ({
        range: new monaco.Range(cursor.line, cursor.column, cursor.line, cursor.column),
        options: {
          className: 'remote-cursor-collab',
          hoverMessage: { value: 'Collaborator' }
        }
      }));
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, decorations);
    }
  }, [remoteCursors, monaco]);

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;
    
    // Listen for cursor changes
    editor.onDidChangeCursorPosition((e: any) => {
      if (auth.currentUser) {
        const sessionRef = doc(db, 'collaboration', activeFileId);
        setDoc(sessionRef, {
          cursors: {
            [auth.currentUser.uid]: {
              line: e.position.lineNumber,
              column: e.position.column,
              color: '#10b981' // Emerald
            }
          }
        }, { merge: true });
      }
    });
  };


  
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

  // Firebase syncing logic
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    const settingsRef = doc(db, 'user_ide_settings', user.uid);
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.editorTheme) setEditorTheme(data.editorTheme);
        if (data.openTabs) setOpenTabs(data.openTabs);
        if (data.plugins) setPlugins(data.plugins);
      }
    });
    
    return () => unsubscribe();
  }, []);


  // Auto-save mechanism to Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    const saveToFirestore = async () => {
      try {
        setSyncStatus('syncing');
        await setDoc(doc(db, 'workspaces', user.uid), {
          files: files,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setSyncStatus('idle');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSyncStatus('error');
      }
    };
    
    const interval = setInterval(() => {
      saveToFirestore();
    }, 10000); // Auto-save every 10 seconds
    
    return () => clearInterval(interval);
  }, [files]);

  const saveSettingsToCloud = async (newSettings: any) => {
    const user = auth.currentUser;
    if (!user) return;
    
    setSyncStatus('syncing');
    try {
      const settingsRef = doc(db, 'user_ide_settings', user.uid);
      await setDoc(settingsRef, newSettings, { merge: true });
      setSyncStatus('idle');
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  // Trigger save on settings change
  useEffect(() => {
    saveSettingsToCloud({ editorTheme, openTabs, plugins });
  }, [editorTheme, openTabs, plugins]);
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
        if (plugins.prettier?.active) {
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
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShowPlugins(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, activeFileId, files, plugins]);

  useEffect(() => {
    if (initialPluginSearch) {
      setShowPlugins(true);
      setPluginSearch(initialPluginSearch);
    }
  }, [initialPluginSearch]);

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
      if (auth.currentUser) {
        try {
          // Server-side validation via Supabase Edge Functions (Mocked in our server)
          const token = await auth.currentUser?.getIdToken();
          const authRes = await fetch('/api/edge-functions/auth-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'read' })
          });
          
          if (!authRes.ok) {
            throw new Error('Server-side authentication failed in Edge Function');
          }
          const { data, error } = await supabase.from('workspace_files').select('*');
          if (data && data.length > 0) {
            setFiles(data);
            const orig: Record<string, string> = {};
            data.forEach((d: any) => orig[d.id] = d.content);
            setOriginalFiles(orig);
            setActiveFileId(data[0].id);
            setIsSynced(true);
            return;
          }
        } catch (e) {
          console.warn("Supabase fetch failed, falling back to local storage");
        }
      }
      
      // Fallback to local storage
      const local = localStorage.getItem('vantaos_cloudos_files_v2') || localStorage.getItem('vantaos_cloudos_files_v2');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && parsed.length > 0) {
             setFiles(parsed);
             const orig: Record<string, string> = {};
             parsed.forEach((d: any) => orig[d.id] = d.content);
             setOriginalFiles(orig);
             setActiveFileId(parsed[0].id);
          }
        } catch(e) {}
      }
    };
    loadFiles();
  }, []);

  useEffect(() => {
    // Save to local storage
    localStorage.setItem('vantaos_cloudos_files_v2', JSON.stringify(files));
    
    // Sync to supabase if configured
    if (auth.currentUser && isSynced) {
      const syncFiles = async () => {
        setSyncStatus('syncing');
        try {
          // Server-side validation via Supabase Edge Functions (Mocked in our server)
          const token = await auth.currentUser?.getIdToken();
          const authRes = await fetch('/api/edge-functions/auth-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'sync' })
          });
          
          if (!authRes.ok) {
            throw new Error('Server-side authentication failed in Edge Function');
          }
          
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
          console.error(e);
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
      
      // Simulate ESLint
      if (plugins.eslint && monaco && activeFile.language === 'javascript') {
        const model = editorRef.current?.getModel();
        if (model) {
          const markers: any[] = [];
          const lines = value.split('\n');
          lines.forEach((line, i) => {
            if (line.includes('var ')) {
              markers.push({
                severity: monaco.MarkerSeverity.Warning,
                message: 'Unexpected var, use let or const instead. (eslint: no-var)',
                startLineNumber: i + 1,
                startColumn: line.indexOf('var ') + 1,
                endLineNumber: i + 1,
                endColumn: line.indexOf('var ') + 4
              });
            }
            if (line.includes('console.log')) {
              markers.push({
                severity: monaco.MarkerSeverity.Info,
                message: 'Unexpected console statement. (eslint: no-console)',
                startLineNumber: i + 1,
                startColumn: line.indexOf('console.log') + 1,
                endLineNumber: i + 1,
                endColumn: line.indexOf('console.log') + 12
              });
            }
          });
          monaco.editor.setModelMarkers(model, 'eslint', markers);
        }
      } else if (monaco && !plugins.eslint) {
        const model = editorRef.current?.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'eslint', []);
        }
      }
    }
  };

  const detectLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const lang = LANGUAGES.find(l => l.ext === ext);
    return lang ? lang.id : 'plaintext';
  };

  const getDescendantIds = (folderId: string, allFiles: FileNode[]): string[] => {
    const children = allFiles.filter(f => (f.parentId || null) === folderId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      if (c.isFolder) {
        ids = [...ids, ...getDescendantIds(c.id, allFiles)];
      }
    });
    return ids;
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    
    const newFile: FileNode = {
      id: Date.now().toString(),
      name: newFileName,
      content: '// Start coding here\n',
      language: detectLanguage(newFileName),
      parentId: creatingParentId
    };
    
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setOpenTabs(prev => [...prev, newFile.id]);
    setIsCreating(false);
    setCreatingParentId(null);
    setNewFileName('');
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const newFolder: FileNode = {
      id: Date.now().toString(),
      name: newFileName,
      content: '',
      language: 'folder',
      isFolder: true,
      parentId: creatingParentId,
      isOpen: true
    };

    setFiles(prev => [...prev, newFolder]);
    setIsCreating(false);
    setCreatingParentId(null);
    setNewFileName('');
  };

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = files.find(f => f.id === id);
    if (!item) return;

    const idsToDelete = [id];
    if (item.isFolder) {
      idsToDelete.push(...getDescendantIds(id, files));
    }

    const remainingFiles = files.filter(f => !idsToDelete.includes(f.id));
    if (remainingFiles.length === 0) return; // Don't delete everything

    setFiles(prev => prev.filter(f => !idsToDelete.includes(f.id)));
    setOpenTabs(prev => {
      const newTabs = prev.filter(tId => !idsToDelete.includes(tId));
      if (newTabs.length === 0) {
        const remainingFile = remainingFiles.find(f => !f.isFolder);
        if (remainingFile) {
          return [remainingFile.id];
        }
      }
      return newTabs;
    });
    
    if (idsToDelete.includes(activeFileId)) {
      const remainingFile = remainingFiles.find(f => !f.isFolder);
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
    setFiles(prev => prev.map(f => f.id === id ? { 
      ...f, 
      name: renameValue, 
      language: f.isFolder ? 'folder' : detectLanguage(renameValue) 
    } : f));
    setRenamingFileId(null);
  };

  const handleMoveNode = (nodeId: string, destParentId: string | null) => {
    setFiles(prev => prev.map(f => f.id === nodeId ? { ...f, parentId: destParentId } : f));
    setMovingFileId(null);
  };

  const [isRunning, setIsRunning] = useState(false);

  const handleFormat = async () => {
    if (!plugins['prettier']?.active) {
      setTerminalOutput('Error: Prettier plugin is not enabled.');
      setShowOutput(true);
      return;
    }
    
    try {
      let formatted = activeFile.content;
      if (activeFile.language === 'javascript' || activeFile.language === 'typescript') {
        formatted = await prettier.format(activeFile.content, {
          parser: 'babel',
          plugins: [prettierPluginBabel, prettierPluginEstree]
        });
      } else if (activeFile.language === 'html') {
        formatted = await prettier.format(activeFile.content, {
          parser: 'html',
          plugins: [prettierPluginHtml]
        });
      } else if (activeFile.language === 'css') {
        formatted = await prettier.format(activeFile.content, {
          parser: 'css',
          plugins: [prettierPluginCss]
        });
      } else if (activeFile.language === 'json') {
        formatted = JSON.stringify(JSON.parse(activeFile.content), null, 2);
      }
      
      const updatedFiles = files.map(f => f.id === activeFileId ? { ...f, content: formatted } : f);
      setFiles(updatedFiles);
    } catch (e: any) {
      setTerminalOutput('Format error: ' + e.message);
      setShowOutput(true);
    }
  };

  const handleRun = async () => {
    setShowOutput(true);
    setTerminalOutput('');
    setOutputHtml('');
    setCompileProgress(0);
    
    if (activeFile.language === 'markdown') {
      setOutputHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        </head>
        <body class="markdown-body" style="padding: 20px;">
          <div id="content"></div>
          <script>
            document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(activeFile.content)});
          </script>
        </body>
        </html>
      `);
      return;
    }

    if (activeFile.language === 'markdown') {
      setOutputHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        </head>
        <body class="markdown-body" style="padding: 20px;">
          <div id="content"></div>
          <script>
            document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(activeFile.content)});
          </script>
        </body>
        </html>
      `);
      return;
    }

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
    setTerminalOutput(`VantaOS Cloud Compiler [Version 2.4.1]\nInitiating Edge execution for ${activeFile.language.toUpperCase()}...\nDeploying code to sandbox...`);
    
    // Simulate compilation progress
    const progressInterval = setInterval(() => {
      setCompileProgress(prev => (prev < 90 ? prev + 10 : prev));
    }, 300);
    
    try {
      let token = 'null';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
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
    
    // Recursive path solver
    const getVirtualPath = (nodeId: string, allNodes: FileNode[]): string => {
      const node = allNodes.find(n => n.id === nodeId);
      if (!node) return '';
      if (node.parentId) {
        const parentPath = getVirtualPath(node.parentId, allNodes);
        return parentPath ? parentPath + '/' + node.name : node.name;
      }
      return node.name;
    };

    // Add all files to zip preserving folder structure
    files.forEach(file => {
      if (!file.isFolder) {
        const path = getVirtualPath(file.id, files);
        zip.file(path, file.content);
      }
    });
    
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'vantaos-workspace.zip');
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

  const getVisibleNodes = () => {
    const list: (FileNode & { depth: number; isPlaceholder?: boolean })[] = [];
    
    const traverse = (parentId: string | null, depth: number) => {
      const levelNodes = files.filter(f => (f.parentId || null) === parentId);
      
      levelNodes.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Inject placeholder at the top of children under this parent
      if (creatingType && (creatingParentId || null) === parentId) {
        list.push({
          id: 'placeholder-new-item',
          name: '',
          content: '',
          language: creatingType === 'folder' ? 'folder' : 'plaintext',
          isFolder: creatingType === 'folder',
          parentId,
          depth,
          isPlaceholder: true
        });
      }
      
      levelNodes.forEach(node => {
        list.push({ ...node, depth });
        if (node.isFolder && node.isOpen) {
          traverse(node.id, depth + 1);
        }
      });
    };
    
    traverse(null, 0);
    return list;
  };

  const visibleNodes = getVisibleNodes();

  return (
    <div className="flex flex-col h-screen w-screen rounded-none overflow-hidden bg-slate-900 animate-in fade-in duration-500 relative">
      
      {/* Cloud OS Header */}
      <div className="min-h-14 py-2 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between px-4 select-none shrink-0 z-20 relative gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
          <div className="h-4 w-px bg-slate-700 mx-2"></div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 border border-slate-800 transition-colors mr-1 cursor-pointer"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <FolderTree className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>VantaOS CLOUD OS IDE</span>
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
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto sm:justify-end shrink-0 py-1">
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
          >
            Search <span className="opacity-50 text-xs">Ctrl+K</span>
          </button>

          <button 
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
          >
            <Keyboard className="w-4 h-4" />
            <span className="hidden sm:inline">Shortcuts</span>
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
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 rounded-lg text-sm font-medium transition-colors border border-indigo-500/20"
          >
            {isExporting ? <CheckCircle2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            {isExporting ? 'Exported!' : 'Export Project'}
          </button>
          {plugins['gitlens']?.active && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showDiff ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              <Code2 className="w-4 h-4" />
              <span className="hidden sm:inline">Diff</span>
            </button>
          )}
          
          <button
            onClick={handleFormat}
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
          >
            <Code2 className="w-4 h-4" />
            <span className="hidden sm:inline">Format</span>
          </button>
          <button 
            id="run-code-button"
            onClick={handleRun}
            disabled={isRunning}
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20 disabled:opacity-50"
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
        {sidebarOpen && (
          <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-4 flex items-center justify-between border-b border-slate-800">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <FolderTree className="w-4 h-4" />
                Workspace
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    setCreatingParentId(null);
                    setCreatingType('file');
                    setIsCreating(true);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  title="New File"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setCreatingParentId(null);
                    setCreatingType('folder');
                    setIsCreating(true);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  title="New Folder"
                >
                  <Folder className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
              <div className="h-full w-full">
                <Virtuoso
                  style={{ height: 600, width: '100%' }}
                  totalCount={visibleNodes.length}
                  itemContent={(index) => {
                    const node = visibleNodes[index];
                    if (!node) return null;

                    if (node.isPlaceholder) {
                      return (
                        <div className="px-2 py-0.5" style={{ paddingLeft: `${node.depth * 14}px` }}>
                          <form 
                            onSubmit={(e) => {
                              if (node.isFolder) {
                                handleCreateFolder(e);
                              } else {
                                handleCreateFile(e);
                              }
                            }}
                            className="flex items-center gap-2 bg-slate-800 rounded border border-indigo-500/50 px-2 py-1"
                          >
                            {node.isFolder ? <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <FileIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <input
                              type="text"
                              autoFocus
                              value={newFileName}
                              onChange={e => setNewFileName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Escape') {
                                  setIsCreating(false);
                                  setCreatingType(null);
                                  setCreatingParentId(null);
                                  setNewFileName('');
                                }
                              }}
                              placeholder={node.isFolder ? "Folder..." : "file.ext..."}
                              className="bg-transparent border-none outline-none text-xs text-slate-200 w-full"
                            />
                          </form>
                        </div>
                      );
                    }

                    return (
                      <div className="pr-2 py-0.5" style={{ paddingLeft: `${node.depth * 14}px` }}>
                        <motion.div
                          onClick={() => {
                            if (node.isFolder) {
                              // Toggle folder
                              setFiles(prev => prev.map(f => f.id === node.id ? { ...f, isOpen: !f.isOpen } : f));
                            } else {
                              // Select active file
                              setActiveFileId(node.id);
                              if (!openTabs.includes(node.id)) {
                                setOpenTabs([...openTabs, node.id]);
                              }
                            }
                          }}
                          whileHover={{ scale: 1.01, backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                          whileTap={{ scale: 0.99 }}
                          className={`w-full group flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-all cursor-pointer relative ${
                            !node.isFolder && activeFileId === node.id
                              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                              : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 w-full overflow-hidden">
                            {node.isFolder ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFiles(prev => prev.map(f => f.id === node.id ? { ...f, isOpen: !f.isOpen } : f));
                                }}
                                className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 shrink-0"
                              >
                                {node.isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            ) : (
                              <span className="w-3 shrink-0"></span>
                            )}

                            {node.isFolder ? (
                              node.isOpen ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              getFileIcon(node.language)
                            )}

                            {renamingFileId === node.id ? (
                              <form 
                                onSubmit={(e) => handleRenameSubmit(node.id, e)} 
                                className="w-full"
                                onClick={e => e.stopPropagation()}
                              >
                                 <input
                                   type="text"
                                   autoFocus
                                   value={renameValue}
                                   onChange={e => setRenameValue(e.target.value)}
                                   onBlur={() => setRenamingFileId(null)}
                                   className="bg-slate-800 text-slate-100 border border-indigo-500/50 rounded px-1 text-xs outline-none w-full"
                                 />
                              </form>
                            ) : (
                              <span 
                                 className="truncate flex-1 font-medium"
                                 onDoubleClick={(e) => {
                                   e.stopPropagation();
                                   setRenamingFileId(node.id);
                                   setRenameValue(node.name);
                                 }}
                              >
                                {node.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                            {node.isFolder && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCreatingParentId(node.id);
                                  setCreatingType('file');
                                  setIsCreating(true);
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors"
                                title="New File"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingFileId(node.id);
                                setRenameValue(node.name);
                              }}
                              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors"
                              title="Rename"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFile(node.id, e)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {movingFileId === node.id ? (
                              <div 
                                className="absolute right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl p-1.5 z-50 min-w-[140px] text-left"
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="text-[10px] text-slate-500 px-1 py-0.5 font-bold uppercase select-none">Move to:</div>
                                <select 
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleMoveNode(node.id, val === 'root' ? null : val);
                                  }}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-300 outline-none my-1 text-xs"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Select destination</option>
                                  <option value="root">Workspace Root</option>
                                  {files
                                    .filter(f => f.isFolder && f.id !== node.id && !getDescendantIds(node.id, files).includes(f.id))
                                    .map(folder => (
                                      <option key={folder.id} value={folder.id}>
                                        {folder.name}
                                      </option>
                                    ))}
                                </select>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingFileId(null);
                                  }}
                                  className="w-full text-center py-0.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMovingFileId(node.id);
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-amber-400 transition-colors"
                                title="Move"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    );
                  }}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-800">
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-sm transition-colors">
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        )}

        {/* Editor Area */}
        
<style dangerouslySetInnerHTML={{__html: `
  .remote-cursor-collab {
    border-left: 2px solid #10b981;
    position: absolute;
    z-index: 10;
  }

  /* CloudOS Custom Scrollbars */
  .cloudos-scroll::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  .cloudos-scroll::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
  .cloudos-scroll::-webkit-scrollbar-thumb {
    background: #475569;
    border-radius: 6px;
    border: 3px solid #1e1e1e;
  }
  .cloudos-scroll::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
  .cloudos-scroll {
    scrollbar-width: thin;
    scrollbar-color: #475569 #1e1e1e;
    scroll-behavior: smooth;
  }
  .smooth-typing .view-lines {
    transition: all 0.1s ease-out;
  }
`}} />
<div className="flex-1 flex flex-col bg-[#1e1e1e] relative min-w-0 cloudos-scroll overflow-auto h-full min-h-[600px]">
          <div className="flex items-center justify-between bg-slate-900/50 border-b border-slate-800 pr-4">
            <div className="flex overflow-x-auto shrink-0 cloudos-scroll" style={{ scrollbarWidth: 'thin', scrollBehavior: 'smooth' }}>
              <AnimatePresence>
              {openTabs.map(tabId => {
                const tabFile = files.find(f => f.id === tabId);
                if (!tabFile) return null;
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
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
            <div 
              className="flex-1 relative flex"
              style={{
                /* CSS-in-JS custom scrollbar for the container */
                minHeight: '600px',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeFile.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex"
                >
                  <motion.div 
                    key={activeFileId}
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.5 }}
                    drag
                    dragConstraints={{ top: -200, left: -200, right: 200, bottom: 200 }}
                    dragElastic={0.15}
                    dragMomentum={true}
                    dragTransition={{ bounceStiffness: 400, bounceDamping: 20 }}
                    whileDrag={{ cursor: "grabbing" }}
                    className="flex-1 relative cursor-grab"
                  >
                    {showDiff ? (
                      <DiffEditor height="100%"
                        original={originalFiles[activeFile.id] || ''}
                        modified={activeFile.content}
                        language={activeFile.language}
                        theme={editorTheme}
                        options={{
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          fontSize: 14,
                          fontFamily: '"JetBrains Mono", monospace'
                        }}
                      />
                    ) : (
                    <Editor height="100%" className="cloudos-scroll smooth-typing"
                      language={activeFile.language}
                      theme={editorTheme}
                      value={activeFile.content}
                      onChange={handleEditorChange}
                      onMount={handleEditorDidMount}
                      options={{
                        minimap: { enabled: true, renderCharacters: false },
                        fontSize: 14,
                        fontFamily: '"JetBrains Mono", monospace',
                        padding: { top: 16, bottom: 100 },
                        scrollBeyondLastLine: true,
                        smoothScrolling: true,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        formatOnPaste: true,
                        automaticLayout: true,
                        wordWrap: 'off',
                        scrollbar: {
                          useShadows: false,
                          verticalScrollbarSize: 12,
                          horizontalScrollbarSize: 12,
                          vertical: 'visible',
                          horizontal: 'visible',
                          verticalSliderSize: 10,
                          horizontalSliderSize: 10,
                        }
                      }}
                      loading={
                        <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm">
                          Loading IDE...
                        </div>
                      }
                    />
                  )}
                  </motion.div>
                  
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
                           className="flex-1 w-full p-2 bg-transparent text-slate-300 text-sm font-mono resize-none border-none outline-none placeholder:text-slate-300"
                         />
                       </div>
                    )}
                    <div className="flex-1 overflow-y-auto">
                      {terminalOutput ? (
                        <div className="h-full w-full font-mono text-sm text-emerald-400">
                          <Virtuoso
                            style={{ height: 256, width: '100%' }}
                            totalCount={terminalOutput.split('\n').length}
                            itemContent={(index) => (
                              <div className="px-4 whitespace-pre-wrap">
                                {terminalOutput.split('\n')[index]}
                              </div>
                            )}
                          />
                        </div>
                      ) : (
                        <iframe 
                          srcDoc={outputHtml}
                          className="w-full h-full border-none bg-white/5"
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

      {/* Developer Diagnostics View (Hidden) */}
      <AnimatePresence>
        {showDiagnostics && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-16 right-4 w-80 bg-slate-900 border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden z-[100] font-mono"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3 h-3" /> Diagnostics
              </div>
              <button onClick={() => setShowDiagnostics(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-3 space-y-3 text-xs text-slate-300">
              <div>
                <div className="text-slate-500 mb-1">Heap Memory</div>
                <div className="flex justify-between items-center">
                  <span>{(performance as any)?.memory?.usedJSHeapSize ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + ' MB' : '42 MB'}</span>
                  <span className="text-emerald-400">Stable</span>
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Loaded Plugins Bundle Size</div>
                {Object.entries(plugins).filter(([k, p]) => p.active).length > 0 ? (
                  Object.entries(plugins).filter(([k, p]) => p.active).map(([key, p]) => (
                    <div key={key} className="flex justify-between items-center mt-1">
                      <span>{p.name}</span>
                      <span className="text-indigo-400">{Math.round(Math.random() * 400 + 50)} KB</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">No plugins active</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                Plugin Store
              </div>
              <button onClick={() => setShowPlugins(false)} className="text-slate-500 hover:text-slate-300 font-bold text-xs uppercase tracking-wider">
                Close
              </button>
            </div>
            <div className="px-4 pt-4">
              <input
                type="text"
                placeholder="Search plugins..."
                value={pluginSearch}
                onChange={(e) => setPluginSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto cloudos-scroll">
              {registryLoading && <div className="text-center text-slate-400 text-sm font-mono animate-pulse">Fetching remote registry...</div>}
              {Object.entries(plugins)
                .filter(([_, plugin]) => plugin.name.toLowerCase().includes(pluginSearch.toLowerCase()) || plugin.description.toLowerCase().includes(pluginSearch.toLowerCase()))
                .map(([key, plugin]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-800 rounded border border-slate-700">
                  <div>
                    <div className="text-sm font-bold text-slate-200">
                      {plugin.name} 
                      {plugin.version && <span className="ml-2 text-[10px] text-slate-500 font-mono">v{plugin.version}</span>}
                    </div>
                    <div className="text-xs text-slate-400">{plugin.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={() => setPlugins(prev => ({ ...prev, [key]: { ...prev[key], active: !prev[key].active } }))}
                          className={`text-xs px-2 py-1 rounded font-bold transition-colors ${plugin.active ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                      >
                          {plugin.active ? 'Active' : 'Enable'}
                      </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Shortcuts Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <Keyboard className="w-5 h-5 text-indigo-400" />
                Keyboard Shortcuts
              </div>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-500 hover:text-slate-300 font-bold text-xs uppercase tracking-wider">
                Close
              </button>
            </div>
            <div className="p-4 bg-slate-900">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Search Files</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + K</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Save & Format</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + S</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Run Code</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + Enter</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Toggle Plugins</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + P</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Toggle Shortcuts</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + /</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

