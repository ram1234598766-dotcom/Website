# Phase 2 Report — Security fixes

> **Date:** 2026-09-21 · **Branch:** `phase/2-security` · **Base:** `e3e266e`
> **Commits:** `0a81b16` (fix rules) · `4323bc4` (chore test:rules) · `f0d9197` (fix auth gate)
> **Scope:** harden `database.rules.json`, fail closed when Firebase is unconfigured, verify no secrets in `wrangler.toml` `[vars]`, make the emulator-backed rules suite runnable. Not pushed, not deployed, not `firebase deploy`ed.

## SUMMARY
- `database.rules.json` accepted writes it should have denied. Two write rules used the always-true ternary `(!data.exists() || newData.exists() ? true : …)`, and both update validators only checked that immutable fields were **absent** — any authenticated user could rewrite another author's post or set arbitrary counter values. Write rules now express intent explicitly (create any authed / update any authed / delete author-only), updates must **freeze** `title`, `content`, `category`, `author_id`, `author_username`, `created_at`, and counters may only move by the documented deltas (`upvotes_count` ±1, `replies_count` +1, one at a time, never negative).
- Added `replies` `.indexOn: ["thread_id"]` and a root `profiles` `.read` so the app's ordered query and the admin metric count are authorised by rule rather than failing on a missing index/read.
- **Auth was verified, not assumed:** `verifyFirebaseIdToken` was already called on all four token routes, but each wrapped `projectId(env)`, which **throws** when `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is unset (the default first-run/demo mode). The throw was swallowed by the outer catch-all, so demo mode answered a misleading **500**. A server-safe `isFirebaseConfigured(env)` + `requireFirebaseConfig(env, requestId)` now gate the four sites and return **503 `firebase_not_configured`** without fetching JWKS.
- `wrangler.toml` `[vars]` is **comment-only** — verified, no change needed; all seven Firebase/R2 values plus `GEMINI_API_KEY` are documented as `wrangler secret put` targets. No secret is committed.
- The rules contract is now runnable: `npm run test:rules` boots the RTDB emulator and runs `tests/rules/database-rules.test.ts`. Before: **30/34**; after: **34/34**.

## FILES
- `database.rules.json` — explicit create/update/delete write rules; frozen immutable fields on update; counter deltas constrained to ±1 / +1 and `>= 0`; create pins counters to `0`; added `threads`/`replies` validators mirroring the client shape, `replies .indexOn: ["thread_id"]`, root `profiles .read`.
- `src/lib/server/api-router.ts` — added server-safe `isFirebaseConfigured(env)` and `requireFirebaseConfig(env, requestId)`; gated the four `verifyFirebaseIdToken` call sites (`/api/edge-functions/auth-sync`, `/api/gh/authorize`, `/api/gh/import`, `/api/gh/session`). Deliberately does **not** import the client `src/lib/firebase.ts` (that module pulls the Firebase SDK and must stay client-only).
- `tests/phase2/firebase-auth-gate.test.ts` — **new**: 10 cases; all four routes fail closed with 503 in demo mode, never call `fetch` (JWKS skipped), treat `''` as unconfigured, and 401 a malformed token when configured.
- `package.json` — added `test:rules` (emulator `exec` wrapping `vitest run --config vitest.rules.config.ts`).
- `docs/phase-notes/phase-2-report.md` — **new** (this file); `docs/phase-notes/WORKLOG.md` extended.

## PACKAGES
- Added/removed/upgraded: **none**. The rules suite already had `@firebase/rules-unit-testing` + `firebase-tools`; `test:rules` only wires the existing emulator. Bundle impact: 0 kB.

## COMMANDS
| Command | Result |
|---|---|
| `npm test:rules` (before fix) | 4 failed \| 30 passed (34) — non-author counter writes and whole-node `profiles` read denied |
| `npx vitest run tests/phase2/firebase-auth-gate.test.ts` | **10/10 passed**, 3.63s |
| `npm run test:rules` (after fix) | **34/34 passed**, 5.18s, script exit 0, emulator shut down |
| `npm run lint` | **exit 0** (tsc --noEmit) |
| `CI=1 npm test` | **1327/1327 passed, 87 files**, 169.64s |
| `npm run build` | **exit 0** — Next + OpenNext; worker written to `.open-next/worker.js` |
| `npx playwright test --config=tests/e2e/playwright.config.ts` | **9/9 passed**, 2.7m |
| `npx wrangler deploy --dry-run` | **exit 0** — Total Upload 6080.91 KiB / gzip 1246.22 KiB; 144 asset files; bindings `WORKER_SELF_REFERENCE`, `ASSETS` |
| `npm audit --audit-level=high` | **found 0 vulnerabilities** (exit 0) |

## METRICS
| Metric | Before | After |
|---|---|---|
| Rules suite (`npm run test:rules`) | 30/34 (4 failing) | **34/34** |
| Unit tests | 1317/1317 (86 files) | 1327/1327 (87 files) |
| Token routes in demo mode | 500 `Internal server error` | 503 `firebase_not_configured` |
| JWKS fetch without Firebase config | attempted | **not called** |
| `npm audit --audit-level=high` | 0 | 0 |
| Worker upload | 6080.45 KiB / 1245.83 KiB gzip | 6080.91 KiB / 1246.22 KiB gzip |

The rules before/after was captured by running the same suite against the pre-fix and post-fix `database.rules.json`.

## RISKS
- **Stricter update validation** now requires existing threads/replies to carry the immutable fields and non-negative counters. Legacy rows that predate `author_username`/counters compare `null === null` (allowed), but a row with genuinely malformed counters can no longer be updated until corrected. Client writes were checked against the rules suite; live data was not inspected.
- **Demo mode now returns 503, not 500,** on the four token routes. Callers that special-cased 500 will see the new status; the demo experience itself is unchanged (these routes never worked without Firebase config).
- **Rollback:** `git revert --no-edit f0d9197 4323bc4 0a81b16` (branch not pushed, no deploy).

## FINDINGS
- **AGENTS §5 deploy-story drift — RESOLVED (docs-only, `5e7ac60`).** The four sources now agree: `next.config.mjs` is `output: 'standalone'` (with an inline build-story comment), `package.json` builds via `next build` + `opennextjs-cloudflare build`, `wrangler.toml` packages `.open-next/worker.js`, and there is no static `out/` export. README and CONTRIBUTING were corrected; Playwright's webServer is documented as `next build && next start -p 4173`. `next start` still prints `"next start" does not work with "output: standalone"`, but it serves the built app and E2E passes 9/9 — the webServer was deliberately left unchanged (switching to `node .next/standalone/server.js` requires copying `public`/`.next/static` and risks the gate).
- **Other docs still describe a static export** (not fixed — internal design/audit records, outside the four sources): `docs/ARCHITECTURE.md` (40, 76, 91, 131, 174, 529, 541, 734), `docs/TECH_STACK.md` (50, 59, 76, 92, 214, 253, 328), `docs/TECH_STACK_AUDIT_REPORT.md` (160, 176), `docs/WEB_MODEL_SPEC.md` (5, 35, 171, 326, 338, 340), `docs/SLO_RUNBOOK.md` (21, 139), `SECURITY.md` (4, 95), `public/_redirects` (1). `docs/AUDIT.md` A1 and `docs/PHASE3_DELIVERABLE.md` row 8 already record the truth.
- **Orphaned emulator `java.exe`.** An aborted `firebase emulators:exec` run left a listener on port 9000 (observed PID 11792, `jdk-26.0.2\bin\java.exe`) and the next run failed with "port taken". Detect/clear with `Get-NetTCPConnection -LocalPort 9000 -State Listen` then `Stop-Process -Id <pid> -Force`. Cleaned and re-ran: 34/34.
- **`JAVA_HOME` ≠ `java` on PATH (verified).** `JAVA_HOME=C:\Program Files\Java\jdk1.8.0_211` (JDK 8) while `java` on PATH is `C:\Program Files\Common Files\Oracle\Java\javapath\java.exe` = 26.0.2. The emulator runs on 26 and logs a benign `sun.misc.Unsafe` deprecation warning. Left as-is (environment, not repo).
- **16 `app/api/*` handlers — now read in full.** Resolved in Phase 2b (see `docs/phase-notes/WORKLOG.md`, "Phase 2b"): all 16 reviewed — 13 via the shared `handleApiRequest`, 4 standalone — with boundary fixes and new pinned tests on `phase/2b-api-hardening`.

## BLOCKED
- None. All Phase 2 gate items pass on the frozen tree.
