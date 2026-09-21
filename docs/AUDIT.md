# VantaOS Audit — Baseline Findings

> **Date:** 2026-09-21 · **Watch:** baseline-20260921 · **Method:** all items below observed live this session; `file:line` cited where relevant. Read-only audit — nothing in this file was changed.

## Labels
- **[FIX]** should fix (drift / risk / rot)
- **[NOTE]** observation, no action yet
- **[DONE]** already correct

## A. Documentation / build drift (pack §5)

### A1. static export vs standalone vs OpenNext — RESOLVED
Observed live: `next.config.mjs` has `output: 'standalone'`; `npm run build` runs `next build` then `opennextjs-cloudflare build --skipNextBuild` producing `.open-next/worker.js`; `wrangler.toml` deploys that worker. There is **no** static `out/` export path in the build.
- README still describes a "static export served from out/" — **[FIX]** stale.
- Playwright webServer runs `npx next build && npx next start -p 4173`. `next start` emitted: `⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.` Tests passed regardless, but the server is not exercising the standalone server.js the way wrangler will. **[FIX]** — align README, Playwright config, and package.json on one story (recommend OpenNext/worker as truth; run E2E against `wrangler dev` or standalone server.js).

### A2. Cache-Control headers — **[DONE]** wired
`npm run build` postbuild runs `node scripts/fix-cache.mjs` → "Fixed cache headers in _headers". The known `public, max-age=0, must-revalidate` bug on `/_next/static/*` is now patched at build time. Verify header bytes in Phase 1b.

### A3. ci.yml Node version
CI pins Node 22; local is Node 26.5.0. **[NOTE]** — verified both build green in this session, but keep pinned toolchains aligned to avoid drift.

## B. Tooling measurements

### B1. Circular dependencies — **[FIX]**
`npx madge --circular src app` → 2 cycles, both in telemetry:
1. `src/lib/telemetry/index.ts → src/lib/telemetry/logrocket.ts`
2. `src/lib/telemetry/index.ts → src/lib/telemetry/logrocket.ts → src/lib/telemetry/sentry.ts`
Risk: barrel-import cycle; verify it is lazy/chained and not a runtime init loop. Fix in a later phase, not Phase 0.

### B2. knip — unused code
- Unused files (21): includes `src/components/ConsolePanel.tsx`, `src/components/GitPanel.tsx`, `src/lib/plugins/feed.ts`, `src/lib/plugins/web-registry.ts`, `src/lib/server/rate-limit-durable.ts`, `src/lib/sync/transport.ts`, `src/lib/useToastEnhanced.ts`, `open-next.config.ts`, misc `scripts/phase*.mjs`, `assets/probes/*`. **[FIX]** — several are pack deliverables (Phase 4 transport/rate-limiter; Phase 5 panels) that are defined but never imported. Confirm dead-vs-to-be-wired before removing; nothing was removed.
- Unused dependencies (6): `@xterm/addon-search`, `@xterm/addon-web-links`, `@xterm/addon-webgl`, `date-fns`, `diff`, `node-forge`. **[FIX?]** — verify dynamic-import usage (xterm addons, diff) before dropping; see note 3 below.
- Unused devDependencies (4): `@lhci/cli`, `@next/bundle-analyzer`, `lighthouse`, `madge` (installed by this session as Phase 0 tooling — expected until Phase 1 uses them). **[NOTE]**
- Unused exports (57) incl. `PluginApiProvider`/`usePluginApi`/`createPluginApi` (src/lib/plugins/api-context.tsx:16/36/44) — confirmed never imported anywhere. **[FIX]**
- Duplicate exports (1): `useMotionTokens` / `useReducedMotionTokens` in `src/lib/motion/tokens.ts`. **[FIX]**
- Unlisted binaries: `firebase`, `make` referenced in package.json scripts but no tmp-provided binary. **[NOTE]**

### B3. Verified dead exports (grep-confirmed, not knip guesses)
- `createPluginApi`, `PluginApiProvider`, `usePluginApi` — defined only in api-context.tsx, imported nowhere.
- `createThread` (139), `createReply` (168), `setUpvote` (198), `subscribeThreads` (238), `subscribeReplies` (250) in `src/lib/firestore.ts` — RTDB forum layer never imported by any component.

## C. Architecture facts confirmed live
- **[DONE]** No Firestore: `firestore.rules` / `firestore.indexes.json` exist but nothing writes app data to Firestore; `src/lib/firestore.ts` is the RTDB client (`isFirestoreAvailable()` legacy alias preserved).
- **[DONE]** Homepage statically prerendered (○), no spinner gate observed in E2E home test.
- **[NOTE]** Worker bundle 6041 KiB raw / 1242 KiB gzip — check against Cloudflare subrequest/size limits in a deploy-phase gate; fine for dry-run.
- **[NOTE]** wrangler dry-run warns "Multiple environments defined… no target environment specified" — `wrangler.toml` has an env block; deploys should pass explicit `-e`. Not a defect, but pin it.

## D. Performance / measurement notes
- Home first-load 149 kB; shared 104 kB. No code splitting regressions observed vs prior lineage.
- Vitest jsdom created 86× (91s, 75% of run-time); `pool: 'vmThreads'` tip is a free test-time win. **[FIX]**
- No Lighthouse run in Phase 0 (pack Phase 1 owns the 100/100 target). **Not measured.**

## E. Rollback
Everything in Phase 0 was read-only + dev-tool additions. To revert the tooling: `git checkout -- package.json package-lock.json && npm ci`.