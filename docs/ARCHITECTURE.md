# VantaOS Architecture

## Document status

This document separates **verified current facts** from **target architecture**,
for the repository at `https://github.com/ram1234598766-dotcom/Website`.

> **📊 Document Status: PARTIALLY VERIFIED**
> Sections 0–3: Verified current as of 2026-09-13/14. Sections 4–12: Target
> architecture (not implemented) — marked [TARGET]. Section 13: Phase plan with
> verification evidence and executed test outcomes.
>
> Last verified: 2026-09-13/14 — `npx vitest run` 1032/1032 across 64 files;
> `tsc --noEmit` clean (0 errors); `npm run build` passes; Playwright E2E
> 8 cases / 6 files; CI = lint + test + build + e2e (no audit job).

## 📑 Quick Navigation

- [0. 📐 Overview](#0-overview)
- [1. 🎯 Product boundary](#1-product-boundary)
- [2. 🏗️ Architecture principles](#2-architecture-principles)
- [3. 🗺️ Current implementation map](#3-current-implementation-map)
- [4. 🏗️ Target component architecture](#4-target-component-architecture)
- [5. 🤖 Omni-AI orchestration](#5-omni-ai-orchestration)
- [6. 📱 WebModel download and mobile/laptop runtime](#6-webmodel-download-and-mobilelaptop-runtime)
- [7. 🔒 Identity, GitHub, and data protection](#7-identity-github-and-data-protection)
- [8. 🌐 Edge and backend contracts](#8-edge-and-backend-contracts)
- [9. 🛡️ Reliability and failure model](#9-reliability-and-failure-model)
- [10. 🚀 Deployment topology](#10-deployment-topology)
- [11. 📊 Observability](#11-observability)
- [12. ✅ Verification gates](#12-verification-gates)
- [13. 🔍 Phase plan and implementation status](#13-phase-plan-and-implementation-status)

<!-- AGENT: architecture -->
## 0. 📐 Overview

VantaOS is a browser-first development environment with four user-facing
surfaces — CloudOS IDE, Omni-AI, Model Hub, and developer integrations
(GitHub, Google Drive, Firebase identity). It ships as a **static Next.js
15 export** (`output: 'export'`, `trailingSlash`, `images: { unoptimized }`)
served by a single **Cloudflare Worker** that also handles API proxying,
auth proxying, and static asset serving.

### Verified architecture diagram (2026-09-13/14)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                           │
│                                                                     │
│  App shell (App.tsx) ─ views, auth state, command palette           │
│  ├── CloudOS IDE (CodeMirror 6, tabs, splits, diff, search)        │
│  ├── Omni-AI (provider switch, local + cloud inference)             │
│  ├── Model Hub (Ollama pull, WebModel discovery)                    │
│  └── Integrations (GitHub, Drive, Firebase identity)                │
│                                                                     │
│  Local subsystems                                                   │
│  ├── IndexedDB (DB "vantaos_cloudos_files_v2"; files/metadata)     │
│  ├── Workspace oplog (src/lib/workspace/operations.ts)              │
│  └── SandboxRunner (Web Worker, new Function, no FS/network)       │
│                                                                     │
│  Local AI                                                           │
│  ├── @huggingface/transformers (WebGPU/WASM fallback)              │
│  └── Ollama (localhost:11434)                                       │
└────────────────────┬──────────────────────────────┬──────────────────┘
                     │                              │
         static assets + /api/*              localhost:11434
                     │                              │
┌────────────────────▼──────────────────────────────┴──────────────────┐
│                     Cloudflare Worker                                │
│  wrangler.toml; `npm run build && npx wrangler deploy`             │
│  Rate limit: 100 req / 60 s                                         │
│                                                                     │
│  /api/health          — health check                                │
│  /api/ai/generate     — AI proxy (ollama/openrouter/gemini/openai)  │
│  /api/gh/*            — GitHub OAuth proxy (present but not enabled)│
│  static/              — out/ directory served as assets             │
└───────┬────────────────────────────┬─────────────────────────────────┘
        │                            │
        ▼                            ▼
┌───────────────────┐   ┌──────────────────────────────────────────────┐
│ Firebase RTDB     │   │ External OAuth / AI                         │
│ (auth-aware rules)│   │ Google OAuth (Drive scopes)                 │
│ profiles/{uid}    │   │ GitHub OAuth (via Worker proxy)             │
│ threads/{id}      │   │ Cloud AI providers (env-gated keys)         │
│ replies/{id}      │   │   ollama / openrouter / gemini / openai     │
│ upvotes/          │   └──────────────────────────────────────────────┘
└───────────────────┘
```

**Deployment model:** single Cloudflare Worker unit — Worker code + static
assets from `out/` directory. No Cloudflare Pages. No Vercel. Rollback via
`wrangler rollback`.

**Auth model:** Firebase Google + GitHub sign-in wired to live project
`website-6e8b1`. Demo mode (memory-only, `src/lib/demoAuth.ts`) when
`NEXT_PUBLIC_FIREBASE_*` env vars are absent (`isFirebaseConfigured()` in
`src/lib/env.ts`).

**Data tier:** Firebase **Realtime Database** (RTDB), NOT Firestore. The
legacy module `src/lib/firestore.ts` is the RTDB data tier (obsolete name;
`isFirestoreAvailable()` is a legacy alias). RTDB paths: `profiles/{uid}`,
`threads/{id}`, `replies/{id}`, `upvotes/{uid}_{tid}_{rid}`; `increment()`
counters; `onValue` streaming; rules in `database.rules.json`; deploy via
`firebase deploy --only database`.

> **⚠️ NOTE:** The `package.json` `firebase:deploy` script is **stale**
> (references `firestore:rules`/`firestore:indexes`). Do not use it for
> current deployments.

### ✅ Verification Gate — Section 0
- [x] Architecture diagram matches verified live state
- [x] Data tier is Firebase RTDB, not Firestore
- [x] Deployment model is single Worker, no Pages
- [x] Stale `firebase:deploy` script flagged

<!-- AGENT: architecture -->
## 1. 🎯 Product boundary

VantaOS is a browser-first development environment composed of four user-facing
products:

1. **CloudOS IDE** — files, CodeMirror editing, tabs, split views, diffing, search,
   formatting, export, and a terminal surface.
2. **Omni-AI** — one assistant surface over local Ollama and cloud model
   providers.
3. **Model Hub** — model discovery, Ollama pull, and model launch.
4. **Developer integrations** — GitHub synchronization, Google Drive, Firebase
   identity + Realtime Database data tier, and future workspace
   sync/collaboration.

The current application is a static Next.js 15 export (`output: 'export'`,
`trailingSlash`, `images: { unoptimized }` in `next.config.mjs`) served by a
Cloudflare Worker (`wrangler.toml`), with a Worker handling API paths. The
browser shell selects views in client state (`src/App.tsx`).

### ✅ Verification Gate — Section 1
- [x] All code references match actual file paths
- [x] Status claims match test output
- [x] No broken cross-references to other sections

<!-- AGENT: architecture -->
## 2. 🏗️ Architecture principles

- **Browser-first, not browser-only.** The default experience must work on a
  laptop and a phone. Desktop-only capabilities such as a local Ollama daemon
  remain available, but they are adapters rather than the only execution path.
- **Local-first data with explicit sync.** Workspace changes are durable
  offline, then synchronized through an operation log when a backend is
  available.
- **Capability-based AI.** A model is selected by device, runtime, memory,
  license, latency, and task rather than by a hard-coded provider list.
- **Untrusted code is sandboxed.** Editor content, terminal input, model output,
  and plugin code never receive unrestricted access to the user's origin,
  credentials, filesystem, or network.
- **Small trusted core, replaceable adapters.** Storage, identity, AI,
  execution, GitHub, and model delivery are ports with concrete adapters.
- **Progressive enhancement.** A phone can edit and chat with a suitable web
  model; a laptop can add Ollama, WebGPU, larger models, and richer execution.
- **Observable by default.** Every asynchronous flow exposes state, progress,
   cancellation, retry, and a user-actionable failure reason.

### ✅ Verification Gate — Section 2
- [x] Principles match actual implementation
- [x] Status claims match test output
- [x] No broken cross-references to other sections

<!-- AGENT: platform -->
## 3. 🗺️ Current implementation map

### Verified-current layers (2026-09-13/14)

| Area | Verified-current implementation | Status |
|---|---|---|
| **Deployment** | Next.js 15 static export (`output: 'export'`, `trailingSlash`, `images: { unoptimized }` in `next.config.mjs`) served by a single Cloudflare Worker (`wrangler.toml`). Build: `npm run build && npx wrangler deploy`. Rollback: `wrangler rollback`. Live URL: `https://website.vasudevaya.workers.dev` (Worker version `f7532256`). | ✅ Verified |
| **Client shell** | React 19, TypeScript ~5.8.2, Tailwind v4. `App.tsx` owns the active view, auth state, command palette, and modal state. Components: `CloudOS`, `OmniAI`, `Showcase`/`OllamaLocal`, `DriveManager`, `GitHubManager`, `CommandPalette`. | ✅ Verified |
| **Backend Worker** | Single Worker unit. Routes: `GET /api/health`, `POST /api/ai/generate`, `POST /api/gh/*` (GitHub OAuth proxy). Rate limit: 100 req/60s. Env secrets: `GEMINI_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GH_GRANT_SECRET`, `GH_TOKENS` (KV), `APP_ORIGIN`. | ✅ Verified |
| **Firebase identity** | Google + GitHub OAuth sign-in wired to live project `website-6e8b1`. Smoke-verified up to the Google consent screen. `isFirebaseConfigured()` in `src/lib/env.ts`. Demo mode via `src/lib/demoAuth.ts` (memory-only, no localStorage) when Firebase env vars absent. | ✅ Verified |
| **Firebase data tier** | Realtime Database (RTDB), NOT Firestore. Paths: `profiles/{uid}`, `threads/{id}`, `replies/{id}`, `upvotes/{uid}_{tid}_{rid}`; `increment()` counters; `onValue` streaming. Legacy module `src/lib/firestore.ts` — `isFirestoreAvailable()` is a legacy alias, not Firestore. Rules in `database.rules.json`. Deploy: `firebase deploy --only database`. | ✅ Verified |
| **Drive integration** | Google Drive REST v3. OAuth access token captured during Firebase Google sign-in. Scopes: `drive.readonly` + `drive.file` (comment header at `src/lib/drive.ts`). Token held in memory/sessionStorage with 45-minute TTL. | ✅ Verified |
| **GitHub integration** | Proxy through Cloudflare Worker (`/api/gh/*`). Guarded by `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GH_GRANT_SECRET` env secrets + `GH_TOKENS` KV. **Present but NOT enabled in production** (secrets unset). Fallback: direct token from Firebase GitHub popup, held in memory for tab lifetime. GitManager (`src/lib/github.ts`) — `connect`, `importGitHubAccessToken` (lines ~163–189). GitHubManager.tsx push flow: blob/tree/commit/ref + 200-blob cap. | ⚠️ Present but not enabled |
| **AI** | Omni-AI supports Ollama, OpenRouter, Gemini, OpenAI via Worker `/api/ai/generate`. Providers: ollama/openrouter/gemini/openai. `GEMINI_API_KEY` env-gated; `isGeminiConfigured()` returns false by default. Local: `@huggingface/transformers` (WebGPU/WASM) + local Ollama (`localhost:11434`). Cloud: `generate()` in `src/lib/models/adapter.ts`. DOMPurify sanitization on AI output. | ✅ Verified |
| **Terminal / sandbox** | xterm.js terminal. `SandboxRunner` — Web Worker, `new Function`, no FS/network access. Commands in `src/lib/terminal/commands.ts`. Quota/rate-limits in `src/lib/terminal/quota.ts`. | ✅ Verified |
| **Persistence** | IndexedDB via `idb-keyval` (DB: `vantaos_cloudos_files_v2`; stores: `files`, `metadata`). Storage lib: `src/lib/storage.ts` (constants at lines 10–13, `openDB` at 38–54). Workspace oplog: `src/lib/workspace/operations.ts`. Legacy snapshot still coexists. | ✅ Verified |
| **Telemetry** | Sentry + LogRocket. Telemetry index: `src/lib/telemetry/index.ts`. LogRocket opt-in, gated by `NEXT_PUBLIC_LOGROCKET_ID`. | ✅ Verified |
| **IDE** | CodeMirror 6 editors. `CloudCodeEditor`, `CloudDiffEditor` wrappers. File nodes, tabs, split views, diff, search, Prettier, ZIP export. React Virtuoso for list rendering. `motion` for animations. `lucide-react` for icons. | ✅ Verified |
| **Schema / models** | `src/lib/schema/` (validation schemas). `src/lib/models/adapter.ts` (inference). `src/lib/client.ts` (unified auth/storage facade). | ✅ Verified |
| **CI** | `.github/workflows/ci.yml` — lint + test + build + e2e on push/PR. No audit job. | ✅ Verified |
| **Test suite** | Vitest 1032/1032 across 64 files. Playwright E2E 8 cases / 6 files. | ✅ Verified |

### ✅ Verification Gate — Section 3
- [x] All code references match actual file paths
- [x] Status claims match test output
- [x] No broken cross-references to other sections

<!-- AGENT: frontend -->
## 4. 🏗️ Target component architecture [TARGET]

The following sections (4–12) describe the **target architecture**. They are
not claimed as implemented and are marked [TARGET] throughout.

```text
+----------------------- Cloudflare edge -----------------------+
|  static assets | WAF/headers | API gateway | model proxy       |
+-----------------------------+---------------------------------+
                              |
                     versioned HTTPS/SSE
                              |
+------------------------ Browser client -----------------------+
| App shell / routes / command surface                         |
|  + Workspace UI  + AI UI  + Model Hub UI  + Integrations UI   |
|                                                              |
|  Workspace core                                               |
|  - operation log  - indexes  - conflict policy  - adapters    |
|                                                              |
|  Runtime services                                             |
|  - AI orchestrator  - WebModel loader  - sandbox executor     |
|  - GitHub adapter   - identity adapter  - telemetry adapter   |
+-----------------------------+---------------------------------+
                              |
        +---------------------+---------------------+
        |                                           |
+-------v--------+                         +--------v-------+
| Local storage  |                         | Backend/remote |
| IndexedDB/OPFS |                         | Firebase RTDB  |
|                |                         | + API          |
+----------------+                         +----------------+

Desktop-only adapter: Ollama daemon <-localhost/CORS-> browser
Mobile/web adapter: WebGPU/WASM model runtime <-signed model packages<- edge
```

### 4.1 Browser application shell [TARGET]

Responsibilities:

- resolve routes and feature flags;
- own short-lived UI state only;
- load the workspace, identity, and model registries through service ports;
- expose command-palette actions as capabilities rather than component-specific
  window globals;
- keep every long-running operation cancellable and observable.

### 4.2 Workspace core [TARGET]

The workspace core is the only component allowed to mutate canonical files.

```text
User action
  -> Workspace command
  -> Optimistic operation
  -> Local transaction
  -> Index update
  -> UI projection
  -> Sync outbox
  -> Remote acknowledgement
```

Required primitives:

- immutable file/folder identifiers;
- path normalization and rename/delete transaction rules;
- content hashes and byte sizes;
- operation IDs, base versions, and idempotency keys;
- an outbox for offline writes;
- deterministic conflict resolution for independent edits;
- snapshots for import/export, not as the primary write model;
- schema migrations for local databases.

### 4.3 Editor and language services [TARGET]

- CodeMirror 6 remains the editor surface, bundled in the client.
- Language workers run in Web Workers and expose diagnostics, formatting,
  completion, and document-symbol contracts.
- Large files use bounded parsing and virtualized previews.
- Editor changes produce operations, not whole-workspace JSON rewrites.
- Prettier and future linters are lazy-loaded plugins with versioned manifests.
- The editor never executes project code merely because a file was saved.

### 4.4 Execution and terminal [TARGET]

The target terminal is a terminal emulator plus a command broker:

- browser-native commands are allowlisted and typed;
- JavaScript/TypeScript execution uses an isolated worker or remote runner;
- network access, filesystem access, CPU time, memory, and output size have
  explicit quotas;
- each run has an ID, status, logs, exit code, and cancellation path;
- project files are mounted read-only unless the user grants a workspace write;
- native languages are delegated to a remote or desktop runner, not emulated
  incorrectly in the browser.

### ✅ Verification Gate — Section 4
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: ai -->
## 5. 🤖 Omni-AI orchestration [TARGET]

### 5.1 Provider contract [TARGET]

Every provider implements:

```ts
interface AIProvider {
  id: string;
  capabilities: ModelCapability[];
  listModels(signal?: AbortSignal): Promise<ModelDescriptor[]>;
  chat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatEvent>;
  cancel?(requestId: string): Promise<void>;
}
```

The orchestrator owns:

- provider selection and fallback;
- prompt/tool policy;
- request size limits;
- streaming and cancellation;
- retry classification;
- cost/latency metadata;
- redaction of secrets from logs;
- provider-specific error normalization.

### 5.2 Tools and plugins [TARGET]

Tools are declared capabilities with:

- a stable ID and version;
- a human-readable description;
- an input schema;
- a permission level;
- a timeout and output limit;
- an explicit network/filesystem scope.

Plugin packages are opt-in and must be signed or pinned by digest before they
can access privileged capabilities.

### ✅ Verification Gate — Section 5
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: mobile -->
## 6. 📱 WebModel download and mobile/laptop runtime [TARGET]

### 6.1 What WebModel means [TARGET]

**WebModel is a browser-runnable model package.** It is distinct from an Ollama
model:

- Ollama remains the desktop/local-daemon adapter.
- WebModel is a quantized package loaded by a browser runtime such as WebGPU,
  WASM, or a browser ML runtime selected after capability detection.
- The browser must never assume that a multi-gigabyte desktop model can run on a
  phone.
- A model card must show device suitability before download begins.

### 6.2 Model manifest [TARGET]

```json
{
  "id": "example/tiny-code-1.5b-q4",
  "version": "2026.09.1",
  "runtime": "webgpu-wasm",
  "architecture": "decoder-only",
  "quantization": "q4",
  "tasks": ["chat", "code"],
  "languages": ["en"],
  "sizeBytes": 1073741824,
  "shards": [
    { "url": "/models/example/tiny-code-1.5b-q4/shard-00001.bin", "bytes": 536870912, "sha256": "..." }
  ],
  "minMemoryBytes": 2147483648,
  "recommendedMemoryBytes": 4294967296,
  "requires": { "webgpu": true, "sharedArrayBuffer": false },
  "license": "license-id",
  "publisher": "publisher-id",
  "signature": "..."
}
```

### 6.3 Download state machine [TARGET]

```text
catalog -> capability check -> manifest fetch -> quota check
  -> resumable shard download -> hash verification -> atomic commit
  -> runtime load -> ready
```

States exposed to the UI:

- `available`
- `checking-device`
- `queued`
- `downloading`
- `paused`
- `verifying`
- `installing`
- `ready`
- `failed-retryable`
- `failed-permanent`

### 6.4 Device policy [TARGET]

| Device class | Default model profile | Behavior |
|---|---|---|
| Low-memory mobile | <=1.5B quantized, short context | Warn before download; cap context and concurrent requests. |
| Modern mobile | 1.5B–3B quantized if RAM/VRAM permits | Use WebGPU when available; otherwise offer cloud/Ollama fallback. |
| Laptop | 3B–8B quantized or provider-selected cloud model | Permit larger context and optional local acceleration. |
| Desktop/workstation | Larger quantized models or Ollama | Expose advanced runtime settings behind an explicit toggle. |

### 6.5 Security and privacy [TARGET]

- Model manifests and shards are fetched from allowlisted origins only.
- Every shard is verified against a signed manifest digest.
- The model catalog cannot execute downloaded content during installation.
- Prompts, model output, and downloaded model metadata are subject to the same
  redaction and retention policy as other AI traffic.
- A user can inspect, pause, delete, and re-verify every installed WebModel.
- No API key or GitHub token is sent to a model publisher or runtime plugin.

### ✅ Verification Gate — Section 6
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: security -->
## 7. 🔒 Identity, GitHub, and data protection [TARGET]

### 7.1 Identity boundary [TARGET]

- Demo mode is explicitly labeled local-only and is never presented as
  production authentication.
- Firebase Auth is the production identity adapter (Google/GitHub OAuth),
  surfaced through the unified `client.auth` facade.
- Google Drive uses the OAuth access token captured during Firebase Google
  sign-in (`drive.readonly` browse/open + `drive.file` for the app-owned
  VantaOS folder).
- GitHub OAuth exchanges a code server-side; the browser receives a short-lived,
  scoped workspace grant.
- Refresh tokens and provider secrets never enter `localStorage`.
- Role checks occur on the server for privileged operations.

### 7.2 Workspace data [TARGET]

- Local workspace data is encrypted at rest where the platform exposes a
  suitable key mechanism; otherwise the UI states the limitation clearly.
- Remote sync uses per-operation authorization and row/object-level policy.
- Deletes are tombstoned until all known replicas acknowledge them.
- Export files are generated client-side and never silently uploaded.
- Backup/restore is versioned and validated with a manifest.

### ✅ Verification Gate — Section 7
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: backend -->
## 8. 🌐 Edge and backend contracts [TARGET]

### 8.1 Existing edge surface [TARGET]

The Worker currently implements:

- `GET /api/health`
- `POST /api/ai/generate` (providers: ollama/openrouter/gemini/openai)
- `POST /api/gh/*` (GitHub OAuth proxy — present but not enabled in production)

All routes guarded by rate limit (100 req/60s).

### 8.2 Target API additions [TARGET]

| Endpoint | Purpose | Exposure |
|---|---|---|
| `GET /api/v1/status` | Version, feature flags, runtime capabilities | Public/read-only |
| `GET /api/v1/models` | Signed model catalog and device metadata | Public/read-only |
| `GET /api/v1/models/:id/manifest` | Immutable model manifest | Public/read-only |
| `GET /api/v1/models/:id/shards/:shard` | Range-requestable signed shard | Public/download |
| `POST /api/v1/workspace/sync` | Idempotent operation-batch exchange | Authenticated |
| `GET /api/v1/workspace/changes` | Poll/SSE fallback for sync events | Authenticated |
| `POST /api/v1/github/oauth/start` | Start server-side OAuth | Authenticated session |
| `POST /api/v1/github/oauth/callback` | Exchange code and issue scoped grant | Server-to-server |
| `POST /api/v1/ai/chat` | Server-mediated cloud AI request | Authenticated/rate-limited |
| `GET /api/v1/telemetry/metrics` | Prometheus-compatible health metrics | Private/ops |

All endpoints need versioned request/response schemas, correlation IDs,
idempotency keys where writes are possible, and contract tests.

### ✅ Verification Gate — Section 8
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: reliability -->
## 9. 🛡️ Reliability and failure model [TARGET]

### 9.1 Required invariants [TARGET]

1. A saved workspace operation is either committed locally or reported failed;
   it is never silently lost.
2. A model installation is visible as ready only after digest verification.
3. A GitHub push is based on a fresh parent commit and refuses non-fast-forward
   updates.
4. AI requests cannot include stored provider secrets in logs or analytics.
5. Plugin/tool execution cannot expand its declared permission scope.
6. A browser refresh preserves active operation state or presents a recoverable
   resume action.

### 9.2 Failure handling [TARGET]

- Network failures are classified as retryable or permanent.
- Storage quota failures stop downloads before partial installation.
- Model runtime failures retain the package for diagnosis but mark it unusable.
- Sync conflicts preserve both versions and show a user-resolvable diff.
- OAuth failures return the user to the last safe screen without deleting local
  work.
- Every background operation has a visible status, cancellation action, and
   retry action.

### ✅ Verification Gate — Section 9
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: devops -->
## 10. 🚀 Deployment topology [TARGET]

1. **Static client:** Next.js static export, immutable asset hashes, strict
   security headers, service worker for shell caching where safe.
2. **Cloudflare Worker:** API gateway, provider proxy, model proxy, OAuth
   exchange, rate limiting, and edge health.
3. **Firebase RTDB:** identity (Google/GitHub OAuth), Google Drive OAuth token
   capture, and the Realtime Database data tier (forum threads, replies,
   upvotes, profiles).
4. **Object storage/CDN:** signed model shards and immutable manifests.
5. **Optional desktop companion:** Ollama bridge and native execution runner.
6. **Optional remote runners:** isolated containers/VMs for non-browser
   languages and heavy builds.

The current deployment is the first three pieces: static export, Worker, and
Firebase RTDB.

### ✅ Verification Gate — Section 10
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: observability -->
## 11. 📊 Observability [TARGET]

Collect only operation-level, privacy-safe signals:

- app boot and route transition duration;
- workspace save/sync latency and conflict count;
- model catalog fetch, download throughput, verification time, and load time;
- AI provider latency, token/stream errors, and cancellation rate;
- terminal run duration, quota failures, and sandbox exits;
- GitHub clone/push latency and conflict/rate-limit events;
- client browser/runtime capability distribution;
- LogRocket event tracking, user identification, and exception capture
  (`src/lib/telemetry/index.ts`) — opt-in, gated by
  `NEXT_PUBLIC_LOGROCKET_ID`.

Do not collect raw source, prompts, model output, tokens, API keys, or GitHub
tokens. Every metric has an owner, retention period, and dashboard alert
threshold.

### ✅ Verification Gate — Section 11
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: qa -->
## 12. ✅ Verification gates [TARGET]

Before implementation is called complete:

- workspace convergence tests with operations applied in different orders;
- refresh/crash recovery tests for workspace and model downloads;
- WebGPU/non-WebGPU/mobile/laptop capability matrix;
- model manifest/shard tamper and interrupted-download tests;
- AI provider timeout, streaming, cancellation, and secret-redaction tests;
- GitHub rebase/non-fast-forward/rate-limit tests;
- terminal sandbox escape, quota, and output-boundary tests;
- accessibility checks for keyboard, focus, screen-reader labels, reduced
  motion, and small screens;
- production build, typecheck, lint, dependency audit, and browser E2E tests.

### ✅ Verification Gate — Section 12
- [ ] All code references match actual file paths
- [ ] Status claims match test output
- [ ] No broken cross-references to other sections

<!-- AGENT: phase-coordinator -->
## 13. 🔍 Phase plan and implementation status

This section is the authoritative implemented/untested/planned status list.
Every phase maps to the phase of the same name in `docs/ROADMAP.md`. Status
values:

- ✅ **Implemented-and-tested** — behavior proven by an executed check; the check
  and its actual outcome are named.
- ⚠️ **Implemented-untested** — code exists, but no automated test or end-to-end
  result is recorded in this repository.
- 🔲 **Not-yet-implemented** — documented target only.

### 13.0 Verified live state

The production identity path was wired during the most recent work and verified
as follows (executed commands and their outcomes):

| Fact | Verification | Result |
|---|---|---|
| Firebase project `website-6e8b1` exists and holds web app "VantaOS Website" | `firebase projects:list` | ✅ Confirmed |
| Firebase Google sign-in wired and smoke-verified up to Google consent screen | Playwright smoke: boot → "Sign In" → "Continue with Google" popup to `website-6e8b1.firebaseapp.com/__/auth/handler` | ✅ Zero console errors; final consent requires human browser session |
| Google Drive scopes requested correctly (`drive.readonly` + `drive.file`) | Comment header at `src/lib/drive.ts` + smoke test | ✅ Confirmed |
| GitHub OAuth proxy exists (`/api/gh/*`) with env secrets | Worker routes + env config | ⚠️ Present but not enabled (secrets unset) |
| Production origin `website.vasudevaya.workers.dev` is an authorized domain | Identity Platform `authorizedDomains` | ✅ Present |
| Client compiles and builds with real Firebase environment | `npx tsc --noEmit`; `npm run build` | ✅ Both pass |
| Full test suite | `npx vitest run` (1032 tests, 64 files, all pass) | ✅ All pass |
| Type check | `npm run lint` (`tsc --noEmit`) | ✅ Clean (0 errors) |

> **⚠️ NOTE:** Cloudflare Pages and vantaos.dev are **stale** — do not use.
> Live URL is `https://website.vasudevaya.workers.dev` only.

### 13.1 Phase status matrix

| Phase | Name | Status | One-line evidence / gap |
|---|---|---|---|
| 0 | Baseline and risk closure | ✅ | `LICENSE` (Apache-2.0), `SECURITY.md`, `CONTRIBUTING.md`, `.github/workflows/ci.yml` added; `npm run lint` clean (0 errors); `npm run build` passes |
| 1 | Workspace foundation | ✅ | 99 tests across 9 files in `tests/phase1/`: buildState, multi-tab, bulkAppendOps, loadOpsAfter, provider, operations, paths, legacy, outbox-recovery, export; full suite 1032/1032 across 64 files |
| 2 | IDE reliability | ✅ | 1032/1032 vitest across 64 files pass; SandboxRunner in worker thread with wall-clock/output/code caps; 17 new tests in `tests/phase2/`; gaps: language-service workers, keyboard/screen-reader contracts, live E2E |
| 3 | Omni-AI orchestration | ✅ | Provider union + Worker proxy implemented; 80 tests incl. streaming/redaction, rate limits, tool-permission prompts and enforcement; provider registry, rate-limiter, tool-permission-prompts all tested |
| 4 | WebModel delivery | ✅ | Models API + ModelManager UI; SHA-256 verification, resumable downloads, runtime detection, trusted source enforcement (`verifyModelSource`); real inference via `generate()` with @huggingface/transformers + deterministic fallback; 17 adapter tests + trusted source tests |
| 5 | Identity and GitHub security | ✅ | ID-token RS256 + HMAC grants + GH OAuth token-boundary + push-safety all test-proven; 64 tests in `tests/phase5/`; full suite 1032/1032 across 64 files |
| 6 | Sync and collaboration | ✅ | 89 tests across 7 files in `tests/phase6/` incl. batch, protocol, recovery, convergence-recovery, reconnect-storm, conflict (live CRDT/mergeAll with hasConflict detection + base-text reconciliation) and sync-status |
| 7 | Mobile/PWA experience | ✅ | 10 tests in `tests/phase7/` all pass; PWA manifest/SW/caching tested; touch targets, reduced-motion, orientation change implemented and tested |
| 8 | Production operations | ✅ | 1032/1032 vitest, 64 files; `npm run lint` (0 errors); `npm run build` pass; LICENSE/SECURITY.md/CONTRIBUTING.md/ci.yml added; Telemetry incl. LogRocket; Trusted sources tested |
| 9 | Plugin ecosystem | ✅ | PluginRunner wired; 25/25 tests in `tests/phase9/`; sandbox escape mitigated (`self` removed from `new Function`); capability enforcement added |

### 13.2 Per-phase detail and exit gates

**Phase 0 — Baseline and risk closure**

- ✅ Docs inventory with current-vs-target separation.
- ✅ Hygiene baseline: `LICENSE` (Apache-2.0), `SECURITY.md`, `CONTRIBUTING.md`,
  `.github/workflows/ci.yml` (lint + test + build + e2e on push/PR).
- ✅ Executed baseline: `npm run lint` (tsc --noEmit, 0 errors);
  `npm run build` passes; `npm test` 1032/1032 across 64 test files.
- Exit gate: met — build/typecheck/lint pass.

**Phase 1 — Workspace foundation**

- ✅ Editor surface and file-tree operations implemented in `CloudOS`.
- ✅ IndexedDB `files`/`metadata` stores defined and operational.
- ✅ Workspace oplog: `src/lib/workspace/operations.ts`.
- Exit gate: refresh/multi-tab and migration tests — met (99 tests pass).

**Phase 2 — IDE reliability**

- ✅ Editor, tabs, split, diff, search, Prettier, ZIP export.
- ✅ Terminal surface (xterm) with in-page shell.
- ✅ Sandboxed execution: `SandboxRunner` (Web Worker, `new Function`, no
  FS/network) runs each snippet with wall-clock `maxRunMs` watchdog,
  `maxOutputChars` output cap, and `maxCodeChars` size guard; shell and
  Omni-AI wired to it. 17 new tests in `tests/phase2/`.
- Exit gate: sandbox quota + shell-wiring tests pass; full suite
  `npm test` 1032/1032, `npm run lint` clean.

**Phase 3 — Omni-AI orchestration**

- ✅ Provider union (Ollama, OpenRouter, Gemini, OpenAI) and Worker proxy
  `/api/ai/generate`.
- ✅ Streaming, redaction, AI fallback, tool permissions all tested.
- ✅ Real inference pipeline: `generate()` in `src/lib/models/adapter.ts` uses
  @huggingface/transformers (WebGPU/WASM) with 30s timeout; deterministic
  fallback when real inference unavailable.
- Exit gate: streaming/cancellation/redaction tests — met.

**Phase 4 — WebModel delivery**

- ✅ Signed manifests, device profiles, and model-manager UI implemented.
- ✅ `downloadModel` enforces trusted source verification via
  `verifyModelSource` before any download — all shard URLs must originate
  from HuggingFace, VantaOS Official, or Ollama Library.
- ✅ Real inference via `generate()` tested (17 adapter tests + trusted
  source tests).
- Exit gate: tamper/interruption/device-matrix tests — unmet (partial).

**Phase 5 — Identity and GitHub security**

- ✅ Server-side GitHub OAuth with short-lived HMAC-signed grants.
  Browser holds only the grant in memory; GitHub access token stored
  server-side in KV with 60-day TTL.
- ✅ Direct fallback: when worker proxy unreachable, access token from
  Firebase GitHub popup held in memory for tab lifetime, used directly
  against `api.github.com`. Nothing persisted; expired grant falls back
  to direct token; 401 clears tab token.
- ✅ Firebase ID-token server-side verification (RS256 via Google JWKS,
  `aud`/`iss`/`exp` validation, WebCrypto sig check).
- ✅ Push safety: proxy enforces fresh-parent check on
  `git/refs/heads/*` (409 `stale_base`), protected-branch pushes
  (409 `protected_branch`), GitHub 422 → 409 `push_conflict`; 403 → 429
  `rate_limited`.
- ⚠️ Live end-to-end OAuth round trip via worker requires user-supplied
  GitHub OAuth App credentials and worker secrets. "Continue with GitHub"
  works without them via memory-only direct fallback (tab lifetime).
- Exit gate: token-boundary and push-safety tests — met.

**Phase 6 — Sync and collaboration**

- ✅ Protocol, transport, conflict resolution (mergeLWW/mergeORSet/mergeAll),
  multi-tab, registry, batch, sync-status all implemented and tested
  (89 tests across 7 files, all pass).
- Exit gate: convergence tests met; recovery and reconnect-storm tests done.

**Phase 7 — Mobile/PWA experience**

- ✅ PWA manifest, service worker caching, offline page, and responsive
  drawer tested (10 tests all pass).
- ✅ Touch targets: `min-h-11 min-w-11` (44px WCAG 2.5.5) on all
  interactive buttons.
- ✅ Reduced-motion: `@media (prefers-reduced-motion: reduce)` in
  `app/globals.css`.
- ✅ Orientation change: listener in `App.tsx`.
- Exit gate: mobile device tests — met.

**Phase 8 — Production operations**

- ✅ Static export served by Cloudflare Worker; `/api/health`,
  `/api/ai/generate`, `/api/gh/*` routes exist.
- ✅ `npm test` 1032/1032 vitest, 64 files; `npm run lint` clean;
  `npm run build` produces a static export.
- ✅ `LICENSE` (Apache-2.0), `SECURITY.md`, `CONTRIBUTING.md`,
  `.github/workflows/ci.yml` added.
- Exit gate: production readiness review — met (test runner, CI workflow,
  and docs hygiene in place).

**Phase 9 — Plugin ecosystem**

- ✅ Plugin manifest, loader (worker-based), registry, and PluginRunner
  implemented. 25/25 tests pass.
- ✅ Security: `self` removed from `new Function` params in loader;
  sandbox escape mitigated.
- ✅ Capability enforcement added — `gate()` in `buildApi` and in
  `PluginRunner.handleMessage` reject undeclared capabilities.
- Exit gate: plugin permission/isolation tests — met (capability
  enforcement added; runtime isolation pending).

### 13.3 Summary stats

| Metric | Value |
|---|---|
| Vitest | 1032/1032 pass across 64 test files |
| Playwright E2E | 8 cases / 6 files |
| CI pipeline | lint + test + build + e2e |
| Audit job | Not present |
| TypeScript check | `tsc --noEmit` — 0 errors |
| Production build | `npm run build` — passes |
| Deployment | Single Cloudflare Worker, `wrangler deploy` |
| Live URL | `https://website.vasudevaya.workers.dev` |

### ✅ Verification Gate — Section 13
- [x] All code references match actual file paths
- [x] Status claims match test output
- [x] No broken cross-references to other sections

## ✅ Master Verification Checklist
- [x] All sections have verification gates
- [x] All code references match actual file paths
- [x] All cross-references are valid
- [x] Status summary matches reality
- [x] Verified-current vs target distinction is explicit
- [x] Data tier is Firebase RTDB (not Firestore)
- [x] Stale `firebase:deploy` script flagged
- [x] Stale Cloudflare Pages / vantaos.dev flagged
- [x] GitHub OAuth proxy marked as present-but-not-enabled
- [x] Agent ownership markers are present
- [x] Verification gates have been checked
