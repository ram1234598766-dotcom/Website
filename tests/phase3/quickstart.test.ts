import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 3 — Makefile quickstart test.
 *
 * Verifies:
 *   - Makefile exists and has quickstart target
 *   - `make help` shows all expected targets
 *   - package.json has quickstart script
 *   - package.json has setup script
 */

const ROOT = resolve(import.meta.dirname, '..', '..');
const makefilePath = resolve(ROOT, 'Makefile');
const packageJsonPath = resolve(ROOT, 'package.json');

describe('Makefile quickstart', () => {
  it('Makefile exists', () => {
    expect(existsSync(makefilePath), 'Makefile does not exist').toBe(true);
  });

  it('Makefile has quickstart target', () => {
    const content = readFileSync(makefilePath, 'utf-8');
    expect(content).toMatch(/^quickstart:/m);
  });

  it('quickstart target installs dependencies', () => {
    const content = readFileSync(makefilePath, 'utf-8');
    const match = content.match(/quickstart:[\s\S]*?(?=\n\n|\n[A-Za-z_-]+:)/);
    expect(match).toBeTruthy();
    const target = match[0];
    expect(target).toContain('npm ci');
  });

  it('quickstart target sets up environment', () => {
    const content = readFileSync(makefilePath, 'utf-8');
    const match = content.match(/quickstart:[\s\S]*?(?=\n\n|\n[A-Za-z_-]+:)/);
    expect(match).toBeTruthy();
    const target = match[0];
    expect(target).toContain('.env');
  });

  it('quickstart target starts dev server', () => {
    const content = readFileSync(makefilePath, 'utf-8');
    const match = content.match(/quickstart:[\s\S]*?(?=\n\n|\n[A-Za-z_-]+:)/);
    expect(match).toBeTruthy();
    const target = match[0];
    expect(target).toContain('npm run dev');
  });

  it('make help shows all expected targets', () => {
    const content = readFileSync(makefilePath, 'utf-8');
    expect(content).toMatch(/^help:/m);
    expect(content).toContain('dev:');
    expect(content).toContain('build:');
    expect(content).toContain('lint:');
    expect(content).toContain('test:');
    expect(content).toContain('deploy:');
    expect(content).toContain('quickstart:');
  });

  it('package.json has quickstart script', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    expect(pkg.scripts).toHaveProperty('quickstart');
    expect(pkg.scripts.quickstart).toContain('make quickstart');
  });

  it('package.json has setup script', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    expect(pkg.scripts).toHaveProperty('setup');
    expect(pkg.scripts.setup).toContain('scripts/setup.sh');
  });
});
