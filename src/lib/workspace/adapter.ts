/**
 * VantaOS Workspace — Adapter System.
 *
 * Adapters bridge the workspace to external storage backends. Each adapter
 * implements pull/push/health. The workspace never knows which backend it
 * talks to — it only sees Operations.
 */

import type {
  Adapter,
  AdapterKind,
  AdapterCapabilities,
  Operation,
  WorkspaceNode,
} from './types';
import { detectLanguage } from './indexes';
import * as github from '../github';

// ─── Adapter Interface (re-export) ──────────────────────────────────────────

export type { Adapter, AdapterKind, AdapterCapabilities };

// ─── In-Memory Adapter ──────────────────────────────────────────────────────

/**
 * Default adapter for CloudOS — stores files in the browser's memory
 * (and eventually IndexedDB via the oplog). Used when no external backend
 * is configured.
 */
export class InMemoryAdapter implements Adapter {
  readonly id = 'memory';
  readonly kind: AdapterKind = 'cloudos';
  readonly displayName = 'Local Workspace';
  readonly capabilities: AdapterCapabilities = {
    read: true,
    write: true,
    delete: true,
    move: true,
    sync: false,
  };

  private _files = new Map<string, { node: WorkspaceNode; content: string }>();

  async pull(): Promise<readonly Operation[]> {
    return [];
  }

  async push(_ops: readonly Operation[]): Promise<void> {
    // No-op — data lives in the oplog.
  }

  async health(): Promise<boolean> {
    return true;
  }

  /** Import legacy files from the old CloudOS format. */
  importLegacyFiles(
    files: Array<{
      id: string;
      name: string;
      path: string;
      content: string;
      language?: string;
    }>
  ): Operation[] {
    const now = Date.now();
    return files.map((f, i) => ({
      id: `legacy-${f.id}`,
      kind: 'create_node' as const,
      timestamp: now + i,
      source: 'adapter' as const,
      seq: 0,
      payload: {
        id: f.id,
        path: f.path,
        name: f.name,
        parentId: null,
        content: f.content,
        language: f.language || detectLanguage(f.name),
      },
    }));
  }
}

// ─── GitHub Adapter ──────────────────────────────────────────────────────────

export class GitHubAdapter implements Adapter {
  readonly kind: AdapterKind = 'github';
  readonly displayName: string;
  readonly capabilities: AdapterCapabilities = {
    read: true,
    write: true,
    delete: false, // GitHub API doesn't support delete via tree API
    move: false,
    sync: true,
  };

  private owner: string;
  private repo: string;
  private branch: string;

  constructor(
    readonly id: string,
    owner: string,
    repo: string,
    branch: string
  ) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.displayName = `${owner}/${repo}`;
  }

  async pull(): Promise<readonly Operation[]> {
    try {
      const defaultBranch = await github.getDefaultBranch(
        this.owner,
        this.repo
      );
      this.branch = defaultBranch;

      const treeData = await github.getRepoTree(
        this.owner,
        this.repo,
        this.branch
      );

      const blobs = treeData.tree.filter(
        (t: { type: string }) => t.type === 'blob'
      );
      const ops: Operation[] = [];
      let ts = Date.now();

      for (const item of blobs.slice(0, 200)) {
        const content = await github.getFileContent(
          this.owner,
          this.repo,
          item.path
        );
        ops.push({
          id: `gh-${this.repo}-${item.path}`,
          kind: 'create_node',
          timestamp: ts++,
          source: 'adapter',
          seq: 0,
          payload: {
            id: `gh-${this.repo}-${item.path}`,
            path: item.path,
            name: item.path.split('/').pop() ?? item.path,
            parentId: null,
            content,
            language: detectLanguage(item.path),
          },
        });
      }

      return ops;
    } catch (err) {
      console.error('[GitHubAdapter] pull failed:', err);
      return [];
    }
  }

  async push(_ops: readonly Operation[]): Promise<void> {
    // Push is handled by GitHubManager component for now.
    // Full oplog-based push will be implemented in Phase 4.
  }

  async health(): Promise<boolean> {
    return github.hasGitHubGrant();
  }
}

// ─── Adapter Registry ────────────────────────────────────────────────────────

const adapters = new Map<string, Adapter>();

export function registerAdapter(adapter: Adapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: string): Adapter | undefined {
  return adapters.get(id);
}

export function getAllAdapters(): readonly Adapter[] {
  return Array.from(adapters.values());
}

export function removeAdapter(id: string): boolean {
  return adapters.delete(id);
}

/** Initialize default adapters. */
export function initDefaultAdapters(): void {
  if (!adapters.has('memory')) {
    registerAdapter(new InMemoryAdapter());
  }
}
