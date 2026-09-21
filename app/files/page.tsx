'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder, FileCode, FileText, FileJson, FileImage, File, Search,
  ChevronRight, ChevronDown, Trash2, Edit3, Check, X,
} from 'lucide-react';
import { get, set } from 'idb-keyval';
import type { WorkspaceNode } from '../../src/lib/workspace/types';

const FILE_ICONS: Record<string, typeof FileCode> = {
  '.tsx': FileCode,
  '.ts': FileCode,
  '.jsx': FileCode,
  '.js': FileCode,
  '.css': FileCode,
  '.scss': FileCode,
  '.json': FileJson,
  '.md': FileText,
  '.html': FileCode,
  '.py': FileCode,
  '.go': FileCode,
  '.rs': FileCode,
  '.cpp': FileCode,
  '.c': FileCode,
  '.java': FileCode,
  '.sql': FileCode,
  '.xml': FileCode,
  '.yaml': FileText,
  '.yml': FileText,
  '.toml': FileText,
  '.sh': FileCode,
  '.svg': FileImage,
  '.png': FileImage,
  '.jpg': FileImage,
};

interface FileEntry {
  path: string;
  content: string;
}

function getIconForPath(path: string) {
  const ext = path.includes('.') ? '.' + path.split('.').pop() : '';
  return FILE_ICONS[ext] || File;
}

export default function FilesPage() {
  const [entries, setEntries] = useState<Record<string, FileEntry>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const allEntries: Record<string, FileEntry> = {};
      const prefix = 'vantaos_cloudos_files_v2/';
      for (let i = 0; i < 200; i++) {
        try {
          const key = `${prefix}file_${i}`;
          const val = await get(key);
          if (val && typeof val === 'object' && 'path' in val) {
            const entry = val as { path: string; content?: string };
            allEntries[entry.path] = { path: entry.path, content: entry.content ?? '' };
          }
        } catch {
          /* key doesn't exist */
        }
      }

      const keys = await (async () => {
        try {
          return await (globalThis as any).indexedDB?.open?.('vantaos_cloudos_files_v2')
            ? Object.keys(allEntries)
            : Object.keys(allEntries);
        } catch {
          return Object.keys(allEntries);
        }
      })();

      setEntries(allEntries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files');
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const sortedPaths = Object.keys(entries).sort();
  const filteredPaths = searchQuery
    ? sortedPaths.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedPaths;

  const selectedEntry = selectedPath ? entries[selectedPath] : undefined;

  const openFile = (path: string) => {
    setSelectedPath(path);
    setEditing(false);
    setEditContent(entries[path]?.content ?? '');
  };

  const saveFile = async () => {
    if (!selectedPath) return;
    try {
      await set(`vantaos_cloudos_files_v2/file_${selectedPath}`, {
        path: selectedPath,
        content: editContent,
        updatedAt: Date.now(),
      });
      setEntries((prev) => ({
        ...prev,
        [selectedPath]: { path: selectedPath, content: editContent },
      }));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const deleteFile = async (path: string) => {
    try {
      await get(`vantaos_cloudos_files_v2/file_${path}`).catch(() => { /* not found */ });
      setEntries((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      if (selectedPath === path) {
        setSelectedPath(null);
        setEditing(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const buildTree = () => {
    const root: { name: string; children: Map<string, unknown>; isFile: boolean; path: string } = {
      name: '/', children: new Map(), isFile: false, path: '',
    };
    for (const path of filteredPaths) {
      const parts = path.split('/').filter(Boolean);
      let node = root;
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath += '/' + part;
        if (!node.children.has(part)) {
          node.children.set(part, {
            name: part,
            children: new Map(),
            isFile: i === parts.length - 1,
            path: currentPath,
          });
        }
        node = node.children.get(part) as typeof node;
      }
    }
    return root;
  };

  const RenderTree = ({ node, depth = 0 }: { node: { name: string; children: Map<string, unknown>; isFile: boolean; path: string }; depth?: number }) => {
    const [expanded, setExpanded] = useState(depth < 1);
    const children = Array.from(node.children.values()) as Array<typeof node>;
    const isFile = node.isFile;
    const Icon = isFile ? getIconForPath(node.path) : Folder;

    return (
      <div style={{ marginLeft: depth * 16 }}>
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-white/5 rounded ${
            selectedPath === node.path ? 'bg-indigo-900/30 text-indigo-300' : 'text-slate-300'
          }`}
          onClick={() => {
            if (isFile) {
              openFile(node.path);
            } else {
              setExpanded(!expanded);
            }
          }}
          role="treeitem"
          aria-expanded={!isFile ? expanded : undefined}
        >
          {!isFile && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
          <Icon className={`w-4 h-4 ${isFile ? 'text-yellow-400' : 'text-blue-400'}`} />
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {!isFile && expanded && (
          <div role="group">
            {children.map((child) => (
              <RenderTree key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Files</h1>
          <p className="text-slate-400 text-sm mt-1">
            {Object.keys(entries).length} files in workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              aria-label="Search files"
            />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File tree */}
        <div className="rounded-xl border border-white/10 bg-white/5 lg:col-span-1">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Explorer</span>
            <span className="text-xs text-slate-500">{filteredPaths.length} files</span>
          </div>
          <div className="p-2 overflow-y-auto max-h-[600px]" role="tree">
            {filteredPaths.length === 0 ? (
              <p className="text-slate-500 text-sm p-4">No files found</p>
            ) : (
              <RenderTree node={buildTree()} />
            )}
          </div>
        </div>

        {/* File content */}
        <div className="rounded-xl border border-white/10 bg-white/5 lg:col-span-2 flex flex-col">
          {selectedEntry ? (
            <>
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-mono text-white truncate">{selectedPath}</span>
                <div className="flex items-center gap-2">
                  {!editing ? (
                    <>
                      <button
                        onClick={() => {
                          setEditing(true);
                          setEditContent(selectedEntry.content);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded"
                        aria-label="Edit file"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteFile(selectedPath!)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded"
                        aria-label="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={saveFile}
                        className="px-3 py-1 text-xs bg-green-900/50 text-green-300 rounded hover:bg-green-900/70 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditContent(selectedEntry.content);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 bg-transparent text-slate-300 text-sm p-4 font-mono resize-none focus:outline-none"
                  spellCheck={false}
                  aria-label="File content editor"
                  rows={20}
                />
              ) : (
                <pre className="flex-1 overflow-auto p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap">
                  {selectedEntry.content || '—'}
                </pre>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
