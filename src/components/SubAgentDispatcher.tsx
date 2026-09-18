'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Square, Trash2, Loader2, CheckCircle2, XCircle, AlertCircle, Layers } from 'lucide-react';
import { agentEngine, splitIntoTasks, runWithTimeout, aggregateResults } from '../lib/agents/dispatcher';
import type { SubAgentTask } from '../lib/agents/engine';

interface SubAgentDispatcherProps {
  isOpen: boolean;
  onClose: () => void;
  onResultsReady?: (message: string) => void;
}

const FOCUS_LABELS = ['Analyze', 'Implement', 'Review', 'Test'];

export default function SubAgentDispatcher({ isOpen, onClose, onResultsReady }: SubAgentDispatcherProps) {
  const [taskDesc, setTaskDesc] = useState('');
  const [parallelism, setParallelism] = useState(4);
  const [tasks, setTasks] = useState<SubAgentTask[]>([]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [aggregatedResults, setAggregatedResults] = useState<string[]>([]);
  const onResultsReadyRef = useRef(onResultsReady);
  onResultsReadyRef.current = onResultsReady;

  useEffect(() => {
    const unsub = agentEngine.subscribe((updated) => {
      setTasks([...updated]);
      const allDone = updated.length > 0 && updated.every((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');
      if (allDone && updated.length > 0 && !showSummary) {
        setShowSummary(true);
        const result = aggregateResults(updated);
        setSummary(result.summary);
        setAggregatedResults(result.aggregatedResults);
        const message = `**SubAgent Results**\n\n${result.summary}\n\n` + result.aggregatedResults.map((r, i) => `**Agent ${i + 1}:**\n${r}`).join('\n\n');
        onResultsReadyRef.current?.(message);
      }
    });
    return unsub;
  }, [showSummary]);

  if (!isOpen) return null;

  const handleDispatch = async () => {
    if (!taskDesc.trim() || isDispatching) return;
    setIsDispatching(true);
    setShowSummary(false);
    setSummary('');
    setAggregatedResults([]);
    agentEngine.clear();

    const taskInputs = splitIntoTasks(taskDesc.trim(), parallelism);

    const wrappedTasks = taskInputs.map((t) => ({
      ...t,
      taskFn: async (signal: AbortSignal) => {
        return t.taskFn(signal);
      },
    }));

    try {
      const result = await runWithTimeout(wrappedTasks, 30_000);
      setTasks([...result]);
      const agg = aggregateResults(result);
      setSummary(agg.summary);
      setAggregatedResults(agg.aggregatedResults);
      setShowSummary(true);
    } catch {
      setSummary('Dispatch failed or timed out.');
      setShowSummary(true);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCancelAll = () => {
    const currentTasks = agentEngine.getTasks();
    currentTasks.forEach((t) => {
      if (t.status === 'running') {
        agentEngine.cancel(t.id);
      }
    });
  };

  const handleClear = () => {
    agentEngine.clear();
    setTasks([]);
    setShowSummary(false);
    setSummary('');
    setAggregatedResults([]);
    setTaskDesc('');
    setParallelism(4);
  };

  const runningCount = tasks.filter((t) => t.status === 'running').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ background: '#1e1e1e', borderRadius: 12, width: '90%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={18} color="#007acc" />
            <strong style={{ color: '#fff', fontSize: 15 }}>SubAgent Dispatcher</strong>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {!isDispatching && tasks.length === 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#ccc', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>Task Description</label>
              <textarea
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Describe the task for parallel subagents, e.g. Refactor the auth module"
                rows={4}
                style={{ width: '100%', background: '#252526', border: '1px solid #333', color: '#fff', padding: 10, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {!isDispatching && tasks.length === 0 && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#ccc', fontSize: 13, marginBottom: 6, fontWeight: 500 }}>Parallelism (1-8)</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={parallelism}
                  onChange={(e) => setParallelism(Math.min(8, Math.max(1, parseInt(e.target.value) || 4)))}
                  disabled={isDispatching}
                  style={{ width: '100%', maxWidth: 120, background: '#252526', border: '1px solid #333', color: '#fff', padding: '8px 10px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ color: '#666', fontSize: 12, alignSelf: 'center' }}>
                Each agent gets a different focus: {FOCUS_LABELS.join(', ')}
              </div>
            </div>
          )}

          {isDispatching && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
              <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} color="#007acc" />
              <div style={{ fontSize: 14, color: '#ccc' }}>Dispatching {parallelism} subagents...</div>
            </div>
          )}

          {tasks.length > 0 && !showSummary && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888', marginBottom: 8 }}>
                <span>{runningCount} running</span>
                <span>{pendingCount} pending</span>
                <span>{completedCount} done</span>
              </div>
            </div>
          )}

          {showSummary && (
            <div style={{ background: '#252526', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={14} color="#4caf50" />
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Aggregation Complete</span>
              </div>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>{summary}</div>
              {aggregatedResults.map((r, i) => (
                <div key={i} style={{ background: '#1e1e1e', borderRadius: 6, padding: 10, marginBottom: 8, borderLeft: `3px solid #007acc` }}>
                  <div style={{ color: '#007acc', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Agent {i + 1}</div>
                  <div style={{ color: '#ccc', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r}</div>
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && !showSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#252526', borderRadius: 6, borderLeft: `3px solid ${task.status === 'running' ? '#007acc' : task.status === 'pending' ? '#ff9800' : task.status === 'completed' ? '#4caf50' : '#757575'}` }}>
                  {task.status === 'running' && <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} color="#007acc" />}
                  {task.status === 'completed' && <CheckCircle2 size={14} color="#4caf50" />}
                  {task.status === 'pending' && <AlertCircle size={14} color="#ff9800" />}
                  {task.status === 'cancelled' && <Square size={14} color="#757575" />}
                  <span style={{ color: '#fff', fontSize: 12, flex: 1 }}>{task.label}</span>
                  <span style={{ color: '#666', fontSize: 10, textTransform: 'uppercase' }}>{task.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid #333', background: '#161e1e' }}>
          {!isDispatching && tasks.length === 0 && (
            <>
              <button
                onClick={handleDispatch}
                disabled={!taskDesc.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: taskDesc.trim() ? '#007acc' : '#333', color: taskDesc.trim() ? '#fff' : '#666', border: 'none', borderRadius: 6, cursor: taskDesc.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}
              >
                <Play size={14} />
                Dispatch
              </button>
              <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
            </>
          )}
          {tasks.length > 0 && (
            <>
              <button
                onClick={handleCancelAll}
                disabled={runningCount === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: runningCount > 0 ? '#f44336' : '#333', color: runningCount > 0 ? '#fff' : '#666', border: 'none', borderRadius: 6, cursor: runningCount > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}
              >
                <Square size={14} />
                Cancel All
              </button>
              <button
                onClick={handleClear}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                <Trash2 size={14} />
                Clear
              </button>
              <button onClick={onClose} style={{ marginLeft: 'auto', padding: '8px 16px', background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
