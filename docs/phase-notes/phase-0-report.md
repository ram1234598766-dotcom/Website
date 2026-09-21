# Phase 0 Report — Baseline (read-only)

> **Date:** 2026-09-21 · **Watch:** baseline-20260921 · **Branch:** phase/1b-homepage @ `33ce753`
> **Scope:** read-only verification of tooling + project health. No product code changed.

## Gate — all green (output recorded in `docs/BASELINE.md`)

| Check | Command | Result |
|---|---|---|
| Type gate | `npm run lint` | PASS |
| Tests | `CI=1 npx vitest run` | PASS — 1317/1317, 86 files |
| Build | `npm run build` | PASS — worker at `.open-next/worker.js` |
| E2E | `npx playwright test` | PASS — 9/9 |
| Deploy dry-run | `npx wrangler deploy --dry-run` | PASS |
| Audit | `npm audit --audit-level=high` | PASS — 0 |

## What was done
1. Reconciled repo state before starting (pack §5 "reconcile with reality"): a prior pack-v1 session had already created branches `vantaos/hardening` + `phase/0-recon` and tags `baseline-20260919/20` with a *different* plugin/sync implementation and no dashboard pages. The current lineage carries the verified-green Phase 4/5 deliverable. Chose the current `phase/1b-homepage` lineage as ground truth; left v1 branches/tags untouched.
2. Checkpointed the uncommitted Phase 4/5 work: `c0468d7` (25 files, +3078) so the baseline includes it.
3. Saved Block 0 as `AGENTS.md` (`81138fd`), re-applied the ignore decision for `/opencode`, `scripts/*`, test artifacts (`cec29f9`).
4. Tagged `baseline-20260921` at the known-good state.
5. Ran the full Phase 0 gate (above), installed dev tooling, ran madge + knip, verified dead exports with grep, wrote `docs/API.md` update + `docs/BASELINE.md` + `docs/AUDIT.md`.

## Findings for later phases (full list in docs/AUDIT.md)
- [A1] README static-export claim stale; `next start` warns against `output: standalone` in E2E webServer.
- [A2] Cache-Control now fixed at build time via `scripts/fix-cache.mjs` — verify bytes in Phase 1b.
- [B1] 2 circular deps in `src/lib/telemetry` (index → logrocket → sentry).
- [B2] 57 unused exports, incl. pack deliverables `PluginApiProvider`/`usePluginApi`/`createPluginApi` (never imported) — confirmed by grep.
- [B3] RTDB forum layer (`createThread/createReply/setUpvote/subscribeThreads/subscribeReplies`) never imported by any component.
- [B2] Duplicate exports `useMotionTokens`/`useReducedMotionTokens` in `src/lib/motion/tokens.ts:115`.
- [B4] 6 unused dependencies the pack assumes are used: `@xterm/addon-search`, `@xterm/addon-web-links`, `@xterm/addon-webgl`, `date-fns`, `diff`, `node-forge` — verify dynamic-import usage before dropping.
- [C] wrangler dry-run needs explicit `-e` (multi-env config warning); worker upload 6041 KiB / 1242 KiB gzip.
- [D] Vitest jsdom created 86× (75% of run time) — `pool:'vmThreads'` is a free test-speed win.

## Package changes
Added (dev-only, no runtime bundle impact): @next/bundle-analyzer 16.3.5, size-limit 14.0.0, @size-limit/file 14.0.0, lighthouse 13.5.0, @lhci/cli 0.15.1, madge 8.0.0, knip 6.37.0. Excluded @cloudflare/vitest-pool-workers 0.22.0 (peer-depends on vitest ^4; repo pins ^5).

## Rollback
`git checkout -- package.json package-lock.json && npm ci` reverts all tooling. Nothing else was risk-bearing.