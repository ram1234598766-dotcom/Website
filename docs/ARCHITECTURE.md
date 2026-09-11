# VantaOS Architecture

## Document status

This document separates **verified current facts** from **target architecture**,
for the repository at `https://github.com/ram1234598766-dotcom/Website`.

- **Verified now:** Firebase Google/GitHub sign-in is wired to the live project
  `website-6e8b1` and smoke-verified end to end up to the Google consent screen;
  Google Drive scopes are requested correctly (Section 13.0).
- **Target:** Sections 4–12 describe the target architecture and are not claimed
  as implemented. Section 13 marks every ROADMAP phase and major component with a
  status of implemented-and-tested, implemented-untested, or not-yet-implemented,
  with evidence.

## 1. Product boundary

VantaOS is a browser-first development environment composed of four user-facing
products:

1. **CloudOS IDE** — files, CodeMirror editing, tabs, split views, diffing, search,
   formatting, export, and a terminal surface.
2. **Omni-AI** — one assistant surface over local Ollama and cloud model
   providers.
3. **Model Hub** — model discovery, Ollama pull, and model launch.
4. **Developer integrations** — GitHub synchronization, Google Drive, Firebase
   identity + Cloud Firestore data tier, and future workspace sync/collaboration.

The current application is a static Next.js export served by Cloudflare assets,
with a Worker handling API paths (`next.config.mjs:2-10`, `wrangler.toml:1-11`,
`workers/worker.ts:1-7`). The browser shell selects views in client state
(`src/App.tsx:19-27`, `src/App.tsx:123-134`).

## 2. Architecture principles

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

## 3. Current implementation map

| Area | Current implementation | Architectural implication |
|---|---|---|
| Application shell | `App.tsx` owns the active view, auth state, command palette, and modal state (`src/App.tsx:20-27`, `src/App.tsx:88-146`). | Extract route/state boundaries before adding collaborative or background workflows. |
| IDE | CodeMirror 6 through first-party wrappers (`CloudCodeEditor`, `CloudDiffEditor`), file nodes, tabs, split views, diff, search, Prettier, ZIP export (`src/components/CloudCodeEditor.tsx:16-116`, `src/components/CloudDiffEditor.tsx:15-115`, `src/components/CloudOS.tsx:151-187`, `src/components/CloudOS.tsx:269-293`, `src/components/CloudOS.tsx:573-607`). | Keep the editor adapters thin while moving workspace mutation and persistence into the oplog core. |
| Terminal | xterm.js renders a browser terminal backed by `ShellSession`; `WorkspaceTerminalFs` maps commands to the workspace and `ExecutionQuota` rate-limits commands and caps output (`src/components/TerminalPanel.tsx:41-83`, `src/lib/terminal/commands.ts:51-100`, `src/lib/terminal/sandbox.ts:75-165`, `src/lib/terminal/quota.ts:20-65`). JavaScript `js`/`node` and Omni-AI `js`/`calc` still use unrestricted `Function`/`new Function` execution (`src/lib/terminal/commands.ts:202-220`, `src/components/OmniAI.tsx:84-90`). | Replace unrestricted evaluation with an isolated runner while retaining the workspace-backed filesystem and quota boundary. |
| Persistence | CloudOS hydrates from the IndexedDB workspace oplog, migrates the legacy `localStorage` snapshot, and still writes a secondary snapshot every 300 ms (`src/components/CloudOS.tsx:295-410`). The append-only operation log and sequence metadata are in IndexedDB (`src/lib/workspace/operations.ts:20-169`); the older `storage.ts` helper remains for legacy file storage and migration (`src/lib/storage.ts:10-24`, `src/lib/storage.ts:60-134`). | Finish the migration so the oplog/outbox is the sole canonical write path, then remove the secondary snapshot and add recovery tests. |
| Identity | Firebase Auth is the preferred Google/GitHub OAuth adapter, exposed through the unified `client.auth` facade; local demo auth is the fallback when Firebase is unconfigured (`src/lib/client.ts`, `src/lib/firebase.ts`, `src/lib/demoAuth.ts`). | Define one identity port, explicit demo/production modes, and a secure token boundary. |
| Drive | Google Drive REST v3 uses the OAuth access token captured during Firebase Google sign-in; the token is held in memory/sessionStorage with a 45-minute TTL and scopes `drive.readonly` + `drive.file` (`src/lib/drive.ts:30-100`, `src/lib/drive.ts:138-277`, `src/components/DriveManager.tsx:69-205`). | Move token refresh and privileged API calls out of the browser; keep one identity port for Drive and GitHub. |
| GitHub | Browser code stores a GitHub token and active repository in `localStorage` and calls GitHub REST directly (`src/components/GitHubManager.tsx:15-44`, `src/components/GitHubManager.tsx:68-171`, `src/lib/github.ts:8-116`). | Move privileged token handling to an OAuth/server boundary and use short-lived workspace grants. |
| AI | Omni-AI supports Ollama, OpenRouter, Gemini, and OpenAI; settings/history are browser-local (`src/components/OmniAI.tsx:6-25`, `src/components/OmniAI.tsx:130-146`, `src/components/OmniAI.tsx:148-235`). Local tool commands also use unrestricted `Function`/`new Function` for `calc`/`js` and fetch arbitrary HTTP URLs (`src/components/OmniAI.tsx:58-100`). | Add a provider registry, request policy, streaming protocol, sandboxed tools, and audit-safe telemetry. |
| Ollama/model hub | The model hub calls `localhost:11434` directly for tags, pull, and generation (`src/components/Showcase.tsx:116-169`, `src/components/OllamaLocal.tsx:17-83`). | Keep Ollama as a desktop adapter; add a separate browser-runtime model path for mobile. |
| Edge API | Worker exposes health, AI generation, security scan, and auth-sync routes; the auth-sync path is `/api/edge-functions/auth-sync` (`workers/worker.ts:31-56`, `workers/worker.ts:77-195`). | Version and contract-test the edge API; separate public read APIs from privileged operations. |

## 4. Target component architecture

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
| IndexedDB/OPFS |                         | Firebase +     |
|                |                         | Firestore/API  |
+----------------+                         +----------------+

Desktop-only adapter: Ollama daemon <-localhost/CORS-> browser
Mobile/web adapter: WebGPU/WASM model runtime <-signed model packages<- edge
```

### 4.1 Browser application shell

Responsibilities:

- resolve routes and feature flags;
- own short-lived UI state only;
- load the workspace, identity, and model registries through service ports;
- expose command-palette actions as capabilities rather than component-specific
  window globals;
- keep every long-running operation cancellable and observable.

The current global `window.vantaosIDE` bridge (`src/components/CloudOS.tsx:551-574`)
should become an internal service contract. This prevents command-palette and
future plugin code from depending on React component implementation details
(`src/components/CommandPalette.tsx:30-31`, `src/components/CommandPalette.tsx:109-143`).

### 4.2 Workspace core

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

The existing `StoredFile` shape is a useful starting contract
(`src/lib/storage.ts:11-21`), but it needs operation metadata, content hash,
sync state, and deletion/tombstone semantics before it can support reliable
multi-device sync.

### 4.3 Editor and language services

- CodeMirror 6 remains the editor surface, bundled in the client.
- Language workers run in Web Workers and expose diagnostics, formatting,
  completion, and document-symbol contracts.
- Large files use bounded parsing and virtualized previews.
- Editor changes produce operations, not whole-workspace JSON rewrites.
- Prettier and future linters are lazy-loaded plugins with versioned manifests.
- The editor never executes project code merely because a file was saved.

### 4.4 Execution and terminal

The target terminal is a terminal emulator plus a command broker:

- browser-native commands are allowlisted and typed;
- JavaScript/TypeScript execution uses an isolated worker or remote runner;
- network access, filesystem access, CPU time, memory, and output size have
  explicit quotas;
- each run has an ID, status, logs, exit code, and cancellation path;
- project files are mounted read-only unless the user grants a workspace write;
- native languages are delegated to a remote or desktop runner, not emulated
  incorrectly in the browser.

This replaces the current unrestricted `new Function` path
(`src/components/TerminalPanel.tsx:157-169`) and the disconnected in-memory
terminal filesystem (`src/components/TerminalPanel.tsx:23-35`).

## 5. Omni-AI orchestration

### 5.1 Provider contract

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

The current provider switch is a useful feature baseline
(`src/components/OmniAI.tsx:6-25`, `src/components/OmniAI.tsx:130-146`), but
provider logic should not remain embedded in a chat component.

### 5.2 Tools and plugins

Tools are declared capabilities with:

- a stable ID and version;
- a human-readable description;
- an input schema;
- a permission level;
- a timeout and output limit;
- an explicit network/filesystem scope.

The command palette can enumerate these capabilities
(`src/components/CommandPalette.tsx:13-22`, `src/components/CommandPalette.tsx:53-87`)
without importing their implementations. Plugin packages are opt-in and must be
signed or pinned by digest before they can access privileged capabilities.

## 6. WebModel download and mobile/laptop runtime

### 6.1 What WebModel means

**WebModel is a browser-runnable model package.** It is distinct from an Ollama
model:

- Ollama remains the desktop/local-daemon adapter.
- WebModel is a quantized package loaded by a browser runtime such as WebGPU,
  WASM, or a browser ML runtime selected after capability detection.
- The browser must never assume that a multi-gigabyte desktop model can run on a
  phone.
- A model card must show device suitability before download begins.

### 6.2 Model manifest

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

Required catalog fields:

- publisher identity and signature;
- immutable version and content digest;
- license and acceptable-use metadata;
- architecture, context length, quantization, and task tags;
- estimated RAM/VRAM and warm-up time;
- mobile, laptop, and desktop suitability;
- known limitations and safety notes;
- update/changelog link.

### 6.3 Download state machine

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

The download manager must support:

- range requests and chunk verification;
- resume after navigation where the browser permits it;
- pause/resume and explicit cancellation;
- concurrent-shard limits based on device and network;
- storage quota estimation before starting;
- atomic installation only after every shard verifies;
- background progress through a service worker when supported;
- a clear fallback to Ollama or cloud inference when WebGPU is unavailable.

The current model hub already streams Ollama pull progress
(`src/components/Showcase.tsx:122-169`), but it has no browser-runtime package,
manifest, signature, resume, or device-suitability layer.

### 6.4 Device policy

| Device class | Default model profile | Behavior |
|---|---|---|
| Low-memory mobile | <=1.5B quantized, short context | Warn before download; cap context and concurrent requests. |
| Modern mobile | 1.5B–3B quantized if RAM/VRAM permits | Use WebGPU when available; otherwise offer cloud/Ollama fallback. |
| Laptop | 3B–8B quantized or provider-selected cloud model | Permit larger context and optional local acceleration. |
| Desktop/workstation | Larger quantized models or Ollama | Expose advanced runtime settings behind an explicit toggle. |

The first release should ship a small, licensed, code-oriented model profile and
a cloud fallback. It should not advertise arbitrary multi-gigabyte models as
mobile-ready.

### 6.5 Security and privacy

- Model manifests and shards are fetched from allowlisted origins only.
- Every shard is verified against a signed manifest digest.
- The model catalog cannot execute downloaded content during installation.
- Prompts, model output, and downloaded model metadata are subject to the same
  redaction and retention policy as other AI traffic.
- A user can inspect, pause, delete, and re-verify every installed WebModel.
- No API key or GitHub token is sent to a model publisher or runtime plugin.

## 7. Identity, GitHub, and data protection

### 7.1 Identity boundary

- Demo mode is explicitly labeled local-only and is never presented as
  production authentication.
- Firebase Auth is the production identity adapter (Google/GitHub OAuth),
  surfaced through the unified `client.auth` facade.
- Google Drive uses the OAuth access token captured during Firebase Google
  sign-in (`drive.readonly` browse/open + `drive.file` for the app-owned
  VantaOS folder; `src/lib/drive.ts:4-279`).
- GitHub OAuth exchanges a code server-side; the browser receives a short-lived,
  scoped workspace grant.
- Refresh tokens and provider secrets never enter `localStorage`.
- Role checks occur on the server for privileged operations.

The current implementation uses Firebase in the browser with a localStorage
demo-auth fallback (`src/lib/demoAuth.ts:29-30`, `src/lib/demoAuth.ts:66-81`,
`src/lib/firebase.ts:37-73`), a Drive token cached in `sessionStorage`
(`src/lib/drive.ts:42-96`), and the GitHub manager persists a provider token in
`localStorage` (`src/components/GitHubManager.tsx:15-44`,
`src/lib/github.ts:8-20`). These are current implementation facts, not target
security guarantees.

### 7.2 Workspace data

- Local workspace data is encrypted at rest where the platform exposes a
  suitable key mechanism; otherwise the UI states the limitation clearly.
- Remote sync uses per-operation authorization and row/object-level policy.
- Deletes are tombstoned until all known replicas acknowledge them.
- Export files are generated client-side and never silently uploaded.
- Backup/restore is versioned and validated with a manifest.

## 8. Edge and backend contracts

### 8.1 Existing edge surface

The Worker currently implements:

- `GET /api/health` (`workers/worker.ts:31-41`);
- `POST /api/ai/generate` (`workers/worker.ts:43-46`, `workers/worker.ts:77-155`);
- `POST /api/security/scan` (`workers/worker.ts:48-51`, `workers/worker.ts:157-179`);
- `POST /api/security/auth-sync` (`workers/worker.ts:53-56`, `workers/worker.ts:181-195`).

### 8.2 Target API additions

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

## 9. Reliability and failure model

### 9.1 Required invariants

1. A saved workspace operation is either committed locally or reported failed;
   it is never silently lost.
2. A model installation is visible as ready only after digest verification.
3. A GitHub push is based on a fresh parent commit and refuses non-fast-forward
   updates.
4. AI requests cannot include stored provider secrets in logs or analytics.
5. Plugin/tool execution cannot expand its declared permission scope.
6. A browser refresh preserves active operation state or presents a recoverable
   resume action.

### 9.2 Failure handling

- Network failures are classified as retryable or permanent.
- Storage quota failures stop downloads before partial installation.
- Model runtime failures retain the package for diagnosis but mark it unusable.
- Sync conflicts preserve both versions and show a user-resolvable diff.
- OAuth failures return the user to the last safe screen without deleting local
  work.
- Every background operation has a visible status, cancellation action, and
  retry action.

## 10. Deployment topology

1. **Static client:** Next.js static export, immutable asset hashes, strict
   security headers, service worker for shell caching where safe.
2. **Cloudflare Worker:** API gateway, provider proxy, model proxy, OAuth
   exchange, rate limiting, and edge health.
3. **Firebase:** identity (Google/GitHub OAuth), Google Drive OAuth token capture,
   and the Cloud Firestore data tier (forum threads, replies, upvotes, profiles).
5. **Object storage/CDN:** signed model shards and immutable manifests.
6. **Optional desktop companion:** Ollama bridge and native execution runner.
7. **Optional remote runners:** isolated containers/VMs for non-browser
   languages and heavy builds.

The current deployment is the first two pieces only: static export plus Worker
(`README.md:5-8`, `wrangler.toml:1-11`).

## 11. Observability

Collect only operation-level, privacy-safe signals:

- app boot and route transition duration;
- workspace save/sync latency and conflict count;
- model catalog fetch, download throughput, verification time, and load time;
- AI provider latency, token/stream errors, and cancellation rate;
- terminal run duration, quota failures, and sandbox exits;
- GitHub clone/push latency and conflict/rate-limit events;
- client browser/runtime capability distribution.

Do not collect raw source, prompts, model output, tokens, API keys, or GitHub
tokens. Every metric has an owner, retention period, and dashboard alert
threshold.

## 12. Verification gates

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

## 13. Phase plan and implementation status

This section is the authoritative implemented/untested/planned status list. Every
phase maps to the phase of the same name in `docs/ROADMAP.md`. Status values:

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
| Firebase project `website-6e8b1` exists and holds web app "VantaOS Website" (App ID `1:545509873123:web:e100fdee71cdc833e4bcd6`) | `firebase projects:list` | ✅ Project + App ID confirmed |
| Identity Platform provisioned; `google.com` IdP `enabled=true` with auto-created OAuth client `545509873123-6g180oc512l81nes733v7kbk1knd3f24.apps.googleusercontent.com`; `github.com` `enabled=true` | Identity Platform Admin API `config` (Bearer token) | ✅ HTTP 200 |
| Google Drive API enabled on the linked Cloud project | Service Usage API | ✅ `state=ENABLED` |
| Production origin `website.vasudevaya.workers.dev` is an authorized domain | Identity Platform `authorizedDomains` | ✅ Present |
| Client compiles and builds with the real Firebase environment | `npx tsc --noEmit`; `npm run build` | ✅ Both pass |
| Sign-in UI wiring | Playwright smoke: boot → "Sign In" → "Continue with Google" popup to `website-6e8b1.firebaseapp.com/__/auth/handler` with the correct apiKey, `providerId=google.com`, `redirectUrl=http://localhost:3000/`, and Drive scopes | ✅ Zero console errors; the final Google consent click requires a human browser session |

Notes:

- Local development uses `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  (`.env.local`). A production build must set
  `NEXT_PUBLIC_APP_URL=https://website.vasudevaya.workers.dev` before running
  `npm run build`, and then deploy with `npx wrangler deploy`.
- The final Google account selection and consent step cannot be automated from
  this environment; it must be completed once by a person in the browser to
  close the sign-in happy path end to end.

### 13.1 Phase status matrix

| Phase | Name | Status | One-line evidence / gap |
|---|---|---|---|
| 0 | Baseline and risk closure | ⚠️ | Inventory exists as docs (`TECH_STACK.md`, this file §3) but no executed baseline suite or risk-register artifact |
| 1 | Workspace foundation | ⚠️ | IDE implemented; canonical storage is still a `localStorage` snapshot (`src/components/CloudOS.tsx:290-322`); IndexedDB helper (`src/lib/storage.ts:6-10`) unused as the primary path |
| 2 | IDE reliability | ⚠️ | Editor/terminal/diff/search implemented; terminal executes via `new Function` (`src/components/TerminalPanel.tsx:157-169`); no tests |
| 3 | Omni-AI orchestration | ⚠️ | Provider union + Worker proxy (`src/components/OmniAI.tsx:6-25`, `workers/worker.ts:77-155`) implemented; no streaming/cancellation/redaction tests |
| 4 | WebModel delivery | 🔲 | Ollama pull only (`src/components/Showcase.tsx:122-169`); no manifest/shard/signature path |
| 5 | Identity and GitHub security | ✅ | `npm test` (53 vitest, 4 files `tests/phase5/*.test.ts`) pass Sep 11 2026; Firebase ID-token RS256 verification + HMAC grant lifecycle + GH OAuth token-boundary proxy + push-safety all test-proven; browser token replaced by memory-only grant |
| 6 | Sync and collaboration | 🔲 | No sync API, operation log, or conflict model |
| 7 | Mobile/PWA experience | ⚠️ | Responsive drawer (`src/components/Navigation.tsx:102-159`); no PWA shell or device E2E |
| 8 | Production operations | ⚠️ | `npm test` runs vitest (53 Phase 5 tests); CI workflow, LICENSE, SECURITY.md, CONTRIBUTING.md still missing |
| 9 | Plugin ecosystem | 🔲 | Not started |

### 13.2 Per-phase detail and exit gates

**Phase 0 — Baseline and risk closure**

- ✅ Docs inventory with current-vs-target separation (`TECH_STACK.md`, this file §3).
- 🔲 Executed baseline: no test/lint/E2E script or CI run exists.
- Exit gate (`ROADMAP.md:69-73`): not met — "no critical risk is hidden behind a
  marketing claim" is argued in docs but not proven by executed checks.

**Phase 1 — Workspace foundation**

- ✅ Editor surface and file-tree operations implemented in `CloudOS`.
- ⚠️ Persistence: whole-workspace snapshot in `localStorage`
  (`CloudOS.tsx:290-322`); IndexedDB `files`/`metadata` stores defined but not the
  primary write path.
- 🔲 Operation log, outbox, schema migrations, content hashes, export manifests.
- Exit gate: refresh/multi-tab and migration tests — unmet.

**Phase 2 — IDE reliability**

- ✅ Editor, tabs, split, diff, search, Prettier, ZIP export (Sections 3, 4.3).
- ✅ Terminal surface (xterm) with an in-page shell.
- ⚠️ Execution sandbox: `new Function` remains (`TerminalPanel.tsx:157-169`) —
  the single highest-risk current gap.
- 🔲 Language-service workers, run IDs/quotas/cancellation, keyboard and
  screen-reader contracts.
- Exit gate: IDE E2E and sandbox quota tests — unmet.

**Phase 3 — Omni-AI orchestration**

- ✅ Provider union (Ollama, OpenRouter, Gemini, OpenAI) and Worker proxy
  `/api/ai/generate`.
- ⚠️ Streaming/cancellation/retry/redaction behavior is client-side and untested.
- 🔲 Provider registry extraction, rate limits, tool permission prompts, model
  selection policy.
- Exit gate: streaming/cancellation/redaction tests — unmet.

**Phase 4 — WebModel delivery**

- 🔲 Signed manifests, sharded resumable downloads, digest verification, device
  profiles, runtime adapter, model-manager UI (contract in §6 and
  `docs/WEB_MODEL_SPEC.md`).
- Exit gate: tamper/interruption/device-matrix tests — unmet.

**Phase 5 — Identity and GitHub security**

- ✅ Server-side GitHub OAuth with short-lived HMAC-signed grants
  (`workers/grants.ts`; version/1, TTL 900s, skew 15s, HMAC-SHA256 over
  `version.exp.uid.jti`). Browser holds only the grant in memory
  (`src/lib/github.ts`); GitHub access token stored server-side in KV
  `gh:{uid}` with 60-day TTL. Browser-stored token removed.
- ✅ Firebase ID-token server-side verification (`workers/firebase-verify.ts`):
  RS256 via Google JWKS with kid/use-sig filtering, `aud`/`iss`/`exp`
  validation, WebCrypto sig check, JWKS cache keyed by URL.
- ✅ Push safety: proxy enforces fresh-parent check on PATCH
  `git/refs/heads/*` (409 `stale_base`), protects protected-branch pushes
  (409 `protected_branch`), maps GitHub's "not a fast forward" 422 → 409
  `push_conflict`; 403 rate-limit → 429 `rate_limited`.
- ✅ All of the above proven by 53 vitest tests (`npm test` Sep 11 2026):
  grant lifecycle (sign/verify/expiry/replay/nbf/byte-injection),
  Firebase ID-token verification (tampered/expired/bad-key/cache/clockSkew),
  proxy (token extraction, GET/POST/DELETE routing, fake-origin rejection,
  stashed token forwarding, bad-session → needsConnect, 422/403 mapping,
  expected_parent, force:false rejection, protected-branch, revocation,
  hash capture, grant refresh flow).
- ⚠️ Live end-to-end OAuth round trip requires user-supplied GitHub OAuth
  App credentials and worker secrets (`GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, `GH_GRANT_SECRET`) + `GH_TOKENS` KV binding +
  `APP_ORIGIN` (cannot automate from this environment).
- ⚠️ Firebase Drive round-trip implemented (`src/lib/drive.ts`); browser
  consent for folder creation still pending user's first Google sign-in.
- Exit gate: token-boundary and push-safety tests — now met via
  `npm test` (53 vitest tests, `tests/phase5/*.test.ts`).

**Phase 6 — Sync and collaboration**

- 🔲 Not started. Operation batches, causality metadata, tombstones, conflict UX,
  presence/cursors, SSE/WebSocket with a polling fallback.
- Exit gate: convergence and recovery tests — unmet.

**Phase 7 — Mobile/PWA experience**

- ⚠️ Responsive navigation drawer (`Navigation.tsx:102-159`); IDE small-screen
  contract is informal.
- 🔲 PWA manifest/service worker, storage and battery awareness, device E2E.
- Exit gate: mobile device tests — unmet.

**Phase 8 — Production operations**

- ✅ Static export served by Cloudflare Worker; `/api/health`, `/api/ai/generate`,
  `/api/security/*`, `/api/gh/*` routes exist.
- ✅ `npm test` runs vitest (53 Phase 5 tests, Sep 11 2026); `npm run lint`
  (`tsc --noEmit`) passes; `npm run build` produces a static export.
- 🔲 CI workflow (lint + test + build, on push/PR); no LICENSE file (README
  claims Apache-2.0 at `README.md:138-140`); no `SECURITY.md` or
  `CONTRIBUTING.md`; no structured logs or SLO runbooks.
- Exit gate: production readiness review — partially met (test runner in place;
  CI and docs hygiene still open).

**Phase 9 — Plugin ecosystem**

- 🔲 Not started. Signed manifests, capability scopes, sandbox lifecycle,
  marketplace contract.
- Exit gate: plugin permission/isolation tests — unmet.

### 13.3 Priority order for the next implementation work

Driven by the charter (correctness/security first, then beginner experience,
then advanced power):

1. **Phase 2 sandbox** — replace `new Function` terminal execution with an
   isolated runner (`SandboxRunner`), run-ids, host watchdog, output caps, and
   tests. Single highest-risk current gap; only thing standing between the
   claimed "production-ready" state and an XSS/RCE surface in the browser.
2. **Phase 0/8 baseline** — add `LICENSE` (Apache-2.0), `SECURITY.md`,
   `CONTRIBUTING.md`, `.github/workflows/ci.yml` (lint + test + build on
   push/PR); update §13 matrix with evidence.
3. **Phase 5 live end-to-end** — remaining UI work (Firebase Account Link
   wizard `src/components/Auth.tsx`, Drive consent flow) + live round-trip
   with user-supplied credentials. Blocked on: GitHub OAuth App, worker
   secrets, KV binding, `APP_ORIGIN`.
4. Remaining phases in ROADMAP order (1, 3, 4, 6, 7, 9), each gated on its
   named tests.

The original target architecture was produced without runtime changes; the
§13.0 verified states document subsequent live wiring.
