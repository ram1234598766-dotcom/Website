import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { bulkAppendOps, clearOps } from '../../src/lib/workspace/operations';
import { exportWorkspace, importWorkspace, generateIntegrityChecksum, verifyManifest } from '../../src/lib/workspace/export';
import type { Operation } from '../../src/lib/workspace/types';
import { CURRENT_SCHEMA_VERSION } from '../../src/lib/workspace/migrations';

async function sha256hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeOp(overrides: Partial<Operation> = {}): Operation {
  return {
    id: overrides.id ?? `op-${Math.random().toString(36).slice(2, 8)}`,
    kind: overrides.kind ?? 'create_node',
    timestamp: overrides.timestamp ?? Date.now(),
    source: overrides.source ?? 'user',
    seq: overrides.seq ?? 1,
    payload: overrides.payload ?? { id: 'n1', path: '/test.ts', name: 'test.ts', parentId: null, content: 'hello', language: 'typescript' },
  } as Operation;
}

async function setupOps(ops: Operation[]): Promise<void> {
  await clearOps();
  if (ops.length > 0) {
    await bulkAppendOps(ops);
  }
}

describe('exportWorkspace', () => {
  beforeEach(async () => {
    await clearOps();
  });

  it('produces a valid manifest JSON string', async () => {
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(manifest).toBeDefined();
    expect(manifest.format).toBe('manifest');
  });

  it('returns a string, not an object', async () => {
    const result = await exportWorkspace({ format: 'manifest' });
    expect(typeof result).toBe('string');
  });

  it('contains all required fields', async () => {
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(manifest).toHaveProperty('format');
    expect(manifest).toHaveProperty('nodeTree');
    expect(manifest).toHaveProperty('operationCount');
    expect(manifest).toHaveProperty('schemaVersion');
    expect(manifest).toHaveProperty('contentHashes');
    expect(manifest).toHaveProperty('timestamp');
    expect(manifest).toHaveProperty('checksum');
  });

  it('nodeTree is an array', async () => {
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(Array.isArray(manifest.nodeTree)).toBe(true);
  });

  it('operationCount is a number', async () => {
    await setupOps([makeOp(), makeOp()]);
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(manifest.operationCount).toBe(2);
    expect(typeof manifest.operationCount).toBe('number');
  });

  it('schemaVersion matches CURRENT_SCHEMA_VERSION', async () => {
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(manifest.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('timestamp is a valid ISO string', async () => {
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(typeof manifest.timestamp).toBe('string');
    expect(() => new Date(manifest.timestamp).toISOString()).not.toThrow();
  });

  it('checksum is a 64-char hex string', async () => {
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(typeof manifest.checksum).toBe('string');
    expect(manifest.checksum.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(manifest.checksum)).toBe(true);
  });

  it('contentHashes is an array', async () => {
    await setupOps([makeOp(), makeOp()]);
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(Array.isArray(manifest.contentHashes)).toBe(true);
  });

  it('empty workspace exports correctly', async () => {
    await clearOps();
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(Array.isArray(manifest.nodeTree)).toBe(true);
    expect(manifest.nodeTree).toHaveLength(0);
    expect(manifest.operationCount).toBe(0);
    expect(Array.isArray(manifest.contentHashes)).toBe(true);
    expect(manifest.contentHashes).toHaveLength(0);
  });

  it('checksum matches verification of the same manifest', async () => {
    await setupOps([makeOp(), makeOp()]);
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const result = await verifyManifest(exportStr);
    expect(result.valid).toBe(true);
  });

  it('verifyManifest is idempotent on same manifest', async () => {
    await setupOps([makeOp(), makeOp()]);
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const r1 = await verifyManifest(exportStr);
    const r2 = await verifyManifest(exportStr);
    expect(r1.valid).toBe(r2.valid);
  });

  it('includes nodes in nodeTree from ops', async () => {
    await setupOps([makeOp({ id: 'op1', payload: { id: 'n1', path: '/a.ts', name: 'a.ts', parentId: null, content: 'code', language: 'typescript' } })]);
    const result = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(result);
    expect(manifest.nodeTree.length).toBeGreaterThanOrEqual(1);
    const node = manifest.nodeTree.find((n: any) => n.id === 'n1');
    expect(node).toBeDefined();
    expect(node.kind).toBe('file');
  });
});

describe('importWorkspace', () => {
  beforeEach(async () => {
    await clearOps();
  });

  it('imports a valid manifest and returns correct node count', async () => {
    await setupOps([makeOp(), makeOp()]);
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const result = await importWorkspace(exportStr);
    expect(result.imported).toBe(true);
    expect(result.nodeCount).toBeGreaterThanOrEqual(0);
    expect(typeof result.checksum).toBe('string');
    expect(result.checksum.length).toBe(64);
  });

  it('returns correct node count from manifest', async () => {
    await setupOps([makeOp({ id: 'op1', payload: { id: 'n1', path: '/a.ts', name: 'a.ts', parentId: null, content: 'code', language: 'typescript' } }), makeOp({ id: 'op2', payload: { id: 'n2', path: '/b.ts', name: 'b.ts', parentId: null, content: 'code', language: 'typescript' } })]);
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    const result = await importWorkspace(exportStr);
    expect(result.imported).toBe(true);
    expect(result.nodeCount).toBe(manifest.nodeTree.length);
  });

  it('rejects tampered manifests', async () => {
    await setupOps([makeOp()]);
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    manifest.nodeTree = [{ id: 'tampered', kind: 'file', path: '/hack.ts', name: 'hack.ts', parentId: null, contentHash: 'x', language: 'ts', createdAt: 1, updatedAt: 1 }];
    const tampered = JSON.stringify(manifest);
    const result = await importWorkspace(tampered);
    expect(result.imported).toBe(false);
    expect(result.nodeCount).toBe(0);
  });

  it('rejects manifests with corrupted checksum', async () => {
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    manifest.checksum = '0000000000000000000000000000000000000000000000000000000000000000';
    const result = await importWorkspace(JSON.stringify(manifest));
    expect(result.imported).toBe(false);
  });

  it('rejects invalid JSON', async () => {
    const result = await importWorkspace('not-valid-json');
    expect(result.imported).toBe(false);
    expect(result.nodeCount).toBe(0);
  });

  it('rejects manifest missing checksum', async () => {
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    delete manifest.checksum;
    const result = await importWorkspace(JSON.stringify(manifest));
    expect(result.imported).toBe(false);
  });

  it('imports empty workspace correctly', async () => {
    await clearOps();
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    expect(manifest.nodeTree).toHaveLength(0);
    const result = await importWorkspace(exportStr);
    expect(result.imported).toBe(true);
    expect(result.nodeCount).toBe(0);
  });

  it('accepts valid manifest with zero ops', async () => {
    await clearOps();
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const result = await importWorkspace(exportStr);
    expect(result.imported).toBe(true);
    expect(result.nodeCount).toBe(0);
    expect(result.checksum.length).toBe(64);
  });

  it('rejects manifest with unsupported format', async () => {
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    const tampered = { ...manifest, format: 'v2' };
    const result = await importWorkspace(JSON.stringify(tampered));
    expect(result.imported).toBe(false);
  });

  it('rejects manifest where nodeTree is modified but checksum is from original', async () => {
    await setupOps([makeOp({ id: 'op1', payload: { id: 'n1', path: '/a.ts', name: 'a.ts', parentId: null, content: 'original', language: 'typescript' } })]);
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    manifest.nodeTree[0] = { ...manifest.nodeTree[0], name: 'hacked.ts', contentHash: 'changed' };
    const result = await importWorkspace(JSON.stringify(manifest));
    expect(result.imported).toBe(false);
  });
});

describe('generateIntegrityChecksum', () => {
  it('returns a 64-char hex string', async () => {
    const ops: Operation[] = [makeOp({ id: 'op1' }), makeOp({ id: 'op2' })];
    const checksum = await generateIntegrityChecksum(ops);
    expect(typeof checksum).toBe('string');
    expect(checksum.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(checksum)).toBe(true);
  });

  it('is deterministic for the same operations', async () => {
    const ops = [makeOp({ id: 'op1', seq: 1 }), makeOp({ id: 'op2', seq: 2 })];
    const checksum1 = await generateIntegrityChecksum(ops);
    const checksum2 = await generateIntegrityChecksum(ops);
    expect(checksum1).toBe(checksum2);
  });

  it('changes when operations change', async () => {
    const ops1 = [makeOp({ id: 'op1', seq: 1 })];
    const ops2 = [makeOp({ id: 'op2', seq: 1 })];
    const checksum1 = await generateIntegrityChecksum(ops1);
    const checksum2 = await generateIntegrityChecksum(ops2);
    expect(checksum1).not.toBe(checksum2);
  });

  it('returns a valid SHA-256 hash', async () => {
    const ops: Operation[] = [{
      id: 'x',
      kind: 'create_node',
      timestamp: 1,
      source: 'user',
      seq: 1,
      payload: { id: 'n', path: '/x', name: 'x', parentId: null, content: '', language: 'ts' },
    } as Operation];
    const checksum = await generateIntegrityChecksum(ops);
    const expected = await sha256hex(JSON.stringify(ops));
    expect(checksum).toBe(expected);
  });

  it('detects operation log tampering', async () => {
    const ops = [
      makeOp({ id: 'op1', seq: 1, payload: { id: 'n1', path: '/a', name: 'a', parentId: null, content: 'original', language: 'ts' } }),
      makeOp({ id: 'op2', seq: 2, payload: { id: 'n2', path: '/b', name: 'b', parentId: null, content: 'data', language: 'ts' } }),
    ];
    const checksum = await generateIntegrityChecksum(ops);
    const tampered = [...ops];
    tampered[0] = { ...tampered[0], payload: { ...tampered[0].payload, content: 'modified' } } as Operation;
    const tamperedChecksum = await generateIntegrityChecksum(tampered);
    expect(checksum).not.toBe(tamperedChecksum);
  });

  it('handles empty operations array', async () => {
    const checksum = await generateIntegrityChecksum([]);
    expect(typeof checksum).toBe('string');
    expect(checksum.length).toBe(64);
  });

  it('handles single operation', async () => {
    const ops: Operation[] = [makeOp({ id: 'single', seq: 1 })];
    const checksum = await generateIntegrityChecksum(ops);
    expect(typeof checksum).toBe('string');
    expect(checksum.length).toBe(64);
  });
});

describe('verifyManifest', () => {
  beforeEach(async () => {
    await clearOps();
  });

  it('validates a correct manifest', async () => {
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const result = await verifyManifest(exportStr);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid JSON', async () => {
    const result = await verifyManifest('not-json');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid JSON/);
  });

  it('rejects missing checksum', async () => {
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    delete manifest.checksum;
    const result = await verifyManifest(JSON.stringify(manifest));
    expect(result.valid).toBe(false);
  });

  it('rejects wrong checksum', async () => {
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const manifest = JSON.parse(exportStr);
    manifest.checksum = 'a'.repeat(64);
    const result = await verifyManifest(JSON.stringify(manifest));
    expect(result.valid).toBe(false);
  });

  it('accepts valid manifest with ops', async () => {
    await setupOps([makeOp({ id: 'op1', payload: { id: 'n1', path: '/a.ts', name: 'a.ts', parentId: null, content: 'code', language: 'typescript' } })]);
    const exportStr = await exportWorkspace({ format: 'manifest' });
    const result = await verifyManifest(exportStr);
    expect(result.valid).toBe(true);
  });
});
