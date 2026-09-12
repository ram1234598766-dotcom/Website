/**
 * VantaOS Workspace — Export / Import with Integrity Checks.
 *
 * Exports the workspace as a self-contained JSON bundle with a SHA-256
 * content-addressed manifest. Import verifies the manifest before
 * applying operations.
 */

import type { Operation } from './types';
import { loadOps } from './operations';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkspaceExport {
  /** Format version for the export envelope. */
  readonly formatVersion: 1;
  /** ISO-8601 timestamp of the export. */
  readonly exportedAt: string;
  /** SHA-256 hex digest of the serialized operations array. */
  readonly opsDigest: string;
  /** The operations that define the workspace. */
  readonly ops: readonly Operation[];
  /** User-supplied metadata (workspace name, description, etc.). */
  readonly meta?: Record<string, unknown>;
}

export interface IntegrityCheck {
  readonly valid: boolean;
  readonly error?: string;
}

// ─── SHA-256 Helper ─────────────────────────────────────────────────────────

async function sha256hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Export the current workspace operations as a bundle.
 * Computes SHA-256 over the serialized ops array for integrity.
 */
export async function exportWorkspace(
  meta?: Record<string, unknown>
): Promise<WorkspaceExport> {
  const ops = await loadOps();
  const opsJson = JSON.stringify(ops);
  const digest = await sha256hex(opsJson);

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    opsDigest: digest,
    ops,
    meta,
  };
}

/**
 * Verify the integrity of a WorkspaceExport.
 * Recomputes SHA-256 over the ops array and compares to the stored digest.
 */
export async function verifyExport(
  exported: WorkspaceExport
): Promise<IntegrityCheck> {
  if (exported.formatVersion !== 1) {
    return { valid: false, error: `unsupported format version: ${exported.formatVersion}` };
  }
  if (!Array.isArray(exported.ops)) {
    return { valid: false, error: 'ops is not an array' };
  }

  const opsJson = JSON.stringify(exported.ops);
  const computed = await sha256hex(opsJson);

  if (computed !== exported.opsDigest) {
    return {
      valid: false,
      error: `digest mismatch: expected ${exported.opsDigest}, got ${computed}`,
    };
  }

  return { valid: true };
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  readonly success: boolean;
  readonly opsImported: number;
  readonly error?: string;
}

/**
 * Import a workspace from a verified export bundle.
 * Replaces the current oplog with the imported operations.
 * Caller should verify integrity before calling this.
 */
export async function importWorkspace(
  exported: WorkspaceExport
): Promise<ImportResult> {
  const check = await verifyExport(exported);
  if (!check.valid) {
    return {
      success: false,
      opsImported: 0,
      error: check.error,
    };
  }

  try {
    const { replaceOps } = await import('./operations');
    await replaceOps(exported.ops);
    return {
      success: true,
      opsImported: exported.ops.length,
    };
  } catch (err) {
    return {
      success: false,
      opsImported: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
