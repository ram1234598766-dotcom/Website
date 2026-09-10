/**
 * VantaOS IDE — CodeMirror 6 themes.
 *
 * Maps the EditorTheme ids (kept from the old Monaco set so CloudOS and the
 * theme select never change: vs-dark, vs, hc-black) to a CodeMirror
 * EditorView theme plus a @lezer HighlightStyle, both driven by one palette
 * per mode.
 */

import { EditorView } from '@codemirror/view';
import {
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

import type { EditorTheme } from './settings';

interface Palette {
  dark: boolean;
  background: string;
  foreground: string;
  gutterBackground: string;
  gutterForeground: string;
  gutterActive: string;
  lineHighlight: string;
  lineHighlightGutter: string;
  selection: string;
  cursor: string;
  matchingBracket: string;
  matchingBracketBorder: string;
  panelBackground: string;
  panelForeground: string;
  tooltipBackground: string;
  tooltipForeground: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  bool: string;
  regexp: string;
  functionName: string;
  typeName: string;
  className: string;
  variableName: string;
  propertyName: string;
  constant: string;
  operator: string;
  punctuation: string;
  invalid: string;
  meta: string;
  labelName: string;
}

const vsDark: Palette = {
  dark: true,
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  gutterBackground: '#1e1e1e',
  gutterForeground: '#858585',
  gutterActive: '#2a2d2e',
  lineHighlight: 'rgba(255, 255, 255, 0.07)',
  lineHighlightGutter: 'rgba(255, 255, 255, 0.07)',
  selection: '#264f78',
  cursor: '#aeafad',
  matchingBracket: 'rgba(108, 108, 108, 0.9)',
  matchingBracketBorder: '#8f8f8f',
  panelBackground: '#252526',
  panelForeground: '#d4d4d4',
  tooltipBackground: '#252526',
  tooltipForeground: '#d4d4d4',
  comment: '#6a9955',
  keyword: '#569cd6',
  string: '#ce9178',
  number: '#b5cea8',
  bool: '#569cd6',
  regexp: '#d16969',
  functionName: '#dcdcaa',
  typeName: '#4ec9b0',
  className: '#4ec9b0',
  variableName: '#9cdcfe',
  propertyName: '#9cdcfe',
  constant: '#4fc1ff',
  operator: '#d4d4d4',
  punctuation: '#d4d4d4',
  invalid: '#f48771',
  meta: '#569cd6',
  labelName: '#c586c0',
};

const vsLight: Palette = {
  dark: false,
  background: '#ffffff',
  foreground: '#000000',
  gutterBackground: '#ffffff',
  gutterForeground: '#237d3b',
  gutterActive: '#ececec',
  lineHighlight: 'rgba(0, 0, 0, 0.05)',
  lineHighlightGutter: 'rgba(0, 0, 0, 0.05)',
  selection: '#add6ff',
  cursor: '#000000',
  matchingBracket: 'rgba(0, 0, 0, 0.07)',
  matchingBracketBorder: 'rgba(0, 0, 0, 0.45)',
  panelBackground: '#f3f3f3',
  panelForeground: '#1f1f1f',
  tooltipBackground: '#f3f3f3',
  tooltipForeground: '#1f1f1f',
  comment: '#008000',
  keyword: '#0000ff',
  string: '#a31515',
  number: '#098658',
  bool: '#0000ff',
  regexp: '#811f3f',
  functionName: '#795e26',
  typeName: '#267f99',
  className: '#267f99',
  variableName: '#001080',
  propertyName: '#001080',
  constant: '#0070c1',
  operator: '#000000',
  punctuation: '#000000',
  invalid: '#cd3131',
  meta: '#0451a5',
  labelName: '#af00db',
};

const hcBlack: Palette = {
  dark: true,
  background: '#000000',
  foreground: '#ffffff',
  gutterBackground: '#000000',
  gutterForeground: '#cccccc',
  gutterActive: '#2d2d2d',
  lineHighlight: 'rgba(255, 255, 255, 0.08)',
  lineHighlightGutter: 'rgba(255, 255, 255, 0.08)',
  selection: '#3a3a3a',
  cursor: '#ffffff',
  matchingBracket: 'rgba(255, 255, 255, 0.25)',
  matchingBracketBorder: 'rgba(255, 255, 255, 0.8)',
  panelBackground: '#2d2d2d',
  panelForeground: '#ffffff',
  tooltipBackground: '#2d2d2d',
  tooltipForeground: '#ffffff',
  comment: '#8caa9b',
  keyword: '#4fc1ff',
  string: '#ff9c7d',
  number: '#b5cea8',
  bool: '#4fc1ff',
  regexp: '#d16969',
  functionName: '#ffd48a',
  typeName: '#3ddc97',
  className: '#3ddc97',
  variableName: '#9cdcfe',
  propertyName: '#9cdcfe',
  constant: '#4fc1ff',
  operator: '#ffffff',
  punctuation: '#c8c8c8',
  invalid: '#f48771',
  meta: '#4fc1ff',
  labelName: '#e8a33d',
};

function makeTheme(palette: Palette): Extension {
  const chrome = EditorView.theme(
    {
      '&': {
        backgroundColor: palette.background,
        color: palette.foreground,
      },
      '.cm-content': {
        caretColor: palette.cursor,
      },
      '&.cm-focused .cm-cursor, .cm-cursor': {
        borderLeftColor: palette.cursor,
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: palette.selection,
      },
      '.cm-activeLine': {
        backgroundColor: palette.lineHighlight,
      },
      '.cm-gutters': {
        backgroundColor: palette.gutterBackground,
        color: palette.gutterForeground,
        border: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: palette.lineHighlightGutter,
        color: palette.gutterActive,
      },
      '.cm-matchingBracket': {
        backgroundColor: palette.matchingBracket,
        border: `1px solid ${palette.matchingBracketBorder}`,
        borderRadius: 2,
      },
      '.cm-nonmatchingBracket': {
        backgroundColor: palette.invalid,
      },
      '.cm-panels': {
        backgroundColor: palette.panelBackground,
        color: palette.panelForeground,
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: '1px solid rgba(128, 128, 128, 0.35)',
      },
      '.cm-tooltip': {
        backgroundColor: palette.tooltipBackground,
        color: palette.tooltipForeground,
      },
      '.cm-searchMatch': {
        backgroundColor: 'rgba(234, 92, 0, 0.33)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'rgba(234, 92, 0, 0.55)',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'transparent',
        border: 'none',
        color: palette.gutterForeground,
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '::-webkit-scrollbar': {
        width: '10px',
        height: '10px',
      },
      '::-webkit-scrollbar-thumb': {
        backgroundColor: 'rgba(121, 121, 121, 0.4)',
        borderRadius: '5px',
      },
      '::-webkit-scrollbar-thumb:hover': {
        backgroundColor: 'rgba(121, 121, 121, 0.7)',
      },
    },
    { dark: palette.dark }
  );

  const highlight = HighlightStyle.define([
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: palette.comment, fontStyle: 'italic' },
    { tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: palette.keyword },
    { tag: tags.self, color: palette.keyword },
    { tag: [tags.string, tags.special(tags.string), tags.character, tags.attributeValue], color: palette.string },
    { tag: tags.escape, color: palette.regexp },
    { tag: [tags.number, tags.integer, tags.float, tags.unit], color: palette.number },
    { tag: [tags.bool, tags.null, tags.atom], color: palette.bool },
    { tag: tags.regexp, color: palette.regexp },
    { tag: [tags.link, tags.url], color: palette.constant, underline: true },
    { tag: [tags.macroName, tags.labelName], color: palette.labelName },
    { tag: [tags.definition(tags.variableName), tags.definition(tags.function(tags.variableName))], color: palette.functionName, fontWeight: 'bold' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: palette.functionName },
    { tag: [tags.className, tags.definition(tags.className)], color: palette.className },
    { tag: [tags.typeName, tags.definition(tags.typeName)], color: palette.typeName },
    { tag: [tags.variableName, tags.special(tags.variableName)], color: palette.variableName },
    { tag: [tags.propertyName, tags.definition(tags.propertyName), tags.attributeName], color: palette.propertyName },
    { tag: tags.constant(tags.variableName), color: palette.constant },
    { tag: tags.operator, color: palette.operator },
    { tag: [tags.punctuation, tags.separator, tags.bracket, tags.angleBracket, tags.squareBracket, tags.paren], color: palette.punctuation },
    { tag: tags.invalid, color: palette.invalid },
    { tag: tags.meta, color: palette.meta },
    { tag: tags.contentSeparator, color: palette.punctuation },
    { tag: [tags.heading, tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: palette.typeName, fontWeight: 'bold' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.deleted, color: palette.invalid },
    { tag: tags.inserted, color: palette.number },
    { tag: tags.documentMeta, color: palette.meta },
  ]);

  return [chrome, EditorView.darkTheme.of(palette.dark), syntaxHighlighting(highlight)];
}

export const editorThemes: Record<EditorTheme, Extension> = {
  'vs-dark': makeTheme(vsDark),
  vs: makeTheme(vsLight),
  'hc-black': makeTheme(hcBlack),
};

export function editorThemeExtension(theme: EditorTheme): Extension {
  return editorThemes[theme] ?? editorThemes['vs-dark'];
}