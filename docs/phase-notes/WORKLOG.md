# VantaOS Worklog

Chronological log of phases and significant work. One entry per phase, prefixed by the phase number.

---

## Phase 0 — Baseline (read-only) — 2026-09-21

**Outcome:** green gate, baseline captured. Watch `baseline-20260921`.

- Reconciled prior pack-v1 branch/tag divergence (see report).
- Checkpointed uncommitted Phase 4/5 deliverable; committed AGENTS.md, .gitignore, dev tooling.
- Ran gate: lint / 1317-1317 vitest / build / 9-9 E2E / wrangler dry-run / npm audit — all PASS.
- Ran madge (2 circular deps in telemetry) and knip (57 unused exports, 6 unused deps, duplicate motion-token exports).
- Wrote docs/AUDIT.md, docs/BASELINE.md, updated docs/API.md, this worklog + phase report.
- Report: docs/phase-notes/phase-0-report.md

---

## Phase 1 — Correctness & performance (homepage first) — 2026-09-21

**Outcome:** green gate; `/` is static SSR, Lighthouse 100/100. Branch `phase/1b-homepage`.

- `app/page.tsx` → static Server Component; IDE shell moved to new `/ide` route (`app/ide/page.tsx`, client-only). `src/App.tsx` gained `initialView`.
- Six IDE E2E flows updated to `goto('/ide')`; `home.test.ts` untouched (banner CTA relabelled so the single-CTA assertion holds).
- Added `scripts/lighthouse-run.cjs` (drives Lighthouse CLI; 100/100 on `/`, desktop).
- Removed unused `@lhci/cli` (Phase 0 dev tooling) → clears the 7 high audit findings; CI audit gate green.
- Gate: lint 0 · vitest 1317/1317 (86 files) · build 0 (`/` 179 B/104 kB, `/ide` 1.76 kB/105 kB) · E2E 9/9 · wrangler dry-run 0 · audit 0.
- Report: docs/phase-notes/phase-1-report.md

---

## Phase 2 — Security fixes — 2026-09-21

**Outcome:** green gate; rules hardened (34/34), token routes fail closed in demo mode. Branch `phase/2-security`.

- `database.rules.json`: removed always-true write ternaries; updates freeze immutable fields and constrain counter deltas (`upvotes_count` ±1, `replies_count` +1, one at a time, `>= 0`); added `replies .indexOn: ["thread_id"]` and root `profiles .read`.
- `src/lib/server/api-router.ts`: added server-safe `isFirebaseConfigured` + `requireFirebaseConfig`; the four `verifyFirebaseIdToken` routes now return 503 `firebase_not_configured` in demo mode instead of a throw-driven 500, and skip JWKS.
- `tests/phase2/firebase-auth-gate.test.ts` (new): 10 cases covering all four routes.
- `package.json`: added `test:rules` (RTDB emulator → `vitest.rules.config.ts`).
- `wrangler.toml` `[vars]`: verified comment-only; no secrets committed.
- Gate: lint 0 · vitest 1327/1327 (87 files) · test:rules 34/34 · build 0 · E2E 9/9 · wrangler dry-run 0 (6080.91 KiB / 1246.22 KiB gzip, 144 assets) · audit 0.
- Report: docs/phase-notes/phase-2-report.md

---

## Phase 3 — Interface & beginner experience — 2026-09-21

**Outcome:** green gate; quickstart verified end-to-end, setup wizard now configures a working Firebase. Branch `phase/3-beginner-experience`.

- `.env.example`: Firestore story retired (there is no Firestore); optional-Firebase framing; the four required values named; `NEXT_PUBLIC_FIREBASE_DATABASE_URL` added; RTDB deployment section (`firebase deploy --only database`).
- `src/lib/firebase.ts`: honours the optional `NEXT_PUBLIC_FIREBASE_DATABASE_URL` (`undefined` when unset, so demo mode and existing configs are unchanged).
- `scripts/setup.sh`: previously asked only for an API key, leaving `isFirebaseConfigured()` false and hiding the failure as demo mode. Now collects the four required values with derived defaults, upserts through a `write_env` helper (no more `.env.local.bak` litter), seeds `.env.local` from the template, and exits cleanly on a non-tty stdin.
- `README.md`: test counts 1317/86 → 1327/87; removed the self-contradicting stale `firebase:deploy` note; deduped the deploy row; added `NEXT_PUBLIC_FIREBASE_APP_ID` and marked `DATABASE_URL` optional.
- `make quickstart` verified: deps + env detected, `Ready in 1979ms`, `GET / 200 in 3090ms`, probe HTTP 200 after 4s, port 3000 cleaned up.
- Gate: lint 0 · vitest 1327/1327 (87 files) · test:rules 34/34 · build 0 · E2E 9/9 · wrangler dry-run 0 (6080.91 KiB / 1246.28 KiB gzip, 141 assets) · audit 0.
- Report: docs/phase-notes/phase-3-report.md

---

## Phase 2b - API boundary hardening - 2026-09-21

**Outcome:** green gate; the shared API router validates the AI boundary and no longer logs secrets. Branch `phase/2b-api-hardening`. Not pushed, not deployed.

- Swept all 16 `app/api/*` handlers against AGENTS 7.6/7.9. Thirteen delegate to the shared `handleApiRequest`, so the boundary fixes land once in `src/lib/server/api-router.ts`; the four standalone routes (`status`, `models`, `healthz`, `plugins`) were reviewed individually.
- `src/lib/server/log.ts` (new): `redactSecrets` / `errorText` / `logServerError` emit one structured JSON line and never throw. Upstream fetch errors can embed the operator Gemini key via a `?key=` URL, so the three catch-site `console.error` calls now route through it. Kept server-local (does not import the client `src/lib/ai/orchestrator.ts` - AGENTS 7.8).
- `src/lib/server/api-router.ts`: `messages` is validated (array, 1..64 items, each `{ role: string, content: string <= 32000 }`) on both the JSON and streaming paths - a non-array previously reached `messages.map()` and surfaced as an opaque 500; `/api/ai/generate` rejects bodies over 1MB with 413, mirroring `/api/model-proxy`; `rate-limit-check` caps `key` at 128 chars.
- `app/api/healthz/route.ts`: liveness is always 200; demo mode reports `status: degraded` in the body instead of failing the probe (AGENTS 4).
- New tests: `tests/phase2/log-redaction.test.ts`, `tests/phase2/ai-generate-validation.test.ts`, `tests/phase2/healthz-demo-mode.test.ts` (16 cases, all pinned).
- Gate: lint 0 - vitest 1343/1343 (1328 in the parallel run across 89 files, plus `tests/operations-safety.test.ts` 15/15 re-run in isolation after a forks-worker start timeout) - test:rules 34/34 - build 0 - E2E 9/9 - wrangler dry-run 0 (6083.06 KiB / gzip 1246.61 KiB, 141 assets) - audit 0.
- FINDINGS (not fixed): `/api/security/scan` is an unauthenticated info oracle (reveals whether the server Gemini key is configured); three-way Firebase-configuration predicate drift across `status` / `healthz` / the client; `models` / `plugins` read request headers under `dynamic = 'force-static'`; the `x-forwarded-for` fallback is spoofable (cf-connecting-ip is checked first, fine on Cloudflare); `next start` warns against `output: standalone`; an aborted emulator run leaves an orphaned JVM on port 9000.

---

## Phase 2b close-out - deploy story, findings, blocker clearance - 2026-09-21

**Outcome:** green gate; AGENTS 5 reconciled (docs-only), Phase 2 FINDINGS closed, both Phase 3 BLOCKED items verified. Branch `phase/2b-api-hardening`. Not pushed, not deployed.

- AGENTS 5 deploy story reconciled docs-only (`5e7ac60`): the build is one Worker via `next build` + `npx opennextjs-cloudflare build` (`output: 'standalone'`), with no static `out/` export. README counts fixed to 1343/90; CONTRIBUTING reworded (7 edits); a comment above `output: 'standalone'` records the truth. The Playwright webServer stays on `next build && next start -p 4173` on purpose.
- Phase 2 FINDINGS rewritten to resolved/verified state (`65f145b`): deploy drift resolved, orphaned emulator JVM cleanup recorded, JAVA_HOME drift recorded as environment, 16 handlers confirmed read, 16 new boundary tests landed in Phase 2b.
- Phase 3 BLOCKED cleared: `npm run setup` was driven end-to-end in an OS-temp sandbox (never the real `.env.local`). Full answers -> exit 0 and `.env.local` written with the 5 Firebase keys + GEMINI_API_KEY (derived defaults resolved); Enter at every prompt -> exit 0 and no file written (demo mode needs zero config); the non-interactive guard exits 0 with guidance and no file.
- Fresh-clone timing measured: `git clone` 1.4 s -> `npm ci` 60.45 s (513 packages) -> `npm run dev` `Ready in 5.9 s`, first `GET / 200` at 16.78 s. Cold total ~78.6 s, so the plan's "< 60 s" holds only warm; the clone had no `.env.local`, confirming demo-mode first-run.
- Gate (each a single command): lint 0 -> vitest 1343/1343 (90 files) -> test:rules 34/34 -> build 0 (First Load JS 104 kB) -> E2E 9/9 -> wrangler dry-run 0 (6083.06 KiB / 1246.36 KiB gzip, 141 assets) -> audit 0. An orphaned `java.exe` held 9000 before test:rules; killed (PID 1408).
- Report: docs/phase-notes/phase-2b-report.md

---

## Phase 5 - Full graphical interface: scrub + gate - 2026-09-22

**Outcome:** green gate; no phantom WebSocket or visitor-visible Firebase string remains in the app pages, contract pinned by a 20-case named test. Branch `phase/5-graphical-interface`. Not pushed, not deployed.

- Removed the phantom WS layer: `app/dashboard` and `app/network` each created a dead `new WebSocket('wss://website.vasudevaya.workers.dev/api/status/stream')` even though no `/api/status/stream` route exists server-side. Deleted the socket blocks, `wsRef`/`wsConnected`, `useRef` imports, and network's "WS Live / Polling" indicator; both pages now poll `/api/status` only (10 s / 15 s) with a single `clearInterval` cleanup.
- Scrubbed visitor-visible Firebase identifiers out of page copy without touching internals (type names `FirebaseUser`, imports, `svc-firebase` topology id, and `serviceHealth` keys stay): security "Recent Auth Events" block (was printing project id `website-6e8b1`, `website-6e8b1.firebaseapp.com`, `/__/auth/handler`) -> "Security Configuration" (Shield icon); settings provider -> "Cloud account" and "Connected (cloud)"; status "Connected (Firebase)" -> "Connected (cloud)"; email "Firebase · {uid}" -> "Cloud · {uid}" + banner; messaging/notifications/network demo banners -> "cloud account" / "signed-in cloud account"; network topology label -> "Cloud".
- Completed the zero-visitor-Firebase sweep across the whole render surface: docs page bullets, `/api/healthz` and `/api/status` bodies, `Home` feature chips / GitHub sync / offline bullets, `AuthForm` offline + OAuth hints, `DriveManager` unconfigured state, and every user-facing/thrown error in `lib/firebase`, `lib/firestore`, `lib/client`, `lib/drive`, and `lib/server/api-router` are now vendor-neutral ("cloud account" / "cloud credentials"/"Realtime Database rules"); `code: 'firebase_not_configured'`, `hasFirebase`, `firebaseToken`, module names, and comments deliberately stay.
- `tests/phase5/no-hardcoded-ui-data.test.ts` (20 -> 41 cases): scans every `app/<page>/page.tsx` for ten forbidden literals, asserts each screen is wired to its real data source, checks `app/api/**` has no mock/seed fixtures, AND runs 21 new `CLOUD_NEUTRAL_LITERALS` guards over app pages plus a `RENDER_SURFACE` map (`Home`, `AuthForm`, `DriveManager`, `lib/{firestore,client,firebase,drive}`, `lib/server/api-router`) so every scrubbed Firebase-literal is pinned.
- Confirmed no mock/hardcoded data remains: dashboard/network/security/status/settings/email/messaging/notifications all read real endpoints, localStorage, or RTDB streams.
- Gate: lint 0 · vitest 1424/1424 (93 files; +21 guards vs 1403) · test:rules 57/57 (emulator on :9000 killed first) · build 0 (First Load JS 104 kB) · E2E 9/9 · wrangler dry-run 0 (6586.88 KiB / gzip 1360.78 KiB, 146 assets) · audit 0. No packages changed.
- Report: docs/phase-notes/phase-5-report.md