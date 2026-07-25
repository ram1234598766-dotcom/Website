import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { io, Socket } from 'socket.io-client';

export type TerminalTheme = 'dark' | 'light' | 'dracula' | 'monokai' | 'ubuntu';

interface TerminalPanelProps {
  fontSize?: number;
  theme?: TerminalTheme;
}

const THEMES = {
  dark: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff' },
  light: { background: '#ffffff', foreground: '#333333', cursor: '#000000', selectionBackground: '#add6ff' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f0' },
  monokai: { background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0' },
  ubuntu: { background: '#300a24', foreground: '#eeeeee', cursor: '#bbbbbb' }
};

export default function TerminalPanel({ fontSize = 13, theme = 'dark' }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: THEMES[theme] || THEMES.dark,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize,
      cursorBlink: true,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    setTimeout(() => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
            fitAddon.fit();
        }
      } catch(e) {}
    }, 50);
    xtermRef.current = term;

    // Connect to server
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
       term.write('\r\n*** Connected to VantaOS Terminal ***\r\n');
       socket.emit('resize', { cols: term.cols, rows: term.rows });
    });

    socket.on('terminal.incData', (data: string) => {
      term.write(data);
    });

    term.onData((data) => {
      socket.emit('terminal.toTerm', data);
    });

    
    const handleTerminalSend = (e: any) => {
       if (socketRef.current && e.detail) {
           socketRef.current.emit('terminal.toTerm', e.detail);
       }
    };
    window.addEventListener('terminal-send', handleTerminalSend);

    term.onResize((size) => {
      socket.emit('resize', { cols: size.cols, rows: size.rows });
    });

    const handleResize = () => {
      if (!term.element || !term.element.parentElement) return;
      try { 
        // Only fit if dimensions are present and terminal is visible
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
            fitAddon.fit(); 
        }
      } catch(e) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      socket.disconnect();
      term.dispose();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('terminal-send', handleTerminalSend);
    };
  }, []);

  useEffect(() => {
    if (xtermRef.current) {
        xtermRef.current.options.fontSize = fontSize;
    }
  }, [fontSize]);

  useEffect(() => {
    if (xtermRef.current) {
        xtermRef.current.options.theme = THEMES[theme] || THEMES.dark;
    }
  }, [theme]);

  return (
    <div className="w-full h-full p-2 overflow-hidden" style={{ backgroundColor: THEMES[theme]?.background || '#1e1e1e' }}>
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
