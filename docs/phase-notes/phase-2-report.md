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
- `next start` still warns that it does not work with `output: standalone` (AGENTS §5 / Phase 0 [A1]); the E2E webServer relies on it. Untouched.
- Orphaned `java.exe` RTDB emulator can hold port 9000 after an aborted run and make `emulators:exec` fail with "port taken". It exited cleanly on the successful run; noted for CI.
- `JAVA_HOME` points at JDK 8 while `java` on PATH is JDK 26; the emulator runs on 26 and logs a benign `sun.misc.Unsafe` deprecation warning.
- 16 `app/api/*` route handlers were only spot-checked (via `tests/backend/error-handling.test.ts` and `tests/phase3/api-consistency.test.ts`), not all read in full.

## BLOCKED
- None. All Phase 2 gate items pass on the frozen tree.
