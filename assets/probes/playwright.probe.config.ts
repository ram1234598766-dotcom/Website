import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Probe-only Playwright config.
 * Targets the already-running Next dev server on :3000 (override with PROBE_BASE_URL).
 * Runs the laptop/cloudos-button hit-test probe in strict serial order so the
 * module-level results array can be diffed in the FINAL test.
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: /(laptop-buttons-probe|omni-gear-scroll-repro)\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PROBE_BASE_URL || 'http://localhost:3000',
    hasTouch: false, // real mouse input everywhere (both viewports)
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});