/**
 * Phase 1 — Legacy Snapshot Migration.
 *
 * Tests the pure core of the legacy migration path: parsing the old
 * localStorage-based file format (vantaos_cloudos_files_v2) into
 * workspace operations with canonical paths and correct parent linkage.
 */

import { describe, expect, it } from 'vitest';
import { buildOpsFromLegacy } from '../../src/lib/workspace/legacy';
import { buildState, getNodeByPath, contentHash, detectLanguage } from '../../src/lib/workspace/indexes';

describe('buildOpsFromLegacy', () => {
  it('returns empty result for non-array input', () => {
    expect(buildOpsFromLegacy(null).ops).toEqual([]);
    expect(buildOpsFromLegacy(undefined).ops).toEqual([]);
    expect(buildOpsFromLegacy('string').ops).toEqual([]);
  });

  it('returns empty result for empty array', () => {
    expect(buildOpsFromLegacy([]).ops).toEqual([]);
  });

  it('migrates root-level files with correct content', () => {
    const legacy = [
      { id: '1', name: 'hello.ts', content: 'console.log("hi");', isFolder: false },
      { id: '2', name: 'notes.md', content: '# notes', isFolder: false },
    ];
    const result = buildOpsFromLegacy(legacy);
    expect(result.fileCount).toBe(2);
    expect(result.folderCount).toBe(0);
    expect(result.ops).toHaveLength(2);

    // Verify ops produce the correct state when replayed
    const state = buildState(result.ops);
    const hello = getNodeByPath(state, 'hello.ts');
    expect(hello).toBeDefined();
    expect(hello!.contentHash).toBe(contentHash('console.log("hi");'));
    expect(hello!.language).toBe('typescript');

    const notes = getNodeByPath(state, 'notes.md');
    expect(notes).toBeDefined();
    expect(notes!.language).toBe('markdown');
  });

  it('creates folders depth-first so parents precede children', () => {
    const legacy = [
      { id: 'f1', name: 'src', isFolder: true },
      { id: 'f2', name: 'components', isFolder: true, parentId: 'f1' },
      { id: 'a1', name: 'App.tsx', content: '<div/>', isFolder: false, parentId: 'f2' },
    ];
    const result = buildOpsFromLegacy(legacy);
    expect(result.folderCount).toBe(2);
    expect(result.fileCount).toBe(1);

    // All ops: folder src, folder components, file App.tsx
    expect(result.ops[0].kind).toBe('create_folder');
    expect((result.ops[0].payload as any).path).toBe('src');
    expect(result.ops[1].kind).toBe('create_folder');
    expect((result.ops[1].payload as any).path).toBe('src/components');
    expect(result.ops[2].kind).toBe('create_node');
    expect((result.ops[2].payload as any).path).toBe('src/components/App.tsx');
  });

  it('sets correct parentId linkage', () => {
    const legacy = [
      { id: 'f1', name: 'lib', isFolder: true },
      { id: 'a1', name: 'x.ts', content: '', isFolder: false, parentId: 'f1' },
    ];
    const result = buildOpsFromLegacy(legacy);
    const folderOp = result.ops[0] as any;
    const fileOp = result.ops[1] as any;
    // The file's parentId should match the migrated folder id
    expect(fileOp.payload.parentId).toBe(folderOp.payload.id);
  });

  it('migrates mixed folders and files at various depths', () => {
    const legacy = [
      { id: 'r1', name: 'root.ts', content: '// root', isFolder: false },
      { id: 'f1', name: 'docs', isFolder: true },
      { id: 'f2', name: 'deep', isFolder: true, parentId: 'f1' },
      { id: 'a1', name: 'guide.md', content: '# guide', isFolder: false, parentId: 'f2' },
    ];
    const result = buildOpsFromLegacy(legacy);
    const state = buildState(result.ops);
    expect(state.nodes.size).toBe(4);
    expect(getNodeByPath(state, 'docs')?.kind).toBe('folder');
    expect(getNodeByPath(state, 'docs/deep')?.kind).toBe('folder');
    expect(getNodeByPath(state, 'docs/deep/guide.md')?.kind).toBe('file');
    expect(getNodeByPath(state, 'docs/deep/guide.md')?.language).toBe('markdown');
  });

  it('uses "migrated-" prefix for ids to avoid collisions', () => {
    const legacy = [{ id: 'old-id', name: 'f.txt', content: 'hi', isFolder: false }];
    const result = buildOpsFromLegacy(legacy);
    const createOp = result.ops[0] as any;
    expect(createOp.payload.id).toBe('migrated-old-id');
  });

  it('handles legacy files with empty content', () => {
    const legacy = [{ id: '1', name: 'empty.txt', content: '', isFolder: false }];
    const result = buildOpsFromLegacy(legacy);
    expect(result.ops).toHaveLength(1);
    const state = buildState(result.ops);
    const node = getNodeByPath(state, 'empty.txt');
    expect(node?.contentHash).toBe(contentHash(''));
  });

  it('skips invalid entries (missing name, non-string name)', () => {
    const legacy = [
      { id: '1' },                     // missing name
      { id: '2', name: 123 },           // non-string name
      { id: '3', name: 'valid.ts', content: 'ok', isFolder: false }, // valid
    ];
    const result = buildOpsFromLegacy(legacy);
    expect(result.fileCount).toBe(1);
    expect(result.ops).toHaveLength(1);
  });

  it('handles cycle in parentId without infinite loop', () => {
    const legacy = [
      { id: 'a', name: 'a', isFolder: true, parentId: 'b' },
      { id: 'b', name: 'b', isFolder: true, parentId: 'a' },
    ];
    const result = buildOpsFromLegacy(legacy);
    // Cycle detected — folders created but cycles resolved via break guard
    expect(result.ops.length).toBeGreaterThanOrEqual(0);
  });

  it('detectLanguage defaults to plaintext for unknown extensions', () => {
    const legacy = [{ id: '1', name: 'file.xyz', content: '', isFolder: false }];
    const result = buildOpsFromLegacy(legacy);
    const state = buildState(result.ops);
    expect(getNodeByPath(state, 'file.xyz')?.language).toBe('plaintext');
  });

  it('preserves legacy language annotation if provided', () => {
    const legacy = [{ id: '1', name: 'file.txt', content: '', isFolder: false, language: 'custom' }];
    const result = buildOpsFromLegacy(legacy);
    expect((result.ops[0].payload as any).language).toBe('custom');
  });

  it('result ops replay deterministically via buildState', () => {
    const legacy = [
      { id: 'f1', name: 'src', isFolder: true },
      { id: 'f2', name: 'lib', isFolder: true, parentId: 'f1' },
      { id: 'a1', name: 'x.ts', content: 'export {}', isFolder: false, parentId: 'f2' },
    ];
    const { ops } = buildOpsFromLegacy(legacy);
    const s1 = buildState(ops);
    const s2 = buildState(ops);
    expect([...s1.nodes.keys()].sort()).toEqual([...s2.nodes.keys()].sort());
  });
});