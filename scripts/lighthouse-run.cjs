/**
 * Lighthouse run for the VantaOS homepage.
 *
 * Usage:
 *   1. Start the app server on port 3000 first (e.g. `npm run dev`, or
 *      `npx next build && npx next start -p 3000`).
 *   2. `node scripts/lighthouse-run.cjs`
 *
 * Lighthouse 13's programmatic API (`require('lighthouse')`) only takes an
 * existing Puppeteer page, so this drives the Lighthouse CLI, which launches
 * Chrome itself, then derives the HTML report from the JSON LHR.
 *
 * Exits non-zero when the Performance score is below LH_MIN_PERF so it can gate
 * CI. Writes the JSON + HTML reports to scripts/_artifacts/.
 */
'use strict';

const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const URL_TO_AUDIT = process.env.LH_URL || 'http://localhost:3000';
const MAX_PERF_SCORE = Number(process.env.LH_MIN_PERF ?? 100);
const ARTIFACTS_DIR = path.join(__dirname, '_artifacts');
const JSON_PATH = path.join(ARTIFACTS_DIR, 'lighthouse-home.json');
const HTML_PATH = path.join(ARTIFACTS_DIR, 'lighthouse-home.html');

function lighthouseCli() {
  // Resolve the CLI entry relative to the resolved package main.
  const main = require.resolve('lighthouse');
  return path.resolve(path.dirname(main), '..', 'cli', 'index.js');
}

function main() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, {recursive: true});
  }

  let cli;
  let generateReport;
  try {
    cli = lighthouseCli();
    generateReport = require('lighthouse').generateReport;
  } catch {
    console.error('lighthouse is not installed. Run `npm install` first.');
    process.exit(2);
  }
  if (!fs.existsSync(cli)) {
    console.error(`Lighthouse CLI not found at ${cli}. Run \`npm install\` first.`);
    process.exit(2);
  }

  console.log(`Auditing ${URL_TO_AUDIT} with Lighthouse (desktop, Performance floor ${MAX_PERF_SCORE})...`);

  const args = [
    cli,
    URL_TO_AUDIT,
    '--output=json',
    `--output-path=${JSON_PATH}`,
    '--only-categories=performance',
    '--preset=desktop',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage',
    '--quiet',
  ];

  const run = spawnSync(process.execPath, args, {stdio: 'inherit'});

  if (run.status !== 0 || !fs.existsSync(JSON_PATH)) {
    console.error(`Lighthouse CLI failed (exit ${run.status}). Is a server running on ${URL_TO_AUDIT}?`);
    process.exit(2);
  }

  const lhr = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  if (typeof generateReport === 'function') {
    fs.writeFileSync(HTML_PATH, generateReport(lhr, 'html'));
  }

  const displayPerf = Math.round(lhr.categories.performance.score * 100);
  console.log(`Performance score: ${displayPerf}/100`);
  console.log(`JSON report:  ${JSON_PATH}`);
  if (typeof generateReport === 'function') console.log(`HTML report:  ${HTML_PATH}`);

  if (displayPerf < MAX_PERF_SCORE) {
    console.error(
      `Gate failed: Performance ${displayPerf} is below required floor ${MAX_PERF_SCORE}. ` +
        `Open ${HTML_PATH} for the failure breakdown.`
    );
    process.exit(1);
  }

  console.log('Gate passed.');
}

main();
