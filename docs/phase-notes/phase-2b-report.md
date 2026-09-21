# Phase 2b Report - API boundary hardening and cross-phase close-out

> **Date:** 2026-09-21 · **Branch:** `phase/2b-api-hardening` · **Base:** `38eaf95`
> **Commits:** `2e4fc37` (fix healthz) · `2280e74` (fix api boundary + log redaction) · `b45091a` (docs 2b) · `5e7ac60` (docs deploy-story) · `65f145b` (docs FINDINGS close-out) · this docs close-out
> **Scope:** a shared-boundary hardening pass over all 16 `app/api/*` handlers, the AGENTS §5 deploy-story reconciliation (docs-only), the Phase 2 FINDINGS close-out, and the two Phase 3 BLOCKED items (setup wizard end-to-end, fresh-clone timing). Not pushed, not deployed, no `firebase deploy`.

## SUMMARY
- Swept all 16 `app/api/*` route handlers against AGENTS §7.6 (validate at the boundary) and §7.9 (auth, error envelope, structured secret-free logs). Thirteen delegate to the shared `handleApiRequest`, so the fixes land once in `src/lib/server/api-router.ts`; the four standalone routes (`status`, `models`, `healthz`, `plugins`) were reviewed individually.
- `src/lib/server/log.ts` (new): `redactSecrets` / `errorText` / `logServerError` emit a single structured JSON line and never throw. The three catch-site `console.error` calls in the AI router previously printed the raw `Error.message`, which can embed the operator Gemini key through a `?key=` URL; they now route through the redactor. Kept server-local rather than importing the client `src/lib/ai/orchestrator.ts` (AGENTS §7.8 - heavy/client modules must not enter server bundles).
- `api-router.ts`: `messages` is validated on both the JSON and streaming paths (array, 1..64 items, each `{ role: non-empty string, content: string <= 32000 }`). A non-array previously reached `messages.map()` and surfaced as an opaque 500. `/api/ai/generate` now rejects bodies over 1 MB with 413 (mirroring `/api/model-proxy`), and `rate-limit-check` caps its `key` at 128 chars.
- `app/api/healthz/route.ts`: liveness is always HTTP 200; in demo mode the body reports `status: degraded` instead of failing the probe, so an unconfigured tree (AGENTS §4 default) no longer looks dead.
- **AGENTS §5 deploy-story drift reconciled docs-only (`5e7ac60`).** The real story - `next.config.mjs` uses `output: 'standalone'` (not `'export'`); `npm run build` runs `next build` then `npx opennextjs-cloudflare build --skipNextBuild` to produce one Worker (`.open-next/worker.js`) plus `.open-next/assets/`; `wrangler.toml` deploys that Worker; there is **no static `out/` export**. README + CONTRIBUTING + a `next.config.mjs` comment now agree; the Playwright webServer was deliberately left on `next build && next start -p 4173` because switching to `node .next/standalone/server.js` would require copying `public` and `.next/static` and risking the gate.
- **Phase 2 FINDINGS closed and Phase 3 BLOCKED resolved.** `phase-2-report.md` FINDINGS rewritten to resolved/verified state; the two blocked Phase 3 items are now proven: the setup wizard was driven end-to-end in a temp sandbox (full answers write `.env.local`; all-Enter writes nothing), and a fresh clone boots in ~78.6 s cold.
- No packages added, removed, or upgraded.

## FILES
- `src/lib/server/log.ts` - **new.** `redactSecrets(value)` (Gemini `AIza…`, `sk-…`, `ghp_…`, `github_pat_…`, and generic `api_key|token|secret|password` key-value patterns), `errorText(err)`, `logServerError(event, requestId, err)` emitting one JSON line; all total (never throw).
- `src/lib/server/api-router.ts` - `validateAiMessages(messages: unknown): string | null` (`MAX_AI_MESSAGES = 64`, `MAX_AI_MESSAGE_CHARS = 32000`) enforced in `handleAiGenerate` and `handleAiGenerateStream`; 1 MB body cap -> 413 on `/api/ai/generate`; `rate-limit-check` `key` capped at 128; three catch sites switched to `logServerError`.
- `app/api/healthz/route.ts` - liveness always 200; `overallStatus` reported in the body; demo mode -> `degraded`.
- `tests/phase2/log-redaction.test.ts` - **new.** Pins every redaction pattern and that `logServerError` emits one line and never throws.
- `tests/phase2/ai-generate-validation.test.ts` - **new.** Pins each validation error string, the 64-item / 32k-char bounds, and the 1 MB 413.
- `tests/phase2/healthz-demo-mode.test.ts` - **new.** Pins HTTP 200 + `degraded` with Firebase unconfigured.
- `README.md` - test counts `1327/1327 across 87 files` -> `1343/1343 across 90 files` (two places); deploy story already correct.
- `CONTRIBUTING.md` - seven edits: standalone/OpenNext framing; "static export must still succeed" -> "production build"; E2E row `next build && next start -p 4173`; `npm run build` and `npm run start` rows corrected; counts -> 1343/90; removed the stale `firebase:deploy` pitfall; E2E pitfall reworded.
- `next.config.mjs` - four-line inline comment above `output: 'standalone'` recording the real one-Worker build (no static `out/`).
- `docs/phase-notes/phase-2-report.md` - `## FINDINGS` rewritten to resolved/verified state (regeneration of results, emulator-orphan kill, `JAVA_HOME` drift, 16 handlers read, deploy-story resolution).
- `docs/phase-notes/phase-3-report.md` - FINDINGS deploy line marked resolved; BLOCKED section replaced with measured resolutions; COMMANDS/METRICS extended with the setup-wizard and fresh-clone runs.
- `docs/phase-notes/phase-2b-report.md` - **new** (this file).
- `docs/phase-notes/WORKLOG.md` - Phase 2b entry extended with the close-out outcome.

## PACKAGES
- Added / removed / upgraded: **none**. Bundle delta: **0 client KB** - `log.ts` is server-only and no client import changed; `First Load JS shared by all` measured **104 kB**, unchanged from the Phase 3 build.

## COMMANDS
| Command | Result |
|---|---|
| `npm run lint` | **exit 0** (`tsc --noEmit`) |
| `CI=1 npm test` | **1343/1343 passed, 90 files**, 185.80 s |
| `npm run test:rules` | **34/34 passed**, 5.65 s, exit 0 (an orphan `java.exe` held 9000 first; killed) |
| `npm run build` | **exit 0** - Next 15.5.25 + OpenNext 1.20.6; `Worker saved in .open-next\worker.js` |
| `npx next build` (route table) | First Load JS shared **104 kB** (46.1 + 54.2 + 3.22 kB) |
| `npx playwright test --config=tests/e2e/playwright.config.ts` | **9/9 passed**, 1.9 m |
| `npx wrangler deploy --dry-run` | **exit 0** - 6083.06 KiB / gzip 1246.36 KiB, 141 asset files |
| `npm audit --audit-level=high` | **0 vulnerabilities** (exit 0) |
| `git clone` + `npm ci` (fresh clone, temp) | clone **1.4 s**; `npm ci` **60.45 s**, 513 packages |
| `npm run dev` (fresh clone, no `.env.local`) | `Ready in 5.9 s`; first `GET / 200` at **16.78 s**; 0 listeners left on 3000 |
| `setup.sh` under PTY (sandbox, full answers) | **exit 0** - 4 steps; `.env.local` written with the 5 Firebase keys + `GEMINI_API_KEY` |
| `setup.sh` under PTY (sandbox, all-Enter) | **exit 0** - Firebase/Gemini skipped; **no `.env.local`** created |
| `npm run setup` (sandbox, non-interactive) | **exit 0** - "No interactive terminal detected"; no file written |

## METRICS
| Metric | Before | After |
|---|---|---|
| `app/api/*` handlers reviewed | 0 | 16 (13 shared + 4 standalone) |
| Unit tests / files | 1327 / 87 | **1343 / 90** |
| New named boundary tests | 0 | 16 (three files) |
| `/api/ai/generate` non-array `messages` | opaque 500 | 400 with an explicit error |
| `/api/healthz` in demo mode | probe failure | HTTP 200, `status: degraded` |
| Operator Gemini key in server logs | printed raw on fetch failure | redacted |
| `First Load JS shared by all` | 104 kB | 104 kB (unchanged) |
| Worker upload | 6080.91 KiB / 1246.28 KiB gzip | 6083.06 KiB / **1246.36 KiB** gzip (+2.15 KiB) |
| Fresh-clone install-to-interactive | not measured | **78.6 s** (1.4 clone + 60.45 install + 16.78 dev) |
| `npm run setup` end-to-end | not verified | verified (three paths, above) |

## RISKS
- **AI request validation is stricter:** a body that previously produced a 500 now returns 400/413 with a short message. Clients other than `src/components/OmniAI.tsx` (which always sends `{ role, content: string }`) could see the new status codes. Rollback: `git revert --no-edit 2280e74`.
- **`healthz` semantics:** the probe is 200 in every case now, so an external monitor keying on the status code alone will not surface a misconfiguration; the body's `status` must be read instead. Rollback: `git revert --no-edit 2e4fc37`.
- **Docs-only §5 change:** no runtime behaviour, but `CONTRIBUTING.md`'s E2E instructions still say `next start`, which prints the `output: standalone` warning - intentional, because that is what the Playwright config actually runs. Rollback: `git revert --no-edit 5e7ac60`.
- **Full rollback** (branch not pushed, nothing deployed): `git revert --no-edit 65f145b 5e7ac60 b45091a 2280e74 2e4fc37`.

## FINDINGS
- `/api/security/scan` is an unauthenticated information oracle: it reveals whether a server Gemini key is configured. Out of the chosen scope; needs a product decision on exposure.
- Three-way Firebase-configuration predicate drift: `app/api/status/route.ts`, `app/api/healthz/route.ts`, and the client each decide "is Firebase configured" differently. `tests/phase3/api-status.test.ts:94-99` pins the `status` predicate, so changing it needs a product call first.
- `app/api/models/route.ts` and `app/api/plugins/route.ts` read request headers while declaring `dynamic = 'force-static'`, so their `X-Request-ID` handling is dead on the static path.
- The `x-forwarded-for` fallback used for rate-limit keys is spoofable (`cf-connecting-ip` is checked first, so it is fine on Cloudflare, unsafe without it).
- Redaction patterns are duplicated: `src/lib/server/log.ts` and `src/lib/ai/orchestrator.ts` carry separate secret patterns. Deliberately not unified to keep the server copy free of the client module.
- npm 11 did not run postinstall scripts for `esbuild`, `onnxruntime-node`, `protobufjs`, `workerd` (install-scripts gate); dev/build still work because the esbuild/workerd platform binaries arrive via optional deps. A cold-cache install under a locked-down npm config is untested.
- `next start` warns it does not work with `output: standalone`; the Playwright webServer relies on it anyway and passes 9/9.
- Other internal docs still describe a static export / `out/` (recorded, not fixed): `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/TECH_STACK_AUDIT_REPORT.md`, `docs/WEB_MODEL_SPEC.md`, `docs/SLO_RUNBOOK.md`, `SECURITY.md`, `public/_redirects`.
- `JAVA_HOME` points at JDK 8 while `java` on PATH is JDK 26; an aborted emulator run leaves an orphaned JVM holding port 9000. Environment, not repo.

## BLOCKED
- None. All four workstreams (API hardening, §5 docs reconciliation, Phase 2 FINDINGS close-out, Phase 3 BLOCKED items) are complete, and the full gate is green on this tree.
