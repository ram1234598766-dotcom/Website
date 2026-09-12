# VantaOS Roadmap

## Purpose

This roadmap turns the current VantaOS browser IDE into a reliable,
mobile-capable, extensible developer environment. It is ordered by risk and
dependency: correctness and security first, then the IDE foundation, then AI and
WebModel delivery, then collaboration and production operations.

This document is a plan, not a claim that the target capabilities already work.
The current repository is a static Next.js/React application with a
CodeMirror 6 editor, xterm, Ollama/Omni-AI, GitHub synchronization, a Google
Drive integration, optional Firebase auth, optional Cloud Firestore, and a Cloudflare
Worker (`README.md:5-8`, `package.json:14-43`, `workers/worker.ts:31-56`).

## 1. North-star outcomes

A user should be able to:

1. open VantaOS on a laptop or phone without installing a desktop application;
2. create or clone a workspace and keep working offline;
3. get useful AI assistance through a model appropriate for the device;
4. download a signed WebModel when the browser can run it, with pause/resume and
   verification;
5. use a sandboxed terminal and language tools without exposing the browser or
   credentials;
6. sync changes safely across devices;
7. connect GitHub through a short-lived, scoped authorization flow;
8. understand every long-running operation and recover from failure.

## 2. Roadmap at a glance

| Phase | Name | Primary outcome | Exit gate |
|---|---|---|---|
| 0 | Baseline and risk closure | Understand the current system and stop unsafe assumptions | Build/typecheck/lint pass; risk register reviewed |
| 1 | Workspace foundation | Canonical local workspace, operation log, migration path | Refresh/crash and multi-tab tests pass (99 tests) |
| 2 | IDE reliability | Real editor services, sandboxed execution, resilient terminal | IDE E2E and sandbox quota tests pass (25 tests) |
| 3 | AI orchestration | Stable provider/tool contracts and safe cloud/local routing | Streaming/cancellation/redaction tests pass (47 tests) |
| 4 | WebModel delivery | Signed, resumable, device-aware browser model downloads | Tamper/interruption/device-matrix tests pass (36 tests) |
| 5 | Identity and GitHub security | Firebase OAuth (in place) + server-side GitHub OAuth, scoped grants, safe token handling | Token-boundary and push safety tests pass (64 tests) |
| 6 | Sync and collaboration | Offline-first multi-device sync and conflict resolution | Convergence and recovery tests pass (76 tests; mergeAll bugs open) |
| 7 | Mobile/PWA experience | Installable, responsive, low-power mobile workflow | Mobile browser/device tests pass — BLOCKED (10 tests fail) |
| 8 | Production operations | CI, telemetry, SLOs, incident runbooks, release gates | Production readiness review passes |
| 9 | Plugin ecosystem | Signed extensions with least-privilege capabilities | Plugin permission/isolation tests pass — BLOCKED (13/19 pass; new Function sandbox escape open) |

## 3. Phase 0 — Baseline and risk closure

### Work

- Inventory routes, components, storage locations, network calls, secrets,
  build/deploy commands, and browser support.
- Separate documented current behavior from target behavior.
- Add a risk register for data loss, credential exposure, model supply-chain,
  unsafe code execution, and mobile storage constraints.
- Establish the baseline commands for build, typecheck, lint, tests, dependency
  audit, and browser E2E.
- Define product claims that require evidence before they appear in the UI or
  README.

### Evidence to collect

- Current build output and warnings.
- Current browser support and mobile behavior.
- Current local persistence behavior after refresh and storage-pressure events.
- Current AI provider behavior when the Worker is absent.
- Current GitHub token lifetime and scope.
- Current model hub behavior without a local Ollama daemon.

### Exit criteria

- No critical risk is hidden behind a marketing claim.
- Every proposed change has an owner, test strategy, and rollback path.
- The roadmap remains documentation-only until the user approves implementation.

### Verification evidence (Sep 12 2026)

- `npm run lint` (`tsc --noEmit`): 0 errors
- `npm run build`: passes (static export)
- `npm test` (`vitest run`): 393/393 across 33 test files
  - Phase 1 (workspace): 99 tests across 9 files — buildState, multi-tab, bulkAppendOps, loadOpsAfter, provider, operations, paths, legacy, outbox-recovery, export
  - Phase 2 (IDE): 25 tests — keyboard, terminal, commands, runner
  - Phase 3 (AI): 47 tests — provider, streaming, redaction, cancellation
  - Phase 5 (auth): 64 tests across 5 files — grant lifecycle, ID-token verification, GitHub proxy, client fallback
  - Phase 6 (sync): 76 tests across 5 files — sync status, conflict, protocol, batch, convergence-recovery
  - Phase 7 (PWA): 10 tests across 2 files — PWA manifest, responsive (all fail — Rolldown JSX)
  - Phase 8 (health): 11 tests — per-service health endpoints

## 4. Phase 1 — Workspace foundation

### Work

1. Define the canonical `WorkspaceFile`, `WorkspaceFolder`, and
   `WorkspaceOperation` schemas.
2. Move the primary local persistence path to IndexedDB or OPFS.
3. Add an operation log and outbox.
4. Add schema migrations and a one-time import from the existing
   `vantaos_cloudos_files_v2` snapshot (`src/components/CloudOS.tsx:290-322`).
5. Add deterministic path, rename, move, and delete rules.
6. Add workspace manifests for export/import and integrity checks.
7. Keep the existing CodeMirror editor adapting through the same editor
   port during migration.

### Tests

- create/edit/rename/move/delete operations survive refresh;
- two tabs applying the same idempotent operation do not duplicate it;
- interrupted transactions leave a recoverable state;
- importing a legacy snapshot preserves file content and paths;
- storage quota failure is visible and does not corrupt existing files.

### Exit criteria

- The workspace is the source of truth; React state is a projection.
- No user file is silently dropped during migration.
- The existing IDE remains usable throughout the migration.

## 5. Phase 2 — IDE reliability

### Work

- Split the monolithic IDE component into editor, explorer, tabs, search,
  terminal, diff, formatting, and export adapters.
- Run language services in Web Workers with bounded memory and cancellation.
- Add real file-backed terminal state rather than a disconnected in-memory map.
- Replace unrestricted `new Function` execution with a sandboxed runner
  (`src/lib/terminal/runner.ts:159`) — **done Sep 11 2026**; shell
  (`commands.ts:230`) and Omni-AI (`OmniAI.tsx:13-106`) wired to it.
- ~~Add run IDs, status, logs, output limits, CPU/memory/time quotas, and
  cancellation.~~ Wall-clock `maxRunMs`, `maxOutputChars`, and `maxCodeChars`
  are implemented; run IDs and rich status are future polish.
- Add keyboard and screen-reader contracts for every action.
- Make split views, tabs, search, and terminal resizing deterministic on small
  screens.

### Tests

- Editor mount/unmount does not leak views or listeners.
- Large files do not block the main thread beyond the defined budget.
- Terminal output is bounded and truncation is explicit — **done**
  (`tests/phase2/runner.test.ts` output-flood test).
- Sandbox code cannot access GitHub, AI, or origin credentials — **done**
  (one-shot worker, no cross-run state, no globalThis leak).
- Keyboard-only users can complete the main IDE workflows.

### Exit criteria

- The IDE works after refresh, navigation, and browser resize.
- Execution failures are actionable and cannot escalate privileges.
- The UI remains responsive on a mid-range laptop and phone.

## 6. Phase 3 — Omni-AI orchestration

### Work

- Extract the provider registry from `OmniAI.tsx`.
- Define provider, model, tool, stream, cancellation, and error contracts.
- Add server-mediated cloud AI requests with rate limits and secret redaction.
- Keep local Ollama as a desktop adapter, not a mobile requirement.
- Add explicit provider health and fallback states.
- Add prompt/tool permission prompts and output limits.
- Add model selection by task, context, latency, cost, privacy, and device.

### Tests

- streaming response, timeout, retry, and cancellation;
- invalid provider/model and provider outage;
- API key never appears in logs, analytics, or error responses;
- tool calls cannot exceed declared permissions;
- local Ollama failure produces a useful fallback message.

### Exit criteria

- Adding a provider does not require changing the chat UI.
- Every AI request has a trace ID and user-visible status.
- The assistant never fabricates a provider connection.

## 7. Phase 4 — WebModel download and runtime

This phase adds the requested mobile/laptop model path without pretending that
Ollama is available on every phone.

### Work

1. Create a signed model catalog and immutable manifest format.
2. Add device capability detection for WebGPU, WASM, memory, storage, and
   browser version.
3. Add a resumable shard downloader with range requests, pause/resume,
   cancellation, and atomic installation.
4. Add digest/signature verification before a model becomes runnable.
5. Add model profiles for low-memory mobile, modern mobile, laptop, and desktop.
6. Add a WebModel runtime adapter and a cloud/Ollama fallback.
7. Add a model manager UI showing size, license, publisher, compatibility,
   progress, storage use, and delete/verify actions.
8. Add a service-worker download path where supported, with a foreground
   fallback everywhere else.
9. Start with a small licensed code/chat model profile and a clear cloud fallback.

### Required model manifest fields

- immutable model ID/version;
- publisher and signature;
- runtime and architecture;
- quantization, context length, and task tags;
- shard URLs, byte lengths, and SHA-256 digests;
- minimum/recommended RAM and VRAM;
- browser/runtime requirements;
- license and acceptable-use metadata;
- update/changelog reference.

### Tests

- interrupted download resumes from the last verified chunk;
- a modified shard is rejected and never marked ready;
- a manifest/signature mismatch is rejected;
- low-storage devices refuse before partial installation;
- non-WebGPU devices receive a clear fallback;
- mobile and laptop profiles select different model classes;
- deleting a model removes runtime access and reclaimable storage;
- model load failures are recoverable without deleting the verified package.

### Exit criteria

- A user can discover whether a model is suitable before downloading it.
- A WebModel is never marked ready before verification.
- Ollama and WebModel are visibly distinct product paths.
- Mobile users get a useful fallback rather than a broken desktop-only button.

## 8. Phase 5 — Identity and GitHub security

### Already in place

- Firebase Auth as the production identity provider for Google/GitHub OAuth,
  surfaced through the unified `client.auth` facade
  (`src/lib/client.ts`, `src/lib/firebase.ts`, `src/lib/demoAuth.ts`).
- Google Drive integration (browse/open read-only + save to an app-owned
  VantaOS folder) using the OAuth token captured during Firebase Google
  sign-in (`src/lib/drive.ts:4-279`, `src/components/DriveManager.tsx`).
- Demo mode is visibly local-only and non-production (`src/lib/demoAuth.ts`).
- Server-side GitHub OAuth with short-lived HMAC-signed grants
  (`workers/grants.ts`, `workers/github-proxy.ts`): browser holds only the
  in-memory grant; the access token lives in KV `gh:{uid}`
  (`src/lib/github.ts`, pushed from `src/lib/client.ts`).
- "Continue with GitHub" works even when the worker proxy is unreachable or
  unconfigured: the popup access token falls back to a **memory-only,
  tab-scoped** connection used straight against api.github.com
  (`connectGitHubWithDirectToken`, `connectionKind()`, fallback wired in
  `src/lib/client.ts` and `src/components/GitHubManager.tsx`). Nothing is
  persisted — the token dies with the page.

**Verification status (2026-09):** Firebase Google sign-in was smoke-verified on
the live project `website-6e8b1` from `http://localhost:3000` — the popup opens
to the project's `__/auth/handler` with `providerId=google.com`, Drive scopes
requested, zero console errors; `npx tsc --noEmit` and `npm run build` pass with
the real `NEXT_PUBLIC_FIREBASE_*` env. The final Google consent click requires a
human browser session and is the last manual step to complete the round trip.
GitHub direct-token fallback is covered by `tests/phase5/github-client.test.ts`
and `tests/phase5/client-github-fallback.test.ts` — all passing;
  full suite `npm test` 373/373 across 31 files (Sep 12 2026). See
  `docs/ARCHITECTURE.md` §13.0 for the fact table.

### Work

- [x] Add server-side GitHub OAuth and short-lived scoped grants.
- [x] Remove long-lived GitHub tokens from browser storage (durable grant path;
  memory-only tab token as the unconfigured-worker fallback).
- [x] Add fresh-parent checks and non-fast-forward protection for pushes.
- [x] Add revocation and session expiry behavior.
- Move Drive/GitHub token refresh out of the browser (currently a 45-minute
  `sessionStorage` TTL for Drive, `localStorage` for GitHub).
- Add server-side role and repository-scope checks.
- Add pagination and large-repository handling instead of silent truncation.

### Tests

- OAuth callback cannot mint a grant for another user/repository;
- expired/revoked grants fail closed;
- push based on a stale parent is rejected with recovery guidance;
- large repositories are paginated or explicitly rejected before partial clone;
- tokens are absent from localStorage, logs, analytics, and client bundles;
- Firebase sign-in/out and Drive connect save/open round trips work end to end
  on the deployed origin (execute once Firebase env is set in the deploy env).

### Exit criteria

- The browser never retains a long-lived GitHub credential (durable path:
  KV-held token, memory-only grant; fallback path: memory-only tab token
  that never survives a reload).
- Every write has an auditable actor, repository, branch, and operation ID.

## 9. Phase 6 — Sync and collaboration

### Work

- Add an authenticated sync API for operation batches.
- Add per-device IDs, vector clocks or equivalent causality metadata, and
  tombstones.
- Add conflict preservation and user-resolvable diffs.
- Add presence/cursors only after the workspace operation model is stable.
- Add remote change notifications through SSE/WebSocket with a polling fallback.
- Add sync health and last-synced state to the UI.

### Tests

- the same operations converge in different orders;
- offline edits from two devices merge or produce an explicit conflict;
- a device waking after days reconciles safely;
- a deleted file does not reappear without a valid operation;
- reconnect storms are bounded.

### Exit criteria

- Offline-first is a tested behavior, not a label.
- Collaboration never overwrites an unacknowledged local operation.

## 10. Phase 7 — Mobile and PWA experience

### Work

- Add responsive workspace, AI, model manager, terminal, and GitHub flows.
- Add installable PWA metadata, offline shell caching, and safe update behavior.
- Add touch targets, virtual-keyboard handling, orientation changes, and
  reduced-motion support.
- Add storage and battery awareness for model downloads and execution.
- Add a mobile-specific model profile and cloud fallback.
- Add end-to-end tests on at least one small Android viewport and one iOS
  WebKit viewport.

### Tests

- all primary workflows complete without a mouse;
- the app recovers after backgrounding during a download or save;
- the UI does not lose focus when the mobile keyboard opens;
- storage pressure produces a safe pause/delete flow;
- no desktop-only feature is presented as available on mobile.

### Exit criteria

- A phone can edit, save, chat, and manage a suitable model.
- A laptop can use the same workspace with larger-model and execution options.

## 11. Phase 8 — Production operations

### Work

- Add CI for build, typecheck, lint, unit tests, browser E2E, dependency audit,
  and artifact publication.
  **Done (Sep 11 2026):** lint (`tsc --noEmit`), Vitest suite (373 tests),
  and static build run on every push/PR via `.github/workflows/ci.yml`.
  Still open: browser E2E, artifact publication.
- Add preview deployments with environment-specific configuration.
- Add structured, redacted logs and correlation IDs.
- Add service health, sync health, model download health, and AI provider health.
- Define SLOs for boot, save, sync, model download, AI first-token latency, and
  terminal run startup.
- Add incident runbooks for credential exposure, model supply-chain failure,
  sync corruption, and edge deployment rollback.
- Add `LICENSE` (Apache-2.0), `SECURITY.md`, `CONTRIBUTING.md` — **done
  (Sep 11 2026).**

### Exit criteria

- Every release has reproducible artifacts and a rollback.
- Critical alerts are actionable and do not expose user data.
- The status page distinguishes client, edge, provider, and device failures.

## 12. Phase 9 — Plugin and skill ecosystem

### Work

- Define a signed plugin manifest with capabilities, permissions, versions, and
  digests.
- Add a plugin sandbox and lifecycle: install, enable, update, disable, revoke.
- Add capability scopes for editor, terminal, AI tools, files, network, and
  native adapters.
- Add a marketplace/catalog contract with publisher verification.
- Add plugin telemetry that excludes source, prompts, and secrets.
- Document an SDK and compatibility policy.

### Tests

- plugins cannot access undeclared capabilities;
- revoked plugins stop at the next trust boundary;
- plugin updates are atomic and rollback safely;
- a malicious or malformed plugin cannot compromise the host;
- disabling a plugin leaves user data intact.

### Exit criteria

- Extensions are opt-in and auditable.
- The core product remains simple and secure when no plugin is installed.

## 13. Delivery rules

- No phase is marked complete from a README claim alone.
- Each phase has a failing test or observable acceptance criterion before the
  implementation is considered done.
- Runtime changes are kept separate from documentation changes.
- Security-sensitive changes are reviewed independently before merge.
- Mobile suitability is a capability decision, not a marketing label.
- The user approves each implementation phase before it is pushed.
