/**
 * VantaOS Terminal — shell session and built-in commands.
 *
 * The shell resolves paths against the workspace-backed `TerminalFs`, so
 * `ls`, `cat`, `mkdir`, `touch`, `rm` and friends operate on the user's
 * real files. Execution is gated by an `ExecutionQuota` to protect the tab.
 */

import type { TerminalFs } from './sandbox';
import { dirName, joinPath } from './sandbox';
import { ExecutionQuota } from './quota';

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const BLUE = '\u001b[34m';
const CYAN = '\u001b[36m';
const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const RESET = '\u001b[0m';

// ─── Path resolution ─────────────────────────────────────────────────────────

export function normalizePath(p: string): string {
  const isAbs = p.startsWith('/');
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return (isAbs ? '/' : '') + out.join('/');
}

function resolve(cwd: string, input: string): string {
  return normalizePath(input.startsWith('/') ? input : `${cwd}/${input}`);
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

// ─── Shell Session ───────────────────────────────────────────────────────────

export class ShellSession {
  private cwd = '/';
  private readonly history: string[] = [];
  private historyIdx = -1;

  constructor(
    private readonly fs: TerminalFs,
    private readonly quota: ExecutionQuota = new ExecutionQuota()
  ) {}

  getPrompt(): string {
    return `\r\n${GREEN}vantaos${RESET}:${BLUE}${this.cwd}${RESET}$ `;
  }

  historyPrev(): string | null {
    if (this.history.length === 0) return null;
    if (this.historyIdx > 0) this.historyIdx--;
    return this.history[this.historyIdx] ?? null;
  }

  historyNext(): string | null {
    if (this.historyIdx < this.history.length - 1) {
      this.historyIdx++;
      return this.history[this.historyIdx] ?? null;
    }
    this.historyIdx = this.history.length;
    return null;
  }

  async execute(input: string): Promise<readonly string[]> {
    const trimmed = input.trim();
    if (!trimmed) return [];

    this.history.push(trimmed);
    this.historyIdx = this.history.length;

    const { allowed, retryMs } = this.quota.tryAcquire();
    if (!allowed) {
      return [
        `${RED}Rate limit hit — try again in ${Math.ceil(retryMs / 1000)}s${RESET}`,
      ];
    }

    const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
    const command = tokens[0].toLowerCase();
    const args = tokens.slice(1).map(stripQuotes);

    const lines = await this.run(command, args, trimmed);
    return this.quota.capOutput(lines);
  }

  private async run(
    command: string,
    args: readonly string[],
    raw: string
  ): Promise<readonly string[]> {
    const lines: string[] = [];
    switch (command) {
      case 'clear': {
        lines.push('__CLEAR__');
        break;
      }
      case 'help': {
        lines.push(`${CYAN}VantaOS Terminal — available commands:${RESET}`);
        lines.push(`  ${YELLOW}ls${RESET} [path]        List files`);
        lines.push(`  ${YELLOW}cd${RESET} <path>        Change directory`);
        lines.push(`  ${YELLOW}pwd${RESET}              Print working directory`);
        lines.push(`  ${YELLOW}cat${RESET} <file>        View file contents`);
        lines.push(`  ${YELLOW}echo${RESET} <text>       Print text`);
        lines.push(`  ${YELLOW}date${RESET}             Show current date/time`);
        lines.push(`  ${YELLOW}whoami${RESET}           Show current user`);
        lines.push(`  ${YELLOW}tree${RESET} [path]      Show the file tree`);
        lines.push(`  ${YELLOW}clear${RESET}            Clear terminal`);
        lines.push(`  ${YELLOW}help${RESET}             Show this help`);
        lines.push(`  ${YELLOW}node${RESET} [file.js]   Run a file or inline JS`);
        lines.push(`  ${YELLOW}js${RESET} <code>         Run JavaScript inline`);
        lines.push(`  ${YELLOW}mkdir${RESET} <dir>       Create directory`);
        lines.push(`  ${YELLOW}touch${RESET} <file>      Create empty file`);
        lines.push(`  ${YELLOW}rm${RESET} <path>         Remove file/directory`);
        lines.push(
          `${YELLOW}Note:${RESET} '${YELLOW}node${RESET}/${YELLOW}js${RESET}' run ` +
            `synchronously — an infinite loop will freeze the tab.`
        );
        break;
      }
      case 'pwd': {
        lines.push(this.cwd);
        break;
      }
      case 'ls': {
        const target = resolve(this.cwd, args[0] ?? '.');
        const entries = this.fs.listChildren(target);
        if (entries.length === 0) {
          lines.push('(empty)');
        } else {
          const dirs = entries
            .filter((e) => e.kind === 'folder')
            .map((e) => `${BLUE}${e.name}/${RESET}`);
          const files = entries
            .filter((e) => e.kind === 'file')
            .map((e) => e.name);
          for (const d of [...dirs, ...files]) lines.push(d);
        }
        break;
      }
      case 'cd': {
        if (!args[0]) {
          this.cwd = '/';
          break;
        }
        const target = resolve(this.cwd, args[0]);
        if (target === '/' || this.isDirectory(target)) {
          this.cwd = target;
        } else {
          lines.push(`${RED}cd: ${args[0]}: No such directory${RESET}`);
        }
        break;
      }
      case 'cat': {
        if (!args[0]) {
          lines.push(`${RED}cat: missing operand${RESET}`);
          break;
        }
        const target = resolve(this.cwd, args[0]);
        const content = this.fs.readFile(target);
        if (content === undefined) {
          lines.push(`${RED}cat: ${args[0]}: No such file${RESET}`);
        } else {
          lines.push(content);
        }
        break;
      }
      case 'tree': {
        const target = resolve(this.cwd, args[0] ?? '.');
        const out = this.renderTree(target);
        if (out.length <= 1) lines.push('(empty)');
        else lines.push(...out);
        break;
      }
      case 'echo': {
        lines.push(args.join(' '));
        break;
      }
      case 'date': {
        lines.push(new Date().toString());
        break;
      }
      case 'whoami': {
        lines.push('vantaos-user');
        break;
      }
      case 'node':
      case 'js': {
        const rest = raw.replace(/^(node|js)\s+/, '');
        const fileTok = (rest.match(/^[^\s"]+|^"[^"]*"/) ?? [''])[0];
        const filePath = resolve(this.cwd, stripQuotes(fileTok));
        const fileContent = fileTok ? this.fs.readFile(filePath) : undefined;
        const code =
          fileContent !== undefined && rest.trim() === fileTok
            ? fileContent
            : rest;
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(code);
          const result = fn();
          lines.push(String(result ?? 'undefined'));
        } catch (e) {
          lines.push(`${RED}${(e as Error).message}${RESET}`);
        }
        break;
      }
      case 'mkdir': {
        if (!args[0]) {
          lines.push(`${RED}mkdir: missing operand${RESET}`);
          break;
        }
        const target = resolve(this.cwd, args[0]);
        const err = await this.fs.createFolder(target);
        if (err) lines.push(`${RED}${err}${RESET}`);
        break;
      }
      case 'touch': {
        if (!args[0]) {
          lines.push(`${RED}touch: missing operand${RESET}`);
          break;
        }
        const target = resolve(this.cwd, args[0]);
        const existing = this.fs.readFile(target);
        const err = await this.fs.writeFile(target, existing ?? '');
        if (err) lines.push(`${RED}${err}${RESET}`);
        break;
      }
      case 'rm': {
        if (!args[0]) {
          lines.push(`${RED}rm: missing operand${RESET}`);
          break;
        }
        const target = resolve(this.cwd, args[0]);
        const err = await this.fs.deletePath(target);
        if (err) lines.push(`${RED}${err}${RESET}`);
        break;
      }
      default: {
        lines.push(
          `${RED}Command not found: ${command}. Type '${YELLOW}help${RED}' for ` +
            `available commands.${RESET}`
        );
      }
    }
    return lines;
  }

  private isDirectory(absPath: string): boolean {
    const parent = dirName(absPath);
    return this.fs.listChildren(parent).some((e) => {
      return e.kind === 'folder' && joinPath(parent, e.name) === absPath;
    });
  }

  private renderTree(absPath: string): string[] {
    const label = absPath === '/' ? '/' : absPath.split('/').pop() ?? absPath;
    const out: string[] = [label];
    const entries = this.fs.listChildren(absPath);
    entries.forEach((entry, i) => {
      const last = i === entries.length - 1;
      const branch = last ? '└── ' : '├── ';
      if (entry.kind === 'folder') {
        const childAbs =
          absPath === '/' ? `/${entry.name}` : `${absPath}/${entry.name}`;
        const childLines = this.renderTree(childAbs);
        out.push(branch + childLines[0]);
        const childPrefix = last ? '    ' : '│   ';
        for (const line of childLines.slice(1)) {
          out.push(childPrefix + line);
        }
      } else {
        out.push(branch + entry.name);
      }
    });
    return out;
  }
}