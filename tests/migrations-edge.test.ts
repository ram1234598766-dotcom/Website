import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  bulkAppendOps,
  loadOps,
  clearOps,
  replaceOps,
} from '../src/lib/workspace/operations';
import { openWorkspaceDB } from '../src/lib/workspace/db';
import {
  runMigrations,
  initSchema,
  getSchemaVersion,
  setSchemaVersion,
  resetSchema,
  CURRENT_SCHEMA_VERSION,
} from '../src/lib/workspace/migrations';
import type { Operation } from '../src/lib/workspace/types';

let seqCounter = 0;

function makeOp(seq: number): Operation {
  const id = 'op-' + ++seqCounter;
  return {
    id,
    kind: 'create_node',
    timestamp: 1000,
    source: 'system' as const,
    seq,
    payload: {
      id: 'n-' + seq,
      path: 'f' + seq + '.ts',
      name: 'f' + seq + '.ts',
      parentId: null,
      content: '',
      language: 'plaintext',
    },
  };
}

async function setStoredVersion(v: number): Promise<void> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace_meta', 'readwrite');
    tx.objectStore('workspace_meta').put({ key: 'schemaVersion', value: v });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('migrations - edge cases', () => {
  beforeEach(async () => {
    seqCounter = 0;
    await clearOps();
  });

  describe('Q1: runMigrations - condition analysis', () => {
    it('runs migration 2->3 when stored version is 2 (correct: >= includes current)', async () => {
      await setStoredVersion(2);
      await bulkAppendOps([makeOp(1)]);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe(2);
      expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
      const stored = await getSchemaVersion();
      expect(stored).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('does NOT run migration when stored version is 3 (already current)', async () => {
      await setStoredVersion(3);
      await bulkAppendOps([makeOp(1)]);
      const result = await runMigrations();
      expect(result.migrated).toBe(false);
      const stored = await getSchemaVersion();
      expect(stored).toBe(3);
    });

    it('runs migration 1->2 when stored version is 1', async () => {
      await setStoredVersion(1);
      await bulkAppendOps([makeOp(1)]);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const stored = await getSchemaVersion();
      expect(stored).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('Q2: runMigrations - stored version 4 above current', () => {
    it('returns migrated=false and does not change version', async () => {
      await setStoredVersion(4);
      await bulkAppendOps([makeOp(1)]);
      const result = await runMigrations();
      expect(result.migrated).toBe(false);
      expect(result.fromVersion).toBe(4);
      const stored = await getSchemaVersion();
      expect(stored).toBe(4);
    });
  });

  describe('Q3: runMigrations - stored version 0', () => {
    it('runs all pending migrations from version 0 via runMigrations', async () => {
      await setStoredVersion(0);
      await bulkAppendOps([makeOp(1)]);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const stored = await getSchemaVersion();
      expect(stored).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('Q4: runMigrations - non-integer stored version', () => {
    it('treats 2.5 as invalid and runs all migrations', async () => {
      await setStoredVersion(2.5);
      await bulkAppendOps([makeOp(1)]);
      const stored = await getSchemaVersion();
      expect(stored).toBe(0);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const after = await getSchemaVersion();
      expect(after).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('treats NaN as invalid and runs all migrations', async () => {
      const db = await openWorkspaceDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('workspace_meta', 'readwrite');
        tx.objectStore('workspace_meta').put({ key: 'schemaVersion', value: NaN });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await bulkAppendOps([makeOp(1)]);
      const stored = await getSchemaVersion();
      expect(stored).toBe(0);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const after = await getSchemaVersion();
      expect(after).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('treats negative numbers as invalid and runs all migrations', async () => {
      await setStoredVersion(-1);
      await bulkAppendOps([makeOp(1)]);
      const stored = await getSchemaVersion();
      expect(stored).toBe(0);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const after = await getSchemaVersion();
      expect(after).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('treats string values as invalid and runs all migrations', async () => {
      const db = await openWorkspaceDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('workspace_meta', 'readwrite');
        tx.objectStore('workspace_meta').put({ key: 'schemaVersion', value: '2' });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await bulkAppendOps([makeOp(1)]);
      const stored = await getSchemaVersion();
      expect(stored).toBe(0);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const after = await getSchemaVersion();
      expect(after).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('treats null as invalid and runs all migrations', async () => {
      const db = await openWorkspaceDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('workspace_meta', 'readwrite');
        tx.objectStore('workspace_meta').put({ key: 'schemaVersion', value: null });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await bulkAppendOps([makeOp(1)]);
      const stored = await getSchemaVersion();
      expect(stored).toBe(0);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const after = await getSchemaVersion();
      expect(after).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('Q5: runMigrations - failure after replaceOps before setSchemaVersion', () => {
    it('is safe to retry after partial failure due to idempotent migrations', async () => {
      await setStoredVersion(2);
      await bulkAppendOps([makeOp(1)]);
      const ops = await loadOps();
      await replaceOps(ops);
      const stored = await getSchemaVersion();
      expect(stored).toBe(2);
      const result = await runMigrations();
      expect(result.migrated).toBe(true);
      const storedAfter = await getSchemaVersion();
      expect(storedAfter).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('Q6: resetSchema', () => {
    it('resets schema version to 0', async () => {
      await setStoredVersion(3);
      await resetSchema();
      const stored = await getSchemaVersion();
      expect(stored).toBe(0);
    });

    it('clears all operations', async () => {
      await bulkAppendOps([makeOp(1), makeOp(2)]);
      const before = await loadOps();
      expect(before.length).toBeGreaterThan(0);
      await resetSchema();
      const after = await loadOps();
      expect(after.length).toBe(0);
    });

    it('resets version to 0 without running migrations', async () => {
      await resetSchema();
      const stored = await getSchemaVersion();
      expect(stored).toBe(0);
      const ops = await loadOps();
      expect(ops.length).toBe(0);
    });
  });

  describe('Q7: initSchema - stored version 0', () => {
    it('runs migrations and stamps version 3 (BUG FIX: previously skipped migrations)', async () => {
      await setStoredVersion(0);
      await bulkAppendOps([makeOp(1)]);
      const result = await initSchema();
      expect(result.fresh).toBe(true);
      expect(result.migrated).toBe(true);
      const stored = await getSchemaVersion();
      expect(stored).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('Q7: initSchema - stored version greater than 0', () => {
    it('runs migrations and reports non-fresh', async () => {
      await setStoredVersion(2);
      await bulkAppendOps([makeOp(1)]);
      const result = await initSchema();
      expect(result.fresh).toBe(false);
      expect(result.migrated).toBe(true);
      const stored = await getSchemaVersion();
      expect(stored).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('returns migrated=false when already at current version', async () => {
      await setStoredVersion(3);
      await bulkAppendOps([makeOp(1)]);
      const result = await initSchema();
      expect(result.fresh).toBe(false);
      expect(result.migrated).toBe(false);
    });
  });
});
