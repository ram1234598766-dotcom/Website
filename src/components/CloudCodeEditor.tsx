/**
 * VantaOS IDE — Code Editor.
 *
 * Thin React wrapper around a CodeMirror 6 EditorView that applies the shared
 * setup from lib/editor. Unlike the old Monaco wrapper there is no CDN load,
 * no loader spinner and no ~3.6MB runtime: everything ships in the bundle.
 *
 * Value sync is one-way defensive: the only doc changes driven from React are
 * when the `value` prop differs from the live document, which is dispatched
 * as a full replacement. Every keystroke goes through the update listener and
 * is reported via `onChange` (never echoed back into the editor).
 */

'use client';

import { useEffect, useRef, memo } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';

import {
  buildEditorExtensions,
  configExtensions,
  createEditorCompartments,
  type EditorCompartments,
} from '../lib/editor/setup';
import { languageExtension } from '../lib/editor/language';
import { editorThemeExtension } from '../lib/editor/themes';
import {
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_EDITOR_TAB_SIZE,
  type EditorTheme,
} from '../lib/editor/settings';

interface CloudCodeEditorProps {
  value: string;
  language: string;
  theme: EditorTheme;
  onChange?: (value: string) => void;
  fontSize?: number;
  tabSize?: number;
  className?: string;
}

function CloudCodeEditor({
  value,
  language,
  theme,
  onChange,
  fontSize = DEFAULT_EDITOR_FONT_SIZE,
  tabSize = DEFAULT_EDITOR_TAB_SIZE,
  className,
}: CloudCodeEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const comRef = useRef<EditorCompartments | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const com = createEditorCompartments();
    comRef.current = com;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: buildEditorExtensions({ language, theme, fontSize, tabSize }, com).concat([
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const next = update.state.doc.toString();
            if (next === lastEmittedRef.current) return;
            lastEmittedRef.current = next;
            onChangeRef.current?.(next);
          }),
        ]),
      }),
      parent,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      comRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    const com = comRef.current;
    if (!view || !com) return;

    if (value !== view.state.doc.toString()) {
      lastEmittedRef.current = value;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }

    view.dispatch({
      effects: [
        com.language.reconfigure(languageExtension(language)),
        com.theme.reconfigure(editorThemeExtension(theme)),
        com.config.reconfigure(configExtensions({ fontSize, tabSize })),
      ],
    });
  }, [value, language, theme, fontSize, tabSize]);

  return <div ref={parentRef} className={className} style={{ height: '100%' }} />;
}

export default memo(CloudCodeEditor);
