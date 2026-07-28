'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export type TerminalTheme = 'dark' | 'light' | 'dracula' | 'monokai' | 'ubuntu';

interface TerminalPanelProps {
  fontSize?: number;
  theme?: TerminalTheme;
  onCommand?: (command: string) => string[];
}

const THEMES: Record<string, any> = {
  dark: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff', black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f0', black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2' },
  ubuntu: { background: '#300a24', foreground: '#eeeeee', cursor: '#bbbbbb', black: '#2e3436', red: '#cc0000', green: '#4e9a06', yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf' },
};

class LocalShell {
  private cwd = '/home/user';
  private fs: Map<string, string> = new Map();
  private history: string[] = [];
  private historyIdx = -1;

  constructor() {
    // Create some initial files
    this.fs.set('/home/user', 'DIR');
    this.fs.set('/home/user/hello.js', 'console.log("Hello from VantaOS!");\n');
    this.fs.set('/home/user/README.md', '# VantaOS Workspace\n\nWelcome to your cloud IDE.\n');
    this.fs.set('/home', 'DIR');
  }

  getPrompt(): string {
    return `\r\n[32mvantaos[0m:[34m${this.cwd}[0m$ `;
  }

  execute(cmd: string): string[] {
    const lines: string[] = [];
    const trimmed = cmd.trim();
    if (!trimmed) return lines;

    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).map(a => a.replace(/^"/, '').replace(/"$/, ''));

    // Add to history
    this.history.push(trimmed);
    this.historyIdx = this.history.length;

    switch (command) {
      case 'clear': {
        lines.push('__CLEAR__');
        break;
      }
      case 'help': {
        lines.push('[36mVantaOS Terminal — Available commands:[0m');
        lines.push('  [33mls[0m [path]        List files');
        lines.push('  [33mcd[0m <path>        Change directory');
        lines.push('  [33mpwd[0m              Print working directory');
        lines.push('  [33mcat[0m <file>        View file contents');
        lines.push('  [33mecho[0m <text>       Print text');
        lines.push('  [33mdate[0m             Show current date/time');
        lines.push('  [33mwhoami[0m           Show current user');
        lines.push('  [33mclear[0m            Clear terminal');
        lines.push('  [33mhelp[0m             Show this help');
        lines.push('  [33mnode[0m <file.js>    Execute JavaScript file');
        lines.push('  [33mjs[0m <code>         Run JavaScript code inline');
        lines.push('  [33mmkdir[0m <dir>       Create directory');
        lines.push('  [33mtouch[0m <file>      Create empty file');
        lines.push('  [33mrm[0m <path>         Remove file/directory');
        break;
      }
      case 'pwd': {
        lines.push(this.cwd);
        break;
      }
      case 'ls': {
        const target = args[0] || this.cwd;
        const targetPath = target.startsWith('/') ? target : `${this.cwd}/${target}`.replace(/\/+/g, '/');
        const dirs = new Set<string>();
        const files: string[] = [];
        for (const key of this.fs.keys()) {
          if (key.startsWith(targetPath + '/') || key === targetPath) {
            const rest = key.slice(targetPath.length).replace(/^\//, '');
            if (rest && !rest.includes('/')) {
              if (this.fs.get(key) === 'DIR') dirs.add(rest);
              else files.push(rest);
            }
          }
        }
        if (dirs.size === 0 && files.length === 0) {
          lines.push('(empty)');
        } else {
          for (const d of dirs) lines.push(`[34m${d}/[0m`);
          for (const f of files) lines.push(f);
        }
        break;
      }
      case 'cd': {
        if (!args[0]) {
          this.cwd = '/home/user';
        } else {
          const newPath = args[0].startsWith('/') ? args[0] : `${this.cwd}/${args[0]}`.replace(/\/+/g, '/').replace(/\/$/, '');
          const normalized = newPath === '' ? '/' : newPath;
          if (this.fs.has(normalized) && this.fs.get(normalized) === 'DIR') {
            this.cwd = normalized;
          } else {
            lines.push(`[31mcd: ${args[0]}: No such directory[0m`);
          }
        }
        break;
      }
      case 'cat': {
        if (!args[0]) { lines.push('[31mcat: missing operand[0m'); break; }
        const filePath = args[0].startsWith('/') ? args[0] : `${this.cwd}/${args[0]}`.replace(/\/+/g, '/');
        const content = this.fs.get(filePath);
        if (content === undefined) {
          lines.push(`[31mcat: ${args[0]}: No such file[0m`);
        } else if (content === 'DIR') {
          lines.push(`[31mcat: ${args[0]}: Is a directory[0m`);
        } else {
          lines.push(content);
        }
        break;
      }
      case 'echo': {
        lines.push(args.join(' '));
        break;
      }
      case 'date': {
        lines.push(new Date().toString());
        break;
      }
      case 'whoami': {
        lines.push('vantaos-user');
        break;
      }
      case 'node':
      case 'js': {
        const code = args.join(' ');
        try {
          const fn = new Function(code);
          const result = fn();
          lines.push(String(result ?? 'undefined'));
        } catch (e: any) {
          lines.push(`[31m${e.message}[0m`);
        }
        break;
      }
      case 'mkdir': {
        if (!args[0]) { lines.push('[31mmkdir: missing operand[0m'); break; }
        const dirPath = args[0].startsWith('/') ? args[0] : `${this.cwd}/${args[0]}`.replace(/\/+/g, '/');
        this.fs.set(dirPath, 'DIR');
        break;
      }
      case 'touch': {
        if (!args[0]) { lines.push('[31mtouch: missing operand[0m'); break; }
        const filePath = args[0].startsWith('/') ? args[0] : `${this.cwd}/${args[0]}`.replace(/\/+/g, '/');
        if (!this.fs.has(filePath)) this.fs.set(filePath, '');
        break;
      }
      case 'rm': {
        if (!args[0]) { lines.push('[31mrm: missing operand[0m'); break; }
        const rmPath = args[0].startsWith('/') ? args[0] : `${this.cwd}/${args[0]}`.replace(/\/+/g, '/');
        this.fs.delete(rmPath);
        // Also delete children if directory
        for (const key of this.fs.keys()) {
          if (key.startsWith(rmPath + '/')) this.fs.delete(key);
        }
        break;
      }
      default: {
        lines.push(`[31mCommand not found: ${command}. Type 'help' for available commands.[0m`);
      }
    }
    return lines;
  }
}

export default function TerminalPanel({ fontSize = 13, theme = 'dark' }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const shellRef = useRef<LocalShell | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !terminalRef.current) return;

    const term = new Terminal({
      theme: THEMES[theme] || THEMES.dark,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: true,
      rows: 20,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    const shell = new LocalShell();
    shellRef.current = shell;

    // Fit terminal to container
    const doFit = () => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
          fitAddon.fit();
        }
      } catch {}
    };
    doFit();
    const resizeTimer = setTimeout(doFit, 100);
    window.addEventListener('resize', doFit);

    // Write initial banner
    term.writeln('[36m╔══════════════════════════════════════╗[0m');
    term.writeln('[36m║   VantaOS Local Terminal v2          ║[0m');
    term.writeln('[36m║   Type [33mhelp[36m for available commands     ║[0m');
    term.writeln('[36m╚══════════════════════════════════════╝[0m');
    term.write(shell.getPrompt());

    let currentLine = '';
    term.onData((data: string) => {
      const code = data.charCodeAt(0);

      // Handle special keys
      if (code === 13) { // Enter
        term.writeln('');
        if (currentLine.trim()) {
          const output = shell.execute(currentLine.trim());
          for (const line of output) {
            if (line === '__CLEAR__') {
              term.clear();
            } else {
              term.writeln(line);
            }
          }
        }
        currentLine = '';
        term.write(shell.getPrompt());
      } else if (code === 127) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code === 9) { // Tab
        // Simple tab complete
        if (currentLine.trim().toLowerCase() === 'cd ') {
          term.write(' ');
          currentLine += ' ';
        }
      } else if (code < 32) {
        // Ignore other control chars
      } else {
        currentLine += data;
        term.write(data);
      }
    });

    // Handle terminal-send custom events from CloudOS
    const handleTerminalSend = (e: any) => {
      const cmd = e.detail || '';
      if (typeof cmd === 'string') {
        const output = shell.execute(cmd.trim());
        for (const line of output) {
          if (line === '__CLEAR__') term.clear();
          else term.writeln(line);
        }
        term.write(shell.getPrompt());
      }
    };
    window.addEventListener('terminal-send', handleTerminalSend);

    xtermRef.current = term;

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', doFit);
      window.removeEventListener('terminal-send', handleTerminalSend);
      term.dispose();
    };
  }, [mounted]);

  useEffect(() => {
    if (xtermRef.current) xtermRef.current.options.fontSize = fontSize;
  }, [fontSize]);

  if (!mounted) {
    return <div className="w-full h-full bg-[#1e1e1e]" />;
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-lg" style={{ backgroundColor: THEMES[theme]?.background || '#1e1e1e' }}>
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
