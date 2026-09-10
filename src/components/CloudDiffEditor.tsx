/**
 * VantaOS IDE — Diff Editor.
 *
 * Side-by-side diff built on CodeMirror's @codemirror/merge MergeView. The
 * left side ("original", saved version) and the right side ("modified", live
 * buffer) are two independent editor states linked by the merge gutter, with
 * revert controls to accept the original into the modified file.
 *
 * Kept in its own component (and lazy-loaded in CloudOS) so the merge module
 * only ships when a diff is actually open.
 */

'use client';

import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';

import {
  buildEditorExtensions,
  createEditorCompartments,
  reconfigureEffects,
  type EditorCompartments,
} from '../lib/editor/setup';
import {
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_EDITOR_TAB_SIZE,
  type EditorTheme,
} from '../lib/editor/settings';

interface CloudDiffEditorProps {
  original: string;
  modified: string;
  language: string;
  theme: EditorTheme;
  fontSize?: number;
  tabSize?: number;
  className?: string;
}

interface DiffCompartments {
  a: EditorCompartments;
  b: EditorCompartments;
}

export default function CloudDiffEditor({
  original,
  modified,
  language,
  theme,
  fontSize = DEFAULT_EDITOR_FONT_SIZE,
  tabSize = DEFAULT_EDITOR_TAB_SIZE,
  className,
}: CloudDiffEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const mergeRef = useRef<MergeView | null>(null);
  const comsRef = useRef<DiffCompartments | null>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const coms: DiffCompartments = {
      a: createEditorCompartments(),
      b: createEditorCompartments(),
    };
    comsRef.current = coms;

    const merge = new MergeView({
      a: {
        doc: original,
        extensions: buildEditorExtensions({ language, theme, fontSize, tabSize }, coms.a),
      },
      b: {
        doc: modified,
        extensions: buildEditorExtensions({ language, theme, fontSize, tabSize }, coms.b),
      },
      parent,
      highlightChanges: true,
      revertControls: 'a-to-b',
    });
    mergeRef.current = merge;

    return () => {
      merge.destroy();
      mergeRef.current = null;
      comsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const merge = mergeRef.current;
    const coms = comsRef.current;
    if (!merge || !coms) return;

    const aDoc = merge.a.state.doc.toString();
    const bDoc = merge.b.state.doc.toString();

    if (original !== aDoc) {
      merge.a.dispatch({
        changes: { from: 0, to: aDoc.length, insert: original },
      });
    }
    if (modified !== bDoc) {
      merge.b.dispatch({
        changes: { from: 0, to: bDoc.length, insert: modified },
      });
    }

    const shared = { language, theme, fontSize, tabSize };
    merge.a.dispatch(reconfigureEffects(shared, coms.a));
    merge.b.dispatch(reconfigureEffects(shared, coms.b));
  }, [original, modified, language, theme, fontSize, tabSize]);

  return <div ref={parentRef} className={className} style={{ height: '100%' }} />;
}