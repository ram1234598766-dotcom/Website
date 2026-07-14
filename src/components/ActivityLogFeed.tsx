import React, { useEffect, useState } from 'react';
import { ActivityEvent } from '../utils/activityLog';
import { Activity, Box, Download, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

export default function ActivityLogFeed() {
  const [logs, setLogs] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    // Initial fetch
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('SystemLogs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);
      
      if (data) {
        setLogs(data as any);
      }
    };
    
    fetchLogs();

    // Setup realtime subscription
    const subscription = supabase
      .channel('system_logs_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'SystemLogs' }, (payload) => {
        setLogs(current => {
          const newLogs = [payload.new as any, ...current];
          return newLogs.slice(0, 5);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  if (logs.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col flex-1"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-800 text-lg">Recent Activity</h3>
      </div>
      <div className="space-y-4">
        {logs.slice(0, 5).map(log => (
          <div key={log.id} className="flex items-start gap-3">
            <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${log.type === 'train' ? 'bg-emerald-100 text-emerald-600' : log.type === 'install' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
              {log.type === 'train' ? <Zap className="w-4 h-4" /> : log.type === 'install' ? <Download className="w-4 h-4" /> : <Box className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{log.action}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
