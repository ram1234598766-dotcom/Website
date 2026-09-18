'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'input' | 'result' | 'string' | 'number' | 'error' | 'system';
  content: string;
}

const COLORS: Record<LogEntry['type'], string> = {
  input: '#9cdcfe',
  result: '#ffffff',
  string: '#ce9178',
  number: '#b5cea8',
  error: '#f44747',
  system: '#6a9955',
};

function syntaxHighlight(code: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  let remaining = code;
  let key = 0;
  const patterns: { regex: RegExp; color: string }[] = [
    { regex: /^(["'])(?:(?!\1|\\).|\\.)*\1/, color: '#ce9178' },
    { regex: /^(?:\d+\.?\d*)/, color: '#b5cea8' },
    { regex: /^(?:true|false|null|undefined|NaN|Infinity)\b/, color: '#569cd6' },
    { regex: /^(?:console|Math|JSON|Date|Array|Object|String|Number|Boolean|Promise|Map|Set|Error|RegExp|Symbol)\b/, color: '#4ec9b0' },
    { regex: /^(?:log|error|warn|info|debug)\b/, color: '#dcdcaa' },
    { regex: /^\/\/.*$/, color: '#6a9955' },
    { regex: /^[a-zA-Z_$][\w$]*/, color: '#9cdcfe' },
  ];
  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, color } of patterns) {
      const m = remaining.match(regex);
      if (m) {
        tokens.push(
          <span key={key++} style={{ color }}>
            {m[0]}
          </span>
        );
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push(
        <span key={key++} style={{ color: '#d4d4d4' }}>
          {remaining.charAt(0)}
        </span>
      );
      remaining = remaining.slice(1);
    }
  }
  return <>{tokens}</>;
}

export default function ConsolePanel() {
  const [input, setInput] = useState('');
  const [multiline, setMultiline] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: 0,
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
      content: 'JavaScript Console — type expressions and press Enter. Shift+Enter for new line.',
    },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idCounter = useRef(1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLog = useCallback((type: LogEntry['type'], content: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: idCounter.current++,
        timestamp: new Date().toLocaleTimeString(),
        type,
        content,
      },
    ]);
  }, []);

  const evaluate = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const startTime = performance.now();
    addLog('input', trimmed);
    setHistory((h) => {
      const next = [trimmed, ...h].slice(0, 200);
      return next;
    });
    setHistoryIndex(-1);

    try {
      const result = eval(trimmed);
      const elapsed = (performance.now() - startTime).toFixed(2);
      if (result === undefined) {
        addLog('result', `undefined \u001b[90m(${elapsed}ms)\u001b[0m`);
      } else if (typeof result === 'string') {
        addLog('string', result);
        addLog('system', `\u001b[90m(${elapsed}ms)\u001b[0m`);
      } else if (typeof result === 'number') {
        addLog('number', String(result));
        addLog('system', `\u001b[90m(${elapsed}ms)\u001b[0m`);
      } else if (typeof result === 'object') {
        addLog('result', JSON.stringify(result, null, 2));
        addLog('system', `\u001b[90m(${elapsed}ms)\u001b[0m`);
      } else {
        addLog('result', String(result));
        addLog('system', `\u001b[90m(${elapsed}ms)\u001b[0m`);
      }
    } catch (err: any) {
      addLog('error', err.message || String(err));
    }
  }, [addLog]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const value = input;
      setInput('');
      setMultiline(false);
      evaluate(value);
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      setInput((v) => v + '\n');
      setMultiline(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex] ?? '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex] ?? '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const handleClear = useCallback(() => {
    setLogs([]);
    addLog('system', 'Console cleared.');
  }, [addLog]);

  const handleCopy = useCallback(async () => {
    const text = logs
      .map((l) => `[${l.timestamp}] ${l.type === 'input' ? '› ' : ''}${l.content}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore copy failures */
    }
  }, [logs]);

  const handleConsoleHelp = useCallback(() => {
    addLog('system', 'Console commands: Enter=evaluate, Shift+Enter=newline, ↑↓=history, Ctrl+C=copy, Ctrl+L=clear');
  }, [addLog]);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white/90 font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-white/10">
        <span className="text-xs text-white/60">JavaScript Console</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            title="Copy output"
            className="text-[10px] text-white/30 hover:text-white/70 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
          >
            Copy
          </button>
          <button
            onClick={handleClear}
            title="Clear console"
            className="text-[10px] text-white/30 hover:text-white/70 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
          >
            Clear
          </button>
          <span className="text-[10px] text-white/30">eval() — browser context</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-1">
        {logs.length === 0 && (
          <div className="text-white/30">JavaScript Console — type expressions and press Enter</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="leading-relaxed">
            <span className="text-white/30">[{log.timestamp}]</span>{' '}
            <span style={{ color: COLORS[log.type] }}>
              {log.type === 'input' ? '› ' : ''}
              {log.type === 'input' || log.type === 'result' || log.type === 'error' || log.type === 'system'
                ? syntaxHighlight(log.content)
                : log.content}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 bg-[#1e1e1e]">
        <div className="flex items-center px-2 py-1">
          <span className="text-emerald-400 mr-1 select-none">&gt;&gt;</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setMultiline(e.target.value.includes('\n'));
            }}
            onKeyDown={handleKeyDown}
            rows={multiline ? Math.max(input.split('\n').length, 2) : 1}
            spellCheck={false}
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-white/90 font-mono text-sm resize-none leading-relaxed"
            placeholder="1+1 (Ctrl+C=copy, Ctrl+L=clear)"
            style={{ minHeight: multiline ? 'auto' : '24px' }}
          />
        </div>
        <div className="px-3 pb-1 flex items-center gap-3 text-[10px] text-white/30">
          <span>Enter: evaluate</span>
          <span>Shift+Enter: newline</span>
          <span>↑↓: history</span>
          <span>Ctrl+C: copy</span>
          <span>Ctrl+L: clear</span>
        </div>
      </div>
    </div>
  );
}
