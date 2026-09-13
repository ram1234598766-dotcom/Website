/**
 * VantaOS Workspace — Schema Versioning & Migrations.
 *
 * Tracks the schema version in IndexedDB and runs forward migrations when
 * the version stored in the DB is older than the current code version.
 * Each migration is a pure function that transforms an operation list.
 */

import type { Operation } from './types';
import { bulkAppendOps, clearOps, replaceOps, loadOps } from './operations';
import { openWorkspaceDB } from './db';

// ─── Schema Version ──────────────────────────────────────────────────────────

/** Current schema version. Bump when the Operation or WorkspaceNode shape changes. */
export const CURRENT_SCHEMA_VERSION = 3;

// ─── Meta helpers ────────────────────────────────────────────────────────────

async function readMeta(key: string): Promise<unknown> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace_meta', 'readonly');
    const req = tx.objectStore('workspace_meta').get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace_meta', 'readwrite');
    tx.objectStore('workspace_meta').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Migration Registry ─────────────────────────────────────────────────────

/**
 * A migration transforms operations from schema version N to N+1.
 * Each migration must be idempotent (safe to re-run on already-migrated ops).
 */
export type Migration = {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (ops: readonly Operation[]) => readonly Operation[];
};

const migrations: Migration[] = [];

function registerMigration(m: Migration): void {
  migrations.push(m);
  migrations.sort((a, b) => a.fromVersion - b.fromVersion);
}

// ─── Built-in Migrations ────────────────────────────────────────────────────

// v1 → v2: No structural changes to Operation type in v2.
// This migration exists as a placeholder and proof-of-concept.
// Add real transformations here when the schema actually changes.
registerMigration({
  fromVersion: 1,
  toVersion: 2,
  migrate(ops) {
    return ops;
  },
});

// v2 → v3: Placeholder for future schema changes.
// Currently no structural changes; operations pass through unchanged.
registerMigration({
  fromVersion: 2,
  toVersion: 3,
  migrate(ops) {
    return ops;
  },
});

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get the stored schema version. Returns 0 if never set or if invalid (non-integer). */
export async function getSchemaVersion(): Promise<number> {
  const v = await readMeta('schemaVersion');
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) {
    return v;
  }
  return 0;
}

/** Set the schema version explicitly. */
export async function setSchemaVersion(version: number): Promise<void> {
  await writeMeta('schemaVersion', version);
}

/**
 * Run all pending forward migrations from the stored version to
 * CURRENT_SCHEMA_VERSION. Writes the new version on success.
 *
 * Returns the list of operations after migration (re-read from IndexedDB).
 */
export async function runMigrations(): Promise<{
  ops: readonly Operation[];
  migrated: boolean;
  fromVersion: number;
  toVersion: number;
}> {
  const fromVersion = await getSchemaVersion();
  let currentOps = await loadOps();
  let migrated = false;

  for (const m of migrations) {
    if (m.fromVersion >= fromVersion && m.fromVersion < CURRENT_SCHEMA_VERSION) {
      currentOps = m.migrate(currentOps);
      migrated = true;
    }
  }

  if (migrated) {
    await replaceOps(currentOps);
    await setSchemaVersion(CURRENT_SCHEMA_VERSION);
  }

  return {
    ops: currentOps,
    migrated,
    fromVersion,
    toVersion: CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Reset the schema version to 0 and clear all data.
 * Used for testing or fresh installs.
 */
export async function resetSchema(): Promise<void> {
  await clearOps();
  await writeMeta('schemaVersion', 0);
}

/**
 * Initialize schema: run migrations, then stamp the current version
 * if this is a fresh install.
 */
export async function initSchema(): Promise<{
  fresh: boolean;
  migrated: boolean;
}> {
  const stored = await getSchemaVersion();
  const fresh = stored === 0;

  if (fresh) {
    const ran = await runMigrations();
    await setSchemaVersion(CURRENT_SCHEMA_VERSION);
    return { fresh: true, migrated: ran.migrated };
  }

  const result = await runMigrations();
  return { fresh: false, migrated: result.migrated };
}
