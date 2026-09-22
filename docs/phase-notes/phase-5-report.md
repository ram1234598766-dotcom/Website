# Phase 5 Report - Full graphical interface: scrub and gate

> **Date:** 2026-09-22 · **Branch:** `phase/5-graphical-interface` · **Base:** `ab7e0da`
> **Commits:** see `git log` on `phase/5-graphical-interface` (fix / test / docs, one logical change each)
> **Scope:** Phase 4 already replaced the mocked `wss://website.vasudevaya.workers.dev/api/status/stream` WS with real HTTP polling data; this phase removes the leftover phantom WebSocket blocks and the remaining visitor-visible Firebase identifiers from the `app/` pages, pins the no-hardcoded-data contract with a named test, and re-runs the full DoD gate. Not pushed, not deployed.

## SUMMARY
- **Removed the phantom WebSocket layer.** `/api/status/stream` exists nowhere server-side (`app/api/status/` has only `route.ts`; root `worker.ts` has no `new WebSocket`), so `app/dashboard/page.tsx` and `app/network/page.tsx` were creating dead `wss://website.vasudevaya.workers.dev/api/status/stream` sockets. Both now poll only (`/api/status` every 10s / 15s), `useRef`/`wsRef`/`wsConnected` and the "WS Live / Polling" indicator are gone, and the effect cleanup is a single `return () => clearInterval(interval);`. The phantom was misleading (suggested a live stream that cannot exist in the default demo-mode boot).
- **Scrubbed visitor-visible Firebase identifiers from the app pages** without touching internals: `app/security/page.tsx` ("Firebase Auth" card, the "Recent Auth Events" block that printed the project id `website-6e8b1`, the auth domain `website-6e8b1.firebaseapp.com`, and the `/__/auth/handler` redirect → rebranded "Security Configuration" with the `Shield` icon, keeping grant-type and rate-limit facts); `app/settings/page.tsx` (`Firebase (website-6e8b1)` provider label → "Cloud account", "Connected (Firebase)" → "Connected (cloud)"); `app/status/page.tsx` ("Connected (Firebase)" → "Connected (cloud)"); `app/email/page.tsx` ("Firebase project" banner → "cloud account", "Firebase · {uid}" → "Cloud · {uid}"); `app/messaging/page.tsx` and `app/notifications/page.tsx` demo banners → "cloud account"; `app/network/page.tsx` topology service label "Firebase" → "Cloud" and demo banner "signed-in Firebase account" → "signed-in cloud account".
- **No mock or hardcoded data confirmed everywhere.** Every `app/<page>/page.tsx` reads real boundaries: `app/dashboard` `/api/status`+`/api/models`+`/api/peers`, `app/network` `/api/status` + `subscribePresence`, `app/security` `/api/healthz?verbose=true` + `/api/gh/session`, `app/status` `/api/status`, `app/settings` `localStorage['vantaos-settings']`, `app/email` / `app/messaging` / `app/notifications` the RTDB mail/presence/direct-inbox/notifications streams (`src/lib/firestore.ts`).
- **Named test added:** `tests/phase5/no-hardcoded-ui-data.test.ts` - 20 cases asserting (a) none of ten forbidden literals (`website-6e8b1`, `firebaseapp.com`, `wss://website.vasudevaya`, `new WebSocket(`, `Firebase (website`, `Firebase ·`, `Connected (Firebase)`, `Firebase Auth`, `Configure a Firebase`, `signed-in Firebase account`) appears in any `app/<page>/page.tsx`, and (b) each page is wired to its real data source, plus (c) `app/api/**` contains no mock/seed fixtures.
- **No packages added, removed, or upgraded.** Bundle unchanged at **104 kB** initial JS. Empty-comment `catch { /* ignore */ }` blocks that existed solely to swallow WS errors were removed with their sockets.

## FILES
- `app/dashboard/page.tsx` - dropped `useRef` from the import + `wsRef` state + the phantom `new WebSocket('wss://website.vasudevaya...')` block; cleanup is now `return () => clearInterval(interval);`.
- `app/network/page.tsx` - dropped `useRef` + `wsConnected`/`wsRef` + the phantom WS block + the "WS Live / Polling" indicator; service label `Firebase` -> `Cloud` (keep the `svc-firebase` topology id, it matches `status.serviceHealth.firebase`); demo banner -> "signed-in cloud account".
- `app/security/page.tsx` - `Firebase Auth` -> `Cloud Auth`; "Recent Auth Events" block -> "Security Configuration" (`Shield` icon, `Users` import removed), project id / auth domain / redirect lines deleted, grant-type and rate-limit lines kept.
- `app/settings/page.tsx` - provider label `Firebase (website-6e8b1)` -> `Cloud account`; `Demo (local) / Connected (Firebase)` -> `Demo (local) / Connected (cloud)`.
- `app/status/page.tsx` - `Mode: Connected (Firebase)` -> `Connected (cloud)`.
- `app/email/page.tsx` - demo banner -> "Configure a cloud account to use the live per-user mailbox."; account subtitle `Firebase ·` -> `Cloud ·`.
- `app/messaging/page.tsx` - demo banner -> "Configure a cloud account to share presence and exchange direct messages."
- `app/notifications/page.tsx` - demo banner -> "Configure a cloud account to persist a personal notification feed."
- `tests/phase5/no-hardcoded-ui-data.test.ts` - **new.** 20 assertions: per-page forbidden-literal scan over the ten literals + per-screen real-data-source wiring (see SUMMARY) + `app/api/**` no-mock scan.
- `docs/phase-notes/phase-5-report.md` - **new** (this file).
- `docs/phase-notes/WORKLOG.md` - Phase 5 entry appended.

## PACKAGES
- Added / removed / upgraded: **none**. Bundle delta: **0 client KB** - `First Load JS shared by all` measured **104 kB**, unchanged from Phase 2b/3 builds (the edits are server-rendered copy plus removed dead socket code).

## COMMANDS
| Command | Result |
|---|---|
| `npx vitest run tests/phase5/no-hardcoded-ui-data.test.ts` | **20/20 passed**, 1 file, 2.17 s |
| `npm run lint` | **exit 0** (`tsc --noEmit`) |
| `CI=1 npm test` | **1403/1403 passed, 93 files** (baseline 1383/92 + 20) |
| (kill orphaned emulator on :9000) | killed PID 24876 |
| `CI=1 npm run test:rules` | **57/57 passed**, exit 0 |
| `CI=1 npm run build` | **exit 0** - Next 15.5.25 + OpenNext 1.20.6; `Worker saved in .open-next\worker.js`; postbuild `fix-cache.mjs` ran |
| `npx playwright test --config=tests/e2e/playwright.config.ts` | **9/9 passed**, 2.0 m |
| `npx wrangler deploy --dry-run` | **exit 0** - 6586.90 KiB / gzip 1356.07 KiB, 146 asset files |
| `CI=1 npm audit --audit-level=high` | **0 vulnerabilities** (exit 0) |

## METRICS
- Tests: **1383/92 -> 1403/93** (new `no-hardcoded-ui-data.test.ts`, +20).
- Forbidden visitor-visible literals in `app/<page>/page.tsx`: **10 -> 0** (per the `FORBIDDEN_LITERALS` table).
- Client bundles in `app/`: no page that shipped only-copy edits or removed dead socket code changed its chunk; `First Load JS shared by all` **104 kB** before and after.

## RISKS
- **Do not re-add a WS client to dashboard/network** until a real `/api/status/stream` (or Durable Object + Edge socket) exists; the named test now fails on `new WebSocket(` in any page.
- The `app/docs/page.tsx` still references Firebase (l.29 "Google Drive - Read-only integration with Firebase auth", l.91 "Firebase RTDB rules are the security boundary") - intentional (documentation of the actual data tier), out of the scrubbed surface; remove only if product docs become vendor-neutral.
- `app/api/status/route.ts` and `app/api/healthz/route.ts` still emit `Firebase...` detail strings in their JSON bodies and the key `firebase` in `serviceHealth` - server/API internals, not page source; consumers keyed on `serviceHealth.firebase` and the UI reads only status + configured flags.
- Rollback: `git checkout ab7e0da -- app tests/phase5/no-hardcoded-ui-data.test.ts` then `git checkout -- docs/phase-notes/phase-5-report.md docs/phase-notes/WORKLOG.md` (or `git reset --hard` a pre-phase commit on this branch) and re-run the gate.

## FINDINGS
- `app/docs/page.tsx` Firebase mentions kept (see RISKS) - flagged rather than changed.
- `app/status/page.tsx` uses inline styles and a flat dark-on-white layout that does not match the Tailwind'd `app/` design language - pre-existing theme drift, not touched (phase scope is data reality, not restyle).
- `worker.ts` still has no WebSocket/SSE path and no `/api/status/stream`; Phase 4's `src/lib/sync/transport.ts` `WebSocketSyncTransport` remains an opt-in sync-engine transport, not wired to any app page - consistent with the mock being deleted here.
- `package.json` `postbuild` (fix-cache.mjs) runs inside `npm run build` and also under `wrangler deploy --dry-run`'s custom build; each run rewrites `_headers`. Harmless, noted.
- No standalone `/models` or `/plugins` *page* routes exist; the dashboard aggregates `/api/models` and `/api/plugins` data. Phase 5 wording allows aggregation; keeping it flat avoids inventing routes.

## BLOCKED
- None. All gate steps passed.