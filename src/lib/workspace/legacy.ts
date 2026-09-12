/**
 * VantaOS Workspace — Legacy Snapshot Migration.
 *
 * Extracts and migrates the legacy localStorage-based file format
 * (vantaos_cloudos_files_v2) into the workspace oplog. This runs once;
 * after migration, the legacy key is removed from localStorage.
 *
 * The core transformation is a pure function (`buildOpsFromLegacy`) so it is
 * fully unit-testable without a browser.
 */

import type { Operation } from './types';
import { bulkAppendOps } from './operations';
import { detectLanguage } from './indexes';
import { buildCanonicalPath } from './paths';

// ─── Legacy Format ──────────────────────────────────────────────────────────

interface LegacyFile {
  id: string;
  name: string;
  content: string;
  language?: string;
  isFolder?: boolean;
  parentId?: string | null;
}

const LEGACY_STORAGE_KEY = 'vantaos_cloudos_files_v2';

// ─── Result Types ───────────────────────────────────────────────────────────

export interface MigrationResult {
  readonly migrated: boolean;
  readonly fileCount: number;
  readonly folderCount: number;
  readonly ops: readonly Operation[];
}

export interface BuildResult {
  readonly fileCount: number;
  readonly folderCount: number;
  readonly ops: readonly Operation[];
}

// ─── Pure Core ──────────────────────────────────────────────────────────────

/**
 * Transform a parsed legacy snapshot array into workspace operations.
 * Pure — no I/O. Exported for direct unit testing.
 *
 * Rules:
 * - Folders are created depth-first so parents precede children.
 * - Canonical paths are computed from the parent chain (paths.ts).
 * - Content languages are detected from the file name.
 * - ids are namespaced as "migrated-<legacyId>" to avoid collisions.
 */
export function buildOpsFromLegacy(parsed: unknown): BuildResult {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { fileCount: 0, folderCount: 0, ops: [] };
  }

  const legacyFiles = parsed.filter(
    (f): f is LegacyFile => typeof f === 'object' && f !== null && typeof f.id === 'string' && f.id
  );

  // Depth of a node measured by walking the parent chain.
  const depthOf = (node: LegacyFile): number => {
    let depth = 0;
    let cur = node;
    const seen = new Set<string>();
    while (cur.parentId != null) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      depth++;
      const next = legacyFiles.find((f) => f.id === cur.parentId);
      if (!next) break;
      cur = next;
    }
    return depth;
  };

  const idMap = new Map<string, string>();
  const pathMap = new Map<string, string>();
  const ops: Operation[] = [];
  let ts = Date.now();
  let seq = 1;
  let fileCount = 0;
  let folderCount = 0;

  const orderedFolders = legacyFiles
    .filter((f) => f.isFolder && typeof f.name === 'string')
    .sort((a, b) => depthOf(a) - depthOf(b));

  for (const folder of orderedFolders) {
    const newId = `migrated-${folder.id}`;
    idMap.set(folder.id, newId);
    const parentNewId = folder.parentId ? idMap.get(folder.parentId) ?? null : null;
    const path = buildCanonicalPath(
      folder.parentId ? pathMap.get(folder.parentId) ?? null : null,
      folder.name
    );
    if (path === null) continue;

    pathMap.set(folder.id, path);
    ops.push({
      id: `op-${newId}`,
      kind: 'create_folder',
      timestamp: ts++,
      source: 'system' as const,
      seq: seq++,
      payload: {
        id: newId,
        path,
        name: folder.name,
        parentId: parentNewId,
      },
    });
    folderCount++;
  }

  for (const file of legacyFiles) {
    if (file.isFolder) continue;
    if (typeof file.name !== 'string') continue;

    const newId = `migrated-${file.id}`;
    idMap.set(file.id, newId);
    const parentNewId = file.parentId ? idMap.get(file.parentId) ?? null : null;
    const path = buildCanonicalPath(
      file.parentId ? pathMap.get(file.parentId) ?? null : null,
      file.name
    );
    if (path === null) continue;

    pathMap.set(file.id, path);
    const content = typeof file.content === 'string' ? file.content : '';
    ops.push({
      id: `op-${newId}`,
      kind: 'create_node',
      timestamp: ts++,
      source: 'system' as const,
      seq: seq++,
      payload: {
        id: newId,
        path,
        name: file.name,
        parentId: parentNewId,
        content,
        language: file.language || detectLanguage(file.name),
      },
    });
    fileCount++;
  }

  return { fileCount, folderCount, ops };
}

// ─── Browser Binding ────────────────────────────────────────────────────────

export function migrateLegacySnapshot(): MigrationResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return { migrated: false, fileCount: 0, folderCount: 0, ops: [] };
  }

  if (!raw) {
    return { migrated: false, fileCount: 0, folderCount: 0, ops: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    const result = buildOpsFromLegacy(parsed);
    if (result.ops.length === 0) {
      return { migrated: false, fileCount: 0, folderCount: 0, ops: [] };
    }
    return {
      migrated: true,
      fileCount: result.fileCount,
      folderCount: result.folderCount,
      ops: result.ops,
    };
  } catch {
    return { migrated: false, fileCount: 0, folderCount: 0, ops: [] };
  }
}

export async function persistMigratedOps(
  ops: readonly Operation[]
): Promise<void> {
  if (ops.length === 0) return;
  await bulkAppendOps(ops);
}

export function clearLegacySnapshot(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable (SSG, private browsing).
  }
}

export function hasLegacySnapshot(): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}
