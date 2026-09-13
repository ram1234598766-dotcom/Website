/**
 * Phase 1 — Export Integrity and Tamper Detection.
 *
 * Verifies that workspace export produces a verifiable bundle and that
 * any tampering with the ops array is caught by the SHA-256 digest check.
 * Uses Node's global crypto.subtle for SHA-256 computation.
 */

import { describe, expect, it } from 'vitest';
import { verifyExport } from '../../src/lib/workspace/export';
import type { WorkspaceExport } from '../../src/lib/workspace/export';

async function sha256hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeExport(ops: any[], digest: string): any {
  return {
    formatVersion: 1,
    exportedAt: '2026-09-11T00:00:00Z',
    opsDigest: digest,
    ops,
    meta: { name: 'test-workspace' },
  };
}

describe('verifyExport', () => {
  it('passes for a valid bundle', async () => {
    const ops = [
      { id: 'o1', kind: 'create_folder', timestamp: 1, source: 'system', seq: 1, payload: { id: 'f1', path: 'a', name: 'a', parentId: null } },
      { id: 'o2', kind: 'create_node', timestamp: 2, source: 'system', seq: 2, payload: { id: 'n1', path: 'a/x.ts', name: 'x.ts', parentId: 'f1', content: 'let x = 1;', language: 'typescript' } },
    ];
    const digest = await sha256hex(JSON.stringify(ops));
    const bundle = makeExport(ops, digest);
    const result = await verifyExport(bundle);
    expect(result.valid).toBe(true);
  });

  it('fails when ops are tampered', async () => {
    const ops = [
      { id: 'o1', kind: 'create_node', timestamp: 1, source: 'system', seq: 1, payload: { id: 'n1', path: 'x.ts', name: 'x.ts', parentId: null, content: 'clean', language: 'typescript' } },
    ];
    const digest = await sha256hex(JSON.stringify(ops));
    const tamperedOps = [...ops];
    tamperedOps[0] = { ...tamperedOps[0], payload: { ...tamperedOps[0].payload, content: 'malicious' } };
    const bundle = makeExport(tamperedOps, digest);
    const result = await verifyExport(bundle);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/digest mismatch/);
  });

  it('fails when digest is corrupted', async () => {
    const ops = [{ id: 'o1', kind: 'create_folder', timestamp: 1, source: 'system', seq: 1, payload: { id: 'f1', path: 'a', name: 'a', parentId: null } }];
    const bundle = makeExport(ops, 'deadbeef00000000000000000000000000000000000000000000000000000000');
    const result = await verifyExport(bundle);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/digest mismatch/);
  });

  it('fails for unsupported format version', async () => {
    const ops = [{ id: 'o1', kind: 'create_folder', timestamp: 1, source: 'system', seq: 1, payload: { id: 'f1', path: 'a', name: 'a', parentId: null } }];
    const digest = await sha256hex(JSON.stringify(ops));
    const bundle = { ...makeExport(ops, digest), formatVersion: 99 };
    const result = await verifyExport(bundle as any);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/format version/);
  });

  it('fails when ops is not an array', async () => {
    const bundle = {
    formatVersion: 1 as any,
      exportedAt: '2026-09-11T00:00:00Z',
      opsDigest: 'aaa',
      ops: 'not-an-array',
    } as any;
    const result = await verifyExport(bundle);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not an array/);
  });

  it('empty ops bundle is valid', async () => {
    const ops: any[] = [];
    const digest = await sha256hex(JSON.stringify(ops));
    const bundle = makeExport(ops, digest);
    const result = await verifyExport(bundle);
    expect(result.valid).toBe(true);
  });
});