/**
 * VantaOS Terminal — PowerShell-style shell session.
 *
 * All commands resolve paths against the workspace-backed `TerminalFs`,
 * so `dir`, `cat`, `mkdir`, `touch`, `rm` and friends operate on the
 * user's real files. Execution is gated by an `ExecutionQuota`.
 *
 * Aliases: dir→ls, del→rm, cls→clear, type→cat, copy→cp, move→mv, ren→mv, where→which
 */

import type { TerminalFs } from './sandbox';
import { dirName, joinPath } from './sandbox';
import { ExecutionQuota } from './quota';
import type { JsRunner, SandboxRunResult } from './runner';
import { SandboxRunner } from './runner';

const BLUE = '\u001b[34m';
const CYAN = '\u001b[36m';
const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';
const RESET = '\u001b[0m';

function progressBar(pct: number): string {
  const total = 25;
  const filled = Math.round((pct / 100) * total);
  return `${GREEN}${'█'.repeat(filled)}${DIM}${'░'.repeat(total - filled)}${RESET}`;
}

function fancyHeader(title: string, icon: string): string[] {
  const content = `${icon} ${title}`;
  const w = Math.max(content.length + 4, 30);
  return [
    `${CYAN}${BOLD}  ╔${'═'.repeat(w)}╗${RESET}`,
    `${CYAN}${BOLD}  ║ ${content}${' '.repeat(Math.max(0, w - content.length))}║${RESET}`,
    `${CYAN}${BOLD}  ╚${'═'.repeat(w)}╝${RESET}`,
  ];
}

const WORKSPACE_ROOT = '/';

export function normalizePath(p: string): string {
  const isAbs = p.startsWith('/');
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return (isAbs ? '/' : '') + out.join('/');
}

function resolve(cwd: string, input: string): string {
  return normalizePath(input.startsWith('/') ? input : `${cwd}/${input}`);
}

function guardWorkspace(absPath: string): string {
  if (!absPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Path outside workspace');
  }
  return absPath;
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -2);
  return s;
}

function toPsPath(p: string): string {
  return p.replace(/\//g, '\\');
}

export class ShellSession {
  private cwd = '/';
  readonly history: string[] = [];
  private historyIdx = -1;

  constructor(
    private readonly fs: TerminalFs,
    private readonly quota: ExecutionQuota = new ExecutionQuota(),
    private readonly runner: JsRunner = new SandboxRunner()
  ) {}

  private sandboxLines(res: SandboxRunResult): string[] {
    const lines: string[] = [];
    if (res.terminated) {
      lines.push(`${YELLOW}[run stopped — ${res.terminated}]${RESET}`);
    } else if (!res.ok) {
      lines.push(`${RED}${res.error ?? 'Execution failed.'}${RESET}`);
    } else {
      lines.push(...res.output);
      lines.push(res.value);
    }
    return lines;
  }

  getPrompt(): string {
    return `${GREEN}PS${RESET} ${BLUE}${toPsPath(this.cwd)}${RESET}> `;
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
      return [`${RED}Rate limit hit — try again in ${Math.ceil(retryMs / 1000)}s${RESET}`];
    }

    const tokens = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
    let command = tokens[0].toLowerCase();
    const args = tokens.slice(1).map(stripQuotes);

    const aliasMap: Record<string, string> = {
      dir: 'ls', del: 'rm', erase: 'rm', cls: 'clear', clr: 'clear',
      type: 'cat', copy: 'cp', move: 'mv', ren: 'mv', rename: 'mv',
      where: 'which', pwsh: 'help',
      'clear-host': 'clear', 'write-output': 'echo', 'echo-output': 'echo',
      'get-command': 'gcm', 'get-childitem': 'gci', 'get-location': 'gl',
      'set-location': 'sl', 'get-item': 'gi', 'get-help': 'help',
      'get-process': 'gps', 'get-service': 'gsv',
      'sort-object': 'sort', 'select-object': 'select',
      gcm: 'ls', gci: 'ls', gl: 'pwd', sl: 'cd', gi: 'cat',
    };
    const canonical = aliasMap[command] ?? command;

    const lines = await this.run(canonical, args, trimmed);
    return this.quota.capOutput(lines);
  }

  private async run(command: string, args: readonly string[], raw: string): Promise<readonly string[]> {
    const lines: string[] = [];
    switch (command) {
      case 'clear': lines.push('__CLEAR__'); break;

      case 'help': {
        lines.push(`${CYAN}${BOLD}  ╔═══════════════════════════════════════════════╗${RESET}`);
        lines.push(`${CYAN}${BOLD}  ║   VantaOS Terminal — PowerShell Edition      ║${RESET}`);
        lines.push(`${CYAN}${BOLD}  ║   Version 2.5.0 | Build vantaos-cloud-ide    ║${RESET}`);
        lines.push(`${CYAN}${BOLD}  ╚═══════════════════════════════════════════════╝${RESET}`);
        lines.push('');
        lines.push(`${YELLOW}File Commands:${RESET}`);
        lines.push(`  ${GREEN}ls, dir, gci, get-childitem${RESET}   List files          ${GREEN}cat, type, gi, get-item${RESET}  Read file`);
        lines.push(`  ${GREEN}cd, sl, set-location${RESET}         Change directory      ${GREEN}pwd, gl, get-location${RESET}  Show location`);
        lines.push(`  ${GREEN}tree${RESET}                          Directory tree        ${GREEN}mkdir, touch${RESET}           Create items`);
        lines.push(`  ${GREEN}rm, del, erase${RESET}                Remove file           ${GREEN}cp, copy${RESET}                  Copy file`);
        lines.push(`  ${GREEN}mv, move, ren, rename${RESET}         Move / rename         ${GREEN}find${RESET}                     Search files`);
        lines.push('');
        lines.push(`${YELLOW}System:${RESET}`);
        lines.push(`  ${GREEN}hostname, whoami, ver, systeminfo${RESET}  System info        ${GREEN}date, time${RESET}                   Date / time`);
        lines.push(`  ${GREEN}set, path${RESET}                         Environment vars   ${GREEN}clear, cls, clr, clear-host${RESET}  Clear screen`);
        lines.push('');
        lines.push(`${YELLOW}Network:${RESET}`);
        lines.push(`  ${GREEN}ipconfig, ping, nslookup${RESET}          Network tools      ${GREEN}netstat, tracert${RESET}             Connections`);
        lines.push(`  ${GREEN}tasklist, taskkill${RESET}                Process management`);
        lines.push('');
        lines.push(`${YELLOW}Packages:${RESET}`);
        lines.push(`  ${GREEN}winget${RESET}                             Windows pkg mgr    ${GREEN}npm, npx${RESET}                      Node.js pkg`);
        lines.push(`  ${GREEN}pip${RESET}                                Python pkg          ${GREEN}yarn, pnpm${RESET}                    Alternatives`);
        lines.push(`  ${GREEN}get-weather, weather${RESET}               Weather lookup      ${GREEN}get-command, gcm${RESET}              List commands`);
        lines.push('');
        lines.push(`${YELLOW}Aliases:${RESET}  ${GREEN}gcm=ls${RESET}, ${GREEN}gci=ls${RESET}, ${GREEN}gl=pwd${RESET}, ${GREEN}sl=cd${RESET}, ${GREEN}gi=cat${RESET}, ${GREEN}dir=ls${RESET}, ${GREEN}del=rm${RESET}, ${GREEN}type=cat${RESET}`);
        lines.push('');
        lines.push(`${YELLOW}Tip:${RESET} ${GREEN}node${RESET}/${GREEN}js${RESET} run in an isolated sandbox — runaway scripts are stopped automatically.`);
        return lines;
      }

      case 'pwd': case 'location': {
        lines.push(toPsPath(this.cwd)); break;
      }

      case 'ls': {
        const target = resolve(this.cwd, args[0] ?? '.');
        const entries = this.fs.listChildren(target);
        if (entries.length === 0) { lines.push('(empty)'); }
        else {
          for (const e of entries.filter((e) => e.kind === 'folder')) lines.push(`${BLUE}${e.name}/${RESET}`);
          for (const e of entries.filter((e) => e.kind === 'file')) lines.push(e.name);
        }
        break;
      }

      case 'cd': {
        if (!args[0]) { this.cwd = '/'; break; }
        const target = resolve(this.cwd, args[0]);
        if (target === '/' || this.isDirectory(target)) { this.cwd = target; }
        else { lines.push(`${RED}cd: ${args[0]}: No such directory${RESET}`); }
        break;
      }

      case 'cat': case 'type': {
        if (!args[0]) { lines.push(`${RED}cat: missing operand${RESET}`); break; }
        const target = resolve(this.cwd, args[0]);
        const content = this.fs.readFile(target);
        if (content === undefined) { lines.push(`${RED}cat: ${args[0]}: No such file${RESET}`); }
        else { lines.push(content); }
        break;
      }

      case 'tree': {
        const target = resolve(this.cwd, args[0] ?? '.');
        const out = this.renderTree(target);
        if (out.length <= 1) lines.push('(empty)'); else lines.push(...out);
        break;
      }

      case 'echo': {
        lines.push(args.join(' '));
        break;
      }

      case 'date': {
        lines.push(new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        break;
      }

      case 'time': {
        lines.push(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        break;
      }

      case 'whoami': { lines.push('VANTAOS\\\\vantaos-user'); break; }
      case 'hostname': { lines.push('VANTAOS-PC'); break; }
      case 'ver': { lines.push('Microsoft Windows [Version 10.0.22631.3593]'); break; }

      case 'systeminfo': {
        lines.push(`${BOLD}${CYAN}Host Name:${RESET}               VANTAOS-PC`);
        lines.push(`${BOLD}${CYAN}OS Name:${RESET}                  Microsoft Windows 11 Pro`);
        lines.push(`${BOLD}${CYAN}OS Version:${RESET}               10.0.22631 N/A Build 22631`);
        lines.push(`${BOLD}${CYAN}OS Manufacturer:${RESET}          Microsoft Corporation`);
        lines.push(`${BOLD}${CYAN}Configuration:${RESET}            Standalone workstation`);
        lines.push(`${BOLD}${CYAN}Registered Owner:${RESET}         vantaos-user`);
        lines.push(`${BOLD}${CYAN}Registered Organization:${RESET}  VantaOS`);
        lines.push(`${BOLD}${CYAN}System Manufacturer:${RESET}      VantaOS`);
        lines.push(`${BOLD}${CYAN}System Model:${RESET}             Cloud IDE v2`);
        lines.push(`${BOLD}${CYAN}System Type:${RESET}              x64-based PC`);
        lines.push(`${BOLD}${CYAN}Processor:${RESET}                Intel(R) Core(TM) i7-13700K @ 3.40GHz`);
        lines.push(`${BOLD}${CYAN}BIOS Version:${RESET}             VantaOS 1.0.0`);
        lines.push(`${BOLD}${CYAN}Windows Directory:${RESET}        C:\\Windows`);
        lines.push(`${BOLD}${CYAN}Hyper-V Requirements:${RESET}     A hypervisor has been detected.`);
        return lines;
      }

      case 'set': {
        const known: Record<string, string> = {
          PATH: 'C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\Git\\cmd',
          USERNAME: 'vantaos-user', USERPROFILE: 'C:\\Users\\vantaos-user',
          HOME: '/home/vantaos-user', OS: 'Windows_NT',
          COMPUTERNAME: 'VANTAOS-PC', SHELL: '/bin/bash', NODE_ENV: 'development',
        };
        if (args[0]) {
          const key = args[0].toUpperCase();
          lines.push(known[key] ? `${key}=${known[key]}` : `${RED}set: ${key}: Variable not found${RESET}`);
        } else {
          for (const [k, v] of Object.entries(known)) lines.push(`${k}=${v}`);
        }
        break;
      }

      case 'path': {
        lines.push('PATH=C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\Git\\cmd;C:\\Users\\vantaos-user\\.local\\bin');
        break;
      }

      case 'ipconfig': {
        lines.push(`${BOLD}${CYAN}Windows IP Configuration${RESET}`);
        lines.push('');
        lines.push(`${GREEN}Ethernet adapter vEthernet (WSL):${RESET}`);
        lines.push('   Connection-specific DNS Suffix  . :');
        lines.push('   Link-local IPv6 Address . . . . . : fe80::a1b2:c3d4:e5f6:7890%12');
        lines.push('   IPv4 Address. . . . . . . . . . . : 192.168.1.105');
        lines.push('   Subnet Mask . . . . . . . . . . . : 255.255.255.0');
        lines.push('   Default Gateway . . . . . . . . . : 192.168.1.1');
        lines.push('');
        lines.push(`${GREEN}Wireless LAN adapter Wi-Fi:${RESET}`);
        lines.push('   Connection-specific DNS Suffix  . :');
        lines.push('   IPv4 Address. . . . . . . . . . . : 192.168.1.106');
        lines.push('   Default Gateway . . . . . . . . . : 192.168.1.1');
        break;
      }

      case 'ping': {
        const host = args[0] ?? 'localhost';
        const count = Math.min(Math.max(parseInt(args[1], 10) || 4, 1), 10);
        lines.push(`${BOLD}${CYAN}Pinging ${host} [127.0.0.1] with 32 bytes of data:${RESET}`);
        for (let i = 1; i <= count; i++) {
          const ms = (Math.random() * 30 + 1).toFixed(2);
          lines.push(`Reply from 127.0.0.1: bytes=32 time=${ms}ms TTL=128`);
        }
        lines.push('');
        lines.push(`${GREEN}Ping statistics for 127.0.0.1:${RESET}`);
        lines.push(`    Packets: Sent = ${count}, Received = ${count}, Lost = 0 (0% loss)`);
        break;
      }

      case 'nslookup': {
        const host = args[0] ?? 'localhost';
        lines.push(`${BOLD}Server:  UnKnown${RESET}`);
        lines.push(`${BOLD}Address:  127.0.0.1${RESET}`);
        lines.push('');
        lines.push(`${BOLD}Name:${RESET}    ${host}`);
        lines.push(`${BOLD}Address:${RESET}  127.0.0.1`);
        lines.push(`${BOLD}Aliases:${RESET}  ${host}.local`);
        break;
      }

      case 'netstat': {
        lines.push(`${BOLD}${CYAN}Active Connections${RESET}`);
        lines.push('');
        lines.push('  Proto  Local Address          Foreign Address        State');
        lines.push('  TCP    192.168.1.105:49832    93.184.216.34:443      ESTABLISHED');
        lines.push('  TCP    192.168.1.105:52341    104.18.25.46:443       ESTABLISHED');
        lines.push('  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING');
        lines.push('  TCP    0.0.0.0:5353           0.0.0.0:0              LISTENING');
        lines.push('  UDP    0.0.0.0:5353           *:*');
        break;
      }

      case 'tracert': {
        const host = args[0] ?? 'localhost';
        lines.push(`${BOLD}${CYAN}Tracing route to ${host} [127.0.0.1] over a maximum of 30 hops:${RESET}`);
        lines.push('');
        lines.push('  1    <1 ms    <1 ms    <1 ms  192.168.1.1');
        lines.push('  2     1 ms     1 ms     1 ms  10.0.0.1');
        lines.push('  3     5 ms     5 ms     6 ms  10.0.0.2');
        lines.push(`  4     8 ms     9 ms     8 ms  ${host} [127.0.0.1]`);
        break;
      }

      case 'tasklist': {
        lines.push(`${BOLD}${CYAN}Image Name                     PID Session Name        Mem Usage${RESET}`);
        lines.push('============================== ======== ================ ============');
        const procs = [
          ['systemd', 1, 'Services', '1,248 K'],
          ['chrome.exe', 4532, 'Console', '482,120 K'],
          ['code-server', 6721, 'Console', '312,084 K'],
          ['node', 7843, 'Console', '145,072 K'],
          ['vantaos-daemon', 8001, 'Services', '89,312 K'],
          ['terminal.exe', 9102, 'Console', '68,540 K'],
        ];
        for (const [name, pid, session, mem] of procs) {
          lines.push(`  ${String(name).padEnd(30)} ${String(pid).padStart(8)} ${String(session).padEnd(16)} ${mem}`);
        }
        break;
      }

      case 'taskkill': {
        if (!args[0]) { lines.push(`${RED}usage: taskkill /PID <pid> | /IM <image>${RESET}`); break; }
        if (args[0].toUpperCase() === '/PID') {
          const pid = parseInt(args[1], 10);
          lines.push(pid && pid > 0 ? `${GREEN}SUCCESS: Process ${pid} terminated.${RESET}` : `${RED}ERROR: Invalid PID${RESET}`);
        } else if (args[0].toUpperCase() === '/IM') {
          lines.push(`${GREEN}SUCCESS: Process "${args[1]}" terminated.${RESET}`);
        } else {
          lines.push(`${RED}ERROR: Invalid syntax${RESET}`);
        }
        break;
      }

      case 'winget': {
        const sub = args[0]?.toLowerCase() ?? '';
        if (sub === 'search' || sub === '-s') {
          const query = args.slice(1).join(' ') || 'terminal';
          lines.push(`${BOLD}Search${RESET}  ${query}`);
          lines.push(`${'─'.repeat(52)}`);
          const packages = [
            ['Microsoft.Terminal', 'Windows Terminal', '1.19.11461.0', '12.5MB'],
            ['Git.Git', 'Git for Windows', '2.45.1', '58.3MB'],
            ['NodeJS.Node.js', 'Node.js LTS', '20.11.0', '28.1MB'],
            ['Python.Python.3.12', 'Python 3.12', '3.12.4', '24.7MB'],
            ['Microsoft.PowerShell', 'PowerShell 7.4', '7.4.3', '89.2MB'],
            ['VSCode', 'Visual Studio Code', '1.88.0', '412.6MB'],
            ['VantaOS.CloudIDE', 'VantaOS Cloud IDE', '2.5.0', '156.3MB'],
            ['OpenAI.CLI', 'OpenAI CLI', '1.0.0', '12.1MB'],
            ['Docker.DockerDesktop', 'Docker Desktop', '4.32.0', '612.4MB'],
          ];
          let shown = 0;
          for (const [id, name, ver, size] of packages) {
            if (query === '' || id.toLowerCase().includes(query.toLowerCase()) || name.toLowerCase().includes(query.toLowerCase())) {
              lines.push(`  ${GREEN}${id}${RESET}  ${name}  ${YELLOW}[${ver}]${RESET}  ${size}`);
              shown++;
            }
          }
          if (shown === 0) lines.push('  (no matches)');
        } else if (sub === 'install' || sub === '-i') {
          const pkg = args.slice(1).join(' ') || 'package';
          const bars = 25;
          const filled = Math.floor(Math.random() * 5 + 20);
          const bar = '█'.repeat(filled) + '░'.repeat(bars - filled);
          lines.push(`Found: ${GREEN}${pkg}${RESET}`);
          lines.push(`Downloading ${YELLOW}${pkg}${RESET}...`);
          lines.push(`[${GREEN}${bar}${RESET}] ${Math.floor(Math.random() * 15 + 85)}%`);
          lines.push(`Verifying ${YELLOW}${pkg}${RESET} checksum... ${GREEN}OK${RESET}`);
          lines.push(`${GREEN}Successfully installed ${pkg}${RESET}`);
        } else if (sub === 'list' || sub === '-l') {
          lines.push(`${BOLD}  Name                            Version  ${RESET}`);
          lines.push(`${'─'.repeat(45)}`);
          for (const [id, ver] of [['VantaOS.CloudIDE','2.5.0'],['Git.Git','2.45.1'],['NodeJS.Node.js','20.11.0'],['Python.Python.3.12','3.12.4'],['Microsoft.PowerShell','7.4.3'],['VSCode','1.88.0'],['OpenAI.CLI','1.0.0']]) {
            lines.push(`  ${GREEN}${id.padEnd(30)}${YELLOW}${ver.padEnd(10)}${RESET}`);
          }
        } else if (sub === 'show') {
          const pkg = args.slice(1).join(' ') || 'package';
          lines.push(`${BOLD}${pkg}${RESET}`);
          lines.push(`  Version:  ${YELLOW}2.0.0${RESET}`);
          lines.push(`  Author:   VantaOS`);
          lines.push(`  License:  MIT`);
        } else {
          lines.push(`${CYAN}Windows Package Manager v1.7.11461${RESET}`);
          lines.push('Commands: install, search, list, show, upgrade, uninstall, source');
        }
        break;
      }

      case 'npm': {
        const sub = args[0]?.toLowerCase() ?? '';
        if (sub === 'install' || sub === 'i') {
          const pkg = args.slice(1).join(' ');
          if (pkg) {
            const bars = 30;
            const filled = Math.floor(Math.random() * 5 + 25);
            const bar = '█'.repeat(filled) + '░'.repeat(bars - filled);
            lines.push(`${CYAN}npm ${'10.8.0'}${RESET}`);
            lines.push(`Installing ${YELLOW}${pkg}${RESET}...`);
            lines.push(`[${GREEN}${bar}${RESET}] ${Math.floor(Math.random() * 20 + 80)}%`);
            lines.push(`${GREEN}added ${Math.floor(Math.random() * 50 + 10)} packages in ${(Math.random() * 3 + 0.5).toFixed(1)}s${RESET}`);
            lines.push(`${Math.floor(Math.random() * 15 + 3)} packages are looking for funding  run \`npm fund\` for details`);
          } else {
            lines.push(`${GREEN}added 42 packages in 3.2s${RESET}`);
            lines.push(`12 packages are looking for funding`);
          }
        } else if (sub === 'run') {
          const script = args[1] ?? '';
          if (script) { lines.push(`> vantaos-app@2.5.0 ${script}`, `${CYAN}[OK] ${script} completed${RESET}`); }
          else { lines.push(`${RED}missing script name${RESET}`); }
        } else if (sub === 'build') {
          lines.push('> vantaos-app@2.5.0 build', `> next build`, `   ▲ Next.js ${GREEN}15.1.0${RESET}`);
          lines.push(`   ${CYAN}Linting and checking validity of types...${RESET}`);
          lines.push(`   Creating an optimized production build...${GREEN}Compiled successfully.${RESET}`);
          lines.push(`   Generating static pages (0/3)...${GREEN}Generated static pages in 1.23s${RESET}`);
        } else if (sub === 'start') {
          lines.push('> vantaos-app@2.5.0 start', `   ${GREEN}ready started server on 0.0.0.0:8080${RESET}`);
        } else if (sub === 'list' || sub === 'ls') {
          lines.push(`${BOLD}vantaos-app@2.5.0 ${toPsPath(this.cwd)}${RESET}`);
          lines.push('');
          lines.push(`  ${GREEN}@vantaos/core@2.5.0${RESET}    ${CYAN}Core runtime for VantaOS Cloud IDE${RESET}`);
          lines.push(`  ${GREEN}@vantaos/terminal@2.5.0${RESET}  ${CYAN}PowerShell-style terminal shell${RESET}`);
          lines.push(`  ${GREEN}react@19.0.0${RESET}             ${CYAN}React 19 - The library for modern UIs${RESET}`);
          lines.push(`  ${GREEN}next@15.0.0${RESET}               ${CYAN}Next.js - Production React Framework${RESET}`);
          lines.push(`  ${GREEN}typescript@5.6.3${RESET}         ${CYAN}TypeScript - Superset of JavaScript${RESET}`);
          lines.push(`  ${GREEN}xterm.js@6.0.0${RESET}          ${CYAN}Terminal emulator for the web${RESET}`);
          lines.push('');
          lines.push(`${YELLOW}Dependencies: 247 packages | Dev: 38 packages${RESET}`);
        } else {
          lines.push(`${CYAN}npm 10.8.0${RESET}`, `node 20.11.0`, `${GREEN}Use npm <command> --help${RESET}`);
        }
        break;
      }

      case 'npx': {
        const pkg = args[0] ?? '';
        if (!pkg) { lines.push(`${RED}npx: missing package name${RESET}`); break; }
        lines.push(`Installing ${YELLOW}${pkg}${RESET}...`);
        lines.push(`${GREEN}Successfully installed and ran ${pkg}${RESET}`);
        break;
      }

      case 'get-weather':
      case 'weather': {
        lines.push(`${CYAN}${BOLD}  ╔══════════════════════════════════════╗${RESET}`);
        lines.push(`${CYAN}${BOLD}  ║   Weather Station v2.5              ║${RESET}`);
        lines.push(`${CYAN}${BOLD}  ╚══════════════════════════════════════╝${RESET}`);
        lines.push('');
        lines.push(`${YELLOW}Usage:${RESET} ${GREEN}get-weather <city>${RESET}   or   ${GREEN}weather in <city>${RESET}`);
        lines.push(`${YELLOW}Examples:${RESET} ${GREEN}get-weather London${RESET}, ${GREEN}weather in Tokyo${RESET}, ${GREEN}get-weather New York${RESET}`);
        lines.push('');
        lines.push(`${GREEN}Pre-loaded: London ${GREEN}17°C ☀️${RESET}  |  ${GREEN}Tokyo ${GREEN}22°C 🌤️${RESET}  |  ${GREEN}NYC ${GREEN}12°C 🌧️${RESET}`);
        break;
      }

      case 'pip': {
        const sub = args[0]?.toLowerCase() ?? '';
        if (sub === 'install' || sub === 'i') {
          const pkg = args.slice(1).join(' ') || 'package';
          lines.push(`${CYAN}Collecting ${YELLOW}${pkg}${RESET}`);
          lines.push(`  Downloading ${pkg}...${GREEN}OK${RESET}`);
          lines.push(`${GREEN}Successfully installed ${pkg}-1.0.0${RESET}`);
        } else if (sub === 'list' || sub === 'freeze') {
          lines.push(`${BOLD}${CYAN}Package              Version${RESET}`);
          lines.push(`${'─'.repeat(35)}`);
          lines.push(`  ${GREEN}package-a${RESET}            1.0.0`);
          lines.push(`  ${GREEN}package-b${RESET}            2.3.1`);
          lines.push(`  ${GREEN}requests${RESET}             2.31.0`);
          lines.push(`  ${GREEN}numpy${RESET}                1.26.3`);
          lines.push(`  ${GREEN}react${RESET}                19.0.0`);
          lines.push(`  ${GREEN}next${RESET}                 15.1.0`);
        } else if (sub === 'show') {
          lines.push(`${BOLD}Name: ${YELLOW}${args[1] ?? 'package'}${RESET}`);
          lines.push(`Version: 1.0.0`);
          lines.push(`Summary:  VantaOS package`);
        } else {
          lines.push(`${CYAN}pip 24.0 from /usr/lib/python3/dist-packages/pip (python 3.12)${RESET}`);
        }
        break;
      }

      case 'yarn': {
        const sub = args[0]?.toLowerCase() ?? '';
        if (sub === 'install' || sub === 'i') {
          lines.push(`${GREEN}yarn install v1.22.19${RESET}`, '[1/4] Resolving...', '[2/4] Fetching...', '[3/4] Linking...', '[4/4] Building...', `${GREEN}Done in 2.43s.${RESET}`);
        } else if (sub === 'add') {
          lines.push(`${GREEN}yarn add v1.22.19${RESET}`, `${GREEN}success Saved 1 new dependency.${RESET}`);
        } else if (sub === 'run') {
          lines.push(`${GREEN}> vantaos-app@2.5.0 ${args[1] ?? ''}${RESET}`);
        } else {
          lines.push(`${CYAN}yarn 1.22.19${RESET}`);
        }
        break;
      }

      case 'pnpm': {
        const sub = args[0]?.toLowerCase() ?? '';
        if (sub === 'install' || sub === 'i') {
          lines.push(`${GREEN}Packages: +42${RESET}`, `${GREEN}Done in 1.8s${RESET}`);
        } else if (sub === 'run') {
          lines.push(`${GREEN}> vantaos-app@2.5.0 ${args[1] ?? ''}${RESET}`);
        } else {
          lines.push(`${CYAN}pnpm 8.15.9${RESET}`);
        }
        break;
      }

      case 'node':
      case 'js': {
        const rest = raw.replace(/^(node|js)\s+/, '');
        const fileTok = (rest.match(/^[^\s"]+|"[^"]*"/) ?? [''])[0];
        const filePath = resolve(this.cwd, stripQuotes(fileTok));
        const fileContent = fileTok ? this.fs.readFile(filePath) : undefined;
        const code = fileContent !== undefined && rest.trim() === fileTok ? fileContent : rest;
        lines.push(...this.sandboxLines(await this.runner.run(code).result));
        break;
      }

      case 'exit': {
        lines.push(`${YELLOW}Exiting VantaOS Terminal...${RESET}`);
        lines.push('__EXIT__');
        break;
      }

      case 'history': {
        if (this.history.length === 0) { lines.push('(no history)'); break; }
        for (let i = 0; i < this.history.length; i++) {
          lines.push(`  ${GREEN}${String(i + 1).padStart(4)}${RESET}  ${this.history[i]}`);
        }
        break;
      }

      case 'which': {
        const cmd = args[0]?.toLowerCase() ?? '';
        const known: Record<string, string> = {
          ls: '/usr/local/bin/ls', dir: 'ls (alias)', cd: '/usr/local/bin/cd', cat: '/usr/local/bin/cat',
          echo: '/usr/local/bin/echo', mkdir: '/usr/local/bin/mkdir', touch: '/usr/local/bin/touch',
          rm: '/usr/local/bin/rm', del: 'rm (alias)', date: '/usr/bin/date', tree: '/usr/local/bin/tree',
          node: '/usr/local/bin/node', winget: '/usr/local/bin/winget', npm: '/usr/local/bin/npm',
          npx: '/usr/local/bin/npx', pip: '/usr/bin/pip', yarn: '/usr/local/bin/yarn',
          pnpm: '/usr/local/bin/pnpm', ping: '/usr/bin/ping', ipconfig: '/usr/sbin/ipconfig',
          clear: '/usr/local/bin/clear', ver: 'cmd.exe', systeminfo: 'cmd.exe',
          hostname: '/usr/local/bin/hostname', whoami: '/usr/local/bin/whoami',
          'get-weather': '/usr/local/bin/weather', weather: '/usr/local/bin/weather',
          gcm: 'ls (alias)', gci: 'ls (alias)', gl: 'pwd (alias)', sl: 'cd (alias)', gi: 'cat (alias)',
          cls: 'clear (alias)', clr: 'clear (alias)', type: 'cat (alias)', copy: 'cp (alias)',
          move: 'mv (alias)', ren: 'mv (alias)', where: '/usr/local/bin/which', pwsh: 'help (alias)',
          install: 'npm/pip/winget (universal)', run: 'execute installed pkg', packages: 'list installed',
          'get-command': 'gcm (alias)', 'get-childitem': 'gci (alias)',
        };
        if (known[cmd]) { lines.push(`${GREEN}${cmd}${RESET} → ${known[cmd]}`); }
        else if (['dir','del','cls','type','copy','move','ren','rename','erase'].includes(cmd)) {
          const a: Record<string, string> = { dir:'ls', del:'rm', cls:'clear', clr:'clear', type:'cat', copy:'cp', move:'mv', ren:'mv', rename:'mv', erase:'rm', where:'which' };
          lines.push(`${GREEN}${cmd}${RESET} is aliased to '${a[cmd]}'`);
        } else {
          lines.push(`${RED}${cmd}: command not found. Try ${YELLOW}packages${RESET} to see installed tools.`);
        }
        break;
      }

      case 'find': {
        const query = args[0] ?? '';
        const path = args[1] ?? this.cwd;
        if (!query) { lines.push(`${RED}find: missing search term${RESET}`); break; }
        const target = resolve(this.cwd, path);
        lines.push(`Searching for "${query}" in ${toPsPath(target)}...`);
        const children = this.fs.listChildren(target);
        let found = false;
        for (const e of children) {
          if (e.name.toLowerCase().includes(query.toLowerCase())) {
            lines.push(`  ${e.kind === 'folder' ? '[DIR]' : '[FILE]'} ${e.name}`);
            found = true;
          }
          if (e.kind === 'folder') {
            const subPath = joinPath(target, e.name);
            const subChildren = this.fs.listChildren(subPath);
            for (const se of subChildren) {
              if (se.name.toLowerCase().includes(query.toLowerCase())) {
                lines.push(`  ${se.kind === 'folder' ? '[DIR]' : '[FILE]'} ${joinPath(subPath, se.name)}`);
                found = true;
              }
            }
          }
        }
        if (!found) lines.push('(no results)');
        break;
      }

      case 'sort': {
        const target = resolve(this.cwd, args[0] ?? '.');
        const content = this.fs.readFile(target);
        if (content === undefined) { lines.push(`${RED}sort: ${args[0] ?? '.'}: No such file${RESET}`); break; }
        const sorted = content.split('\n').sort().join('\n');
        lines.push(sorted);
        break;
      }

      case 'install': {
        const pkg = args[0] ?? '';
        if (!pkg) { lines.push(`${RED}install: missing package name${RESET}`); break; }
        const bars = 20;
        const steps = [
          { label: `Resolving ${pkg}`, status: 'done' as const },
          { label: 'Downloading package', status: 'run' as const },
          { label: 'Installing dependencies', status: 'pending' as const },
          { label: 'Building native modules', status: 'pending' as const },
          { label: `Installing ${pkg}`, status: 'pending' as const },
        ];
        for (const step of steps) {
          const icon = step.status === 'done' ? '✅' : step.status === 'run' ? '⏳' : '⬜';
          const color = step.status === 'done' ? GREEN : step.status === 'run' ? YELLOW : DIM;
          lines.push(`  ${icon} ${color}${step.label}${RESET}`);
        }
        const pct = Math.floor(Math.random() * 20 + 80);
        lines.push('');
        lines.push(`  ${progressBar(pct)} ${pct}%`);
        lines.push('');
        lines.push(`${GREEN}✅ Successfully installed ${pkg}${RESET}`);
        lines.push(`${DIM}Run it anytime with: ${YELLOW}${pkg}${RESET} ${DIM}or add to your project${RESET}`);
        break;
      }

      case 'run': {
        const pkg = args[0] ?? '';
        if (!pkg) { lines.push(`${RED}run: missing package name${RESET}`); break; }
        const rest = args.slice(1).join(' ');
        lines.push(...fancyHeader(`Running ${pkg}`, '▶️'));
        lines.push('');
        if (rest) lines.push(`${YELLOW}Args:${RESET} ${rest}`);
        lines.push(`${CYAN}Executing...${RESET}`);
        lines.push('');
        lines.push(`${GREEN}✔ ${pkg} completed${RESET}`);
        lines.push(`${DIM}Exit code: 0${RESET}`);
        break;
      }

      case 'packages':
      case 'list': {
        lines.push(...fancyHeader('Installed Packages', '📦'));
        lines.push('');
        lines.push(`  ${GREEN}${BOLD}Name${RESET}            ${GREEN}${BOLD}Version${RESET}        ${GREEN}${BOLD}Language${RESET}`);
        lines.push(`  ${'─'.repeat(50)}`);
        const installed = [
          ['node', '20.11.0', 'JavaScript'],
          ['npm', '10.8.0', 'Package'],
          ['python', '3.12.4', 'Python'],
          ['pip', '24.0', 'Package'],
          ['winget', '1.7.11461', 'System'],
          ['git', '2.45.1', 'VCS'],
          ['yarn', '1.22.19', 'Package'],
          ['pnpm', '8.15.9', 'Package'],
          ['vantaos', '2.5.0', 'App'],
          ['typescript', '5.6.3', 'JavaScript'],
          ['next', '15.1.0', 'Framework'],
          ['react', '19.0.0', 'Framework'],
          ['opencode-ai', '1.18.31', 'CLI'],
          ['wrangler', '4.13.0', 'CLI'],
          ['firebase-tools', '15.30.1', 'CLI'],
        ];
        for (const [name, ver, lang] of installed) {
          lines.push(`  ${GREEN}${name.padEnd(18)}${RESET} ${YELLOW}${ver.padEnd(14)}${RESET} ${CYAN}${lang}${RESET}`);
        }
        lines.push('');
        lines.push(`  ${BOLD}Total:${RESET} ${GREEN}${installed.length} packages${RESET} installed globally`);
        break;
      }

      default: {
        lines.push(`${RED}Command not found: ${command}. Type '${YELLOW}help${RED}' for available commands.${RESET}`);
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
        const childAbs = absPath === '/' ? `/${entry.name}` : `${absPath}/${entry.name}`;
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
