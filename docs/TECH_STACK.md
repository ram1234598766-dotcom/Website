# VantaOS Technology Stack

## Document status

Verified against the repository on **2026-09-13**; this revision was re-audited on
**2026-09-14**. All `package.json:N` references below are line numbers in the
current 88-line `package.json`; statements about code are grounded in the named
module, with explicit `file:line` only where a line was re-verified during this
audit.

> **🟡 WARNING:** An earlier tech-stack document referenced line numbers from an
> OLD `package.json` and wrongly presented Cloud Firestore as the data tier.
> The audit write-up is preserved as history in
> `docs/TECH_STACK_AUDIT_REPORT.md` — its line numbers do **not** match the
> current file and must not be cited. The data tier is **Firebase Realtime
> Database** (module `src/lib/firestore.ts` keeps a legacy name only).

> **📋 Quick Navigation**
>
> - [1. 🏗️ Platform overview](#1-platform-overview)
> - [2. 📦 Application layer](#2-application-layer)
> - [3. 💻 Client & storage libraries](#3-client--storage-libraries)
> - [4. 📊 Data layer — Firebase Realtime Database](#4-data-layer--firebase-realtime-database)
> - [5. 🎯 AI stack](#5-ai-stack)
> - [6. 🚀 Backend — Cloudflare Worker](#6-backend--cloudflare-worker)
> - [7. 📚 CI/CD & deployment](#7-cicd--deployment)
> - [8. 🧪 Testing](#8-testing)
> - [9. 🔒 Security & privacy stack](#9-security--privacy-stack)
> - [10. 📝 Reference index](#10-reference-index)

> **📊 Status Summary**
>
> | Area | Status |
> |---|---|
> | Application shell (Next 15 / React 19 / TS) | ✅ Verified (`package.json:55,58-59,78`) |
> | Editor & terminal (CodeMirror 6, xterm) | ✅ Verified (`package.json:18-38,43-44`) |
> | Local file storage (IndexedDB) | ✅ Verified (idb-keyval, `package.json:50`) |
> | AI — local + cloud | ✅ Verified (Ollama, transformers, Worker proxy) |
> | Auth (Firebase Google/GitHub) | ✅ Verified to consent screen |
> | Data tier (Firebase Realtime Database) | ✅ Verified (`src/lib/firestore.ts`) |
> | Edge (Cloudflare Worker proxy) | ✅ Verified (workers/worker.ts, live site) |
> | GitHub OAuth proxy | 🎯/⚠️ Implemented but NOT enabled in production |
> | CI/CD | ✅ Verified (`.github/workflows/ci.yml`) |
> | npm audit in CI | ✅ Implemented (`.github/workflows/ci.yml` job `audit`; `npm audit --audit-level=high`) — 0 vulnerabilities as of Sep 2026-09-14 |

<!-- AGENT: Platform -->
## 1. 🏗️ Platform overview

VantaOS is a browser-based cloud OS/IDE that renders completely client-side.
The Next.js app builds a static export into `out/`, which a **single
Cloudflare Worker** serves along with an `/api/*` proxy. The data tier is
**Firebase Realtime Database** in the same Firebase project used for sign-in.
There is no traditional backend server for the product surface; all product
logic runs in the browser and calls Firebase directly.

```
┌───────────────────────────┐        ┌──────────────────────────────────────┐
│  BROWSER                  │        │  CLOUDFLARE WORKER (single)          │
│  Next.js static export    │ ─────▶ │  • serves out/ static assets         │
│  CodeMirror 6 · xterm     │  https │  • /api/health · /api/ai/generate    │
│  IndexedDB file store     │  :443  │  • /api/gh/* GitHub OAuth proxy      │
│  Workspace opslog         │  ▲     │  • rate limit 100 req/60 s           │
└───────────┬───────────────┘  │     └──────────────────────────────────────┘
            │                  │                 │
            │  Firebase SDK    │                 │ /api/ai/generate (cloud AI)
            ▼                  │                 ▼
┌───────────────────────────┐  │        ┌──────────────────────────────────┐
│  FIREBASE PROJECT         │  │        │  LOCAL-ONLY (no server)          │
│  website-6e8b1            │  └──────▶ │  • Ollama  (localhost:11434)     │
│  Realtime Database        │           │  • @huggingface/transformers     │
│  Google / GitHub sign-in  │           │    (WebGPU/WASM in-page)         │
│  database.rules.json      │           └──────────────────────────────────┘
└───────────────────────────┘
```

- **Deployment:** static `out/` served by one Cloudflare Worker
  (`wrangler.toml`). **LIVE:** `https://website.vasudevaya.workers.dev`
  (deployed version `f7532256`). Rollback is `npx wrangler rollback`.
- **Confirmed boundaries:** no Cloudflare Pages, no KV bound in production
  paths, no `vantaos.dev` domain.
- **Auth:** Firebase Google/GitHub sign-in to project `website-6e8b1`
  (verified as far as the consent screen). When no `NEXT_PUBLIC_FIREBASE_*`
  vars are set the app runs in labeled **demo mode** (`src/lib/env.ts`).
- **Data:** Firebase Realtime Database nodes `profiles/`, `threads/`,
  `replies/`, `upvotes/` with realtime `onValue()` subscriptions.

<!-- AGENT: Platform -->
## 2. 📦 Application layer

### 2.1 Framework and language

- **Next.js 15** (`package.json:55`) with a static export (`output: 'export'`
  in `next.config.mjs`).
- **React 19** + server-rendered shell (`package.json:58-59`).
- **TypeScript ~5.8.2** (`package.json:78`). `npm run lint` runs
  `tsc --noEmit` (`package.json:9`) — a typecheck, not a linter.

### 2.2 UI & interaction

- **Tailwind CSS v4** utilities: `@tailwindcss/postcss`
  (`package.json:40`), `tailwindcss` (`package.json:77`).
- **Motion** for transitions (`package.json:54`).
- **Lucide React** icons (`package.json:53`).
- **React Virtuoso** virtualized lists (`package.json:60`).
- **date-fns** formatting (`package.json:45`).
- **Sentry React** error telemetry in the bundle (`package.json:42`).

### 2.3 Editor & terminal

- **CodeMirror 6** as the editor core: `@codemirror/autocomplete`,
  `@codemirror/commands`, `@codemirror/language`, `@codemirror/search`,
  `@codemirror/state`, `@codemirror/view`, plus 15 language modes
  (`@codemirror/lang-cpp` … `lang-python` … `lang-yaml`) and
  `@codemirror/merge` for the diff view (`package.json:18-38`).
- **@lezer/highlight** for syntax highlighting grammars
  (`package.json:39`).
- Diff editor surfaces `@codemirror/merge` via the `CloudDiffEditor`
  component; find-and-replace uses `@codemirror/search`.
- **xterm.js** terminal: `@xterm/xterm` plus `@xterm/addon-fit`
  (`package.json:44,43`), driven by a sandboxed `SandboxRunner`
  (Web Worker executing with `new Function`).
- **Prettier** as a lazy formatter (`package.json:57`).

### 2.4 Test & tooling devDependencies

- Testing library: `@testing-library/jest-dom`, `@testing-library/react`,
  `@testing-library/user-event` (`package.json:66-68`), `jsdom`
  (`package.json:76`), `vite` (79), `vitest` (80).
- Accessibility assertions: `axe-core` (`package.json:74`).
- IndexedDB test doubles / workers: `fake-indexeddb` (75),
  `@vitejs/plugin-react` (73).
- E2E: `@playwright/test` (69).
- Types / infra: `@types/node`, `@types/react`, `@types/react-dom`
  (`package.json:70-72`), `wrangler` (81).

<!-- AGENT: Editor/Terminal -->
## 3. 💻 Client & storage libraries

- **idb-keyval** (`package.json:50`) wraps the IndexedDB database
  **`vantaos_cloudos_files_v2`** with `files/` and `metadata/` stores used by
  the CloudOS file system (`src/lib/db.ts`).
- **DOMPurify** (`package.json:47`) sanitizes rendered HTML before insertion
  (`src/lib/sanitize.ts`).
- **JSZip** (`package.json:51`) + **file-saver** (`package.json:48`) perform
  explicit user-initiated ZIP export of the workspace (`src/lib/workspace/export.ts`).
- **node-forge** (`package.json:56`) provides browser crypto helpers.
- **diff** (`package.json:46`) powers text diffing in the editor/export paths.
- **Google Drive sync** (`src/lib/drive.ts`): direct browser calls to Drive
  REST v3 using the bearer token captured during Firebase Google sign-in.
  Scopes `drive.readonly` + `drive.file` are declared at
  `src/lib/drive.ts:8-9`; the access token is cached with a TTL and cleared on
  sign-out. App writes only into files/folders it created.
- **GitHub integration** (`src/lib/github.ts`): browser-stored token with
  direct REST calls; push writes blob → tree → commit and updates the branch
  ref; the UI caps clones at 200 blobs with a warning.
- **Workspace operations log** (`src/lib/workspace/operations.ts`) is the
  deterministic op layer behind the file store, with export support
  (`src/lib/workspace/export.ts`).

<!-- AGENT: Data -->
## 4. 📊 Data layer — Firebase Realtime Database

The data tier is the **Firebase Realtime Database**. The legacy module name
`src/lib/firestore.ts` still carries the RTDB wrapper; `isFirestoreAvailable()`
at `src/lib/firestore.ts:43` is a legacy alias for `isFirebaseConfigured()`. Do
not present Firestore as the data tier.

- **Nodes:**
  - `profiles/{uid}` — denormalized user profile.
  - `threads/{id}` — forum threads (denormalized author fields).
  - `replies/{id}` — forum replies.
  - `upvotes/{uid}_{tid}_{rid}` — deterministic key, dedupes votes.
- **Events:** counters update atomically with `increment()`; realtime streams
  use `onValue()` subscriptions (`src/lib/firestore.ts`).
- **Rules:** `database.rules.json`; deploy with
  `firebase deploy --only database`.
- **Auth:** Firebase Google/GitHub sign-in to project `website-6e8b1`
  (`firebase` at `package.json:49`).
- **Demo mode:** `isFirebaseConfigured()` in `src/lib/env.ts` requires four
  `NEXT_PUBLIC_FIREBASE_*` values (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`,
  `APP_ID`); when any is missing, `DEMO_MODE` is set and auth falls back to
  `src/lib/demoAuth.ts`.

> **🟡 WARNING — known legacy artifacts:**
> `firebase:deploy` (`package.json:15`) is **stale** — it targets
> `--only firestore:rules,firestore:indexes`, but the project has no Firestore
> deployment path. The current data-tier deploy is
> `firebase deploy --only database` (rules: `database.rules.json`). The script
> is kept as history and must not be used as the current deploy path.

<!-- AGENT: AI -->
## 5. 🎯 AI stack

- **Local inference:** `@huggingface/transformers` (`package.json:41`) runs
  in-page models via WebGPU/WASM through the WebModel adapter
  (`src/lib/models/adapter.ts`); local **Ollama** serves models on
  `localhost:11434` with pull-progress streaming into the model hub.
- **Cloud inference:** the Worker's `/api/ai/generate` route proxies to cloud
  providers (`src/lib/ai/providers.ts`) with a provider registry
  (`src/lib/ai/provider-registry.ts`) and orchestrator
  (`src/lib/ai/orchestrator.ts`).
- **Gemini gating:** cloud Gemini is env-gated on `GEMINI_API_KEY`
  (`workers/worker.ts`); `isGeminiConfigured()` returns `false` by default in
  `src/lib/env.ts`, so cloud AI is **not configured in production** on the
  mainline (`🔄` runtime-detected).
- **Model catalog & safety:** model manifests/downloads and device profiles
  live under `src/lib/models/`; tool permissions and AI redaction under
  `src/lib/ai/` (rate limiter, tool-permission prompts).

<!-- AGENT: Deploy -->
## 6. 🚀 Backend — Cloudflare Worker

A single first-party Worker (`workers/worker.ts`, config in `wrangler.toml`)
serves the static `out/` directory and intercepts `/api/*`.

- **Routes:** `/api/health`, `/api/ai/generate` (cloud AI), `/api/gh/*`
  (GitHub OAuth proxy). SPA fallback for non-API paths.
- **Rate limit:** 100 requests per 60-second window per client key
  (`workers/worker.ts`).
- **Env surface** (`Env` in `workers/worker.ts`): `GEMINI_API_KEY`,
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GH_GRANT_SECRET`, `GH_TOKENS`
  (KV), `APP_ORIGIN`, `NEXT_PUBLIC_FIREBASE_*`.
- **GitHub OAuth proxy status:** ⚠️ implemented but **not enabled in
  production** — it is presence-guarded on `GH_GRANT_SECRET` +
  `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` + the `GH_TOKENS` KV, none of which
  are bound in prod (`🎯` future enablement).
- **Live deployment:** `https://website.vasudevaya.workers.dev` (version
  `f7532256`); `deploy` script at `package.json:12` (build + `wrangler
  deploy`). Rollback: `npx wrangler rollback`.
- No KV is used on production request paths; no Cloudflare Pages.

<!-- AGENT: Deploy -->
## 7. 📚 CI/CD & deployment

### Scripts (`package.json:6-15`)

| Script | Line | Command | Status |
|---|---|---|---|
| `dev` | 7 | `next dev` | ✅ current |
| `build` | 8 | `next build` | ✅ current |
| `lint` | 9 | `tsc --noEmit` | ✅ current (typecheck, not linter) |
| `test` | 10 | `vitest run` | ✅ current |
| `start` | 11 | `npx serve out` | ✅ current (static preview) |
| `deploy` | 12 | `npm run build && npx wrangler deploy` | ✅ current |
| `cf-preview` | 13 | `npm run build && npx wrangler dev` | ✅ current |
| `firebase:setup` | 14 | `bash scripts/firebase-setup.sh` | ✅ current |
| `firebase:deploy` | 15 | `firebase deploy --only firestore:rules,firestore:indexes` | 🔄 stale — targets Firestore; data tier is RTDB (`firebase deploy --only database`) |

### GitHub Actions (`.github/workflows/ci.yml`)

- **lint:** `npx tsc --noEmit` (Node 22).
- **test:** `npx vitest run`.
- **build:** `next build` (Next static export), then `npx opennextjs-cloudflare build` (Worker bundle).
- **e2e:** build + `playwright install` + 9 Playwright cases across 7 files.
- Triggered on push to `main` and pull requests.

### Deploy & rollback

- Rules deploy (real): `firebase deploy --only database` using
  `database.rules.json`.
- Worker deploy: `npm run deploy` (`package.json:12`), rollback with
  `npx wrangler rollback`. Live site: `https://website.vasudevaya.workers.dev`.

> **🟢 INFO — dependency audit automated:** CI runs an `npm audit` job
> (`audit` in `.github/workflows/ci.yml`, `npm audit --audit-level=high`);
> as of 2026-09-14 a full `npm audit` reports **0 vulnerabilities**.

<!-- AGENT: Testing -->
## 8. 🧪 Testing

- **Unit (Vitest):** `1047/1047` passing across **65 files**
  (`npm test`, `package.json:10`).
- **E2E (Playwright):** **9 cases** across **7 files** in `tests/e2e/flows/`
  (auth, home, files, ide, omni-ai, terminal), config at
  `tests/e2e/playwright.config.ts`.

Suites by directory:

| Directory | Focus |
|---|---|
| `tests/phase1/` (9) | Workspace ops, paths, outbox recovery, export, conflict, build state, multi-tab, legacy |
| `tests/phase2/` (2 + Node worker harness) | Terminal runner, commands |
| `tests/phase3/` (7) | AI streaming, fallback, redaction, rate limiter, provider registry, tool permissions |
| `tests/phase4/` (1) | WebModel manifests |
| `tests/phase5/` (5) | GitHub proxy, grants, client fallback, Firebase ID-token verify |
| `tests/phase6/` (7) | Sync batch, conflict, protocol, recovery, reconnect storm, convergence |
| `tests/phase8/` (1) | Per-service health endpoints |
| `tests/phase9/` (3) | Plugin loader, manifest, registry |
| `tests/phase-schema/` (10) | Schemas, contracts, SLOs, runbooks, edge contract, telemetry |
| `tests/contract/` (3) | Workspace / terminal / model contracts |
| `tests/` root (12) | Telemetry (Sentry, LogRocket), sources, security, edge/manifest/migration edges |
| `tests/e2e/flows/` (7) | Playwright end-to-end flows |

<!-- AGENT: Browser -->
## 9. 🔒 Security & privacy stack

- **Data-tier rules:** Firebase Realtime Database gated by
  `database.rules.json`; auth-aware read/write on `profiles/`, `threads/`,
  `replies/`, `upvotes/`.
- **Output sanitization:** DOMPurify (`package.json:47`) applied via
  `src/lib/sanitize.ts` before HTML rendering.
- **Edge rate limiting:** 100 req / 60 s in `workers/worker.ts` protects the
  API proxy surface.
- **Secrets are env-only:** cloud AI key via `wrangler secret put
  GEMINI_API_KEY` (absent in prod ⇒ Gemini off by default); GitHub OAuth
  secrets (`GH_GRANT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
  `GH_TOKENS`) are not bound in production, so `/api/gh/*` is disabled.
  `NEXT_PUBLIC_FIREBASE_*` in `wrangler.toml` are public Firebase web config
  by design.
- **GitHub OAuth proxy:** 🎯/⚠️ implemented, presence-guarded, **not enabled
  in prod**; browser-stored GitHub token is a known limitation of the current
  direct-integration path.
- **Demo mode:** labeled fallback (`DEMO_MODE` in `src/lib/env.ts`) when
  Firebase is not configured — never presented as production auth.
- **Telemetry:** Sentry (`@sentry/react`, `package.json:42`) + LogRocket
  (`package.json:52`) initialized via `src/lib/telemetry/index.ts`; prompts,
  outputs, and credentials are expected to be redacted from events.
- **Supply chain:** overrides pin `adm-zip` 0.6.1, `sharp` 0.35.4, `postcss`
  8.5.28 (`package.json` `overrides`); `npm audit` runs in CI (job `audit`,
  `--audit-level=high`) — ✅ 0 vulnerabilities as of Sep 2026-09-14.

<!-- AGENT: Testing -->
## 10. 📝 Reference index

| Module | Purpose |
|---|---|
| `package.json` | Manifest (88 lines): scripts 6-15, deps 17-61, overrides 62-64, devDeps 65-82, override pins 83-87 |
| `next.config.mjs` | Static export build config |
| `wrangler.toml` | Worker config — name `website`, `main: workers/worker.ts`, `[assets] directory = "out"`, `[vars]` Firebase web config |
| `workers/worker.ts` | API routes, rate limit, static + SPA serving, `Env` surface |
| `workers/github-proxy.ts` | GitHub OAuth service using `KvLike` token store |
| `workers/grants.ts`, `workers/firebase-verify.ts` | Grant + Firebase ID-token verification for the proxy |
| `.github/workflows/ci.yml` | CI: lint, test, build, e2e, audit |
| `database.rules.json` | RTDB security rules (deploy: `firebase deploy --only database`) |
| `src/lib/env.ts` | Capability detection: `isFirebaseConfigured()` (4 `NEXT_PUBLIC_FIREBASE_*` vars), `isGeminiConfigured()` (false by default), `DEMO_MODE` |
| `src/lib/firestore.ts` | **Realtime Database** data layer; `isFirestoreAvailable()` legacy alias at line 43 |
| `src/lib/firebase.ts` | Firebase app + Google/GitHub auth setup |
| `src/lib/demoAuth.ts` | Demo-mode auth fallback |
| `src/lib/client.ts` | Unified `client` facade (auth, storage, ai, sync) |
| `src/lib/drive.ts` | Google Drive v3 browser calls; scopes `drive.readonly` + `drive.file` at lines 8-9; token TTL cache |
| `src/lib/github.ts` | GitHub REST client (blob/tree/commit/ref push) |
| `src/lib/models/adapter.ts` | WebModel adapter registry (`@huggingface/transformers` pipeline) |
| `src/lib/ai/` | Providers, provider registry, orchestrator, rate limiter, tool permissions |
| `src/lib/workspace/` | Opslog (`operations.ts`), export (`export.ts`), outbox, conflict, migrations, db |
| `src/lib/terminal/` | SandboxRunner, runner, quota, commands |
| `src/lib/telemetry/` | Sentry + LogRocket init and event API |
| `src/lib/schema/` | Operation/validation schemas |
| `src/lib/slo/`, `src/lib/incident-runbooks/` | SLO checks + incident runbooks |
| `src/lib/plugins/`, `src/lib/sync/` | Plugin registry; sync protocol/batch/conflict |
| `src/components/` | App shell, `CloudCodeEditor`, `CloudDiffEditor`, terminal panel |
| `tests/` | Vitest suites (65 files, 1047 tests); `tests/e2e/` Playwright (9 cases / 7 files) |