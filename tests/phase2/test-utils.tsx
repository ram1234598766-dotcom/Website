/**
 * Test helpers — renders CloudOS with the full provider stack it needs in
 * tests so individual test files stay focused on behaviour, not wiring.
 */

import React, { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// ---- Mock CodeMirror editors ------------------------------------------------
// CodeMirror 6 needs a real browser layout (getClientRects, canvas, etc.)
// that jsdom cannot provide.  Replace both editor wrappers with plain divs so
// the surrounding CloudOS chrome (sidebar, tabs, terminal) remains testable.
vi.mock('../../src/components/CloudCodeEditor', () => ({
  default: ({ value, language, onChange, className, ...rest }: any) => (
    <div
      data-testid="cloud-code-editor"
      data-value={value}
      data-language={language}
      className={className}
      {...rest}
    />
  ),
}));
vi.mock('../../src/components/CloudDiffEditor', () => ({
  default: (props: any) => <div data-testid="cloud-diff-editor" {...props} />,
}));

// ---- Mock TerminalPanel -----------------------------------------------------
// xterm.js calls window.matchMedia which jsdom does not implement.
vi.mock('../../src/components/TerminalPanel', () => ({
  default: (props: any) => <div data-testid="terminal-panel" {...props} />,
}));

// ---- Mock useWorkspace ------------------------------------------------------
// The real WorkspaceProvider bootstraps asynchronously from IndexedDB; in
// tests we bypass it entirely and hand CloudOS a pre-seeded in-memory state.
const DEFAULT_CONTENT = '// Start coding here...\nconsole.log("Hello from VantaOS!");\n';
const seedId = '0';

let wsContent = DEFAULT_CONTENT;
let wsNodes: Array<{ id: string; name: string; kind: 'file' | 'folder'; language: string; parentId: string | null; path: string }> = [
  { id: seedId, name: 'Untitled.js', kind: 'file', language: 'javascript', parentId: null, path: 'Untitled.js' },
];
let wsReady = true;

vi.mock('../../src/lib/workspace/workspace', () => {
  const DEFAULT_CONTENT = '// Start coding here...\nconsole.log("Hello from VantaOS!");\n';
  const seedId = '0';
  let wsNodes: Array<{ id: string; name: string; kind: 'file' | 'folder'; language: string; parentId: string | null; path: string }> = [
    { id: seedId, name: 'Untitled.js', kind: 'file', language: 'javascript', parentId: null, path: 'Untitled.js' },
  ];
  let wsContent = DEFAULT_CONTENT;
  return {
    useWorkspace: () => ({
      state: { nodes: new Map() },
      config: { conflictPolicy: 'last-write-wins' as const },
      ready: true,
      createFile: async (_path: string, name: string, content = '', parentId: string | null = null) => {
        const id = String(Date.now()) + Math.random();
        wsNodes.push({ id, name, kind: 'file', language: 'javascript', parentId, path: name });
        wsContent = content;
        return { id, name, kind: 'file' as const, path: name, parentId, language: 'javascript', createdAt: Date.now(), updatedAt: Date.now() };
      },
      createFolder: async (_path: string, name: string, parentId: string | null = null) => {
        const id = String(Date.now()) + Math.random();
        wsNodes.push({ id, name, kind: 'folder', language: '', parentId, path: name });
        return { id, name, kind: 'folder' as const, path: name, parentId, createdAt: Date.now(), updatedAt: Date.now() };
      },
      updateContent: async (_nodeId: string, content: string) => { wsContent = content; },
      renameNode: async (id: string, newName: string) => {
        const idx = wsNodes.findIndex(n => n.id === id);
        if (idx >= 0) wsNodes[idx] = { ...wsNodes[idx], name: newName, path: newName };
      },
      moveNode: async (_nodeId: string, _newParentId: string | null) => {},
      deleteNode: async (id: string) => {
        const toDelete = new Set([id, ...wsNodes.filter(n => n.parentId === id).map(n => n.id)]);
        wsNodes = wsNodes.filter(n => !toDelete.has(n.id));
      },
      getNode: (id: string) => wsNodes.find(n => n.id === id),
      getNodeByPath: (_path: string) => wsNodes[0],
      getChildren: (_parentId: string | null) => wsNodes.filter(n => n.parentId === _parentId),
      getDirtyNodes: () => [],
      getContent: (_nodeId: string) => wsContent,
      getAllNodes: () => wsNodes,
      setConflictPolicy: (_p: string) => {},
    }),
    WorkspaceProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

export function renderWithProviders(ui: ReactNode) {
  return render(ui as React.ReactElement);
}
