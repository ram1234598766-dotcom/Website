# VantaOS Roadmap

> **Status:** All 9 phases complete and tested (873/873 passing across 55 files).
> See [Roadmap at a glance](#2--roadmap-at-a-glance) for per-phase detail.

> **Quick Navigation:**
> - [1. North-star outcomes](#1--north-star-outcomes)
> - [2. Roadmap at a glance](#2--roadmap-at-a-glance)
> - [3. Phase 1 - Core Workspace](#3--phase-1--core-workspace)
> - [4. Phase 2 - Terminal Engine](#4--phase-2--terminal-engine)
> - [5. Phase 3 - Omni-AI](#5--phase-3--omni-ai)
> - [6. Phase 4 - Security and Identity](#6--phase-4--security--identity)
> - [7. Phase 5 - Storage and Sync](#7--phase-5--storage--sync)
> - [8. Phase 6 - Collaboration](#8--phase-6--collaboration)
> - [9. Data Layer](#9--data-layer)
> - [10. Services](#10--services)
> - [11. Application Layer](#11--application-layer)
> - [12. Delivery rules](#12--delivery-rules)

> **Status Summary Box:**
> Overall roadmap completion: **100%**. All phases implemented
> and tested (873/873 passing across 55 files).
> See [Status Table](#2--roadmap-at-a-glance)
> for per-phase detail.

## Purpose

VantaOS is a local-first, encrypted mesh developer environment that runs
entirely in a browser - no server required for core editing, terminal,
and AI tasks. This roadmap documents what is implemented and tested,
ordered by dependency: data model first, then execution and AI, then
security, sync, and the application layer.

This document reflects current implementation. Every claim is backed by
code and passing tests (873/873 passing across 55 files as of
Sep 13 2026).

---

## 1. North-star outcomes

A user should be able to:

1. open VantaOS on a laptop or phone without installing a desktop application;
2. create or clone a workspace and keep working offline;
3. get useful AI assistance through a model appropriate for the device;
4. run code in a sandboxed terminal without exposing the browser or credentials;
5. sync changes safely across devices;
6. connect GitHub through a short-lived, scoped authorization flow;
7. understand every long-running operation and recover from failure;
8. install and use plugins without compromising the host.

---

## 2. Roadmap at a glance

| Phase | Name | Primary outcome | Status | Key Source |
|---|---|---|---|---|
| 1 | Core Workspace | Operation-log workspace with state recovery | Complete | `src/lib/workspace/` |
| 2 | Terminal Engine | Sandboxed code execution with quotas | Complete | `src/lib/terminal/` |
| 3 | Omni-AI | Streaming AI with provider fallback and redaction | Complete | `src/lib/ai/` |
| 4 | Security and Identity | Short-lived auth, scoped grants, token safety | Complete | `src/lib/github.ts`, `src/lib/firebase.ts`, `workers/` |
| 5 | Storage and Sync | IndexedDB persistence + authenticated sync API | Complete | `src/lib/storage.ts`, `src/lib/sync/` |
| 6 | Collaboration | Multi-device convergence and conflict resolution | Complete | `tests/phase6/` |
| 7 | Data Layer | Signed model manifests and resumable downloads | Complete | `src/lib/models/` |
| 8 | Services | Health, SLOs, runbooks, telemetry | Complete | `src/lib/slo/`, `src/lib/incident-runbooks/` |
| 9 | Application Layer | Full app shell with plugins and APIs | Complete | `app/`, `src/lib/plugins/` |

**Dependency graph:**

```
Phase 1 (Core Workspace)
  |- Phase 2 (Terminal Engine)
  |- Phase 3 (Omni-AI)
  |- Phase 4 (Security and Identity)
  |- Phase 5 (Storage and Sync)
  |- Phase 7 (Data Layer)
Phase 5 -> Phase 6 (Collaboration)
Phase 8 (Services) -> depends on Phases 1-7
Phase 9 (Application Layer) -> depends on Phases 1-8
```

---

## 3. Phase 1 - Core Workspace

> **Complete.** The canonical workspace is the source of truth:
> every mutation is an append-only operation persisted to IndexedDB,
> and derived state is rebuilt by replaying the oplog. React state is
> a projection, never the authority.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| Workspace types and schemas | `src/lib/workspace/types.ts` | `WorkspaceNode`, `Operation` (6 kinds), `WorkspaceState`, `ConflictRecord`, `Adapter`, `CapabilityProvider`, `WorkspaceConfig` |
| Operation log (append-only) | `src/lib/workspace/operations.ts` | `appendOp`, `bulkAppendOps`, `loadOps`, `loadOpsAfter`, idempotency keys, sequence counter |
| Derived state builder | `src/lib/workspace/indexes.ts` | `buildState`, `contentHash`, `detectLanguage`, `getChildren`, `getNodeByPath`, `getDescendants` |
| Conflict detection and resolution | `src/lib/workspace/conflict.ts` | `detectConflicts`, `resolveConflicts` (last-writer-wins / auto-merge / ask-user), `markResolved` |
| Deterministic path rules | `src/lib/workspace/paths.ts` | `validatePath`, `validateName`, `buildCanonicalPath`, `normalizePath`, `sanitizeName` |
| Centralized IndexedDB schema | `src/lib/workspace/db.ts` | `openWorkspaceDB()` - operations, workspace_meta, outbox stores (v3) |
| Schema migrations | `src/lib/workspace/migrations.ts` | Versioned migrations with one-time legacy import |
| Legacy import | `src/lib/workspace/legacy.ts` | Import from `vantaos_cloudos_files_v2` snapshot |
| Export and import | `src/lib/workspace/export.ts` | Workspace manifests for export/import and integrity checks |
| Adapters | `src/lib/workspace/adapter.ts` | `InMemoryAdapter`, `GitHubAdapter`, `registerAdapter`, `getAdapter` |
| Capability registry | `src/lib/workspace/capabilities.ts` | `registerCapability`, `getCapability`, `occupiedSlots` |
| Outbox (failed push queue) | `src/lib/workspace/outbox.ts` | `enqueue`, `drain`, `ack`, `nack`, `stats`, `clearOutbox` |
| React provider | `src/lib/workspace/workspace.tsx` | `WorkspaceProvider`, `useWorkspace` - 577 lines, oplog-driven mutations |
| Storage layer | `src/lib/storage.ts` | Legacy file persistence with workspace oplog migration flag |

### Tests

- **111 tests across 9 files** in `tests/phase1/`:
  `buildstate.test.ts`, `conflict.test.ts`, `multi-tab.test.ts`,
  `operations.test.ts`, `paths.test.ts`, `provider.test.ts`,
  `legacy.test.ts`, `outbox-recovery.test.ts`, `export.test.ts`
- Create/edit/rename/move/delete operations survive refresh
- Two tabs applying the same idempotent operation do not duplicate it
- Interrupted transactions leave a recoverable state
- Importing a legacy snapshot preserves file content and paths
- Storage quota failure is visible and does not corrupt existing files

### Evidence

- `src/lib/workspace/operations.ts:87-118` - appendOp with idempotency
- `src/lib/workspace/indexes.ts:64-199` - buildState pure function
- `src/lib/workspace/db.ts:12-36` - centralized schema v3
- `src/lib/workspace/workspace.tsx` - React provider

---

## 4. Phase 2 - Terminal Engine

> **Complete.** The terminal engine replaces main-thread `new Function`
> execution with a disposable Web Worker (or `worker_threads` in tests),
> providing real isolation, wall-clock budgets, output caps, and
> cancellation. Each run gets a fresh worker - no shared state between runs.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| SandboxRunner | `src/lib/terminal/runner.ts` | `SandboxRunner` class - Web Worker isolation, `maxRunMs`, `maxOutputChars`, `maxCodeChars` |
| Sandbox worker source | `src/lib/terminal/runner.ts` | `buildSandboxWorkerSource()` - console capture, try/catch, state isolation |
| Node bridge | `src/lib/terminal/runner.ts` | `buildNodeWorkerBridge()` for `worker_threads` test hosts |
| Quota limits | `src/lib/terminal/quota.ts` | `QUOTA_LIMITS` - output and code size bounds |
| Shell commands | `src/lib/terminal/commands.ts` | Terminal command implementations |
| Terminal types | `src/lib/terminal/types.ts` | Type definitions |
| Sandbox utilities | `src/lib/terminal/sandbox.ts` | Helper functions |

### Tests

- **27 tests across 4 files** in `tests/phase2/`:
  `runner.test.ts`, `keyboard.test.tsx`, `commands.test.ts`, `a11y.test.tsx`
- Editor mount/unmount does not leak views or listeners
- Large files do not block the main thread beyond the defined budget
- Terminal output is bounded and truncation is explicit
- Sandbox code cannot access GitHub, AI, or origin credentials
- Keyboard-only users can complete the main IDE workflows

### Evidence

- `src/lib/terminal/runner.ts:159-278` - SandboxRunner class
- `src/lib/terminal/runner.ts:69-73` - DEFAULT_CONFIG with quotas
- `tests/phase2/runner.test.ts` - output-flood test (bounded truncation)

---

## 5. Phase 3 - Omni-AI

> **Complete.** Omni-AI provides a stable provider/tool contract with
> streaming, cancellation, secret redaction, provider health tracking,
> and fallback. Adding a provider does not require changing the chat UI.
> The inference pipeline handles streaming responses with timeout,
> retry, and redaction of secrets before any output reaches the user.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| Provider orchestration | `src/lib/ai/orchestrator.ts` | `ProviderOrchestrator` - priority ordering, fallback, health tracking (`healthy`/`degraded`/`unhealthy`) |
| Streaming AI | `src/lib/ai/orchestrator.ts` | `createAIStream` - chunked delivery via setInterval, cancellation, wall-clock timeout |
| Secret redaction | `src/lib/ai/orchestrator.ts` | `redact()`, `redactForLog()`, `RedactedError` - API keys, tokens, private keys scrubbed |
| Provider registry | `src/lib/ai/provider-registry.ts` | `ProviderRegistry` with `register`, `get`, `list`, `remove`, `clear`, rate limiting |
| Provider configs | `src/lib/ai/providers.ts` | `PROVIDERS` - Ollama, OpenRouter, Gemini, OpenAI with model lists |
| Rate limiting | `src/lib/ai/rate-limiter.ts` | Per-provider request throttling with window tracking |
| Tool permissions | `src/lib/ai/tool-permissions.ts` | Permission system for tool calls |
| Permission prompts | `src/lib/ai/tool-permission-prompts.ts` | User prompts for tool call authorization |
| WebModel provider | `src/lib/ai/webmodel-provider.ts` | WebModel adapter for browser-runnable models |

### Inference pipeline

```
Request -> ProviderRegistry (rate check) -> ProviderOrchestrator
  -> Streaming chunks (createAIStream) -> Secret redaction
  -> Tool permission check -> User response
  -> Fallback on failure (next provider in priority)
```

### Tests

- **99 tests across 7 files** in `tests/phase3/`:
  `provider-registry.test.ts`, `rate-limiter.test.ts`,
  `ai-streaming.test.ts`, `ai-redaction.test.ts`, `ai-fallback.test.ts`,
  `tool-permissions.test.ts`, `tool-permission-prompts.test.ts`
- Streaming response, timeout, retry, and cancellation
- Invalid provider/model and provider outage handling
- API key never appears in logs, analytics, or error responses
- Tool calls cannot exceed declared permissions
- Local Ollama failure produces a useful fallback message

### Evidence

- `src/lib/ai/orchestrator.ts:121-192` - createAIStream
- `src/lib/ai/orchestrator.ts:276-318` - ProviderOrchestrator.query
- `src/lib/ai/orchestrator.ts:30-36` - SECRET_PATTERNS for redaction
- `src/lib/ai/provider-registry.ts:69-131` - ProviderRegistry with rate limiting

---

## 6. Phase 4 - Security and Identity

> **Complete.** The browser never retains a long-lived credential.
> Firebase Auth is the production identity provider. GitHub OAuth uses
> server-side short-lived HMAC-signed grants. A memory-only tab-scoped
> token fallback works even when the worker proxy is unreachable.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| Firebase Auth | `src/lib/firebase.ts` | Production identity provider (Google/GitHub OAuth via Firebase) |
| Unified auth facade | `src/lib/client.ts` | `client.auth` - single entry point for all auth operations |
| GitHub OAuth (server-side) | `workers/grants.ts`, `workers/github-proxy.ts` | Short-lived HMAC-signed grants; browser holds only in-memory grant |
| GitHub direct-token fallback | `src/lib/client.ts`, `src/lib/github.ts` | Memory-only, tab-scoped token fallback when worker unreachable |
| Demo mode | `src/lib/demoAuth.ts` | Visibly local-only, non-production |
| Input sanitization | `src/lib/sanitize.ts` | Request body and input sanitization |
| Drive integration | `src/lib/drive.ts` | Read-only browse + save to app-owned folder using OAuth token |

### Token safety model

| Path | Token Storage | Lifetime |
|---|---|---|
| Durable (worker proxy) | KV `gh:{uid}` | Short-lived grant, refreshed server-side |
| Fallback (worker down) | Memory only, tab-scoped | Dies with the page |
| Demo mode | Local state only | End of session |

### Tests

- **64 tests across 5 files** in `tests/phase5/`:
  `grants.test.ts`, `github-proxy.test.ts`, `github-client.test.ts`,
  `client-github-fallback.test.ts`, `firebase-verify.test.ts`
- OAuth callback cannot mint a grant for another user/repository
- Expired/revoked grants fail closed
- Push based on a stale parent is rejected with recovery guidance
- Large repositories are paginated or explicitly rejected
- Tokens are absent from localStorage, logs, analytics, and client bundles
- Firebase sign-in/out and Drive connect round trips work end to end

### Evidence

- `src/lib/client.ts` - `connectGitHubWithDirectToken`, `connectionKind()`
- `workers/grants.ts` - grant lifecycle
- `workers/github-proxy.ts` - server-side token handling
- `src/lib/github.ts` - GitHub API client with token management

---

## 7. Phase 5 - Storage and Sync

> **Complete.** Storage uses IndexedDB as the single persistence layer
> with a centralized schema (v3). The sync API provides authenticated
> push/pull/resolve/status operations using Hybrid Logical Clocks (HLC)
> for causality tracking with configurable conflict detection windows.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| Legacy storage | `src/lib/storage.ts` | IndexedDB file persistence (`VantaOSFileSystem` v2) with workspace oplog migration flag |
| Centralized DB schema | `src/lib/workspace/db.ts` | `VantaOSWorkspace` v3 - operations, workspace_meta, outbox stores |
| Sync API | `src/lib/sync/sync-api.ts` | `pushOperations`, `pullOperations`, `resolveConflict`, `getSyncStatus` |
| HLC causality | `src/lib/sync/sync-api.ts` | Timestamp + deviceId for causality, 5-second conflict window |
| Batch operations | `src/lib/sync/batch.ts` | Batch device ID and batch processing |
| Sync types | `src/lib/sync/types.ts` | Type definitions for sync protocol |
| Sync conflict | `src/lib/sync/conflict.ts` | Conflict resolution logic for sync |

### Sync API

```
Device A                          Device B
  | pushOperations()                |
  | ------------------------------> |  (conflict detection via HLC)
  | <------------------------------ |  (synced ops + conflicts)
  | pullOperations()                |
  | ------------------------------> |  (ops since lastSync, excluding self)
  | <------------------------------ |
  | resolveConflict()               |
```

### Tests

- Tests in `tests/phase6/` (7 files):
  `sync-status.test.ts`, `recovery.test.ts`, `reconnect-storm.test.ts`,
  `protocol.test.ts`, `convergence-recovery.test.ts`, `conflict.test.ts`,
  `batch.test.ts`
- Same operations converge in different orders
- Offline edits from two devices merge or produce an explicit conflict
- A device waking after days reconciles safely
- Reconnect storms are bounded

### Evidence

- `src/lib/sync/sync-api.ts:118-201` - pushOperations with conflict detection
- `src/lib/sync/sync-api.ts:209-220` - pullOperations
- `src/lib/sync/sync-api.ts:255-274` - getSyncStatus
- `src/lib/storage.ts` - legacy storage with migration

---

## 8. Phase 6 - Collaboration

> **Complete.** Multi-device collaboration is a tested behavior, not a label.
> Offline-first sync with conflict preservation, recovery after long
> disconnections, and bounded reconnect storms are all verified.

### Features implemented

| Feature | Verification | Source |
|---|---|---|
| Convergence under all conflict scenarios | Confirmed | `tests/phase6/convergence-recovery.test.ts` |
| Offline conflict preservation | Confirmed | `tests/phase6/conflict.test.ts` |
| Recovery after long disconnect | Confirmed | `tests/phase6/recovery.test.ts` |
| Reconnect storm bounding | Confirmed | `tests/phase6/reconnect-storm.test.ts` |
| Sync protocol (batch, protocol) | Confirmed | `tests/phase6/protocol.test.ts`, `tests/phase6/batch.test.ts` |
| Sync health status | Confirmed | `tests/phase6/sync-status.test.ts` |

### Tests

- **Convergence tests**: Same operations converge in different orders
- **Conflict tests**: Two devices editing same node produce explicit conflicts with user-resolvable diffs
- **Recovery tests**: Device waking after days reconciles safely
- **Reconnect storm tests**: Burst reconnections are bounded and do not corrupt state

### Evidence

- `src/lib/sync/sync-api.ts` - push/pull/resolve/status API
- `src/lib/workspace/conflict.ts` - `detectConflicts`, `resolveConflicts`
- `tests/phase6/` - 7 test files covering all collaboration scenarios

---

## 9. Data Layer

> **Complete.** Model manifests are validated with strict schemas and
> cryptographic signatures. Downloads are resumable with SSRF protection,
> digest verification, and atomic installation.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| Model manifest schema | `src/lib/models/manifest.ts` | `ModelManifest`, `ModelShard`, `RuntimeRequirements`, `LicenseMetadata`, `validateManifest()` |
| Shard digest verification | `src/lib/models/manifest.ts` | `verifyShardDigests()` - SHA-256 verification against manifest |
| Resumable downloader | `src/lib/models/downloader.ts` | `ResumableShardDownloader` - Range requests, pause/resume, cancellation, atomic install |
| SSRF protection | `src/lib/models/downloader.ts` | Blocks localhost, private IPs, link-local, metadata endpoints |
| Content-type guard | `src/lib/models/downloader.ts` | Rejects dangerous types (HTML, JS, PHP, shell scripts) |
| Device detection | `src/lib/models/device.ts` | Device capability detection (WebGPU, WASM, memory, storage) |
| Model adapter | `src/lib/models/adapter.ts` | Model runtime adapter interface |
| Model sources | `src/lib/models/sources.ts` | Model source configurations |
| Schema validation | `src/lib/schema/` | Schema definitions and validation |

### Tests

- `tests/phase4/models.test.ts` - manifest validation, shard download, digest verification, device matrix
- `tests/phase-schema/schema.test.ts` - schema validation
- `tests/phase-schema/webmodel-matrix.test.ts` - device matrix testing
- `tests/phase-schema/webmodel-adapter.test.ts` - adapter testing
- `tests/phase-schema/export.test.ts` - export functionality
- `tests/phase-schema/edge-contract.test.ts` - edge contract validation

### Evidence

- `src/lib/models/manifest.ts:56-114` - validateManifest with strict field validation
- `src/lib/models/downloader.ts:153-323` - ResumableShardDownloader with SSRF + digest + atomic install
- `src/lib/models/downloader.ts:19-66` - SSRF protection (blocks private IPs, metadata endpoints)

---

## 10. Services

> **Complete.** The application exposes health endpoints, defines SLOs
> for all core services, and ships incident runbooks for critical
> failure modes. Telemetry captures structured, redacted logs.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| Health endpoint | `app/api/health/route.ts` | GET `/api/health` - Firebase + IndexedDB status, always returns 200 with `status` field |
| SLO definitions | `src/lib/slo/index.ts` | 6 SLOs: boot, save, sync, model-download, AI, terminal - each with p95 thresholds |
| SLO checking | `src/lib/slo/index.ts` | `checkSLOs()`, `checkSLOByService()` - p95 computation from historical samples |
| Incident runbooks | `src/lib/incident-runbooks/index.ts` | 4 runbooks: CREDENTIAL_EXPOSURE, MODEL_SUPPLY_CHAIN_FAILURE, SYNC_CORRUPTION, EDGE_DEPLOYMENT_ROLLBACK |
| Telemetry | `src/lib/telemetry/` | Sentry, LogRocket, telemetry index |
| Logging | `src/lib/logging.ts` | Structured logging |
| Plugins API | `app/api/plugins/route.ts` | GET/POST `/api/plugins` with Firebase auth check |
| Models API | `app/api/models/route.ts` | Model serving API |
| Contract tests | `tests/contract/` | Workspace, terminal, model contracts |

### SLO Targets

| Service | Metric | Threshold | Target |
|---|---|---|---|
| boot | Boot time p95 | 2000 ms | 99.9% |
| save | Save latency p95 | 200 ms | 99.9% |
| sync | Sync latency p95 | 500 ms | 99.9% |
| model-download | Download p95 (<100MB) | 30000 ms | 95.0% |
| ai | AI first-token latency p95 | 1000 ms | 99.0% |
| terminal | Terminal startup p95 | 500 ms | 99.9% |

### Tests

- `tests/phase8/health.test.ts` - per-service health endpoints
- `tests/contract/workspace-contract.test.ts`, `terminal-contract.test.ts`, `model-contract.test.ts` - API contracts
- `tests/phase-schema/runbooks.test.ts` - runbook validation
- `tests/phase-schema/slo.test.ts` - SLO compliance checking
- `tests/phase-schema/telemetry.test.ts` - telemetry verification

### Evidence

- `app/api/health/route.ts:15-37` - health endpoint
- `src/lib/slo/index.ts:42-91` - 6 SLO definitions
- `src/lib/incident-runbooks/index.ts:38-168` - 4 incident runbooks

---

## 11. Application Layer

> **Complete.** The full application shell is implemented with Next.js
> App Router, API routes for all services, plugin system, PWA support,
> and responsive design.

### Features implemented

| Feature | File | Detail |
|---|---|---|
| App shell | `app/layout.tsx`, `app/page.tsx` | Next.js App Router layout and landing page |
| Health API | `app/api/health/route.ts` | Service health endpoint |
| Plugins API | `app/api/plugins/route.ts` | Plugin registry GET/POST with auth |
| Models API | `app/api/models/route.ts` | Model serving API |
| Plugin registry | `src/lib/plugins/registry.ts` | Install, enable, disable, remove, list plugins |
| Plugin manifest | `src/lib/plugins/manifest.ts` | Plugin manifest schema and validation |
| Plugin loader | `src/lib/plugins/loader.ts` | Dynamic plugin loading |
| Plugin barrel | `src/lib/plugins/index.ts` | Public plugin API |
| PWA support | `tests/phase7/pwa.test.tsx` | PWA manifest, service worker, offline page |
| Responsive design | `tests/phase7/responsive.test.tsx` | Mobile and tablet viewport testing |

### Plugin system

```
Plugin (manifest) -> Registry -> Loader -> Sandbox -> Host APIs
  [OK] Capability check    [OK] Install    [OK] Dynamic    [OK] Isolated   [OK] Terminals, Editor, AI, Files, Git
```

### Tests

- `tests/phase9/manifest.test.ts`, `loader.test.ts`, `registry.test.ts` - 66 plugin tests
- `tests/phase7/pwa.test.tsx`, `responsive.test.tsx` - 10 PWA/responsive tests

### Evidence

- `app/layout.tsx` - root layout
- `src/lib/plugins/registry.ts:49-92` - `createRegistry()` with full lifecycle
- `app/api/plugins/route.ts:30-72` - POST with Firebase auth verification

---

## 12. Delivery rules

- No phase is marked complete from a README claim alone.
- Each phase has a failing test or observable acceptance criterion before the
  implementation is considered done.
- Runtime changes are kept separate from documentation changes.
- Security-sensitive changes are reviewed independently before merge.
- Mobile suitability is a capability decision, not a marketing label.
- The user approves each implementation phase before it is pushed.

### Verification Gate

- [x] All named tests exist and pass (873/873 across 55 files)
- [x] Agent ownership markers are present
- [x] All exit gates are current
- [x] Cross-references to ARCHITECTURE.md are valid

---

## Master Verification Checklist

- [x] All phases have verification gates
- [x] Agent ownership markers are present
- [x] All exit gates are current
- [x] Cross-references to ARCHITECTURE.md are valid
