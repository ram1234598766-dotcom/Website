'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { GitBranch, GitCommit, RefreshCw, ChevronRight, FileCode, Plus, Minus, ArrowLeftRight } from 'lucide-react';

interface GitFile {
  status: string;
  path: string;
  staged: boolean;
}

interface GitState {
  branch: string;
  files: GitFile[];
  error: string | null;
  loading: boolean;
}

function parsePorcelain(output: string): GitFile[] {
  const files: GitFile[] = [];
  for (const line of output.split('\n')) {
    if (!line || line.length < 3) continue;
    const x = line[0];
    const y = line[1];
    const path = line.substring(3);
    const isStaged = x !== ' ' && x !== '?';
    files.push({
      status: x + y,
      path,
      staged: isStaged,
    });
  }
  return files;
}

export default function GitPanel() {
  const [state, setState] = useState<GitState>({
    branch: '',
    files: [],
    error: null,
    loading: false,
  });
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [diffText, setDiffText] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [workspaceSynced, setWorkspaceSynced] = useState(false);

  useEffect(() => {
    const checkSync = () => {
      try {
        const stored = localStorage.getItem('vantaos_workspace_synced');
        setWorkspaceSynced(stored === 'true');
      } catch {
        setWorkspaceSynced(false);
      }
    };
    checkSync();
    const handler = () => checkSync();
    window.addEventListener('workspace-sync', handler);
    return () => window.removeEventListener('workspace-sync', handler);
  }, []);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (typeof window === 'undefined') {
        const { execSync } = require('child_process');
        const branch = execSync('git branch --show-current', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
        const status = execSync('git status --porcelain', { cwd: process.cwd(), encoding: 'utf-8' }).trim();
        const files = parsePorcelain(status);
        setState({ branch, files, error: null, loading: false });
      } else {
        const res = await fetch('/api/git-status');
        if (!res.ok) throw new Error('Git status unavailable');
        const data = await res.json();
        setState({ branch: data.branch ?? '', files: data.files ?? [], error: null, loading: false });
      }
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message, loading: false, branch: '', files: [] }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openDiff = useCallback(async (file: GitFile) => {
    setSelectedFile(file);
    setDiffLoading(true);
    setDiffText('');
    try {
      if (typeof window === 'undefined') {
        const { execSync } = require('child_process');
        const diff = execSync(`git diff -- "${file.path}"`, { cwd: process.cwd(), encoding: 'utf-8' });
        setDiffText(diff || `No changes in ${file.path}`);
      } else {
        const res = await fetch(`/api/git-diff?file=${encodeURIComponent(file.path)}`);
        if (!res.ok) throw new Error('Diff unavailable');
        const diff = await res.text();
        setDiffText(diff || `No changes in ${file.path}`);
      }
    } catch (err: any) {
      setDiffText(`Error: ${err.message}`);
    } finally {
      setDiffLoading(false);
    }
  }, []);

  const stagedFiles = state.files.filter((f) => f.staged);
  const unstagedFiles = state.files.filter((f) => !f.staged);

  const statusColor = (s: string) => {
    if (s.includes('M')) return 'text-amber-400';
    if (s.includes('D')) return 'text-red-400';
    if (s.includes('A')) return 'text-emerald-400';
    if (s.includes('R')) return 'text-blue-400';
    if (s.includes('?')) return 'text-white/30';
    return 'text-white/60';
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white/90 font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-white/10">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">Source Control</span>
        </div>
        <button
          onClick={refresh}
          disabled={state.loading}
          className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
          aria-label="Refresh git status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${state.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-3 py-2 bg-[#252526] border-b border-white/5">
        {state.branch ? (
          <div className="flex items-center gap-2">
            <GitCommit className="w-3 h-3 text-blue-400" />
            <span className="text-blue-400 font-semibold">{state.branch}</span>
          </div>
        ) : workspaceSynced ? (
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Git status: Connected
          </div>
        ) : (
          <div className="text-white/40">Not a git repository or no branch detected</div>
        )}
      </div>

      {state.error && (
        <div className="mx-3 mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400">
          {state.error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {state.files.length === 0 && !state.loading && (
          <div className="p-4 text-white/30 text-center">No changes</div>
        )}

        {(stagedFiles.length > 0 || unstagedFiles.length > 0) && (
          <>
            {stagedFiles.length > 0 && (
              <div className="px-3 py-1 bg-blue-500/10 text-blue-400 font-semibold flex items-center gap-1">
                <Plus className="w-3 h-3" /> Staged ({stagedFiles.length})
              </div>
            )}
            {stagedFiles.map((f) => (
              <div
                key={f.path}
                onClick={() => openDiff(f)}
                className="flex items-center gap-2 px-3 py-1 hover:bg-white/5 cursor-pointer group"
              >
                <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/50" />
                <span className={statusColor(f.status)}>{f.status}</span>
                <FileCode className="w-3 h-3 text-white/30" />
                <span className="truncate text-white/70">{f.path}</span>
              </div>
            ))}

            {unstagedFiles.length > 0 && (
              <div className="px-3 py-1 bg-amber-500/10 text-amber-400 font-semibold flex items-center gap-1 mt-1">
                <Minus className="w-3 h-3" /> Changes ({unstagedFiles.length})
              </div>
            )}
            {unstagedFiles.map((f) => (
              <div
                key={f.path}
                onClick={() => openDiff(f)}
                className="flex items-center gap-2 px-3 py-1 hover:bg-white/5 cursor-pointer group"
              >
                <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/50" />
                <ArrowLeftRight className="w-3 h-3 text-white/20" />
                <span className={statusColor(f.status)}>{f.status}</span>
                <FileCode className="w-3 h-3 text-white/30" />
                <span className="truncate text-white/70">{f.path}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {selectedFile && (
        <div className="border-t border-white/10 bg-[#1e1e1e] h-48 flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-white/5">
            <span className="text-white/70 truncate max-w-[80%]">{selectedFile.path}</span>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-white/30 hover:text-white/70 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {diffLoading ? (
              <div className="text-white/30">Loading diff...</div>
            ) : (
              <pre className="text-xs leading-relaxed whitespace-pre-wrap">
                <code className={diffText.startsWith('Error') ? 'text-red-400' : 'text-white/60'}>
                  {diffText || `No diff for ${selectedFile.path}`}
                </code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
