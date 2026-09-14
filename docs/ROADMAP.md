# VantaOS Roadmap

> **Status:** 9/9 development phases complete and tested — Vitest 1047/1047 passing across 65 files, 9 Playwright E2E cases across 7 files, CI green; last verified 2026-09-14.

## Purpose / How to read this doc

VantaOS is a browser-based cloud OS / developer workspace: a cloud OS workspace with file manager, a CodeMirror 6 editor and xterm.js terminal, Omni-AI chat, Google Drive and GitHub sync, a forum with admin, and a plugin system. It ships as a **Next.js 15 hybrid-rendered app** (static pages + dynamic API routes) served by a **Cloudflare Worker** via OpenNext, backed by **Firebase Realtime Database (RTDB)** as the data tier, with IndexedDB for local persistence and offline tolerance. Live URL: https://website.vasudevaya.workers.dev.

This document records what is implemented and tested, ordered by the 9 development phases. It follows two rules: no phase is marked complete from a README claim alone — every row cites the named test suite and CI job that prove it — and the status legend below distinguishes implemented-and-tested from present-but-not-enabled. All status claims are dated 2026-09-14.

**Data-tier and deploy notes:**

- The data tier is Firebase **Realtime Database (RTDB)**, not Firestore. The `npm run firebase:deploy` script in `package.json` still targets `firestore.rules` / `firestore.indexes` and is **STALE**; the correct rules deploy is `firebase deploy --only database`. Flagged, not yet corrected.
- Deployment is one OpenNext Cloudflare Worker unit (`.open-next/worker.js` + `.open-next/assets`) via `npm run deploy` (`npx wrangler deploy`, builds via `[build]` in wrangler.toml); rollback via `npx wrangler rollback [version-id]`. E2E's `webServer` builds and runs the app (`npm run build && npx next start -p 4173`), so build-first is required.

## Phase history

| Phase | Name | What shipped | Verification evidence | Status |
|---|---|---|---|---|
| 1 | Core Workspace | Cloud OS workspace + file manager: append-only operation log as source of truth, IndexedDB v3 schema, derived-state builder, conflict detection/resolution, deterministic path rules, legacy import, export, outbox | Vitest `tests/phase1` (7 files) | ✅ |
| 2 | Terminal Engine | xterm.js terminal with sandboxed Web Worker runner (fresh worker per run, wall-clock/output quotas, cancellation); CodeMirror 6 editor (15 languages) + diff editor with keyboard/a11y workflows | Vitest `tests/phase2` (4 test files + 2 helpers) | ✅ |
| 3 | Omni-AI | Streaming chat across cloud providers (OpenRouter, Gemini, OpenAI) + local Ollama; provider registry and fallback; secret redaction; rate limiting; permission-gated tools | Vitest `tests/phase3`; model-adapter suites | ✅ |
| 4 | Security and Identity | Firebase Google/GitHub sign-in (RTDB-backed, project `website-6e8b1`, smoke-verified to the consent screen); GitHub Worker OAuth proxy issuing short-lived HMAC-signed grants; memory-only direct-token fallback; demo auth gated by `isFirebaseConfigured` | Vitest `tests/phase5` (grants, github-proxy, github-client, client-github-fallback, firebase-verify) | ✅ |
| 5 | Storage and Sync | IndexedDB local persistence (v3 schema) + authenticated push/pull/resolve/status API with HLC causality and configurable conflict windows; Google Drive sync (`drive.readonly` / `drive.file`) | Vitest `tests/phase6` (sync, status, batch, protocol suites) | ✅ |
| 6 | Collaboration | Multi-device convergence and conflict preservation; recovery after long disconnects; bounded reconnect storms; forum + admin backed by RTDB | Vitest `tests/phase6` (7 files) | ✅ |
| 7 | Data Layer | Signed model manifests; resumable shard downloads with SSRF protection, SHA-256 digest verification, and atomic install; device-capability detection | Vitest `tests/phase4/models.test.ts`; `tests/phase-schema` suites | ✅ |
| 8 | Services | `/api/health` reflecting real Firebase + IndexedDB status; 6 SLOs with p95 targets; 4 incident runbooks; Sentry/LogRocket telemetry; plugins + models API | Vitest `tests/phase-schema`; telemetry / sentry / logrocket audit suites | ✅ |
| 9 | Application Layer | Next.js 15 hybrid app shell (static `/` + server-rendered `/api/*`); plugin registry/manifest/loader; GitHub import/push via Worker OAuth proxy (GUI ships but is env-guarded — see legend); PWA + responsive | Vitest `tests/phase9` (plugin, manifest, edge, operations, model-adapter); Playwright `tests/e2e/flows` (auth 2, terminal 2, files 1, home 1, ide 1, ide-run 1, omni-ai 1) | ✅ |

Every phase above also lands in CI: `.github/workflows/ci.yml` runs lint (`tsc --noEmit`), test (Vitest), build (`next build`), and e2e (Playwright) on push and PR, plus a dedicated `npm audit` job (`npm audit --audit-level=high`; 0 vulnerabilities as of Sep 2026-09-14).

## Status legend

- ✅ **Implemented and tested** — feature shipped and covered by a named, passing suite.
- ⚠️ **Implemented, present-but-not-enabled** — code ships behind an environment guard; not active in production.
- 🎯 **Next work / backlog** — not yet implemented; candidate milestone.

## Implemented vs. backlog

| Tier | Items |
|---|---|
| ✅ Implemented and tested | Core workspace + file manager (oplog, conflict resolution, IndexedDB v3); CodeMirror 6 editor (15 languages) + diff editor; xterm.js terminal with sandboxed Web Worker runner; Omni-AI chat (cloud providers + local Ollama); Firebase Google/GitHub sign-in (wired to project `website-6e8b1`, consent-screen smoke-verified); forum + admin on RTDB; Google Drive sync (`drive.readonly` / `drive.file`); IndexedDB local persistence with authenticated HLC sync; plugin system; health API + 6 SLOs + 4 incident runbooks; Sentry/LogRocket telemetry; demo auth fallback gated by `isFirebaseConfigured`; PWA + responsive |
| ⚠️ Implemented but not enabled | GitHub OAuth proxy in production — the API path (`app/api/gh/[...rest]`, implemented in `src/lib/server/github-proxy.ts` / `grants.ts`) and the GUI path ship, but are env-guarded: `GH_GRANT_SECRET` and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` are unset, so the path is not active on the live Worker (no KV token store either — fails closed) |
| 🎯 Backlog / next work | Live GitHub-OAuth enablement in prod (set the three secrets + add an E2E for the proxy); AI provider quota/billing; any non-LAN federation / rendezvous so two deployments can sync |

## Backlog / next milestones

1. **Enable GitHub OAuth proxy in production** — set `GH_GRANT_SECRET` + `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` on the Worker and add an E2E that exercises the proxy in CI. Picks up the ⚠️ row above.
2. **Tighten RTDB rules and add rules unit tests** — restrict database rules to the forum/admin paths and signed-in writers, and prove the rules with structural tests. <sub>(Baseline landed: `database.rules.json` is wired in `firebase.json` and covered by `tests/phase-schema/database-rules.test.ts`. The `firebase:deploy` script targets `database:rules,firestore:rules,firestore:indexes`.)</sub>
3. **Optional: Sentry-aware error SLO dashboard** — surface crash / first-token / error budgets from Sentry against the existing 6 SLOs.
4. **Optional: self-hostable single-command deploy** — ship a `wrangler.json` / GitHub Actions path so bringing up a second deployment is one command.
5. **Optional: PWA offline mode** — full offline app shell + sync queue for the workspace (IndexedDB is already the local tier; service-worker coverage is the gap).
6. **Far-future / optional: federation between deployments** — rendezvous so two independently deployed Cloudflare Workers can sync. Not on the critical path; revisit only after milestones 1–3.

## How status is maintained

- Update this document whenever shipped behavior changes — a new feature, an altered test count, or a guard flipped on in production.
- Keep the README/docs status tables and the §13 tracker in `docs/ARCHITECTURE.md` in lockstep with this file.
- Audit `file:line` references on every change; the standing cross-check is `docs/TECH_STACK_AUDIT_REPORT.md`.

---

## Master verification checklist

- [x] All 9 phases have named verification suites and land in CI
- [x] Status claims are dated (2026-09-13/14) and tied to executed tests
- [x] Implemented-but-not-enabled surfaces are marked ⚠️, not ✅
- [x] Backlog items are concrete and scoped; far-future items are labeled optional
- [x] Data tier is Firebase RTDB; Firestore references flagged as stale where present