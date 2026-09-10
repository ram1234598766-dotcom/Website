/**
 * VantaOS Terminal — sandbox filesystem.
 *
 * The shell never touches the workspace directly. It drives a small
 * `TerminalFs` interface; the workspace-backed implementation translates
 * absolute paths to the workspace's node/path model. This keeps the shell
 * pure and swappable (e.g. a memory fs in tests).
 */

import type { NodeKind } from '../workspace/types';

export interface TerminalFsEntry {
  readonly name: string;
  readonly kind: NodeKind;
}

export interface TerminalFs {
  /** List the entries directly under an absolute path. Empty when missing. */
  listChildren(absPath: string): readonly TerminalFsEntry[];
  /** Return a file's contents, or undefined when missing/not a file. */
  readFile(absPath: string): string | undefined;
  /** Create a file. Resolves to '' on success, or an error message. */
  createFile(absPath: string, content: string): Promise<string>;
  /** Create a folder. Resolves to '' on success, or an error message. */
  createFolder(absPath: string): Promise<string>;
  /** Create-if-missing, then write content. Resolves to '' or an error message. */
  writeFile(absPath: string, content: string): Promise<string>;
  /** Delete a file or folder (recursively). Resolves to '' or an error message. */
  deletePath(absPath: string): Promise<string>;
}

// ─── Path Helpers ────────────────────────────────────────────────────────────

export function dirName(absPath: string): string {
  const idx = absPath.lastIndexOf('/');
  return idx <= 0 ? '/' : absPath.slice(0, idx);
}

export function baseName(absPath: string): string {
  const idx = absPath.lastIndexOf('/');
  return absPath.slice(idx + 1);
}

export function joinPath(from: string, name: string): string {
  if (from === '/') return `/${name}`;
  return `${from}/${name}`;
}

// ─── Workspace-Backed Implementation ─────────────────────────────────────────

/** Structural subset of the workspace hook used by the terminal. */
export interface WorkspaceLike {
  getNodeByPath(
    path: string
  ): { id: string; kind: NodeKind; name: string } | undefined;
  getChildren(
    parentId: string | null
  ): readonly { id: string; kind: NodeKind; name: string }[];
  getContent(nodeId: string): string | undefined;
  createFile(
    path: string,
    name: string,
    content: string,
    parentId?: string | null
  ): Promise<unknown>;
  createFolder(
    path: string,
    name: string,
    parentId?: string | null
  ): Promise<unknown>;
  updateContent(nodeId: string, content: string): Promise<void>;
  deleteNode(nodeId: string): Promise<void>;
}

export class WorkspaceTerminalFs implements TerminalFs {
  constructor(private readonly ws: WorkspaceLike) {}

  listChildren(absPath: string): readonly TerminalFsEntry[] {
    if (absPath === '/' || absPath === '') {
      return this.ws.getChildren(null).map((n) => ({ name: n.name, kind: n.kind }));
    }
    const node = this.ws.getNodeByPath(absPath);
    if (!node || node.kind !== 'folder') return [];
    return this.ws
      .getChildren(node.id)
      .map((n) => ({ name: n.name, kind: n.kind }));
  }

  readFile(absPath: string): string | undefined {
    const node = this.ws.getNodeByPath(absPath);
    if (!node || node.kind !== 'file') return undefined;
    return this.ws.getContent(node.id);
  }

  async createFile(absPath: string, content: string): Promise<string> {
    if (absPath === '/' || !baseName(absPath)) {
      return 'mkdir: invalid path';
    }
    if (this.ws.getNodeByPath(absPath)) {
      return `mkdir: ${absPath}: File exists`;
    }
    const parent = dirName(absPath);
    if (parent !== '/' && !this.ws.getNodeByPath(parent)) {
      return `mkdir: ${absPath}: No such directory`;
    }
    try {
      await this.ws.createFile(absPath, baseName(absPath), content, this.parentId(absPath));
      return '';
    } catch (err) {
      return `mkdir: ${(err as Error).message}`;
    }
  }

  async createFolder(absPath: string): Promise<string> {
    if (absPath === '/' || !baseName(absPath)) {
      return 'mkdir: invalid path';
    }
    if (this.ws.getNodeByPath(absPath)) {
      return `mkdir: ${absPath}: File exists`;
    }
    const parent = dirName(absPath);
    if (parent !== '/' && !this.ws.getNodeByPath(parent)) {
      return `mkdir: ${absPath}: No such directory`;
    }
    try {
      await this.ws.createFolder(absPath, baseName(absPath), this.parentId(absPath));
      return '';
    } catch (err) {
      return `mkdir: ${(err as Error).message}`;
    }
  }

  async writeFile(absPath: string, content: string): Promise<string> {
    const existing = this.ws.getNodeByPath(absPath);
    if (existing) {
      if (existing.kind !== 'file') return `touch: ${absPath}: Is a directory`;
      try {
        await this.ws.updateContent(existing.id, content);
        return '';
      } catch (err) {
        return `touch: ${(err as Error).message}`;
      }
    }
    return this.createFile(absPath, content);
  }

  async deletePath(absPath: string): Promise<string> {
    const node = this.ws.getNodeByPath(absPath);
    if (!node) return `rm: ${absPath}: No such file or directory`;
    try {
      for (const child of this.ws.getChildren(node.id)) {
        await this.deletePath(joinPath(absPath, child.name));
      }
      await this.ws.deleteNode(node.id);
      return '';
    } catch (err) {
      return `rm: ${(err as Error).message}`;
    }
  }

  private parentId(absPath: string): string | null {
    const parent = this.ws.getNodeByPath(dirName(absPath));
    return parent ? parent.id : null;
  }
}