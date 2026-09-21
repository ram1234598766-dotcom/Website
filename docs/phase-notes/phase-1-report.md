# Phase 1 Report — Correctness & Performance (homepage first)

> **Date:** 2026-09-21 · **Branch:** `phase/1b-homepage` · **Base:** `b654434`
> **Commits:** `ebddb25` (feat home) · `b2da4ee` (chore lighthouse) · `4d5835d` (chore deps)
> **Scope:** make `/` render static SSR HTML with no spinner gate; Lighthouse Performance 100/100; keep the E2E home contract green. Not pushed, not deployed.

## SUMMARY
- `/` was gated behind a client-side spinner, so it shipped **no static SSR HTML** and paid the **full app bundle** on first load. `app/page.tsx` is now a static Server Component (hero, preview IDE, features, footer, nav); the interactive shell moved to a new **`/ide`** route (client-only, `dynamic(ssr:false)`).
- `src/App.tsx` gained an `initialView` prop so the IDE shell can be mounted at `/ide` without behavioral change to in-app navigation.
- Rewrote all six IDE-related E2E flows to `goto('/ide')`; `home.test.ts` left **untouched** (only the duplicate-CTA label in `app/page.tsx` changed, so its single-element assertion stays valid).
- Added `scripts/lighthouse-run.cjs`; Lighthouse **Performance 100/100** on `/` (desktop).
- Removed the unused Phase-0 dev tooling `@lhci/cli`, which was the sole source of **7 high** audit findings; the CI audit gate is green again.

## FILES
- `app/page.tsx` — rewritten as a static SSR homepage; banner CTA relabelled "Launch the IDE" so "Get Started for Free" is unique.
- `app/ide/page.tsx` — **new**: `'use client'`, `dynamic(() => import('../../src/App'), { ssr: false })` with the former spinner as `loading`, renders `<VantaApp initialView="ide" />`.
- `src/App.tsx` — `initialView` prop (`useState<ViewState>(initialView)`).
- `tests/e2e/flows/auth.test.ts` — `goto('/ide')`.
- `tests/e2e/flows/files.test.ts` — `goto('/ide')`.
- `tests/e2e/flows/ide-run.test.ts` — `goto('/ide')`.
- `tests/e2e/flows/ide.test.ts` — `goto('/ide')`, dropped the nav hop + 2s sleep.
- `tests/e2e/flows/omni-ai.test.ts` — `goto('/ide')`.
- `tests/e2e/flows/terminal.test.ts` — both tests `goto('/ide')`.
- `tests/e2e/flows/home.test.ts` — **not modified** (contract preserved).
- `scripts/lighthouse-run.cjs` — **new**: drives the Lighthouse CLI (Chrome launch), derives HTML from the JSON LHR, exits non-zero below `LH_MIN_PERF` (default 100).
- `package.json`, `package-lock.json` — removed `@lhci/cli`.
- `docs/phase-notes/phase-1-report.md` — **new** (this file); `docs/phase-notes/WORKLOG.md` extended.

## PACKAGES
- **Removed:** `@lhci/cli` `^0.15.1` (dev-only). Its subtree removed with it: nested `lighthouse@12.6.1`, `puppeteer-core`, `extract-zip`, `tmp`, `inquirer`, `external-editor`, `uuid`. Lockfile −2933 lines. **No runtime bundle impact.**
- Added/upgraded: none.
- KB delta (First Load JS): `/` **−45 kB** (see METRICS); `/ide` unchanged app shell.

## COMMANDS
| Command | Result |
|---|---|
| `npm run lint` | **exit 0** (tsc --noEmit) |
| `CI=1 npx vitest run` | **1317/1317 passed, 86 files**, 179.20s |
| `npm run build` | **exit 0** — `/` = 179 B / 104 kB (static `○`); `/ide` = 1.76 kB / 105 kB; shared 104 kB; worker written to `.open-next/worker.js` |
| `npx playwright test --config=tests/e2e/playwright.config.ts` | **9/9 passed**, 2.1m |
| `npx wrangler deploy --dry-run` | **exit 0** — Total Upload 6080.45 KiB / gzip 1245.83 KiB; 141 asset files; bindings `WORKER_SELF_REFERENCE`, `ASSETS` |
| `npm audit --audit-level=high` | **found 0 vulnerabilities** (exit 0) |
| `node scripts/lighthouse-run.cjs` (server on :3000) | **Performance 100/100**, `Gate passed`, exit 0 — artifacts in `scripts/_artifacts/` |
| `npm uninstall @lhci/cli --no-fund --no-audit` | removed; audit re-run clean |

## METRICS
| Metric | Before | After |
|---|---|---|
| `/` First Load JS | 3.02 kB page / **149 kB** (spinner gate) | 179 B page / **104 kB** |
| `/` rendering | client-gated spinner | static SSR `○` |
| Lighthouse Performance `/` | not measured (spinner-gated) | **100/100** |
| Unit tests | 1317/1317 (86 files) | 1317/1317 (86 files) |
| E2E | 9/9 | 9/9 |
| `npm audit --audit-level=high` | 7 high / 1 moderate / 2 low | **0** |
| Worker upload | 6041 KiB / 1242 KiB gzip (Phase 0) | 6080.45 KiB / 1245.83 KiB gzip |

The `149 kB → 104 kB` before-value was measured earlier in this effort via a stash build of the pre-Phase-1 tree.

## RISKS
- **Deep-linking `/` no longer opens the IDE** — users who bookmarked `/` now get the static homepage; the IDE lives at `/ide`. In-app navigation still routes there.
- `app/ide/page.tsx` spinner fallback uses `animation:'spin …'` but `@keyframes spin` is not defined in `app/globals.css` (only `vanta-spin`) → the loading fallback does not animate (cosmetic; see FINDINGS).
- Static footer uses `new Date().getFullYear()`, frozen at build time.
- **Rollback:** `git revert --no-edit 4d5835d b2da4ee ebddb25` (branch not pushed), or revert packages only: `git checkout -- package.json package-lock.json && npm ci`.

## FINDINGS
- `next start` warns: `"next start" does not work with "output: standalone" configuration.` — the README/"static export" vs `output:'standalone'` vs OpenNext drift flagged in AGENTS §5 and Phase 0 [A1] is unresolved; the E2E webServer still relies on `next start`. Untouched.
- `scripts/lighthouse-run.cjs` uses the Lighthouse CLI because Lighthouse 13's programmatic API only accepts an existing Puppeteer `page` (no auto-launch). `puppeteer-core`/`chrome-launcher` are nested, not top-level.
- `docs/AUDIT.md` still lists other unused devDeps (`@next/bundle-analyzer`, `madge`; `lighthouse` is now used) and 57 unused exports — out of scope here.
- Worker upload grew ~39 KiB vs Phase 0 (new `/ide` route + homepage SSR).

## BLOCKED
- None. All Phase 1 gate items pass on the frozen tree.
