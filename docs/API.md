# VantaOS API Documentation

> **Verification date:** 2026-09-13 (source-verified against the audited codebase)
> **Current as of:** 2026-09-14
> **Status model:** ✅ verified (read from code + exercised by the test suites) · ⚠️ present-but-not-enabled · 🎯 target
> **Ground truth:** This document is derived from executed tests and read source, not from README claims. References are module-level unless a `file:line` pair is explicitly cited below; no line numbers are invented.

---

## Current Architecture Snapshot

VantaOS is a Next.js 15 **hybrid-rendered** app — static shell pages plus dynamic server-rendered API routes — served by a **Cloudflare Worker** built with OpenNext, with **Firebase Realtime Database (RTDB)** as its data tier.

- Live URL: `https://website.vasudevaya.workers.dev`
- Backend: an OpenNext worker (`open nextjs-cloudflare build` output in `.open-next/worker.js`) whose routes are the Next.js route handlers in `app/api/*` (implemented in `src/lib/server/*`), serving the statically prerendered pages plus the REST API in Section 1.
- **Data tier = Firebase Realtime Database (RTDB), not Firestore.** The client module carrying a legacy name (`src/lib/firestore.ts`) exposes the RTDB data layer via `isFirestoreAvailable()` — a legacy alias. Nothing in the product writes application data to Firestore.
- Security boundary: the client-only app has no application server authorizing reads/writes. The server-side authorization contract is the RTDB ruleset at `database.rules.json` (see Section 2).

**Test / verification status (Sep 14, 2026):** Vitest **1047/1047** passing across **65 files**; Playwright **9 cases across 7 files**. CI runs lint, test, build, e2e, and an `npm audit` job (`--audit-level=high`; 0 vulnerabilities as of Sep 2026-09-14).

**API surfaces at a glance:**

| Surface | Module / Endpoint | Status |
|---|---|---|
| Backend API (route handlers) | `app/api/*` · `/api/health` · `/api/ai/generate` · `/api/gh/*` · `/api/ready` · `/api/plugins` · `/api/models` | ✅ / ✅ / ⚠️ |
| Firebase Auth + RTDB | firebase ^12.19.0 · `src/lib/firestore.ts` · `src/lib/demoAuth.ts` | ✅ |
| Workspace Files API | `src/lib/workspace/index.ts` · `src/lib/storage.ts` · `src/lib/workspace/export.ts` | ✅ |
| Editor / Model / AI adapter layer | `src/lib/models/adapter.ts` · `src/lib/client.ts` · `src/lib/telemetry/index.ts` | ✅ |
| Google Drive Integration | `src/lib/drive.ts` · `DriveManager.tsx` | ✅ |
| GitHub Integration | `src/lib/github.ts` · `GitHubManager.tsx` · `/api/gh/*` | ⚠️ proxy not enabled in prod |
| Terminal Sandbox API | `src/lib/terminal/runner.ts` · `TerminalPanel.tsx` | ✅ |

---

## Table of Contents

1. [Backend Worker API](#1-backend-worker-api)
2. [Firebase Auth & Realtime Database](#2-firebase-auth--realtime-database)
3. [Workspace Files API](#3-workspace-files-api)
4. [Editor, Model & AI Adapter Layer](#4-editor-model--ai-adapter-layer)
5. [Google Drive Integration](#5-google-drive-integration)
6. [GitHub Integration](#6-github-integration)
7. [Terminal Sandbox API](#7-terminal-sandbox-api)

---

## 1. Backend API

**Module:** OpenNext worker bundle (`app/api/*` route handlers; logic in `src/lib/server/*`). Deployed via `opennextjs-cloudflare build && opennextjs-cloudflare deploy`.

**Purpose:** the worker is the only backend in the deployment. It (a) serves the Next.js hybrid build at the edge (static pages + on-demand route handlers), (b) exposes a health probe, (c) proxies cloud AI generation, and (d) hosts the GitHub OAuth proxy.

### 1.1 GET `/api/health` — status probe — ✅ verified

- **Purpose:** liveness/status probe.
- **Request:** `GET`; no authentication, no body required. (OpenNext serves route handlers per-method, so this endpoint is **not** served for `HEAD` — a `HEAD /api/health` returns 404 with an `x-opennext: 1` header. Monitoring should use `GET`.)
- **Response:** `200` + JSON status document (`{ status, firebase, ai, github, drive }`; shape defined in `src/lib/server/api-router.ts`). `firebase.configured` reflects `NEXT_PUBLIC_FIREBASE_PROJECT_ID` presence; `status` is `ok` when Firebase is configured or IndexedDB is available, else `degraded`. Cache header: `Cache-Control: no-store`. Sufficient for uptime monitoring and load-balancer health checks.
- **Errors:** standard HTTP errors surfaced by the worker runtime on misrouting.

### 1.2 POST `/api/ai/generate` — cloud AI proxy — ✅ verified

- **Purpose:** forwards a model request from the browser client to an external provider. Body carries `provider` / `model` / `prompt`. This is the cloud fallback path when the on-device WebModel adapter (§4) is unsuitable or absent, and it backs the `gemini` provider registry entry.
- **Request (JSON):** `{ provider?, model, prompt, ... }` — field set as defined in `src/lib/server/api-router.ts`.
- **Response (JSON):** generated text; exact shape defined in `src/lib/server/api-router.ts`.
- **Auth:** gated on the `GEMINI_API_KEY` secret being set at deploy time. Without it, the endpoint returns an auth error.
- **Rate limit:** **100 requests per 60-second window per client** (`RATE_LIMIT = 100`, 60 s window; enforced via the rate-limit logic in `src/lib/server/rate-limit.ts`). Exceeding the window is rejected at the worker boundary.

### 1.3 `/api/gh/*` — GitHub OAuth proxy — ⚠️ present-but-not-enabled

- **Purpose:** server-side OAuth handoff for GitHub. Operations: OAuth redirect, authorization-code → access-token exchange, and repository import. The `GitHubManager` push flow (§6) uses GitHub blob/tree/commit/ref REST calls with a **200-blob UI cap**.
- **Auth model:** guarded by `GH_GRANT_SECRET` plus `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`. At the token-verification boundary, `verifyFirebaseIdToken` (Firebase ID tokens) and `verifyGrant` (grant checks) are used. **There is no KV namespace binding**: OAuth-token storage is absent by design, so the grant flow fails closed unless a token store is provisioned.
- **Presence guard ⚠️:** these secrets are **unset in the production deployment**, so this route group is not active in production. Treat it as present-but-not-enabled until the environment is provisioned; do not document it as a live feature.

### 1.4 Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | conditionally | Gates `/api/ai/generate` (stored as a Worker secret) |
| `GITHUB_CLIENT_ID` | no (prod: unset) | OAuth client for the `/api/gh/*` proxy |
| `GITHUB_CLIENT_SECRET` | no (prod: unset) | OAuth secret for the `/api/gh/*` proxy |
| `GH_GRANT_SECRET` | no (prod: unset) | Guards the GitHub grant flow |
| `APP_ORIGIN` | no | Expected request origin for the API |
| `NEXT_PUBLIC_FIREBASE_*` | [vars] | Firebase configuration available to the server; the client build consumes `NEXT_PUBLIC_FIREBASE_*` from the local build env |

**Errors / rate limits summary:** non-`/api/*` paths serve the hybrid app (static pages + on-demand routes); `/api/ai/generate` is rate-limited at 100 req/60 s/client; `/api/gh/*` is inert until env-provided.

---

## 2. Firebase Auth & Realtime Database

**Modules:** firebase SDK (`^12.19.0`) · `src/lib/firestore.ts` (legacy-named RTDB facade) · `src/lib/demoAuth.ts` (demo mode).

**Purpose:** all user identity and shared multi-user data (forum, profiles, votes) live in Firebase. This module group is the identity + data tier for VantaOS.

### 2.1 Authentication

- Sign-in providers: **Google** and **GitHub**, both scoped to the Firebase project **`website-6e8b1`**.
- **Demo mode:** when the Firebase configuration environment variables are absent (local dev/CI), the app falls back to demo mode via `src/lib/demoAuth.ts` — no real backend writes occur. Useful for isolated development; never the production path.

### 2.2 Data tier (RTDB)

- The RTDB data layer is exposed through the **legacy-named module `src/lib/firestore.ts`**. Its `isFirestoreAvailable()` function is a legacy alias that reflects RTDB availability. **This is not Firestore.** All application data below persists in Firebase Realtime Database paths.

Forum data model (RTDB paths):

| Path | Contents |
|---|---|
| `profiles/{uid}` | User profile documents |
| `threads/{id}` | Forum threads |
| `replies/{id}` | Replies to threads |
| `upvotes/{uid}_{tid}_{rid}` | One upvote record per user × thread × reply triple |

Client behavior:
- `increment()` for counter fields — atomic server-side increments, no read-modify-write races.
- `onValue()` for realtime subscriptions (threads, replies, votes) — live updates, not polling.
- The Firebase SDK uses the WebSocket/long-poll based realtime socket to RTDB; subscription lifecycle is tied to component mount/unmount.

### 2.3 ⚠️ Security note — RTDB rules are the security boundary

VantaOS is a **client-only application**: there is no application server authorizing reads/writes. The only server-side authorization is the RTDB ruleset at **`database.rules.json`**. Every path above — and anything a client writes into RTDB — is protected only by those rules. This ruleset is the security contract and must be validated as such: a rule bug is a live data-exposure bug. Client-side checks (e.g., hiding controls) are cosmetic and must never be treated as authorization.

**Status:** ✅ verified — SDK integration and the forum model are covered by the unit and e2e suites; the RTDB tier is exercised by the CI e2e setup.

---

## 3. Workspace Files API

**Modules:** `src/lib/workspace/index.ts` (public entry point) · `src/lib/workspace/operations.ts` (oplog) · `src/lib/workspace/export.ts` (export/import archive) · `src/lib/storage.ts` (persistence).

**Purpose:** file/folder CRUD over an append-only operation log (oplog). The workspace is browser-side: operations are plain function calls, results are in-memory + IndexedDB-persisted state.

### 3.1 Public exports (re-verified against `src/lib/workspace/index.ts`)

The entry point re-exports, grouped by submodule. **Section names below were re-verified from the actual file (90 lines) on 2026-09-13.**

- **Types** (from `./types`): `WorkspaceNode`, `NodeKind`, `Operation`, `OperationKind`, `CreateNodeOp`, `CreateFolderOp`, `UpdateContentOp`, `RenameNodeOp`, `MoveNodeOp`, `DeleteNodeOp`, `WorkspaceState`, `WorkspaceConfig`, `ConflictRecord`, `ConflictPolicy`, `AdapterKind`, `AdapterCapabilities`, `Adapter`, `CapabilitySlot`, `CapabilityProvider`, and the constant `DEFAULT_WORKSPACE_CONFIG`.
- **Oplog** (from `./operations`): `appendOp`, `bulkAppendOps`, `loadOps`, `loadOpsAfter`, `clearOps`, `replaceOps`, `initSeqCounter`, plus factories `makeCreateNodeOp`, `makeCreateFolderOp`, `makeUpdateContentOp`, `makeRenameNodeOp`, `makeMoveNodeOp`, `makeDeleteNodeOp`.
- **Indexes** (from `./indexes`): `contentHash`, `detectLanguage`, `buildState`, `getChildren`, `getNodeByPath`, `getDescendants`, `getPathParts`, `buildPath`.
- **Conflict** (from `./conflict`): `detectConflicts`, `resolveConflicts`, `markResolved` — policy enum `ConflictPolicy ∈ last-writer-wins | ask-user | auto-merge`.
- **Adapters** (from `./adapter`): `InMemoryAdapter`, `GitHubAdapter`, `registerAdapter`, `getAdapter`, `getAllAdapters`, `removeAdapter`, `initDefaultAdapters`.
- **Capabilities** (from `./capabilities`): `registerCapability`, `getCapability`, `getCapabilities`, `removeCapability`, `clearCapabilities`, `occupiedSlots`.
- **React** (from `./workspace`): `WorkspaceProvider`, `useWorkspace`.

> **Correction vs. the previous revision of this doc:** the older revision claimed `index.ts` re-exports `./paths`. The current `index.ts` does **not** re-export `./paths`; path utilities live inside the workspace package. Do not import path helpers from the package root.

### 3.2 Persistence

- Oplog and workspace state persist locally to **IndexedDB** via `idb-keyval` (`src/lib/storage.ts`): database **`vantaos_cloudos_files_v2`**, object stores **`files`** and **`metadata`** (`openDB`).
- The `localStorage` key **`vantaos_cloudos_files_v2`** is a legacy/demo path; `bulkAppendOps` is the documented entry point for migrating legacy localStorage data into the IndexedDB oplog.

### 3.3 Semantics

- **Oplog:** append-only, sequence-ordered (`seq`). `appendOp` seals an operation with id, timestamp, and seq; when an `idempotencyKey` matches an existing op, the existing op is returned instead. `loadOpsAfter(seq)` supports incremental sync hooks.
- **State replay:** `buildState(ops)` replays the oplog into full workspace state as a pure function.
- **Export/import:** `src/lib/workspace/export.ts` provides archive export/import (format defined in that module).

### 3.4 Auth, errors, limits

- **Auth:** none at this layer — it is a local, client-side API. Anything promoted into shared storage is subject to the RTDB rules (§2.3).
- **Errors:** validation failures surface via path validation and `ConflictRecord`s; op-batch conflicts resolve per the active `ConflictPolicy`.
- **Rate limits:** not applicable (local only).

### 3.5 Status

**Status:** ✅ verified — oplog replay, ordering, idempotency, and conflict resolution are covered by the Vitest suite.

🎯 **Target — multi-device sync:** the oplog is local-only today. A backend sync service (oplog pull/push via the Worker and/or RTDB) is a target; no shipped surface syncs workspace operations between devices yet.

---

## 4. Editor, Model & AI Adapter Layer

**Modules:** `src/lib/models/adapter.ts` · `src/lib/client.ts` · `src/lib/telemetry/index.ts`.

**Purpose:** on-device model lifecycle + a cloud fallback path, behind a single application facade, with error/telemetry observability.

### 4.1 WebModel adapter — `src/lib/models/adapter.ts`

- **Model download:** sharded, resumable, digest-verified (each shard checked against its SHA-256 before use).
- **Local storage:** IndexedDB (size-limited by browser storage quota).
- **Runtime detection:** capability detection (WebGPU / WASM) and device profiling; unsuitable runtimes route to the cloud path.
- **Model resolution & inference:** manifest resolution (cache → IndexedDB), manifest signature verification, and inference execution.
- **Provider registry:** `ollama`, `openrouter`, `gemini`, `openai` — the registry maps runtime providers; `gemini` resolves to the Worker's `GEMINI_API_KEY`-gated endpoint (§1.2).

### 4.2 Client facade — `src/lib/client.ts`

- The single front door for editor/AI operations. UI components call the facade rather than registries directly. When the local runtime is unsuitable, the facade routes generate requests through `POST /api/ai/generate`.

### 4.3 Telemetry — `src/lib/telemetry/index.ts`

- Wraps **Sentry** (errors/traces) and **LogRocket** (session replay). Records events, timings, and errors; sensitive keys are redacted before any payload is sent.

### 4.4 Auth, rate limits, status

- **Auth:** none at the module layer. Cloud calls authenticate via the Worker env (`GEMINI_API_KEY` for `gemini`) or provider-native secrets configured at runtime (`ollama`/`openrouter`/`openai`).
- **Rate limits:** the §1.2 proxy limit (100 req/60 s per client) applies to `gemini`-backed requests.
- **Status:** ✅ verified — adapter, orchestrator, and redaction behavior are covered by unit tests.

---

## 5. Google Drive Integration

**Modules:** `src/lib/drive.ts` · UI host `DriveManager.tsx`.

**Purpose:** browse and import Google Drive files into the workspace (§3).

### 5.1 OAuth scopes

The header comment in `src/lib/drive.ts` (lines 8–9) scopes the integration to **`drive.readonly`** and **`drive.file`** — readable Drive files plus files the app itself has created. No broader Drive scopes are granted.

### 5.2 Token handling

- Access tokens are obtained in-browser via Google OAuth and **cached client-side with a TTL** (`src/lib/drive.ts`).
- Tokens are **not** shipped into the RTDB data tier; they exist only in the client session.

### 5.3 Request/response & errors

- Drive REST calls use the cached access token as a Bearer credential; imported file contents flow into the workspace store (§3).
- Token expiry is handled via TTL-driven re-authorization; failures surface in the `DriveManager` UI.
- Live end-to-end calls depend on the Google OAuth client configuration being active for Firebase project `website-6e8b1`.

**Status:** ✅ verified — client code and token-cache behavior covered by unit tests. Treat live OAuth round-trips as configuration-dependent.

---

## 6. GitHub Integration

**Modules:** `src/lib/github.ts` · UI host `GitHubManager.tsx` · backend proxy `/api/gh/*` (§1.3).

**Purpose:** connect a GitHub account, import repositories, and push workspace content as commits. The `GitHubManager` push flow performs the GitHub blob → tree → commit → ref REST sequence with a **200-blob UI cap**.

### 6.1 Auth model — two token paths

- **Grant path:** the `/api/gh/*` OAuth proxy exchanges a GitHub authorization code for an access token (guarded by `GH_GRANT_SECRET` + `GITHUB_CLIENT_ID`/`SECRET` at the worker; tokens held in the `GH_TOKENS` KV store). Client entry point: `connectGitHubWithFirebase`, and `importGitHubAccessToken` for importing an existing token — `src/lib/github.ts` ≈ lines 163–189. `grant` / `directToken` variables distinguish the modes.
- **Direct-token path:** a user-supplied GitHub token, usable without the proxy.

### 6.2 ⚠️ Production caveat

The `/api/gh/*` proxy is **present-but-not-enabled**: its secrets are unset in production, so the grant path is not live. Direct-token mode can operate without the proxy when the user supplies a token, but the push flow is degraded in production until the worker environment is provisioned.

**Status:** ⚠️ proxy not enabled in production; the client code is ✅ verified by unit tests.

---

## 7. Terminal Sandbox API

**Modules:** `src/lib/terminal/runner.ts` · UI host `TerminalPanel.tsx` (xterm).

**Purpose:** sandboxed execution of user-provided JavaScript with no ambient authority.

### 7.1 Architecture

- `SandboxRunner` executes user code **via `new Function` inside a Web Worker**.
- **No file-system access** and **no network access** inside the sandbox — deliberate hermetic boundary.
- Console interception captures `log`/`error`/`warn`/`info` into the result.
- Lifecycle: a **fresh worker per run**; wall-clock timeout and output character caps apply; cleanup and termination are automatic.

### 7.2 Request/result shape

- `run(code)` returns a `SandboxRunHandle` whose result resolves to `{ ok, value, output, error?, terminated?, durationMs }`.

### 7.3 Auth

None — and that is the security design: untrusted code runs without credentials or I/O. Never grant the runner any ambient authority (filesystem, network, secrets).

**Status:** ✅ verified — runner behavior covered by the Vitest suite.

---

## Verification Summary

Re-verified on **2026-09-13**; current as of **2026-09-14**.

| Surface | Module / endpoint | Verified basis | Status |
|---|---|---|---|
| Backend API | `app/api/*` routes · `src/lib/server/*` | Source read + live edge smoke (deployment `1a381352-…`) | ✅ (health, ready, ai/generate) · ⚠️ (`/api/gh/*` — secrets unset in prod) |
| Firebase Auth + RTDB | firebase ^12.19.0 · `src/lib/firestore.ts` · `src/lib/demoAuth.ts` · `database.rules.json` | Source read + e2e suites | ✅ |
| Workspace Files API | `src/lib/workspace/index.ts` (re-verified exports) · `operations.ts` · `export.ts` · `storage.ts` | Source read + Vitest | ✅ (multi-device sync is 🎯) |
| Editor / Model / AI | `src/lib/models/adapter.ts` · `src/lib/client.ts` · `src/lib/telemetry/index.ts` | Source read + Vitest | ✅ |
| Google Drive | `src/lib/drive.ts` (scopes, header lines 8–9) | Source read + unit tests | ✅ (live round-trip is config-dependent) |
| GitHub | `src/lib/github.ts` (≈lines 163–189) · `/api/gh/*` | Source read + unit tests | ⚠️ proxy not enabled in prod |
| Terminal Sandbox | `src/lib/terminal/runner.ts` | Source read + Vitest | ✅ |

**Suite counts:** Vitest 1047/1047 across 65 files; Playwright 9 cases across 7 files; CI covers lint / test / build / e2e / npm audit (0 vulnerabilities as of Sep 2026-09-14).

**Referencing discipline:** `file:line` pairs appear in this document only where cited above (drive OAuth scopes, GitHub token helpers); all other references are module-level.

---

*End of API documentation*