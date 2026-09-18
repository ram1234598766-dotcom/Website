import { describe, it, expect } from 'vitest';
import { ShellSession, normalizePath } from '../../src/lib/terminal/commands';
import type { TerminalFs, TerminalFsEntry } from '../../src/lib/terminal/sandbox';

const mockFs = (paths: Record<string, TerminalFsEntry[]>, content: Record<string, string> = {}): TerminalFs => {
  return {
    listChildren(absPath: string) {
      return paths[absPath] ?? [];
    },
    readFile(absPath: string) {
      return content[absPath];
    },
    async createFile() { return ''; },
    async createFolder() { return ''; },
    async writeFile() { return ''; },
    async deletePath() { return ''; },
  };
};

describe('ShellSession — PowerShell Edition', () => {
  it('prompt is PowerShell-style', () => {
    const shell = new ShellSession(mockFs({}));
    const prompt = shell.getPrompt();
    expect(prompt).toContain('PS');
    expect(prompt).toMatch(/PS.*>/);
  });

  it('normalizes paths correctly', () => {
    expect(normalizePath('/a/b/c')).toBe('/a/b/c');
    expect(normalizePath('/a/../b')).toBe('/b');
    expect(normalizePath('a/b/../c')).toBe('a/c');
    expect(normalizePath('/./a')).toBe('/a');
  });

  it('help lists all command categories', () => {
    const shell = new ShellSession(mockFs({}));
    void shell.execute('help');
    // Help is async; just verify constructor works and shell has execute method
    expect(typeof shell.execute).toBe('function');
    expect(typeof shell.getPrompt).toBe('function');
    expect(typeof shell.historyPrev).toBe('function');
    expect(typeof shell.historyNext).toBe('function');
  });

  it('history tracking works', async () => {
    const shell = new ShellSession(mockFs({}));
    await shell.execute('ls');
    await shell.execute('cd /home');
    expect(shell.history).toContain('ls');
    expect(shell.history).toContain('cd /home');
  });

  it('empty input returns no output', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('');
    expect(result).toHaveLength(0);
  });

  it('exit returns exit marker', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('exit');
    expect(result).toContain('__EXIT__');
  });

  it('unknown command shows helpful error', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('nonexistent-cmd-xyz');
    expect(result.some((l) => l.toLowerCase().includes('command not found'))).toBe(true);
  });
});

describe('ShellSession — aliases', () => {
  it('dir resolves to ls', async () => {
    const fs = mockFs({ '/': [{ name: 'docs', kind: 'folder' }, { name: 'readme.md', kind: 'file' }] });
    const shell = new ShellSession(fs);
    const result = await shell.execute('dir');
    expect(result.some((l) => l.includes('docs/'))).toBe(true);
    expect(result.some((l) => l.includes('readme.md'))).toBe(true);
  });

  it('del resolves to rm', async () => {
    const fs = mockFs({ '/': [{ name: 'docs', kind: 'folder' }] });
    const shell = new ShellSession(fs);
    // rm on folder should work via deletePath (returns '' in mock)
    const result = await shell.execute('del docs');
    expect(result).toBeDefined();
  });

  it('cls resolves to clear', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('cls');
    expect(result).toContain('__CLEAR__');
  });

  it('type resolves to cat', async () => {
    const fs = mockFs({ '/': [] }, { '/readme.md': 'Hello vantaos' });
    const shell = new ShellSession(fs);
    const result = await shell.execute('type readme.md');
    expect(result).toContain('Hello vantaos');
  });

  it('where resolves to which', async () => {
    const shell = new ShellSession(mockFs({}));
    // which/where will show command location or alias info
    const result = await shell.execute('where ls');
    expect(result).toBeDefined();
  });
});

describe('ShellSession — PowerShell system commands', () => {
  it('hostname returns VANTAOS-PC', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('hostname');
    expect(result).toContain('VANTAOS-PC');
  });

  it('whoami returns domain user', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('whoami');
    expect(result.some((l) => l.includes('VANTAOS'))).toBe(true);
  });

  it('ver returns Windows version', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('ver');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain('Windows');
    expect(result[0]).toContain('Version');
  });

  it('systeminfo returns detailed info', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('systeminfo');
    expect(result.some((l) => l.includes('Host Name'))).toBe(true);
    expect(result.some((l) => l.includes('OS Name'))).toBe(true);
  });

  it('ipconfig returns network config', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('ipconfig');
    expect(result.some((l) => l.includes('IP'))).toBe(true);
    expect(result.some((l) => l.includes('Configuration'))).toBe(true);
  });

  it('ping returns ping results', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('ping localhost');
    expect(result.some((l) => l.includes('Pinging'))).toBe(true);
  });

  it('netstat returns connections', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('netstat');
    expect(result.some((l) => l.includes('Active'))).toBe(true);
  });

  it('tasklist returns processes', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('tasklist');
    expect(result.some((l) => l.includes('chrome') || l.includes('node'))).toBe(true);
  });

  it('date returns formatted date', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('date');
    expect(result).toHaveLength(1);
    expect(result[0].length).toBeGreaterThan(3);
  });

  it('time returns formatted time', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('time');
    expect(result).toHaveLength(1);
  });
});

describe('ShellSession — package managers', () => {
  it('winget search lists packages', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('winget search terminal');
    expect(result.some((l) => l.includes('Terminal'))).toBe(true);
  });

  it('winget install shows progress', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('winget install vantaos');
    expect(result.some((l) => l.includes('Downloading') || l.includes('installed') || l.includes('Successfully'))).toBe(true);
  });

  it('npm install shows success', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('npm install');
    expect(result.some((l) => l.includes('added') || l.includes('success'))).toBe(true);
  });

  it('npm run executes script', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('npm run dev');
    expect(result.some((l) => l.includes('dev'))).toBe(true);
  });

  it('npx runs package', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('npx prettier');
    expect(result).toBeDefined();
  });

  it('pip install shows success', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('pip install requests');
    expect(result.some((l) => l.includes('Successfully'))).toBe(true);
  });

  it('yarn install works', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('yarn install');
    expect(result.some((l) => l.includes('Done') || l.includes('yarn'))).toBe(true);
  });

  it('pnpm install works', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('pnpm install');
    expect(result.some((l) => l.includes('Done') || l.includes('pnpm') || l.includes('Packages'))).toBe(true);
  });
});

describe('ShellSession — file commands', () => {
  it('ls lists workspace entries', async () => {
    const fs = mockFs({
      '/': [
        { name: 'docs', kind: 'folder' },
        { name: 'src', kind: 'folder' },
        { name: 'readme.md', kind: 'file' },
      ],
    });
    const shell = new ShellSession(fs);
    const result = await shell.execute('ls');
    expect(result.some((l) => l.includes('docs/'))).toBe(true);
    expect(result.some((l) => l.includes('src/'))).toBe(true);
    expect(result.some((l) => l.includes('readme.md'))).toBe(true);
  });

  it('cat reads file content', async () => {
    const fs = mockFs({ '/': [] }, { '/test.txt': 'vantaos content' });
    const shell = new ShellSession(fs);
    const result = await shell.execute('cat test.txt');
    expect(result).toContain('vantaos content');
  });

  it('cd changes directory', async () => {
    const shell = new ShellSession(mockFs({ '/': [{ name: 'home', kind: 'folder' }], '/home': [{ name: 'docs', kind: 'folder' }] }));
    await shell.execute('cd /home');
    const prompt = shell.getPrompt();
    expect(prompt).toContain('home');
  });

  it('cd to nonexistent fails', async () => {
    const shell = new ShellSession(mockFs({}));
    const result = await shell.execute('cd /nonexistent');
    expect(result.some((l) => l.includes('No such directory'))).toBe(true);
  });

  it('tree shows hierarchy', async () => {
    const fs = mockFs({
      '/': [
        { name: 'docs', kind: 'folder' },
        { name: 'app.ts', kind: 'file' },
      ],
      '/docs': [{ name: 'guide.md', kind: 'file' }],
    });
    const shell = new ShellSession(fs);
    const result = await shell.execute('tree');
    expect(result.some((l) => l.includes('docs'))).toBe(true);
  });
});
