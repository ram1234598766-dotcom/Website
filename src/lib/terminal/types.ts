/**
 * VantaOS Terminal — shared types.
 *
 * Themes and the execution-quota configuration live here so the shell logic
 * (commands/quota) stays UI-agnostic and the panel stays thin.
 */

export type TerminalTheme =
  | 'dark'
  | 'light'
  | 'dracula'
  | 'monokai'
  | 'ubuntu'
  | 'powershell';

export type TerminalPalette = {
  background: string;
  foreground: string;
  cursor: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
};

export const TERMINAL_THEMES: Record<TerminalTheme, TerminalPalette> = {
  dark: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff', black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5' },
  light: { background: '#f5f5f5', foreground: '#333333', cursor: '#555555', black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#949800', blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f0', black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2' },
  monokai: { background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0', black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75', blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f9f8f5' },
  ubuntu: { background: '#300a24', foreground: '#eeeeee', cursor: '#bbbbbb', black: '#2e3436', red: '#cc0000', green: '#4e9a06', yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf' },
  powershell: { background: '#000000', foreground: '#cccccc', cursor: '#ffffff', black: '#000000', red: '#c50f1f', green: '#13a10e', yellow: '#c19c00', blue: '#0037ad', magenta: '#881798', cyan: '#008282', white: '#e5e5e5' },
};

export const QUOTA_LIMITS = {
  /** Max completed commands per rolling window. */
  maxCommandsPerWindow: 30,
  /** Rolling window for the rate limit, in ms. */
  windowMs: 10_000,
  /** Max total output characters written by a single command (then truncated). */
  maxOutputChars: 40_000,
} as const;