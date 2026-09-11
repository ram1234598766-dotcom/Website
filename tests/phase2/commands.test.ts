/**
 * Phase 2 — ShellSession wiring for the sandboxed node/js commands. Uses a
 * fake JsRunner to keep the tests deterministic and fast, and an in-memory
 * TerminalFs so ls/cat/file-run paths stay covered.
 */

import { describe, expect, it } from 'vitest';
import { ShellSession } from '../../src/lib/terminal/commands';
import type { TerminalFs, TerminalFsEntry } from '../../src/lib/terminal/sandbox';
import { ExecutionQuota } from '../../src/lib/terminal/quota';
import type { JsRunner, SandboxRunResult } from '../../src/lib/terminal/runner';
import { normalizePath } from '../../src/lib/terminal/commands';

class FakeRunner implements JsRunner {
  calls: string[] = [];
  result: SandboxRunResult = { ok: true, value: '7', output: [], durationMs: 0 };
  next: SandboxRunResult | null = null;

  run(code: string) {
    this.calls.push(code);
    const r = this.next ?? this.result;
    return { runId: this.calls.length, result: Promise.resolve(r), cancel() {} };
  }
}

class MemoryFs implements TerminalFs {
  private files = new Map<string, string>();
  private folders = new Set<string>(['/']);

  seedFile(relPath: string, content: string): void {
    const abs = normalizePath(relPath);
    this.files.set(abs, content);
    const parent = abs.slice(0, abs.lastIndexOf('/')) || '/';
    this.folders.add(parent);
    this.folders.add(normalizePath(parent));
  }

  listChildren(absPath: string): readonly TerminalFsEntry[] {
    const p = normalizePath(absPath);
    if (!this.folders.has(p)) return [];
    const prefix = p === '/' ? '/' : `${p}/`;
    const out = new Map<string, 'file' | 'folder'>();
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) {
        out.set(f.slice(prefix.length).split('/')[0], 'file');
      }
    }
    for (const d of this.folders) {
      if (d !== p && d.startsWith(prefix)) {
        out.set(d.slice(prefix.length).split('/')[0], 'folder');
      }
    }
    return [...out.entries()].map(([name, kind]) => ({ name, kind }));
  }

  readFile(absPath: string): string | undefined {
    return this.files.get(normalizePath(absPath));
  }

  async createFile(absPath: string, content: string): Promise<string> {
    this.files.set(normalizePath(absPath), content);
    return '';
  }

  async createFolder(absPath: string): Promise<string> {
    this.folders.add(normalizePath(absPath));
    return '';
  }

  async writeFile(absPath: string, content: string): Promise<string> {
    this.files.set(normalizePath(absPath), content);
    return '';
  }

  async deletePath(absPath: string): Promise<string> {
    const p = normalizePath(absPath);
    this.files.delete(p);
    for (const f of [...this.files.keys()]) {
      if (f.startsWith(`${p}/`)) this.files.delete(f);
    }
    this.folders.delete(p);
    return '';
  }
}

describe('ShellSession node/js sandbox wiring', () => {
  it('routes inline js through the runner and prints the value', async () => {
    const runner = new FakeRunner();
    const shell = new ShellSession(new MemoryFs(), new ExecutionQuota(), runner);
    const lines = await shell.execute('js 1 + 2 * 3');
    expect(runner.calls).toEqual(['1 + 2 * 3']);
    expect(lines.join('\n')).toContain('7');
  });

  it('prints captured console lines before the value', async () => {
    const runner = new FakeRunner();
    runner.result = { ok: true, value: 'ok', output: ['a', 'b'], durationMs: 0 };
    const shell = new ShellSession(new MemoryFs(), new ExecutionQuota(), runner);
    const lines = await shell.execute('js console.log(1)');
    expect(lines).toEqual(['a', 'b', 'ok']);
  });

  it('prints the error message on a failed run', async () => {
    const runner = new FakeRunner();
    runner.result = { ok: false, value: '', error: 'boom', output: [], durationMs: 0 };
    const shell = new ShellSession(new MemoryFs(), new ExecutionQuota(), runner);
    const lines = await shell.execute('js throw new Error("boom")');
    expect(lines[0]).toContain('boom');
  });

  it('prints a stopped notice when the run is terminated', async () => {
    const runner = new FakeRunner();
    runner.result = {
      ok: false,
      value: '',
      output: [],
      terminated: 'exceeded the 1s execution limit',
      durationMs: 400,
    };
    const shell = new ShellSession(new MemoryFs(), new ExecutionQuota(), runner);
    const lines = await shell.execute('node while (true) {}');
    expect(lines[0]).toContain('exceeded the 1s execution limit');
  });

  it('runs a file passed to node instead of inline code', async () => {
    const runner = new FakeRunner();
    const fs = new MemoryFs();
    fs.seedFile('/greet.js', "const who = 'world'; who;");
    const shell = new ShellSession(fs, new ExecutionQuota(), runner);
    const lines = await shell.execute("node /greet.js");
    expect(runner.calls).toEqual(["const who = 'world'; who;"]);
    expect(lines.join('\n')).toContain('7');
  });

  it('still renders a file value as "undefined" when none is returned', async () => {
    const runner = new FakeRunner();
    runner.result = { ok: true, value: 'undefined', output: [], durationMs: 0 };
    const shell = new ShellSession(new MemoryFs(), new ExecutionQuota(), runner);
    const lines = await shell.execute('js const x = 1;');
    expect(lines).toEqual(['undefined']);
  });

  it('help text no longer claims the tab can freeze', async () => {
    const shell = new ShellSession(new MemoryFs(), new ExecutionQuota(), new FakeRunner());
    const lines = await shell.execute('help');
    expect(lines.join('\n')).toContain('isolated sandbox');
    expect(lines.join('\n')).not.toContain('freeze the tab');
  });
});