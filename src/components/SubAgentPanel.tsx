import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { agentEngine, type SubAgentTask } from '../lib/agents/engine';

interface SubAgentPanelProps {
  onDispatch?: (tasks: { prompt: string; label: string; taskFn: (signal: AbortSignal) => Promise<string> }[]) => void;
}

export default function SubAgentPanel({ onDispatch }: SubAgentPanelProps) {
  const [tasks, setTasks] = useState<SubAgentTask[]>([]);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const unsub = agentEngine.subscribe((updated) => {
      setTasks([...updated]);
    });
    return unsub;
  }, []);

  const handleDispatch = async () => {
    if (!prompt.trim()) return;

    const labels = ['Analyze', 'Implement', 'Review', 'Test'];
    const taskFns = labels.map((label) => async (signal: AbortSignal) => {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 2000 + Math.random() * 3000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          throw new DOMException('Aborted', 'AbortError');
        });
      });
      const results = [
        `Found 3 issues in ${label.toLowerCase()} phase: missing error handling, unused imports, type mismatch`,
        `Generated ${label.toLowerCase()} code: 47 lines, 0 warnings, 2 suggestions`,
        `Review complete: ${label.toLowerCase()} found 1 critical, 2 minor issues`,
        `Tests passed: 12/12 (1200ms), coverage 94.2%`,
      ];
      return results[labels.indexOf(label)];
    });

    const tasks = labels.map((label, i) => ({
      prompt: `${prompt} (${label})`,
      label,
      taskFn: taskFns[i],
    }));

    await agentEngine.fanout(tasks, (task) => {});
    onDispatch?.(tasks);
  };

  const runningCount = tasks.filter((t) => t.status === 'running').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <strong style={{ color: '#fff', fontSize: 13 }}>Subagents</strong>
        {runningCount > 0 && (
          <span
            style={{
              background: '#007acc',
              color: '#fff',
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 11,
            }}
          >
            {runningCount} running
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: 11 }}>
          {tasks.filter((t) => t.status === 'completed').length} done / {tasks.length} total
        </span>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleDispatch()}
          placeholder="Describe task for parallel subagents..."
          style={{
            flex: 1,
            background: '#252526',
            border: '1px solid #333',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 12,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleDispatch}
          disabled={!prompt.trim() || runningCount > 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            background: !prompt.trim() || runningCount > 0 ? '#333' : '#007acc',
            color: !prompt.trim() || runningCount > 0 ? '#666' : '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: !prompt.trim() || runningCount > 0 ? 'default' : 'pointer',
            fontSize: 12,
          }}
        >
          <Play size={12} />
          Dispatch
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 8px',
        }}
      >
        {tasks.length === 0 && (
          <div style={{ color: '#666', padding: 16, textAlign: 'center', fontSize: 12 }}>
            No subagents dispatched. Click &ldquo;Dispatch&rdquo; to fan out tasks in parallel.
          </div>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              padding: '8px 10px',
              marginBottom: 4,
              background: '#252526',
              borderRadius: 4,
              borderLeft: `3px solid ${
                task.status === 'completed'
                  ? '#4caf50'
                  : task.status === 'failed'
                  ? '#f44336'
                  : task.status === 'running'
                  ? '#007acc'
                  : task.status === 'cancelled'
                  ? '#757575'
                  : '#ff9800'
              }`,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              {task.status === 'running' && <Loader2 size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />}
              {task.status === 'completed' && <CheckCircle2 size={12} color="#4caf50" />}
              {task.status === 'failed' && <XCircle size={12} color="#f44336" />}
              {task.status === 'cancelled' && <Square size={12} color="#757575" />}
              {task.status === 'pending' && <AlertCircle size={12} color="#ff9800" />}
              <span style={{ color: '#fff', fontWeight: 500 }}>{task.label}</span>
              <span style={{ color: '#666', marginLeft: 'auto', fontSize: 10 }}>
                {task.status.toUpperCase()}
              </span>
            </div>
            <div style={{ color: '#aaa', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
              {task.result || task.error || task.prompt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
