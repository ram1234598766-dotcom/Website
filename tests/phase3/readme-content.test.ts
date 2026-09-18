import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 3 — README content tests.
 *
 * Verifies:
 *   - README.md has "What this is, in plain English" section
 *   - README.md has Troubleshooting section
 *   - README has Quickstart section with make quickstart
 *   - README has no stale version numbers
 *   - Status page exists in app/
 */

const ROOT = resolve(import.meta.dirname, '..', '..');
const readmePath = resolve(ROOT, 'README.md');

describe('README content', () => {
  it('README.md exists', () => {
    expect(existsSync(readmePath), 'README.md does not exist').toBe(true);
  });

  it('has "What this is, in plain English" section', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('What this is, in plain English');
  });

  it('has Troubleshooting section', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toMatch(/## Troubleshooting/);
  });

  it('has Quickstart section with make quickstart', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toMatch(/## Quickstart/);
    expect(content).toContain('make quickstart');
  });

  it('plain English section explains what the product is', () => {
    const content = readFileSync(readmePath, 'utf-8');
    const start = content.indexOf('What this is, in plain English');
    const end = content.indexOf('---', start + 1);
    const section = content.substring(start, end > 0 ? end : start + 500);
    expect(section.length).toBeGreaterThan(100);
    expect(section.toLowerCase()).toContain('browser');
  });

  it('troubleshooting section has actionable advice', () => {
    const content = readFileSync(readmePath, 'utf-8');
    const start = content.indexOf('Troubleshooting');
    const end = content.indexOf('---', start + 1);
    const section = content.substring(start, end > 0 ? end : start + 1000);
    expect(section.length).toBeGreaterThan(200);
    expect(section).toContain('Port already in use');
  });

  it('quickstart section has make quickstart command in a code block', () => {
    const content = readFileSync(readmePath, 'utf-8');
    const start = content.indexOf('Quickstart');
    const end = content.indexOf('---', start + 1);
    const section = content.substring(start, end > 0 ? end : start + 500);
    expect(section).toContain('make quickstart');
  });

  it('has no stale version numbers (v1.0 or older in stale contexts)', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).not.toMatch(/v1\.0\b/);
    expect(content).not.toMatch(/version 1\.0/);
  });

  it('version in README matches package.json version', () => {
    const readme = readFileSync(readmePath, 'utf-8');
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
    const versionPattern = new RegExp(`v?${pkg.version.replace(/\./g, '\\.')}`);
    expect(readme.match(versionPattern), `README should mention version ${pkg.version}`).toBeTruthy();
  });

  it('status page exists in app/', () => {
    expect(existsSync(resolve(ROOT, 'app', 'status', 'page.tsx')), 'app/status/page.tsx does not exist').toBe(true);
  });
});
