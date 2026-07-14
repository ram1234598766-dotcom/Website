import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { sanitizeInput, detectSqlInjection } from '../lib/sanitize';
import { Thread, Profile, Reply } from '../types';
import { MessageSquare, ArrowUp, Plus, Search, Filter, LogOut, Loader2, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import AuthForm from './AuthForm';

export default function Forum() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // UI state
  const [isComposing, setIsComposing] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadCategory, setNewThreadCategory] = useState('General');
  
  const [replyContent, setReplyContent] = useState('');

  const categories = ['All Discussions', 'Announcements', 'Platform API', 'Infrastructure', 'Tutorials', 'Feature Requests', 'General'];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (activeThread) {
      loadReplies(activeThread.id);
    } else {
      loadThreads();
    }
  }, [activeThread]);

  useEffect(() => {
    // Realtime subscriptions
    const threadsSubscription = supabase
      .channel('public:threads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => {
        if (!activeThread) loadThreads();
      })
      .subscribe();

    const repliesSubscription = supabase
      .channel('public:replies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replies' }, payload => {
        if (activeThread && (payload.new as any).thread_id === activeThread.id) {
          loadReplies(activeThread.id);
        }
      })
      .subscribe();

    const upvotesSubscription = supabase
      .channel('public:upvotes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upvotes' }, payload => {
        if (activeThread) {
          loadReplies(activeThread.id);
        } else {
          loadThreads();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(threadsSubscription);
      supabase.removeChannel(repliesSubscription);
      supabase.removeChannel(upvotesSubscription);
    };
  }, [activeThread]);

  async function loadThreads() {
    const { data, error } = await supabase
      .from('threads')
      .select('*, author:profiles(*)');
    
    if (data) {
      setThreads(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
  }

  async function loadReplies(threadId: string) {
    const { data, error } = await supabase
      .from('replies')
      .select('*, author:profiles(*)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    
    if (data) setReplies(data);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      setAuthError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your AI Studio secrets.');
      return;
    }

    try {
      if (isSignUp) {
        if (!username) {
          setAuthError('Username is required');
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });
        if (error) throw error;
        alert('Check your email for the login link or log in if auto-confirmed!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user) return;
    
    if (detectSqlInjection(newThreadTitle) || detectSqlInjection(newThreadContent)) {
      alert('Security violation: Potential SQL injection detected.');
      return;
    }

    const { data, error } = await supabase
      .from('threads')
      .insert([
        { 
          title: sanitizeInput(newThreadTitle), 
          content: sanitizeInput(newThreadContent), 
          category: newThreadCategory,
          author_id: session.user.id
        }
      ])
      .select();

    if (error) {
      alert(error.message);
    } else {
      setIsComposing(false);
      setNewThreadTitle('');
      setNewThreadContent('');
      loadThreads();
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user || !activeThread || !replyContent.trim()) return;

    if (detectSqlInjection(replyContent)) {
      alert('Security violation: Potential SQL injection detected.');
      return;
    }

    const { error } = await supabase
      .from('replies')
      .insert([
        {
          thread_id: activeThread.id,
          content: sanitizeInput(replyContent),
          author_id: session.user.id
        }
      ]);

    if (error) {
      alert(error.message);
    } else {
      setReplyContent('');
      // increment reply count on thread via rpc or trigger in real app
      // for now, subscription handles reload
    }
  }

  async function handleUpvote(threadId?: string, replyId?: string) {
    if (!session?.user) {
      alert('Please log in to upvote');
      return;
    }
    const { error } = await supabase
      .from('upvotes')
      .insert([
        {
          user_id: session.user.id,
          thread_id: threadId,
          reply_id: replyId
        }
      ]);
    if (error && error.code !== '23505') { // Ignore unique constraint violations (already upvoted)
      alert(error.message);
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Community Forum</h2>
          <p className="text-slate-600 mt-1">Live, real-time discussions powered by Supabase.</p>
        </div>
        
        {session ? (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">
              Welcome, {session.user.user_metadata?.username || session.user.email}
            </span>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            {!activeThread && !isComposing && (
              <button 
                onClick={() => setIsComposing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Discussion
              </button>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Sign in to participate in the real-time forum.</div>
        )}
      </div>

      {!session && !activeThread ? (
        <AuthForm />
      ) : isComposing ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">Create New Thread</h3>
            <button onClick={() => setIsComposing(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
          <form onSubmit={handleCreateThread} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Thread Title"
              value={newThreadTitle}
              onChange={e => setNewThreadTitle(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
              required
            />
            <select
              value={newThreadCategory}
              onChange={e => setNewThreadCategory(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              {categories.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea
              placeholder="What's on your mind?"
              value={newThreadContent}
              onChange={e => setNewThreadContent(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
              required
            ></textarea>
            <button type="submit" className="self-end px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
              Post Thread
            </button>
          </form>
        </div>
      ) : activeThread ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center gap-4">
            <button 
              onClick={() => setActiveThread(null)}
              className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back to threads
            </button>
          </div>
          
          <div className="p-6 border-b border-slate-100">
            <div className="flex gap-4">
              <div className="flex flex-col items-center justify-start gap-1 min-w-[3rem]">
                <button 
                  onClick={() => handleUpvote(activeThread.id, undefined)}
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <ArrowUp className="w-6 h-6" />
                </button>
                <span className="text-sm font-bold text-slate-700">{activeThread.upvotes_count || 0}</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{activeThread.title}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                  <span className="font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                    {activeThread.category}
                  </span>
                  <span>Posted by <span className="font-semibold text-slate-700">{activeThread.author?.username || 'Unknown'}</span></span>
                  <span>{formatDistanceToNow(new Date(activeThread.created_at))} ago</span>
                </div>
                <div className="text-slate-700 whitespace-pre-wrap">{activeThread.content}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 flex-1 p-6 flex flex-col gap-6">
            <h3 className="font-bold text-slate-800 text-lg">{replies.length} Replies</h3>
            
            <div className="flex flex-col gap-4">
              {replies.map(reply => (
                <div key={reply.id} className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4">
                  <div className="flex flex-col items-center justify-start gap-1 min-w-[2.5rem]">
                    <button 
                      onClick={() => handleUpvote(undefined, reply.id)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-700">{reply.upvotes_count || 0}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <span className="font-bold text-slate-700">{reply.author?.username || 'Unknown'}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(reply.created_at))} ago</span>
                    </div>
                    <div className="text-slate-700 text-sm whitespace-pre-wrap">{reply.content}</div>
                  </div>
                </div>
              ))}
            </div>

            {session && (
              <form onSubmit={handleReply} className="mt-4 flex flex-col gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <textarea
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                  required
                ></textarea>
                <button type="submit" className="self-end px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                  Reply
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Categories</div>
            {categories.map((cat, i) => (
              <button 
                key={cat}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${i === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {cat}
              </button>
            ))}
          </aside>

          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search discussions..." 
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                <Filter className="w-4 h-4" />
              </button>
            </div>
            
            <div className="divide-y divide-slate-100">
              {threads.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No threads found. Be the first to post!</div>
              ) : (
                threads.map(thread => (
                  <div key={thread.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex gap-4">
                    <div className="flex flex-col items-center justify-center gap-1 min-w-[3rem]">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleUpvote(thread.id, undefined); }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                      <span className="text-sm font-bold text-slate-700">{thread.upvotes_count || 0}</span>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 
                        onClick={() => setActiveThread(thread)}
                        className="font-semibold text-slate-900 text-base leading-tight mb-1 cursor-pointer hover:text-indigo-600 transition-colors"
                      >
                        {thread.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {thread.category}
                        </span>
                        <span>Posted by <span className="font-medium text-slate-700">{thread.author?.username || 'Unknown'}</span></span>
                        <span>&bull;</span>
                        <span>{formatDistanceToNow(new Date(thread.created_at))} ago</span>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm font-medium">{thread.replies_count || 0}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
