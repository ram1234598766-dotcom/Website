/**
 * VantaOS Workspace — Centralized IndexedDB Schema.
 *
 * Single source of truth for database name, version, and object store / index
 * definitions. All workspace modules should import `openWorkspaceDB` from here
 * rather than creating their own connections.
 */

export const DB_NAME = 'VantaOSWorkspace';
export const DB_VERSION = 3;

export function openWorkspaceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('operations')) {
        const ops = db.createObjectStore('operations', { keyPath: 'id' });
        ops.createIndex('by_seq', 'seq', { unique: true });
        ops.createIndex('by_timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('workspace_meta')) {
        db.createObjectStore('workspace_meta', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('outbox')) {
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
        outbox.createIndex('by_timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
