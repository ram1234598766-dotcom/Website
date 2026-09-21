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