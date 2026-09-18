import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Archive, Code2, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import TerminalPanel from './TerminalPanel';

export type BottomPanelTab = 'terminal' | 'output' | 'console';

interface BottomPanelProps {
  defaultTab?: BottomPanelTab;
}

const TABS: { id: BottomPanelTab; label: string; icon: React.ReactNode }[] = [
  { id: 'terminal', label: 'Terminal', icon: <Terminal size={13} /> },
  { id: 'output', label: 'Output', icon: <Archive size={13} /> },
  { id: 'console', label: 'Console', icon: <Code2 size={13} /> },
];

export default function BottomPanel({ defaultTab = 'terminal' }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<BottomPanelTab>(defaultTab);
  const [isOpen, setIsOpen] = useState(true);
  const [height, setHeight] = useState(200);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [consoleInput, setConsoleInput] = useState('');

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const rect = containerRef.current.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const newHeight = rect.bottom - e.clientY;
      if (newHeight > 100 && newHeight < window.innerHeight - 300) {
        setHeight(newHeight);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const addOutput = (line: string) => {
    setOutputLines((prev) => [...prev.slice(-500), line]);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString();
      addOutput(`[${now}] workspace active`);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConsoleSubmit = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!consoleInput.trim()) return;
    try {
      const result = eval(consoleInput);
      const now = new Date().toLocaleTimeString();
      setConsoleOutput((prev) => [
        ...prev,
        `[${now}] > ${consoleInput}`,
        `[${now}] ${String(result ?? '')}`,
      ]);
    } catch (err: any) {
      const now = new Date().toLocaleTimeString();
      setConsoleOutput((prev) => [
        ...prev,
        `[${now}] > ${consoleInput}`,
        `[${now}] Error: ${err.message}`,
      ]);
    }
    setConsoleInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
          height: 32,
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 12px',
              height: 32,
              background: activeTab === tab.id ? '#1e1e1e' : '#252526',
              color: activeTab === tab.id ? '#fff' : '#aaa',
              border: 'none',
              borderRight: '1px solid #333',
              borderTop: activeTab === tab.id ? 'none' : 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'Segoe UI, sans-serif',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <X
              size={12}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTab === tab.id && TABS.length > 1) {
                  setIsOpen(false);
                }
              }}
              style={{ cursor: 'pointer', opacity: 0.6, padding: 2 }}
            />
          </button>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      {isOpen && (
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            height,
            cursor: isResizing ? 'row-resize' : 'default',
          }}
          onMouseDown={() => setIsResizing(true)}
        >
          {activeTab === 'terminal' && (
            <div style={{ height: '100%', width: '100%' }}>
              <TerminalPanel />
            </div>
          )}
          {activeTab === 'output' && (
            <div
              ref={outputRef}
              style={{
                height: '100%',
                overflow: 'auto',
                padding: '4px 8px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#d4d4d4',
                background: '#1e1e1e',
              }}
            >
              {outputLines.length === 0 && (
                <div style={{ color: '#666', padding: 8 }}>
                  No output yet. Activity will appear here...
                </div>
              )}
              {outputLines.map((line, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
                  {line}
                </div>
              ))}
            </div>
          )}
          {activeTab === 'console' && (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: '#1e1e1e',
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '4px 8px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: '#d4d4d4',
                }}
              >
                {consoleOutput.length === 0 && (
                  <div style={{ color: '#666', padding: 8 }}>
                    JavaScript Console — type expressions and press Enter
                  </div>
                )}
                {consoleOutput.map((line, i) => (
                  <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
                    {line}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderTop: '1px solid #333',
                }}
              >
                <span style={{ color: '#4ec9b0', fontSize: 12, marginRight: 4 }}>
                  &gt;&gt;
                </span>
                <input
                  type="text"
                  value={consoleInput}
                  onChange={(e) => setConsoleInput(e.target.value)}
                  onKeyDown={handleConsoleSubmit}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#d4d4d4',
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                  placeholder="eval('1+1')"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
