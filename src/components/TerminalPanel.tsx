'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { ShellSession } from '../lib/terminal/commands';
import {
  WorkspaceTerminalFs,
  type TerminalFs,
} from '../lib/terminal/sandbox';
import { ExecutionQuota } from '../lib/terminal/quota';
import {
  TERMINAL_THEMES,
  type TerminalTheme,
  type TerminalPalette,
} from '../lib/terminal/types';
import { useWorkspace } from '../lib/workspace/workspace';

interface TerminalPanelProps {
  fontSize?: number;
  theme?: TerminalTheme;
}

const FONT = '"JetBrains Mono", "Fira Code", monospace';

export default function TerminalPanel({
  fontSize = 13,
  theme = 'dark',
}: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const [mounted, setMounted] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const ws = useWorkspace();
  const focusedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (xtermRef.current) {
      try {
        const term = xtermRef.current;
        term.dispose();
      } catch {
        /* ignore disposal errors */
      }
      xtermRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !terminalRef.current) return;

    try {
      // Focus the terminal once it has rendered.
      setTimeout(() => {
        try {
          const textarea = terminalRef.current?.querySelector(
            '.xterm-helper-textarea'
          );
          (textarea as HTMLElement | null)?.focus();
        } catch {
          /* ignore focus failures */
        }
      }, 500);

      const fs: TerminalFs = new WorkspaceTerminalFs(ws);
      const shell = new ShellSession(fs, new ExecutionQuota());

      const term = new Terminal({
        theme: { ...TERMINAL_THEMES[theme] || TERMINAL_THEMES.dark },
        fontFamily: FONT,
        fontSize,
        cursorBlink: true,
        cursorStyle: 'bar',
        allowTransparency: true,
        rows: 20,
        scrollback: 10000,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);

      const doFit = () => {
        try {
          if (terminalRef.current && terminalRef.current.clientWidth > 0) {
            fitAddon.fit();
          }
        } catch {
          /* ignore fit failures */
        }
      };
      doFit();
      const resizeTimer = setTimeout(doFit, 100);
      window.addEventListener('resize', doFit);

      // VantaOS fancy banner
      term.writeln('\u001b[36m\u001b[1m  ╔═══════════════════════════════════════════════╗\u001b[0m');
      term.writeln('\u001b[36m\u001b[1m  ║ \u001b[35m███\u001b[0m\u001b[36m\u001b[1m VantaOS Cloud IDE \u001b[35m███\u001b[0m\u001b[2m  ╡ v2.5.0\u001b[0m\u001b[1m║\u001b[0m');
      term.writeln('\u001b[36m\u001b[2m  ║ Node 20.11 | Next.js 15 | TS 5.6 | React 19  ║\u001b[0m\u001b[1m║\u001b[0m');
      term.writeln('\u001b[36m\u001b[1m  ╠═══════════════════════════════════════════════╣\u001b[0m');
      term.writeln('\u001b[36m  \u001b[33mInstall:\u001b[0m \u001b[32mnpm install pkg\u001b[36m | \u001b[33mrun:\u001b[0m \u001b[32mrun pkg\u001b[36m | \u001b[33mpackages to list\u001b[0m');
      term.writeln('\u001b[36m  \u001b[33mTools:\u001b[0m \u001b[32mweather\u001b[36m | \u001b[32mcalc\u001b[36m | \u001b[32mjs\u001b[36m | \u001b[32mfetch\u001b[36m | \u001b[32msearch\u001b[36m | \u001b[32mnode/js\u001b[0m');
      term.writeln('\u001b[36m\u001b[1m  ╚═══════════════════════════════════════════════╝\u001b[0m');
      term.writeln('');
      term.write(shell.getPrompt());

      let currentLine = '';
      const clearCurrentLine = () => {
        while (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      };

      const writeLines = (lines: readonly string[]) => {
        for (const line of lines) {
          if (line === '__CLEAR__') {
            term.clear();
          } else if (line === '__TIMING__') {
            const elapsed = Date.now() - startTimeRef.current;
            term.writeln(`\u001b[90mDone in ${elapsed}ms\u001b[0m`);
          } else {
            term.writeln(line);
          }
        }
        try { term.scrollToBottom(); } catch { /* ignore */ }
      };

      const executeCommand = async (line: string) => {
        startTimeRef.current = Date.now();
        void shell.execute(line).then((output) => {
          const exitIdx = output.findIndex((l) => l === '__EXIT__');
          if (exitIdx >= 0) {
            writeLines(output.slice(0, exitIdx));
            term.writeln('');
            term.writeln('\u001b[33mSession ended. Press any key to restart...\u001b[0m');
          } else {
            writeLines(output);
            writeLines(['__TIMING__']);
          }
          term.write(shell.getPrompt());
          setTimeout(() => {
            try {
              const ta = terminalRef.current?.querySelector('.xterm-helper-textarea') as HTMLElement | null;
              ta?.focus();
            } catch { /* ignore */ }
          }, 10);
        });
      };

      term.onData((data: string) => {
        const code = data.charCodeAt(0);

        if (data === '\u001b[A') {
          // Up arrow — history back
          const prev = shell.historyPrev();
          if (prev !== null) {
            clearCurrentLine();
            currentLine = prev;
            term.write(currentLine);
          }
        } else if (data === '\u001b[B') {
          // Down arrow — history forward
          const next = shell.historyNext();
          clearCurrentLine();
          if (next !== null) {
            currentLine = next;
            term.write(currentLine);
          }
        } else if (code === 13) {
          // Enter
          term.writeln('');
          const line = currentLine.trim();
          currentLine = '';
          if (line) {
            focusedRef.current = true;
            executeCommand(line);
          } else {
            term.write(shell.getPrompt());
          }
        } else if (code === 7) {
          // Bell — indicate command completion
          term.writeln('\u001b[33m\u2605\u001b[0m');
        } else if (code === 127) {
          // Backspace
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write('\b \b');
          }
        } else if (code === 9) {
          // Tab — command name completion
          const partial = currentLine.trim().toLowerCase();
          const commands = ['ls', 'dir', 'gci', 'gcm', 'gl', 'sl', 'gi', 'cd', 'cat', 'type', 'pwd', 'location', 'set-location', 'get-location', 'get-childitem', 'get-command', 'get-item', 'get-help', 'tree', 'clear', 'cls', 'clr', 'clear-host', 'write-output', 'echo', 'date', 'time', 'whoami', 'hostname', 'ver', 'systeminfo', 'set', 'path', 'ipconfig', 'ping', 'nslookup', 'netstat', 'tracert', 'tasklist', 'taskkill', 'winget', 'npm', 'npx', 'pip', 'yarn', 'pnpm', 'get-weather', 'weather', 'exit', 'history', 'which', 'find', 'sort', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'ren', 'copy', 'move', 'del', 'node', 'js', 'uname', 'env'];
          const match = commands.find((c) => c.startsWith(partial) && c !== partial);
          if (match) {
            currentLine = match + ' ';
            term.write('\b'.repeat(partial.length) + ' '.repeat(partial.length) + match + ' ');
          }
        } else if (code < 32) {
          // Ignore other control chars
        } else {
          currentLine += data;
          term.write(data);
        }
      });

      // Auto-focus terminal when BottomPanel is activated
      const handleTerminalActivate = () => {
        setTimeout(() => {
          try {
            const ta = terminalRef.current?.querySelector('.xterm-helper-textarea') as HTMLElement | null;
            if (ta) {
              ta.focus();
              focusedRef.current = true;
            }
          } catch { /* ignore focus failures */ }
        }, 100);
      };
      window.addEventListener('terminal-activate', handleTerminalActivate);

      // Handle paste (multi-line input)
      const refEl = terminalRef.current;
      const handlePaste = (e: ClipboardEvent) => {
        const pasted = e.clipboardData?.getData('text');
        if (!pasted) return;
        e.preventDefault();
        for (const char of pasted) {
          if (char === '\n' || char === '\r') {
            term.write('\r');
          } else {
            term.write(char);
          }
        }
      };
      if (refEl) {
        refEl.addEventListener('paste', handlePaste);
      }

      // Handle terminal-send custom events from CloudOS — require internal source
      const handleTerminalSend = (e: Event) => {
        const ev = e as CustomEvent<{ detail?: string; __src?: string }>;
        if (ev.detail?.__src !== 'vantaos') return;
        const cmd = ev.detail.detail ?? '';
        if (typeof cmd === 'string' && cmd.trim()) {
          focusedRef.current = true;
          executeCommand(cmd.trim());
        }
      };
      window.addEventListener('terminal-send', handleTerminalSend);

      xtermRef.current = term;
      window.dispatchEvent(new CustomEvent('terminal-ready'));

      return () => {
        clearTimeout(resizeTimer);
        window.removeEventListener('resize', doFit);
        window.removeEventListener('terminal-activate', handleTerminalActivate);
        window.removeEventListener('terminal-send', handleTerminalSend);
        if (refEl) {
          refEl.removeEventListener('paste', handlePaste);
        }
        window.dispatchEvent(new CustomEvent('terminal-disposed'));
        term.dispose();
        xtermRef.current = null;
      };
      // Re-create the session only when the panel first mounts.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (err) {
      setInitError(err instanceof Error ? err.message : String(err));
      console.error('TerminalPanel: xterm initialization failed:', err);
    }
  }, [mounted]);

  useEffect(() => {
    if (xtermRef.current) xtermRef.current.options.fontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    const palette: TerminalPalette =
      TERMINAL_THEMES[theme] || TERMINAL_THEMES.dark;
    if (xtermRef.current) {
      xtermRef.current.options.theme = { ...palette };
    }
  }, [theme]);

  const background =
    TERMINAL_THEMES[theme]?.background || TERMINAL_THEMES.dark.background;

  if (!mounted) {
    return <div className="w-full h-full bg-[#1e1e1e]" />;
  }

  if (initError) {
    return (
      <div
        className="w-full h-full overflow-hidden rounded-lg flex items-center justify-center"
        style={{ backgroundColor: background }}
      >
        <div className="text-center px-4">
          <div className="text-red-400 text-sm mb-2">Terminal initialization failed</div>
          <div className="text-gray-500 text-xs">{initError}</div>
          <div className="text-gray-600 text-xs mt-1">The terminal is available in the bottom panel</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full overflow-hidden rounded-lg"
      style={{ backgroundColor: background }}
    >
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}