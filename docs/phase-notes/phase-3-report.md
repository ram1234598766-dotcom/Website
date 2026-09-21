# Phase 3 Report — Interface & beginner experience

> **Date:** 2026-09-21 · **Branch:** `phase/3-beginner-experience` · **Base:** `ca3c4d6`
> **Commits:** `3a62b15` (fix config) · `67ef83f` (feat setup) · `273793d` (docs readme)
> **Scope:** one-command quickstart, a 4-step `npm run setup` wizard that actually configures Firebase, `.env.example` matching the Realtime Database tier, and README front-door accuracy. Not pushed, not deployed, no `firebase deploy`.
> **Plan note:** `plans/phase3-interface-beginner.md` names the branch `phase/3b-interface` and asks for `scripts/setup.mjs`; this phase used `phase/3-beginner-experience` and kept `scripts/setup.sh` (see FINDINGS).

## SUMMARY
- `.env.example` **described Firestore**, which does not exist in this product, and omitted the app ID and the Realtime Database URL the data tier uses. The Firebase block is now titled as optional, the four values `isFirebaseConfigured()` actually requires are named, extras are marked optional, a **Realtime Database** section replaces the Firestore one (with `firebase deploy --only database` and an explicit "there is no Firestore" note), and `NEXT_PUBLIC_FIREBASE_DATABASE_URL` exists as a documented optional var.
- `src/lib/firebase.ts` now passes `databaseURL: databaseUrl || undefined`, so that documented var is real. Unset stays unset — behaviour, demo mode, and existing configurations are unchanged.
- `scripts/setup.sh` asked only for an API key, so a user who completed the wizard still had `isFirebaseConfigured() === false` and was silently dropped into demo mode. It now collects the four required values with derived defaults (`<project>.firebaseapp.com`, `https://<project>-default-rtdb.firebaseio.com`), writes them through a `write_env` upsert helper instead of `sed -i.bak` (no more `.env.local.bak` litter), seeds `.env.local` from the template when missing, and exits cleanly when stdin is not a terminal instead of hanging.
- README corrected: test counts **1317/86 → 1327/87**, the self-contradicting "Stale script: `firebase:deploy`" note removed (package.json already runs `firebase deploy --only database`), the duplicated `npm run deploy` row collapsed, and `NEXT_PUBLIC_FIREBASE_APP_ID` added while `NEXT_PUBLIC_FIREBASE_DATABASE_URL` is marked optional. The plain-language section already sat above the architecture diagram, so it was left alone.
- `make quickstart` **verified end-to-end on Windows**: deps detected, env detected, dev server ready in 1979 ms, `GET / 200 in 3090 ms`, probe returned HTTP 200 after 4 s, process killed, 0 listeners left on 3000.
- No packages added or removed.

## FILES
- `.env.example` — retired the Firestore story; optional-Firebase framing; the four required vars named; `NEXT_PUBLIC_FIREBASE_DATABASE_URL` added; RTDB deployment section (`database.rules.json`, `firebase deploy --only database`); build-time wording ("browser bundle") and Cloudflare Workers vars path corrected.
- `src/lib/firebase.ts` — added `const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || ''` and `databaseURL: databaseURL || undefined` in `initializeApp`; header comment "(static export)" → "inlined into the browser bundle at build time". `isFirebaseConfigured()` deliberately untouched (adding the URL to it would break previously working configs).
- `scripts/setup.sh` — 4-step wizard retained and rewritten: `write_env()` upsert helper (`grep -v` + `printf` + `mv`, no `.bak`), `ensure_env_file()` copies `.env.example` → `.env.local`, derived defaults for auth domain and RTDB URL, non-interactive guard (`[ ! -t 0 ]` → friendly exit 0), Node guidance 22+.
- `README.md` — commands table rebuilt (single deploy row, `build`/`cf-preview` described accurately, `test:rules`/`setup`/`quickstart` listed, RTDB-rules line replacing the stale-script note); unit-test count updated; env table completed with `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_FIREBASE_APP_ID` and the closure sentence now names the four core values.
- `docs/phase-notes/phase-3-report.md` — **new** (this file).
- `docs/phase-notes/WORKLOG.md` — extended with the Phase 3 entry.

## PACKAGES
- Added / removed / upgraded: **none**. Bundle delta: **not measured** — no dependency, import, or module graph changed; the only client edit reads one additional optional env var.

## COMMANDS
| Command | Result |
|---|---|
| `npm run lint` | **exit 0** (`tsc --noEmit`) |
| `npx vitest run tests/phase3 tests/phase5 tests/phase2` | **249/249 passed**, 25 files, 53.19 s |
| `npm run test:rules` | **34/34 passed**, 5.81 s, script exit 0, emulator shut down (an orphan `java.exe` was holding 9000 first) |
| `CI=1 npm test` | **1327/1327 passed, 87 files**, 175.39 s |
| `npm run build` | **exit 0** — Next 15.5.25 + OpenNext 1.20.6; worker written to `.open-next/worker.js` |
| `npx playwright test --config=tests/e2e/playwright.config.ts` | **9/9 passed**, 1.7 m |
| `npx wrangler deploy --dry-run` | **exit 0** — Total Upload 6080.91 KiB / gzip 1246.28 KiB, 141 asset files, bindings `WORKER_SELF_REFERENCE`, `ASSETS` |
| `npm audit --audit-level=high` | **found 0 vulnerabilities** (exit 0) |
| `make quickstart` (background, then probed) | deps + env detected, `Ready in 1979ms`, `GET / 200 in 3090ms`; probe **HTTP 200 after 4 s** with real SSR HTML; killed, `PORT3000_LISTENERS_AFTER=0` |

## METRICS
| Metric | Before | After |
|---|---|---|
| Outcome of completing `npm run setup` | Firebase unconfigured → silent demo mode | all four required values collected |
| `.env.example` Firestore references / missing core vars | 1 Firestore section, app ID + DB URL absent | 0 Firestore references, both present |
| README test counts | 1317/1317 across 86 files | **1327/1327 across 87 files** |
| README `npm run deploy` rows | 2 | 1 |
| README stale `firebase:deploy` warning | present | removed |
| Quickstart time-to-HTTP-200 | not previously measured | 4 s (warm tree) |
| Unit tests / rules suite | 1327/87 · 34/34 | 1327/87 · 34/34 |

## RISKS
- **`databaseURL` passthrough:** when `NEXT_PUBLIC_FIREBASE_DATABASE_URL` is unset the option is `undefined`, which is what the SDK received before, so existing deployments are unaffected. Setting it to a wrong URL is now possible by design — the SDK will use whatever is configured.
- **Wizard output path:** `scripts/setup.sh` writes `.env.local`. Next loads both `.env` and `.env.local` (`.env.local` wins), and the Makefile treats "either file exists" as configured — so an `.env`-only tree is not overwritten by `make quickstart`, but a wizard run will still add `.env.local`.
- **Rollback:** `git revert --no-edit 273793d 67ef83f 3a62b15` (branch not pushed, no deploy).

## FINDINGS
- `CONTRIBUTING.md` still describes a "static export"/`out/` (lines 5, 52, 110, 112) and repeats the outdated `firebase:deploy` claim (line 119). Left untouched: outside this phase's named files, and AGENTS §5's four-way static-export reconciliation is still open.
- `AGENTS.md` §3 baseline ("~1317 tests / 86 files") is now stale against 1327/87. Not edited — it is the operating brief, not a phase artifact.
- `plans/phase3-interface-beginner.md` Step 2 asks for `scripts/setup.mjs` that itself installs, copies env, starts the dev server, and HTTP-checks port 3000. `tests/phase3/setup-script.test.ts` asserts `scripts/setup.sh` and AGENTS §8 asks only for a 4-step wizard, so the shell wizard was kept and server startup stays with `make quickstart`. The `.mjs` rewrite was not done.
- `next start` still warns it does not work with `output: standalone`; the Playwright webServer relies on it (carried over from Phase 2).
- `src/lib/firebase.ts` contains pre-existing mojibake (`â€”`) in user-facing strings. Not touched (drive-by).
- Orphaned `java.exe` held port 9000 before this run, as noted in Phase 2; killed before `test:rules`.

## BLOCKED
- **`npm run setup` was not executed end-to-end**, because it writes `.env.local`, which the operating brief forbids modifying. Its content contract is covered by `tests/phase3/setup-script.test.ts` (passing) and its two non-Bash halves were exercised separately: `make quickstart` (deps → env → dev server → HTTP 200) and the rules/test suites. The interactive prompts and derived defaults are **not verified** by execution.
- **Fresh-clone install-to-interactive timing** (plan Step 1 target < 60 s) is **not verified** — no fresh clone was made; the 4 s measurement is on a warm tree with `node_modules` and env already present.
