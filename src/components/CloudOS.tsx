import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Virtuoso } from 'react-virtuoso';
import dynamic from 'next/dynamic';
import CloudCodeEditor from './CloudCodeEditor';
const CloudDiffEditor = dynamic(() => import('./CloudDiffEditor'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#1e1e1e]" />,
});
import { formatWithPrettier, isPrettierFormattable } from '../lib/editor/prettier';
import { EDITOR_THEMES, type EditorTheme } from '../lib/editor/settings';
import { Play, Terminal, Code2, FolderTree, FileJson, FileType, CheckCircle2, Plus, Trash2, Edit2, File as FileIcon, Archive, ChevronDown, ChevronRight, Folder, FolderOpen, ArrowRight, X, Activity, Columns, Rows, FileCode2, FileTerminal, Database } from 'lucide-react';
import { Keyboard, Github, HardDrive, Store } from 'lucide-react';
import GitHubManager from './GitHubManager';
import DriveManager from './DriveManager';
import { saveAs } from 'file-saver';
import { useWorkspace } from '../lib/workspace/workspace';
import ActivityBar, { type ActivityView } from './ActivityBar';
import BottomPanel from './BottomPanel';
import SubAgentPanel from './SubAgentPanel';
import WebPluginRegistry from './WebPluginRegistry';
import SearchPanel from './SearchPanel';
import Statusbar from './Statusbar';
import ErrorBoundary from './ErrorBoundary';
import { useToast } from '../lib/useToast';

interface PluginMeta {
  name: string;
  description: string;
  active: boolean;
  version?: string;
}

const DEFAULT_PLUGINS: Record<string, PluginMeta> = {
  prettier: { name: 'Prettier', description: 'Auto-formatter for JS, HTML, CSS', active: true },
  eslint: { name: 'ESLint', description: 'JavaScript Linter', active: false }
};
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
  { id: '0', name: 'Untitled.js', content: '// Start coding here...\nconsole.log("Hello from VantaOS!");\n', language: 'javascript', parentId: null }
];



export default function CloudOS() {
  const ws = useWorkspace();
  const [files, setFiles] = useState<FileNode[]>(DEFAULT_FILES);
  const [originalFiles, setOriginalFiles] = useState<Record<string, string>>({});
  const [showDiff, setShowDiff] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string>('0');
  const [activeView, setActiveView] = useState<ActivityView>('explorer');

  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [runPending, setRunPending] = useState(false);
  const terminalReadyRef = useRef(false);

  const dispatchRun = useCallback(() => {
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;
    const code = file.content.slice(0, 500);
    window.dispatchEvent(new CustomEvent("terminal-send", { detail: { detail: "js " + code, __src: "vantaos" } }));
  }, [files, activeFileId]);

  const [isRunning, setIsRunning] = useState(false);
  const { toasts, show, dismiss } = useToast();

  const handleRun = useCallback(() => {
    setActiveView('terminal');
    setBottomPanelOpen(true);
    setRunPending(true);
    setIsRunning(true);
    show('Running file...', 'info');
  }, [setActiveView, setBottomPanelOpen, setRunPending, setIsRunning]);

  useEffect(() => {
    if (activeView !== 'terminal' || !runPending) return;
    if (terminalReadyRef.current) {
      dispatchRun();
      setRunPending(false);
      setIsRunning(false);
      show('Execution complete', 'success');
      return;
    }
    const onReady = () => {
      dispatchRun();
      setRunPending(false);
      setIsRunning(false);
      show('Execution complete', 'success');
    };
    window.addEventListener('terminal-ready', onReady, { once: true });
    return () => {
      window.removeEventListener('terminal-ready', onReady);
    };
  }, [activeView, runPending, dispatchRun, show]);

  const [dirtyTabs, setDirtyTabs] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<'none' | 'side-by-side' | 'stacked'>('none');
  const [secondaryActiveFileId, setSecondaryActiveFileId] = useState<string | null>(null);
  
  

  // Sidebar auto-collapses on small screens so the editor stays usable on phones.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024
  );
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const [movingFileId, setMovingFileId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Editor themes are applied through CodeMirror compartments in the editor
  // components; Ctrl+S is handled by the global keydown handler below, so no
  // editor-level save binding is needed here.


  
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
  const [editorTheme, setEditorTheme] = useState<EditorTheme>('vs-dark');

  useEffect(() => {
    const handleSave = async () => {
      // Flush any pending debounced content update through the oplog
      if (contentSaveTimerRef.current) {
        clearTimeout(contentSaveTimerRef.current);
        contentSaveTimerRef.current = null;
      }
      const persistIds = [activeFileId];
      if (secondaryActiveFileId) persistIds.push(secondaryActiveFileId);
      for (const pid of persistIds) {
        const f = files.find(ff => ff.id === pid);
        if (f) {
          await ws.updateContent(pid, f.content).catch(console.error);
        }
      }

      setDirtyTabs(prev => prev.filter(id => id !== activeFileId && id !== secondaryActiveFileId));
      setOriginalFiles(prev => {
         const newOrig = { ...prev };
         const f1 = files.find(f => f.id === activeFileId);
         if (f1) newOrig[activeFileId] = f1.content;
         if (secondaryActiveFileId) {
             const f2 = files.find(f => f.id === secondaryActiveFileId);
             if (f2) newOrig[secondaryActiveFileId] = f2.content;
         }
         return newOrig;
      });
    };
    window.addEventListener('save-active-file', handleSave);
    return () => window.removeEventListener('save-active-file', handleSave as any);
  }, [activeFileId, secondaryActiveFileId, files, ws]);

  const activeFile = files.find(f => f.id === activeFileId) || files[0] || { id: '', name: '', content: '', language: 'plaintext' } as FileNode;

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isEditorFocused = document.activeElement?.closest('.cm-editor') !== null;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        if (isEditorFocused) {
          // Let CodeMirror handle commenting in editor
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: '/',
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            bubbles: true,
          }));
        } else {
          setShowShortcuts(prev => !prev);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();

        // Auto-format with Prettier (lazy-loaded so the ~1MB parser bundle only
        // ships when the user actually saves).
        const file = files.find(f => f.id === activeFileId);
        if (file) {
          try {
            let formatted = file.content;
            if (isPrettierFormattable(file.language)) {
              formatted = await formatWithPrettier(file.content, file.language);
            }
            if (formatted !== file.content) {
              setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: formatted } : f));
              ws.updateContent(activeFileId, formatted).catch(console.error);
            }
          } catch (err) {
            console.error("Prettier format failed", err);
          }
        }

        window.dispatchEvent(new CustomEvent('save-active-file'));
        show('File saved', 'success');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (isEditorFocused) {
          // Let CodeMirror handle find in editor
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'f',
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            bubbles: true,
          }));
        } else {
          setIsSearchOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setBottomPanelOpen(prev => !prev);
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, activeFileId, files]);

  // Auto-open terminal panel when switching to terminal view
  useEffect(() => {
    if (activeView === 'terminal') {
      setBottomPanelOpen(true);
    }
  }, [activeView]);

  // Listen for TerminalPanel readiness signal
  useEffect(() => {
    const handler = () => { terminalReadyRef.current = true; };
    window.addEventListener('terminal-ready', handler);
    return () => {
      window.removeEventListener('terminal-ready', handler);
      terminalReadyRef.current = false;
    };
  }, []);

  
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
    if (!ws.ready) return;

    const loadFiles = async () => {
      const nodes = ws.getAllNodes();
      if (nodes.length > 0) {
        // Hydrate from workspace oplog
        const hydrated: FileNode[] = nodes.map((n) => ({
          id: n.id,
          name: n.name,
          content: n.kind === 'file' ? (ws.getContent(n.id) ?? '') : '',
          language: n.language || 'plaintext',
          isFolder: n.kind === 'folder',
          parentId: n.parentId,
        }));
        setFiles(hydrated);
        const orig: Record<string, string> = {};
        const openIds: string[] = [];
        hydrated.forEach((d) => {
          orig[d.id] = d.content;
          if (!d.isFolder) openIds.push(d.id);
        });
        setOriginalFiles(orig);
        setOpenTabs(openIds.length > 0 ? openIds : [hydrated[0].id]);
        setActiveFileId(hydrated[0].id);
        return;
      }

      // Empty workspace — migrate legacy localStorage files if present,
      // otherwise seed the default starter file through the oplog.
      let migrated = false;
      const local = localStorage.getItem('vantaos_cloudos_files_v2');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const legacyFiles = parsed as any[];
            const idMap = new Map<string, string>(); // legacyId → new workspaceId

            // Order folders so parents are created before children.
            const orderedFolders = legacyFiles
              .filter((d) => d && d.isFolder)
              .sort((a, b) => {
                const depthOf = (node: any): number => {
                  let depth = 0;
                  let cur = node;
                  while (cur && cur.parentId != null) {
                    depth++;
                    cur = legacyFiles.find((f) => f.id === cur.parentId);
                  }
                  return depth;
                };
                return depthOf(a) - depthOf(b);
              });

            for (const folder of orderedFolders) {
              if (!folder || typeof folder.name !== 'string') continue;
              const newId = (
                await ws.createFolder(
                  folder.name,
                  folder.name,
                  folder.parentId ? (idMap.get(folder.parentId) ?? null) : null
                )
              ).id;
              if (folder.id) idMap.set(folder.id, newId);
            }

            for (const d of legacyFiles) {
              if (!d) continue;
              if (d.isFolder) continue;
              if (typeof d.name !== 'string') continue;
              await ws.createFile(
                d.name,
                d.name,
                typeof d.content === 'string' ? d.content : '',
                d.parentId ? (idMap.get(d.parentId) ?? null) : null
              );
            }
            migrated = true;
          }
        } catch (e) {
          console.warn('[CloudOS] localStorage migration failed:', e);
        }
      }
      if (!migrated) {
        for (const df of DEFAULT_FILES) {
          await ws.createFile(df.name, df.name, df.content, null);
        }
      }
      // Re-read after migration/seed
      const seeded2 = ws.getAllNodes();
      const hydrated: FileNode[] = seeded2.map((n) => ({
        id: n.id,
        name: n.name,
        content: n.kind === 'file' ? (ws.getContent(n.id) ?? '') : '',
        language: n.language || 'plaintext',
        isFolder: n.kind === 'folder',
        parentId: n.parentId,
      }));
      setFiles(hydrated);
      if (hydrated.length > 0) {
        setOpenTabs([hydrated[0].id]);
        setActiveFileId(hydrated[0].id);
      }
    };
    loadFiles();
  }, [ws.ready]);

  useEffect(() => {
    // Debounced save to local storage so we don't serialize the whole
    // workspace on every keystroke.
    const timeoutId = setTimeout(() => {
      localStorage.setItem('vantaos_cloudos_files_v2', JSON.stringify(files));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [files]);

    const contentSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleEditorChange = useCallback((value: string | undefined, isSecondary: boolean = false) => {
    const fileId = isSecondary ? secondaryActiveFileId : activeFileId;
    if (value !== undefined && fileId) {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: value } : f));
      setDirtyTabs(prev => {
        if (!prev.includes(fileId)) return [...prev, fileId];
        return prev;
      });

      // Debounced persistence through the oplog (800ms after last keystroke)
      if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
      contentSaveTimerRef.current = setTimeout(() => {
        ws.updateContent(fileId, value).catch(console.error);
      }, 800);
    }
  }, [activeFileId, secondaryActiveFileId, ws])

  const detectLanguage = useCallback((filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const lang = LANGUAGES.find(l => l.ext === ext);
    return lang ? lang.id : 'plaintext';
  }, [])

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

  const handleCreateFile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    
    const content = '// Start coding here\n';
    const node = await ws.createFile(newFileName, newFileName, content, creatingParentId);
    
    const newFile: FileNode = {
      id: node.id,
      name: newFileName,
      content,
      language: node.language || detectLanguage(newFileName),
      parentId: creatingParentId,
    };
    
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setOpenTabs(prev => [...prev, newFile.id]);
    setIsCreating(false);
    setCreatingParentId(null);
    setNewFileName('');
  }, [newFileName, creatingParentId, setCreatingType, setCreatingParentId, setNewFileName, setIsCreating, setActiveFileId, setOpenTabs])

  const handleCreateFolder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const node = await ws.createFolder(newFileName, newFileName, creatingParentId);

    const newFolder: FileNode = {
      id: node.id,
      name: newFileName,
      content: '',
      language: 'folder',
      isFolder: true,
      parentId: creatingParentId,
      isOpen: true,
    };

    setFiles(prev => [...prev, newFolder]);
    setIsCreating(false);
    setCreatingParentId(null);
    setNewFileName('');
  }, [newFileName, creatingParentId, setCreatingType, setCreatingParentId, setNewFileName, setIsCreating])

  const handleDeleteFile = useCallback(async (id: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    const item = files.find(f => f.id === id);
    if (!item) return;

    const idsToDelete = [id];
    if (item.isFolder) {
      idsToDelete.push(...getDescendantIds(id, files));
    }

    const remainingFiles = files.filter(f => !idsToDelete.includes(f.id));
    if (remainingFiles.length === 0) return; // Don't delete everything

    // Delete through workspace oplog (deepest first to preserve parent refs)
    for (const delId of idsToDelete) {
      await ws.deleteNode(delId);
    }

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
  }, [files, activeFileId, secondaryActiveFileId, setActiveFileId, setOpenTabs])

  const handleRenameSubmit = useCallback(async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim()) {
      setRenamingFileId(null);
      return;
    }
    await ws.renameNode(id, renameValue);
    setFiles(prev => prev.map(f => f.id === id ? { 
      ...f, 
      name: renameValue, 
      language: f.isFolder ? 'folder' : detectLanguage(renameValue) 
    } : f));
    setRenamingFileId(null);
  }, [renameValue, ws])

  const handleMoveNode = useCallback(async (nodeId: string, destParentId: string | null) => {
    await ws.moveNode(nodeId, destParentId);
    setFiles(prev => prev.map(f => f.id === nodeId ? { ...f, parentId: destParentId } : f));
    setMovingFileId(null);
  }, [ws])

  
    const handleFormat = useCallback(async () => {
      try {
        const file = files.find(f => f.id === activeFileId);
        if (!file) return;
        let formatted = file.content;
        if (file.language === "json") {
          formatted = JSON.stringify(JSON.parse(file.content), null, 2);
        } else if (isPrettierFormattable(file.language)) {
          formatted = await formatWithPrettier(file.content, file.language);
        }
      if (formatted !== file.content) {
        setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: formatted } : f));
        ws.updateContent(activeFileId, formatted).catch(console.error);
        show('File formatted', 'success');
      }
    } catch (e) {
      console.warn("Format error:", e);
    }
  }, [files, activeFileId, ws]);

  
  const handleExportProject = useCallback(async () => {
    setIsExporting(true);
    // JSZip is lazy-loaded so the ~100KB library is only fetched on export.
    const JSZip = (await import('jszip')).default;
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
  }, [files])

  const getFileIcon = useCallback((lang: string) => {
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
  }, [])

  const visibleNodes = useMemo(() => {
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
  }, [files, creatingType, creatingParentId]);
  useEffect(() => {
    (window as any).vantaosIDE = {
      files,
      openTabs,
      activeFileId,
      setActiveFileId: (id: string) => {
        setOpenTabs((prev: string[]) => {
          if (!prev.includes(id)) return [...prev, id];
          return prev;
        });
        setActiveFileId(id);
      },
      newFile: () => {
        setCreatingType("file");
        setCreatingParentId(null);
      },
      saveFile: () => {
        window.dispatchEvent(new CustomEvent('save-active-file'));
      }
    };
    return () => {
      delete (window as any).vantaosIDE;
    };
  }, [files, openTabs, activeFileId, setOpenTabs, setActiveFileId, setCreatingType, setCreatingParentId]);


  if (!ws.ready) {
    return (
      <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, background: '#07070b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, zIndex: 9999 }}>
        <div style={{ position: 'relative', width: 80, height: 80 }} aria-hidden>
          <div style={{ position: 'absolute', inset: 0, border: '2px solid transparent', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1.2s cubic-bezier(0.5,0,0.5,1) infinite' }} />
          <div style={{ position: 'absolute', inset: 10, border: '2px solid transparent', borderRightColor: '#818cf8', borderRadius: '50%', animation: 'spin 1.8s cubic-bezier(0.5,0,0.5,1) infinite reverse' }} />
          <div style={{ position: 'absolute', inset: 20, border: '2px solid transparent', borderBottomColor: '#a5b4fc', borderRadius: '50%', animation: 'spin 2.4s cubic-bezier(0.5,0,0.5,1) infinite' }} />
        </div>
        <div style={{ color: '#818cf8', fontFamily: 'system-ui, sans-serif', fontWeight: 900, letterSpacing: 6, fontSize: 14 }}>VANTA.OS</div>
        <div style={{ color: '#646a80', fontFamily: 'system-ui, sans-serif', fontSize: 12, letterSpacing: 2 }}>Connecting to workspace…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen rounded-none bg-slate-900 animate-in fade-in duration-500 relative overflow-hidden">
      
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
            aria-label={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <FolderTree className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>VantaOS Cloud IDE · by Mrityunjay K</span>
          </div>
        </div>
        
        {/* Search Modal */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className="absolute top-2 left-1/2 w-[min(600px,92vw)] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
            >
              <div className="flex items-center px-4 py-3 border-b border-slate-700">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search files and content (Ctrl+P)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-slate-200 text-lg"
                />
                <button onClick={() => setIsSearchOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
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
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300 cursor-pointer"
            aria-label="Search files (Ctrl+P)"
          >
            Search <span className="opacity-50 text-xs">Ctrl+P</span>
          </button>

          <button 
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300 cursor-pointer"
            aria-label="Keyboard shortcuts (Ctrl+/)"
          >
            <Keyboard className="w-4 h-4" />
            <span>Shortcuts</span>
          </button>
 <button 
            onClick={() => setShowGithub(!showGithub)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showGithub ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}`}
            aria-label="Toggle GitHub manager"
          >
            <Github className="w-4 h-4" />
            GitHub
          </button>

          <button 
            onClick={() => setShowDrive(!showDrive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showDrive ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}`}
            aria-label="Toggle Drive manager"
          >
            <HardDrive className="w-4 h-4" />
            Drive
          </button>
          
          
          
          
          
          
          <button
            onClick={handleExportProject}
            disabled={isExporting}
            aria-label="Export project as ZIP"
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 rounded-lg text-sm font-medium transition-colors border border-indigo-500/20 cursor-pointer"
          >
            {isExporting ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <Archive className="w-4 h-4" aria-hidden />}
            {isExporting ? 'Exported!' : 'Export Project'}
          </button>
          <button
            onClick={() => setShowDiff(!showDiff)}
            aria-label="Toggle diff view"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border cursor-pointer ${showDiff ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}`}
          >
            <Code2 className="w-4 h-4" aria-hidden />
            <span>Diff</span>
          </button>
          <button
            onClick={handleFormat}
            aria-label="Format active file"
            className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300 cursor-pointer"
          >
            <Code2 className="w-4 h-4" aria-hidden />
            <span>Format</span>
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            aria-label="Compile and run active file"
            aria-busy={isRunning}
            className="relative z-[60] flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white shadow shadow-emerald-900/20 cursor-pointer"
          >
            <Play className="w-4 h-4" aria-hidden />
            <span>{isRunning ? 'Running…' : 'Compile & Run'}</span>
          </button>
                  </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar active={activeView} onChange={setActiveView} />
        {/* Sidebar / File Explorer */}
        {activeView === 'explorer' && sidebarOpen && (
          <div data-testid="sidebar" className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-4 flex items-center justify-between border-b border-slate-800">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <FolderTree className="w-4 h-4" />
                Workspace
              </div>
              <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('vantaos:open-plugins', { detail: { tab: 'marketplace' } }));
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                title="Browse Extensions"
                aria-label="Browse Extensions in marketplace"
              >
                <Store className="w-3.5 h-3.5" aria-hidden />
                <span className="text-[10px]">Browse</span>
              </button>
              <button 
                onClick={() => {
                  setCreatingParentId(null);
                  setCreatingType('file');
                  setIsCreating(true);
                }}
                 className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                 title="New File"
                 aria-label="Create new file"
              >
                <Plus className="w-4 h-4" aria-hidden />
              </button>
              <button 
                onClick={() => {
                  setCreatingParentId(null);
                  setCreatingType('folder');
                  setIsCreating(true);
                }}
                className="p-2 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px]"
                title="New Folder"
                aria-label="Create new folder"
              >
                <Folder className="w-4 h-4" aria-hidden />
              </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
              <div className="h-full w-full">
                <Virtuoso
                  role="tree"
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
                           role="treeitem"
                          tabIndex={0}
                          aria-selected={!node.isFolder && activeFileId === node.id}
                          aria-expanded={node.isFolder ? node.isOpen : undefined}
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                            if (e.key === 'F2') {
                              e.preventDefault();
                              setRenamingFileId(node.id);
                              setRenameValue(node.name);
                            }
                            if (e.key === 'Delete') {
                              e.preventDefault();
                              handleDeleteFile(node.id, e);
                            }
                          }}
                          whileHover={{ scale: 1.01, backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                          whileTap={{ scale: 0.99 }}
                          className={`w-full group flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-all cursor-pointer relative focus-visible:outline-2 focus-visible:outline-indigo-400 ${
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
                                aria-label="New File"
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
                              aria-label="Rename"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFile(node.id, e)}
                              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete"
                              aria-label="Delete"
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
            
          </div>
        )}

        {activeView === 'search' && (
          <SearchPanel onClose={() => setActiveView('explorer')} />
        )}
        {activeView === 'agents' && <SubAgentPanel />}
        {activeView === 'extensions' && (
          <WebPluginRegistry onClose={() => setActiveView('explorer')} />
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
<div className="flex-1 flex flex-col bg-[#1e1e1e] relative min-w-0 overflow-hidden h-full">
          <div className="flex flex-wrap items-center justify-between bg-slate-900/50 border-b border-slate-800 pr-4">
            <div className="flex overflow-x-auto shrink-0 max-w-full cloudos-scroll" style={{ scrollbarWidth: 'thin', scrollBehavior: 'smooth' }}>
              <AnimatePresence>
              {openTabs.map((tabId, index) => {
                const tabFile = files.find(f => f.id === tabId);
                if (!tabFile) return null;
                const isPrimary = activeFileId === tabId;
                const isSecondary = secondaryActiveFileId === tabId;
                const isDirty = dirtyTabs.includes(tabId);
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={tabId}
                    draggable
                    onDragStart={(e: any) => {
                      e.dataTransfer.setData('text/plain', index.toString());
                    }}
                    onDragOver={(e: any) => e.preventDefault()}
                    onDrop={(e: any) => {
                      e.preventDefault();
                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                      const toIndex = index;
                      if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                        const newTabs = [...openTabs];
                        const [moved] = newTabs.splice(fromIndex, 1);
                        newTabs.splice(toIndex, 0, moved);
                        setOpenTabs(newTabs);
                      }
                    }}
                    onClick={() => {
                        if (splitMode !== 'none' && activeFileId !== tabId && secondaryActiveFileId !== tabId) {
                            setSecondaryActiveFileId(tabId);
                        } else {
                            setActiveFileId(tabId);
                            if (splitMode === 'none') setSecondaryActiveFileId(null);
                        }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-mono cursor-pointer border-r border-slate-800 min-w-[120px] max-w-[200px] group ${isPrimary ? 'bg-[#1e1e1e] text-slate-300 border-t-2 border-t-indigo-500' : isSecondary ? 'bg-[#1e1e1e] text-slate-300 border-t-2 border-t-emerald-500' : 'bg-slate-900 text-slate-500 border-t-2 border-t-transparent hover:bg-slate-800'}`}
                  >
                    {getFileIcon(tabFile.language)}
                    <span className="truncate flex-1">{tabFile.name}</span>
                    {isDirty && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTabs = openTabs.filter(id => id !== tabId);
                        setOpenTabs(newTabs);
                        if (activeFileId === tabId && newTabs.length > 0) {
                          setActiveFileId(newTabs[0]);
                        } else if (secondaryActiveFileId === tabId) {
                          setSecondaryActiveFileId(null);
                        } else if (newTabs.length === 0) {
                          setOpenTabs([files[0].id]);
                          setActiveFileId(files[0].id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded ml-1 cursor-pointer"
                      aria-label="Close tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            </div>
            
            {/* Language Selector */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono text-slate-400">
               <div className="flex items-center gap-2">
                  <label htmlFor="cloudos-theme" className="opacity-60">Theme:</label>
                  <select 
                     id="cloudos-theme"
                     value={editorTheme}
                     onChange={(e) => setEditorTheme(e.target.value as EditorTheme)}
                     className="bg-transparent border-none outline-none text-indigo-400 font-bold cursor-pointer"
                  >
                    {EDITOR_THEMES.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme === 'vs-dark' ? 'Dark' : theme === 'vs' ? 'Light' : 'High Contrast'}
                      </option>
                    ))}
                 </select>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="cloudos-language" className="opacity-60">Language:</label>
                <select
                  id="cloudos-language"
                  value={activeFile.language}
                  aria-label="File language"
                  onChange={(e) => {
                    const lang = LANGUAGES.find(l => l.id === e.target.value);
                    if (!lang) return;
                    setFiles(prev => prev.map(f => {
                      if (f.id === activeFile.id) {
                        let newName = f.name;
                        if (newName.toLowerCase().startsWith('untitled')) {
                          newName = `untitled.${lang.ext}`;
                        }
                        return { ...f, language: lang.id, name: newName };
                      }
                      return f;
                    }));
                  }}
                  className="bg-transparent border-none outline-none text-indigo-400 font-bold cursor-pointer"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.id} value={lang.id} className="bg-slate-800 text-slate-200">
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1 border-l border-slate-800 pl-4 ml-2">
                <button 
                  onClick={() => {
                     setSplitMode('none');
                     setSecondaryActiveFileId(null);
                  }}
                  className={`p-1 rounded ${splitMode === 'none' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
                  title="Single View"
                >
                  <Activity className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                     setSplitMode('side-by-side');
                     if (!secondaryActiveFileId) setSecondaryActiveFileId(openTabs.find(t => t !== activeFileId) || null);
                  }}
                  className={`p-1 rounded ${splitMode === 'side-by-side' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
                  title="Split Side-by-Side"
                >
                  <Columns className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                     setSplitMode('stacked');
                     if (!secondaryActiveFileId) setSecondaryActiveFileId(openTabs.find(t => t !== activeFileId) || null);
                  }}
                  className={`p-1 rounded ${splitMode === 'stacked' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
                  title="Split Stacked"
                >
                  <Rows className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full h-full relative flex flex-col overflow-hidden cloudos-editor-area">
            <div
              className="flex-1 relative flex overflow-hidden"
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
                    key={`${activeFileId}-${splitMode}-${secondaryActiveFileId}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex-1 flex ${splitMode === 'stacked' ? 'flex-col' : 'flex-row'} w-full h-full relative`}
                  >
                    <div className="flex-1 relative min-h-0 min-w-0">
                      {showDiff ? (
                        <CloudDiffEditor
                          original={originalFiles[activeFile.id] || ''}
                          modified={activeFile.content}
                          language={activeFile.language}
                          theme={editorTheme}
                        />
                      ) : (
                      <CloudCodeEditor className="cloudos-scroll smooth-typing"
                        value={activeFile.content}
                        language={activeFile.language}
                        theme={editorTheme}
                        onChange={(val) => handleEditorChange(val, false)}
                      />
                      )}
                    </div>
                    {splitMode !== 'none' && secondaryActiveFileId && (
                      <>
                        <div className={`bg-slate-800 ${splitMode === 'stacked' ? 'h-[2px] w-full' : 'w-[2px] h-full'} z-10`} />
                        <div className="flex-1 relative min-h-0 min-w-0">
                          {(() => {
                            const secFile = files.find(f => f.id === secondaryActiveFileId);
                            if (!secFile) return null;
                            return (
                              <CloudCodeEditor className="cloudos-scroll smooth-typing"
                                value={secFile.content}
                                language={secFile.language}
                                theme={editorTheme}
                                onChange={(val) => handleEditorChange(val, true)}
                              />
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>


          </div>
        </div>
      </div>
      {activeView === 'terminal' && bottomPanelOpen && (
        <div style={{ height: 200, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <BottomPanel isOpen={bottomPanelOpen} onToggleOpen={() => setBottomPanelOpen(prev => !prev)} />
        </div>
      )}
      <Statusbar fileCount={files.filter(f => !f.isFolder).length} gitBranch="main" gitChanged={false} encoding="UTF-8" cursorPos="Ln 1, Col 1" indentType="spaces" indentSize={2} />
      
      {/* Plugin Modal */}
      <AnimatePresence>
        {showGithub && (
          <GitHubManager 
            files={files} 
            setFiles={setFiles} 
            originalFiles={originalFiles} 
            setOriginalFiles={setOriginalFiles} 
            onClose={() => setShowGithub(false)} 
          />
        )}
        {showDrive && (
          <DriveManager 
            files={files}
            setFiles={setFiles}
            activeFileId={activeFileId}
            setActiveFileId={(id) => {
              setOpenTabs(prev => (prev.includes(id) ? prev : [...prev, id]));
              setActiveFileId(id);
              (window as any).vantaosIDE?.setActiveFileId?.(id);
            }}
            onClose={() => setShowDrive(false)} 
          />
        )}
        
      </AnimatePresence>
      {/* Shortcuts Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(400px,92vw)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <Keyboard className="w-5 h-5 text-indigo-400" />
                Keyboard Shortcuts
              </div>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-500 hover:text-slate-300 font-bold text-xs uppercase tracking-wider cursor-pointer">
                Close
              </button>
            </div>
            <div className="p-4 bg-slate-900">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Command Palette</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + K</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Save</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + S</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Find in File</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + F</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Search Files</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + P</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Focus Terminal</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + J</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Toggle Terminal</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + `</span>
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
    {/* Toast notifications */}
    <AnimatePresence>
      {toasts.map((t) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          role="alert"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[200] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: '#0c0c12',
            border: `1px solid ${t.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : t.type === 'error' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: t.type === 'success' ? '#10b981' : t.type === 'error' ? '#f43f5e' : '#6366f1',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <span className="text-sm text-slate-200">{t.message}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
  );
}

