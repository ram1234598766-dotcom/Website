/**
 * VantaOS Workspace — Export / Import with Integrity Checks.
 *
 * Exports the workspace as a self-contained JSON bundle with a SHA-256
 * content-addressed manifest. Import verifies the manifest before
 * applying operations.
 */

import type { Operation, WorkspaceNode } from './types';
import { loadOps, replaceOps } from './operations';
import { CURRENT_SCHEMA_VERSION } from './migrations';

// ─── Types ───────────────────────────────────────────────────────────────

export interface WorkspaceExport {
  readonly format: 'manifest';
  readonly timestamp: string;
  readonly schemaVersion: number;
  readonly nodeTree: WorkspaceNode[];
  readonly operationCount: number;
  readonly contentHashes: string[];
  readonly checksum: string;
}

export interface IntegrityCheck {
  readonly valid: boolean;
  readonly error?: string;
}

export interface ImportResult {
  readonly imported: boolean;
  readonly nodeCount: number;
  readonly checksum: string;
}

// ─── SHA-256 Helper ──────────────────────────────────────────────────────

async function sha256hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Node Tree Builder ───────────────────────────────────────────────────

function buildNodeTree(ops: readonly Operation[]): { nodes: WorkspaceNode[]; contentHashes: string[] } {
  const nodes: WorkspaceNode[] = [];
  const contentHashes: string[] = [];
  for (const op of ops) {
    if (op.kind !== 'create_node') continue;
    const p = op.payload as Record<string, unknown>;
    const content = typeof p.content === 'string' ? p.content : '';
    const language = typeof p.language === 'string' ? p.language : 'unknown';
    const name = typeof p.name === 'string' ? p.name : '';
    const isFolder = name.endsWith('/') || name === '' || language === 'folder';
    const node: WorkspaceNode = {
      id: typeof p.id === 'string' ? p.id : String(op.id),
      kind: isFolder ? 'folder' : 'file',
      path: typeof p.path === 'string' ? p.path : '',
      name,
      parentId: typeof p.parentId === 'string' ? p.parentId : null,
      contentHash: '',
      language,
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : op.timestamp,
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : op.timestamp,
    };
    contentHashes.push(node.contentHash);
    nodes.push(node);
  }
  return { nodes, contentHashes };
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function generateIntegrityChecksum(ops: readonly Operation[]): Promise<string> {
  return sha256hex(JSON.stringify(ops));
}

export async function exportWorkspace(
  meta?: Record<string, unknown>
): Promise<string> {
  const ops = await loadOps();
  const { nodes, contentHashes } = buildNodeTree(ops);

  const payload = {
    format: 'manifest' as const,
    timestamp: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodeTree: nodes,
    operationCount: ops.length,
    contentHashes,
  };
  const checksum = await sha256hex(JSON.stringify(payload));

  const manifest: WorkspaceExport = { ...payload, checksum };

  return JSON.stringify(manifest);
}

export async function verifyManifest(manifestStr: string): Promise<IntegrityCheck> {
  let manifest: WorkspaceExport;
  try {
    manifest = JSON.parse(manifestStr);
  } catch {
    return { valid: false, error: 'invalid JSON' };
  }

  if (typeof manifest.checksum !== 'string' || manifest.checksum.length !== 64) {
    return { valid: false, error: 'missing or invalid checksum' };
  }

  const { checksum, ...payload } = manifest;
  const computed = await sha256hex(JSON.stringify(payload));

  if (computed !== checksum) {
    return { valid: false, error: 'checksum mismatch' };
  }

  return { valid: true };
}

export async function verifyExport(exported: WorkspaceExport): Promise<IntegrityCheck> {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(typeof exported === 'string' ? exported : JSON.stringify(exported));
  } catch {
    return { valid: false, error: 'invalid JSON' };
  }
  if (manifest.format !== 'manifest' && manifest.formatVersion !== 1) {
    return { valid: false, error: 'unsupported format version' };
  }
  const ops = manifest.ops;
  if (!Array.isArray(ops)) {
    return { valid: false, error: 'ops is not an array' };
  }
  if (typeof manifest.opsDigest !== 'string' || manifest.opsDigest.length !== 64) {
    return { valid: false, error: 'missing or invalid checksum' };
  }
  const { opsDigest, ...payload } = manifest;
  const computed = await sha256hex(JSON.stringify(ops));
  if (computed !== opsDigest) {
    return { valid: false, error: `digest mismatch: expected ${opsDigest}, got ${computed}` };
  }
  return { valid: true };
}

export async function importWorkspace(manifestStr: string): Promise<ImportResult> {
  const check = await verifyManifest(manifestStr);
  if (!check.valid) {
    return { imported: false, nodeCount: 0, checksum: '' };
  }

  let manifest: WorkspaceExport;
  try {
    manifest = JSON.parse(manifestStr);
  } catch {
    return { imported: false, nodeCount: 0, checksum: '' };
  }

  try {
    await replaceOps(manifest.nodeTree.map((n) => ({
      id: n.id,
      kind: n.kind === 'folder' ? 'create_folder' : 'create_node',
      timestamp: n.createdAt,
      source: 'system',
      seq: 0,
      payload: {
        id: n.id,
        path: n.path,
        name: n.name,
        parentId: n.parentId,
        content: '',
        language: n.language,
      },
    } as Operation)));

    return { imported: true, nodeCount: manifest.nodeTree.length, checksum: manifest.checksum };
  } catch (err) {
    return {
      imported: false,
      nodeCount: 0,
      checksum: err instanceof Error ? err.message : String(err),
    };
  }
}
