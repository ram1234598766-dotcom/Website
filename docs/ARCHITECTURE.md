# VantaOS Architecture

## Document status

This is a documentation-only target architecture for the repository at
`https://github.com/ram1234598766-dotcom/Website`. It does not claim that the
target state is implemented or tested. The current implementation evidence is
called out separately from the proposed architecture.

## 1. Product boundary

VantaOS is a browser-first development environment composed of four user-facing
products:

1. **CloudOS IDE** — files, Monaco editing, tabs, split views, diffing, search,
   formatting, export, and a terminal surface.
2. **Omni-AI** — one assistant surface over local Ollama and cloud model
   providers.
3. **Model Hub** — model discovery, Ollama pull, and model launch.
4. **Developer integrations** — GitHub synchronization, optional Supabase
   identity, and future workspace sync/collaboration.

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
| Application shell | `App.tsx` owns the active view, auth state, command palette, and modal state (`src/App.tsx:19-27`, `src/App.tsx:103-145`). | Extract route/state boundaries before adding collaborative or background workflows. |
| IDE | Monaco, file nodes, tabs, split views, diff, search, Prettier, ZIP export (`src/components/CloudOS.tsx:11-68`, `src/components/CloudOS.tsx:143-187`, `src/components/CloudOS.tsx:208-262`, `src/components/CloudOS.tsx:463-498`). | Introduce a workspace core and editor adapters; keep UI components thin. |
| Terminal | xterm.js plus an in-page `LocalShell` with an in-memory map and `new Function` execution (`src/components/TerminalPanel.tsx:23-35`, `src/components/TerminalPanel.tsx:56-198`, `src/components/TerminalPanel.tsx:216-231`). | Replace unrestricted evaluation with an isolated execution service and typed command protocol. |
| Persistence | `storage.ts` defines IndexedDB stores (`src/lib/storage.ts:1-10`, `src/lib/storage.ts:23-49`), while CloudOS currently restores and saves a JSON snapshot in `localStorage` (`src/components/CloudOS.tsx:290-322`). | Make IndexedDB/OPFS the canonical local store and treat snapshots as migration/import data. |
| Identity | Optional Supabase client with a localStorage demo-auth proxy (`src/lib/supabase.ts:9-23`, `src/lib/supabase.ts:34-190`, `src/lib/demoAuth.ts:1-10`). | Define one identity port, explicit demo/production modes, and a secure token boundary. |
| GitHub | Browser code stores a GitHub token in `localStorage` and calls the GitHub REST API directly (`src/components/GitHubManager.tsx:15-44`, `src/lib/github.ts:8-40`). | Move privileged token handling to an OAuth/server boundary and use short-lived workspace grants. |
| AI | Omni-AI supports Ollama, OpenRouter, Gemini, and OpenAI; settings/history are browser-local (`src/components/OmniAI.tsx:6-25`, `src/components/OmniAI.tsx:130-146`, `src/components/OmniAI.tsx:196-220`). | Add a provider registry, request policy, streaming protocol, and audit-safe telemetry. |
| Ollama/model hub | The model hub calls `localhost:11434` directly for tags, pull, and generation (`src/components/Showcase.tsx:116-169`, `src/components/OllamaLocal.tsx:17-83`). | Keep Ollama as a desktop adapter; add a separate browser-runtime model path for mobile. |
| Edge API | Worker exposes health, AI generation, security scan, and auth-sync routes (`workers/worker.ts:31-56`, `workers/worker.ts:77-195`). | Version and contract-test the edge API; separate public read APIs from privileged operations. |

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
| IndexedDB/OPFS |                         | Supabase/API   |
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

- Monaco remains the editor surface.
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
- Supabase OAuth is the production identity adapter.
- GitHub OAuth exchanges a code server-side; the browser receives a short-lived,
  scoped workspace grant.
- Refresh tokens and provider secrets never enter `localStorage`.
- Role checks occur on the server for privileged operations.

The current demo implementation uses localStorage-backed users and sessions
(`src/lib/demoAuth.ts:29-30`, `src/lib/demoAuth.ts:66-81`) and the GitHub manager
persists a provider token in `localStorage` (`src/components/GitHubManager.tsx:15-44`,
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
3. **Supabase:** identity, workspace metadata, sync operations, and optional
   forum data with RLS.
4. **Object storage/CDN:** signed model shards and immutable manifests.
5. **Optional desktop companion:** Ollama bridge and native execution runner.
6. **Optional remote runners:** isolated containers/VMs for non-browser
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

No runtime code was changed to produce this document.
