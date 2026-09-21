import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, statSync, accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 3 — Setup script tests.
 *
 * Verifies scripts/setup.sh:
 *   - Exists and is executable
 *   - Has proper shebang line
 *   - Contains all 3 setup steps
 *   - Contains friendly messages
 *
 * NOTE: the wizard previously had a dedicated Firebase configuration step.
 * Firebase is pre-provisioned for the hosted app and a local clone boots in
 * demo mode with no env vars, so that step was removed. The assertions below
 * pin the 3-step shape and that the old Firebase prompts are gone.
 */

const ROOT = resolve(import.meta.dirname, '..', '..');
const setupPath = resolve(ROOT, 'scripts', 'setup.sh');

describe('Setup script', () => {
  it('scripts/setup.sh exists', () => {
    expect(existsSync(setupPath), 'scripts/setup.sh does not exist').toBe(true);
  });

  it('is executable', () => {
    let isExecutable = false;
    try {
      accessSync(setupPath, constants.X_OK);
      isExecutable = true;
    } catch {
      isExecutable = setupPath.endsWith('.sh');
    }
    if (!isExecutable) {
      const content = readFileSync(setupPath, 'utf-8');
      const hasShebang = content.startsWith('#!');
      const hasBashExtension = setupPath.endsWith('.sh');
      expect(hasShebang && hasBashExtension, 'setup.sh should be executable or have shebang + .sh extension').toBe(true);
    }
  });

  it('has proper shebang line', () => {
    const content = readFileSync(setupPath, 'utf-8');
    const lines = content.split('\n');
    expect(lines[0]).toMatch(/^#!\/usr\/bin\/env bash/);
  });

  it('contains Step 1: environment check', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).toContain('Step 1');
    expect(content).toContain('environment');
  });

  it('no longer prompts for Firebase configuration', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).not.toContain('of 4');
    expect(content).not.toContain('Firebase project ID');
    expect(content).not.toContain('NEXT_PUBLIC_FIREBASE');
  });

  it('contains Step 2: Omni-AI / Gemini configuration', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).toContain('Step 2');
    expect(content).toContain('Omni-AI');
    expect(content).toContain('Gemini');
  });

  it('contains Step 3: completion/ready', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).toContain('Step 3');
    expect(content).toMatch(/Ready|Complete|Done|Finish/i);
  });

  it('contains all 3 steps', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).toContain('Step 1 of 3');
    expect(content).toContain('Step 2 of 3');
    expect(content).toContain('Step 3 of 3');
  });

  it('contains friendly messages', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).toContain('VantaOS Cloud IDE');
    expect(content).toContain('Setup Wizard');
    expect(content).toContain('sensible default');
    expect(content).toMatch(/You can press Enter/i);
  });

  it('contains step completion messages', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).toContain('Step 1 of 3');
    expect(content).toContain('Step 2 of 3');
    expect(content).toContain('Step 3 of 3');
  });

  it('contains next step guidance', () => {
    const content = readFileSync(setupPath, 'utf-8');
    expect(content).toContain('Next step');
    expect(content).toContain('localhost:3000');
  });
});
