/**
 * VantaOS IDE — CodeMirror 6 setup.
 *
 * Shared extension builder used by the single editor and by each side of the
 * diff view. Every mutable dial (language, theme, font/size/tab) lives behind
 * a Compartment so CloudOS can reconfigure it without remounting the editor.
 */

import { Compartment, EditorState, type Extension, type StateEffect } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from '@codemirror/search';

import { languageExtension } from './language';
import { editorThemeExtension } from './themes';
import {
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_EDITOR_TAB_SIZE,
  EDITOR_FONT_FAMILY,
  type EditorTheme,
} from './settings';

export interface EditorCompartments {
  language: Compartment;
  theme: Compartment;
  config: Compartment;
}

export interface EditorConfig {
  language: string;
  theme: EditorTheme;
  fontSize?: number;
  tabSize?: number;
}

export function createEditorCompartments(): EditorCompartments {
  return {
    language: new Compartment(),
    theme: new Compartment(),
    config: new Compartment(),
  };
}

/** Static chrome shared by every editor instance (sizing, scrolling). */
const editorChrome = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-mergeView, .cm-mergeView > div, .cm-mergeView .cm-editor': {
    height: '100%',
  },
  '&.cm-focused': { outline: 'none' },
});

/** The always-on capability set (keymaps, history, folding, search…). */
function baseSetup(): Extension {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    EditorState.allowMultipleSelections.of(true),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
  ];
}

export function configExtensions(config: Pick<EditorConfig, 'fontSize' | 'tabSize'>): Extension {
  const fontSize = config.fontSize ?? DEFAULT_EDITOR_FONT_SIZE;
  const tabSize = config.tabSize ?? DEFAULT_EDITOR_TAB_SIZE;

  return [
    EditorView.theme({
      '&': {
        fontSize: `${fontSize}px`,
        fontFamily: EDITOR_FONT_FAMILY,
      },
    }),
    indentUnit.of(' '.repeat(tabSize)),
    EditorState.tabSize.of(tabSize),
  ];
}

/** Build a full editor extension set for one CodeMirror instance. */
export function buildEditorExtensions(
  config: EditorConfig,
  com: EditorCompartments
): Extension[] {
  const fontSize = config.fontSize ?? DEFAULT_EDITOR_FONT_SIZE;
  const tabSize = config.tabSize ?? DEFAULT_EDITOR_TAB_SIZE;

  return [
    editorChrome,
    baseSetup(),
    com.language.of(languageExtension(config.language)),
    com.theme.of(editorThemeExtension(config.theme)),
    com.config.of(configExtensions({ fontSize, tabSize })),
  ];
}

/** Reconfiguration effects for every mutable dial (shared by both sides). */
export function reconfigureEffects(
  config: Pick<EditorConfig, 'language' | 'theme' | 'fontSize' | 'tabSize'>,
  com: EditorCompartments
): { effects: StateEffect<unknown>[] } {
  const fontSize = config.fontSize ?? DEFAULT_EDITOR_FONT_SIZE;
  const tabSize = config.tabSize ?? DEFAULT_EDITOR_TAB_SIZE;

  return {
    effects: [
      com.language.reconfigure(languageExtension(config.language)),
      com.theme.reconfigure(editorThemeExtension(config.theme)),
      com.config.reconfigure(configExtensions({ fontSize, tabSize })),
    ],
  };
}