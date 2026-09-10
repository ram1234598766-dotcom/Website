/**
 * VantaOS IDE — Editor Settings.
 *
 * Single source of truth for the CodeMirror 6 editor so the main editor, the
 * split editor and the diff view can never drift apart.
 *
 * The old Monaco-era option objects are gone: every per-instance dial
 * (language, theme, font size, tab size) is owned by CloudOS and passed
 * through the shared setup helpers in lib/editor, which reconfigure the
 * relevant CodeMirror compartments on change.
 */

export const EDITOR_THEMES = ['vs-dark', 'vs', 'hc-black'] as const;
export type EditorTheme = (typeof EDITOR_THEMES)[number];

export const DEFAULT_EDITOR_FONT_SIZE = 14;
export const DEFAULT_EDITOR_TAB_SIZE = 2;

export const EDITOR_FONT_FAMILY =
  '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';