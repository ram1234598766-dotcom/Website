import { ShieldAlert, Activity, Users, Server, Ban, Lock, Globe2, Loader2, MessageSquare, Reply } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminPanel() {
  const [logs] = useState([
    { id: 1, type: 'DDoS', ip: '192.168.x.x', status: 'Neutralized', time: '2 mins ago' },
    { id: 2, type: 'Prompt Injection', target: 'LumenVision', status: 'Blocked', time: '15 mins ago' },
    { id: 3, type: 'SQLi Attempt', target: 'Auth Node 4', status: 'Neutralized', time: '1 hour ago' },
  ]);

  const [metrics, setMetrics] = useState({
    usersCount: 0,
    threadsCount: 0,
    repliesCount: 0,
    loading: true
  });

  useEffect(() => {
    async function loadMetrics() {
      try {
        const [usersRes, threadsRes, repliesRes] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('threads').select('*', { count: 'exact', head: true }),
          supabase.from('replies').select('*', { count: 'exact', head: true })
        ]);

        setMetrics({
          usersCount: usersRes.count || 0,
          threadsCount: threadsRes.count || 0,
          repliesCount: repliesRes.count || 0,
          loading: false
        });
      } catch (err) {
        console.error('Failed to load metrics:', err);
        setMetrics(prev => ({ ...prev, loading: false }));
      }
    }

    loadMetrics();

    // Subscribe to changes to update metrics in real-time
    const threadsSub = supabase.channel('metrics_threads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, loadMetrics)
      .subscribe();
    
    const repliesSub = supabase.channel('metrics_replies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replies' }, loadMetrics)
      .subscribe();

    const profilesSub = supabase.channel('metrics_profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadMetrics)
      .subscribe();

    return () => {
      supabase.removeChannel(threadsSub);
      supabase.removeChannel(repliesSub);
      supabase.removeChannel(profilesSub);
    };
  }, []);

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b border-red-500/20 pb-6 mt-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full mb-1 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <ShieldAlert className="w-3 h-3 text-red-500" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-red-500">Omniscient Admin Protocol Active</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Admin Override Center</h2>
          <p className="text-slate-600 max-w-2xl text-base">
            Authorized access granted to <span className="font-mono text-xs bg-slate-200 px-1 py-0.5 rounded">ram1234598766@gmail.com</span>. Monitor live database statistics and anomaly-detection networks.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Metric Cards */}
        <div className="bg-[#0a0d12] border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-950/50 rounded-xl border border-emerald-900/50">
              <Users className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Users</div>
              <div className="text-2xl font-black text-white">
                {metrics.loading ? <Loader2 className="w-5 h-5 animate-spin mt-1" /> : metrics.usersCount}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0d12] border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-950/50 rounded-xl border border-indigo-900/50">
              <MessageSquare className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Threads</div>
              <div className="text-2xl font-black text-white">
                {metrics.loading ? <Loader2 className="w-5 h-5 animate-spin mt-1" /> : metrics.threadsCount}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0d12] border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-950/50 rounded-xl border border-blue-900/50">
              <Reply className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Replies</div>
              <div className="text-2xl font-black text-white">
                {metrics.loading ? <Loader2 className="w-5 h-5 animate-spin mt-1" /> : metrics.repliesCount}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-[#0a0d12] border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-950/50 rounded-xl border border-amber-900/50">
              <Server className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Model Downloads</div>
              <div className="text-sm font-mono text-slate-400 mt-1">Not tracked yet</div>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0d12] border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-950/50 rounded-xl border border-rose-900/50">
              <Activity className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Compile / Run Counts</div>
              <div className="text-sm font-mono text-slate-400 mt-1">Not tracked yet</div>
            </div>
          </div>
        </div>

      </div>

      {/* Threat Log */}
      <div className="bg-[#0a0d12] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 bg-[#161B22] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-500" />
            AI Threat Watchdog Logs
          </h3>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-emerald-500 uppercase tracking-wider font-mono font-bold">Watchdog Active</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="text-xs uppercase bg-[#0D1117] text-slate-500 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-bold">Threat Type</th>
                <th className="px-6 py-4 font-bold">Target / Source</th>
                <th className="px-6 py-4 font-bold">Action Taken</th>
                <th className="px-6 py-4 font-bold">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800/50 hover:bg-[#161B22] transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">{log.type}</td>
                  <td className="px-6 py-4 font-mono text-xs">{log.ip || log.target}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-950/50 text-emerald-400 text-xs font-bold rounded border border-emerald-900/50">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
