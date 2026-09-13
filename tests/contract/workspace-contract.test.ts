import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useWorkspace, WorkspaceProvider } from '../../src/lib/workspace/workspace';

const ExpectedMethods = [
  'createFile',
  'createFolder',
  'updateContent',
  'renameNode',
  'moveNode',
  'deleteNode',
  'getAllNodes',
  'getContent',
] as const;

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(WorkspaceProvider, null, children);
}

describe('useWorkspace() contract', () => {
  it('exports all expected mutation and query methods', () => {
    const result = renderHook(() => useWorkspace(), { wrapper: Wrapper });
    const api = result.result.current;

    for (const method of ExpectedMethods) {
      expect(typeof api[method]).toBe('function');
    }
  });

  it('has a state object and ready flag', () => {
    const result = renderHook(() => useWorkspace(), { wrapper: Wrapper });
    const api = result.result.current;

    expect(api.state).toBeDefined();
    expect(typeof api.ready).toBe('boolean');
    expect(typeof api.setConflictPolicy).toBe('function');
  });
});
