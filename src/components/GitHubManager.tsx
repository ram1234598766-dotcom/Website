import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, Loader2, RefreshCw, Download, Upload, AlertCircle, X, ChevronRight, GitCommit } from 'lucide-react';
import * as github from '../lib/github';
import { supabase } from '../lib/supabaseClient';

interface Props {
  files: any[];
  setFiles: (files: any[]) => void;
  originalFiles: Record<string, string>;
  setOriginalFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onClose: () => void;
}

export default function GitHubManager({ files, setFiles, originalFiles, setOriginalFiles, onClose }: Props) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeRepo, setActiveRepo] = useState<any>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (token) {
      loadRepos();
    }
  }, [token]);

  const loadRepos = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await github.getUserRepos();
      setRepos(data);
    } catch (err: any) {
      setError(err.message);
      if (err.status === 401) setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { scopes: 'user:email repo' }
    });
    if (error) setError(error.message);
  };

  const handleClone = async (repo: any) => {
    try {
      setLoading(true);
      setError('');
      const branch = await github.getDefaultBranch(repo.owner.login, repo.name);
      const treeData = await github.getRepoTree(repo.owner.login, repo.name, branch);
      
      const newFiles: any[] = [];
      const newOriginals: Record<string, string> = {};
      
      let idCounter = Date.now();
      
      // For a real app, you might want to load files lazily. Here we load small files eagerly.
      // But GitHub REST API limits can be hit if tree is huge. Let's just load first 10 files for demo, or all if small.
      const blobItems = treeData.tree.filter((t: any) => t.type === 'blob').slice(0, 30); // Limiting to 30 files for safety
      
      for (const item of blobItems) {
        const content = await github.getFileContent(repo.owner.login, repo.name, item.path);
        const id = `\${idCounter++}`;
        
        let language = 'plaintext';
        if (item.path.endsWith('.ts') || item.path.endsWith('.tsx')) language = 'typescript';
        else if (item.path.endsWith('.js') || item.path.endsWith('.jsx')) language = 'javascript';
        else if (item.path.endsWith('.json')) language = 'json';
        else if (item.path.endsWith('.css')) language = 'css';
        else if (item.path.endsWith('.html')) language = 'html';
        else if (item.path.endsWith('.md')) language = 'markdown';
        
        newFiles.push({
          id,
          name: item.path.split('/').pop() || item.path,
          path: item.path,
          content,
          language
        });
        newOriginals[id] = content;
      }
      
      setFiles(newFiles);
      setOriginalFiles(newOriginals);
      setActiveRepo({ ...repo, branch });
      localStorage.setItem('active_github_repo', JSON.stringify({ owner: repo.owner.login, name: repo.name, branch }));
      
    } catch (err: any) {
      setError(err.message);
      if (err.status === 401) setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!activeRepo) return;
    try {
      setPushing(true);
      setError('');
      
      const owner = activeRepo.owner.login || activeRepo.owner;
      const name = activeRepo.name;
      const branch = activeRepo.branch;
      
      const latestCommitSha = await github.getLatestCommit(owner, name, branch);
      const baseTreeSha = await github.getCommitTree(owner, name, latestCommitSha);
      
      const tree = [];
      const changedFiles = files.filter(f => f.content !== originalFiles[f.id]);
      
      if (changedFiles.length === 0) {
        throw new Error('No changes to commit.');
      }
      
      for (const file of changedFiles) {
         const blobSha = await github.createBlob(owner, name, file.content);
         tree.push({
           path: file.path || file.name,
           mode: '100644',
           type: 'blob',
           sha: blobSha
         });
      }
      
      const newTreeSha = await github.createTree(owner, name, baseTreeSha, tree);
      const newCommitSha = await github.createCommit(owner, name, commitMessage || 'Update from VantaOS', newTreeSha, latestCommitSha);
      await github.updateRef(owner, name, branch, newCommitSha);
      
      // Update original files
      const newOriginals = { ...originalFiles };
      for (const file of changedFiles) {
         newOriginals[file.id] = file.content;
      }
      setOriginalFiles(newOriginals);
      setCommitMessage('');
      
    } catch (err: any) {
      setError(err.message);
      if (err.status === 401) setToken(null);
    } finally {
      setPushing(false);
    }
  };

  // Restore active repo from local storage if not set
  useEffect(() => {
    if (!activeRepo) {
      const stored = localStorage.getItem('active_github_repo');
      if (stored) {
        try { setActiveRepo(JSON.parse(stored)); } catch(e){}
      }
    }
  }, []);

  const changedFilesCount = files.filter(f => f.content !== originalFiles[f.id]).length;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-16 right-4 w-96 bg-[#0a0a0c]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[80vh]"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Github className="w-5 h-5" /> GitHub Integration
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto flex-1">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!token ? (
          <div className="text-center py-8">
            <Github className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 text-sm mb-6">Sign in to sync your repositories, clone code, and commit directly from VantaOS.</p>
            <button 
              onClick={handleLogin}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors w-full"
            >
              Connect GitHub
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {activeRepo && (
               <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                 <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Active Repository</div>
                      <div className="font-medium text-white">{activeRepo.owner?.login || activeRepo.owner}/{activeRepo.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <GitCommit className="w-3 h-3" /> Branch: {activeRepo.branch}
                      </div>
                    </div>
                    <button 
                      onClick={() => { setActiveRepo(null); localStorage.removeItem('active_github_repo'); }} 
                      className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                    >
                      Disconnect
                    </button>
                 </div>
                 
                 <div className="pt-4 border-t border-slate-700/50">
                    <div className="flex items-center justify-between text-sm mb-3">
                       <span className="text-slate-300">Uncommitted Changes</span>
                       <span className={`font-mono font-bold \${changedFilesCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                         {changedFilesCount} files
                       </span>
                    </div>
                    {changedFilesCount > 0 ? (
                       <div className="space-y-3">
                          <input 
                            type="text" 
                            placeholder="Commit message..." 
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            className="w-full bg-black/40 border border-slate-600 rounded p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <button 
                            onClick={handlePush}
                            disabled={pushing}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                          >
                            {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {pushing ? 'Committing...' : 'Commit & Push'}
                          </button>
                       </div>
                    ) : (
                       <div className="text-center py-2 text-slate-500 text-sm">
                         Working tree clean.
                       </div>
                    )}
                 </div>
               </div>
            )}
            
            {!activeRepo && (
               <div>
                 <div className="flex items-center justify-between mb-3">
                   <h4 className="text-sm font-bold text-slate-300">Your Repositories</h4>
                   <button onClick={loadRepos} className="text-slate-500 hover:text-slate-300" disabled={loading}>
                     <RefreshCw className={`w-4 h-4 \${loading ? 'animate-spin' : ''}`} />
                   </button>
                 </div>
                 
                 <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                   {repos.map(repo => (
                     <div key={repo.id} className="flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/80 border border-slate-700/30 rounded-lg transition-colors group cursor-pointer" onClick={() => handleClone(repo)}>
                       <div className="overflow-hidden">
                         <div className="text-sm font-medium text-slate-200 truncate">{repo.name}</div>
                         <div className="text-xs text-slate-500 truncate">{repo.full_name}</div>
                       </div>
                       <button className="opacity-0 group-hover:opacity-100 p-1.5 bg-indigo-500/20 text-indigo-400 rounded transition-all">
                         <Download className="w-4 h-4" />
                       </button>
                     </div>
                   ))}
                   {!loading && repos.length === 0 && (
                     <div className="text-center py-4 text-sm text-slate-500">No repositories found.</div>
                   )}
                 </div>
               </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
