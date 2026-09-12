# VantaOS Technology Stack

## Document status

This document separates the **current stack** from the **target stack**. Current
statements are grounded in repository files; target choices are architectural
recommendations and are not represented as implemented.

The current product is a browser-based IDE with a CodeMirror 6 editor, xterm, a local
model hub, Omni-AI, GitHub synchronization, a Google Drive integration, optional
Firebase auth, optional Cloud Firestore, and a Cloudflare
Worker (`README.md:3-8`, `package.json:14-43`, `workers/worker.ts:31-56`).

> **📋 Quick Navigation**
>
> - [1. 🏗️ Stack decision summary](#1-stack-decision-summary)
> - [2. 📦 Current stack inventory](#2-current-stack-inventory)
> - [3. 🎯 Target stack](#3-target-stack)
> - [4. 💻 Browser and device matrix](#4-browser-and-device-matrix)
> - [5. 📚 Package and dependency policy](#5-package-and-dependency-policy)
> - [6. 🧪 Testing stack](#6-testing-stack)
> - [7. 📊 Observability stack](#7-observability-stack)
> - [8. 🔒 Security stack](#8-security-stack)
> - [9. 🚀 Deployment and release stack](#9-deployment-and-release-stack)
> - [10. 📝 Architecture decisions to record](#10-architecture-decisions-to-record)

> **📊 Status Summary**
>
> | Area | Current | Target |
> |---|---|---|
> | Application shell | ✅ Implemented (Next.js 15, React 19, TS) | ✅ Keep + service boundaries |
> | Editor & terminal | ✅ Implemented (CodeMirror 6, xterm) | ✅ Keep + language-service workers |
> | Local data | 🔄 Partial (IndexedDB helper present; localStorage still in use) | ✅ IndexedDB/OPFS operation log |
> | AI & models | ✅ Implemented (Ollama + cloud) | ✅ Provider registry + WebModel adapter |
> | Auth & integrations | 🔄 Partial (Firebase optional, tokens in browser) | ✅ Server-side OAuth |
> | Edge (Cloudflare) | ✅ Implemented (Worker API proxy) | ✅ Versioned gateway |
> | Testing | ❌ Missing (no test script) | 🎯 Vitest + Playwright E2E |
> | CI/CD | ❌ Missing (no workflow files) | 🎯 GitHub Actions gates |

<!-- AGENT: Platform -->
## 1. 🏗️ Stack decision summary

| Layer | Current | Target | Status | Reason |
|---|---|---|---|---|
| Application | Next.js 15 static export, React 19, TypeScript (`next.config.mjs:2-10`, `package.json:28-34`) | Keep Next.js/React/TypeScript for the web shell; introduce service boundaries and route-level loading | ✅ Keep | Preserves the existing product while making state and integrations testable |
| UI | Tailwind CSS v4, Motion, Lucide (`package.json:17-27`) | Keep the design system; add semantic component primitives and responsive/mobile contracts | ✅ Keep | Improves consistency without replacing the visual language |
| Editor | CodeMirror 6 through `@codemirror/*` with custom React wrappers (`package.json:15-29`, `src/components/CloudCodeEditor.tsx`, `src/components/CloudDiffEditor.tsx`) | Keep CodeMirror as the editor core; add language-service-style workers for diagnostics and completions | ✅ Keep | Ships in the bundle (no CDN, no ~3mb runtime) while retaining 35+ language modes, diffing, and search |
| Terminal | xterm.js plus in-page shell (`package.json:18-19`, `src/components/TerminalPanel.tsx:23-35`) | Keep xterm as the terminal surface; add a sandboxed command/execution broker | ✅ Keep | Separates terminal UI from unsafe execution |
| Local data | IndexedDB helper exists (`src/lib/storage.ts:1-10`); CloudOS currently uses localStorage JSON (`src/components/CloudOS.tsx:290-322`) | IndexedDB/OPFS operation log and outbox | 🔄 Migrate | Provides durable, bounded, migratable offline storage |
| AI | Ollama plus OpenRouter/Gemini/OpenAI through browser/Worker calls (`src/components/OmniAI.tsx:6-25`, `workers/worker.ts:77-155`) | Provider registry, streaming protocol, server-mediated cloud path, WebModel runtime adapter | ✅ Keep | Makes providers interchangeable and mobile-capable |
| Models | Ollama model cards and localhost pull (`src/components/Showcase.tsx:14-105`, `src/components/Showcase.tsx:122-169`) | Signed WebModel catalog, resumable downloads, device profiles, Ollama adapter | 🔄 Extend | Adds a real browser/mobile path without misrepresenting Ollama support |
| Auth | Optional Firebase client (Google/GitHub OAuth) with a localStorage demo fallback, exposed through the unified `client` facade (`src/lib/client.ts`, `src/lib/firebase.ts`, `src/lib/demoAuth.ts`) | Keep Firebase as the production identity provider; add server-side OAuth and short-lived grants | 🔄 Harden | Provides real Google/GitHub sign-in with a single adapter surface |
| Drive | Google Drive REST v3 (readonly + app-owned files) using the OAuth access token captured during Firebase Google sign-in (`src/lib/drive.ts:4-279`, `src/components/DriveManager.tsx`) | Move long-lived tokens out of the browser; server-side token refresh | 🔄 Harden | Browser-only token expiry/refresh is the current limit |
| GitHub | Direct REST calls with a browser-stored token (`src/lib/github.ts:8-40`, `src/components/GitHubManager.tsx:15-44`) | Server-side OAuth, scoped grants, fresh-parent push protection | 🔄 Harden | Removes long-lived credentials from the browser |
| Edge | Cloudflare Worker API proxy (`wrangler.toml:1-11`, `workers/worker.ts:13-75`) | Versioned API gateway, model proxy, OAuth exchange, rate limits, health | ✅ Keep | Provides a stable trust boundary and operational surface |
| Tests | No test script is present in `package.json:6-13` | Vitest/Playwright plus contract, worker, security, and mobile E2E suites | ❌ Add | Makes reliability claims testable |
| CI/CD | No workflow files are present in the cloned repository | GitHub Actions build/typecheck/lint/test/E2E/dependency audit/deploy gates | ❌ Add | Prevents regressions from reaching production |

> **🔴 CRITICAL:** No test script exists in `package.json:6-13` and no CI workflow files are present — reliability claims cannot be verified today.

> **🔵 INFO:** The `npm run lint` command currently runs `tsc --noEmit` (`package.json:6-13`); this is a typecheck, not a linter.

### ✅ Verification Gate — Section 1
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Platform -->
## 2. 📦 Current stack inventory

> **🟢 SUCCESS:** An IndexedDB database with `files` and `metadata` stores already exists at `src/lib/storage.ts:6-10`.

> **🔴 CRITICAL:** The IDE bypasses the IndexedDB helper and persists workspace state as a full JSON snapshot in `localStorage` (`src/components/CloudOS.tsx:290-322`).

> **🔴 CRITICAL:** The current terminal executes supplied JavaScript with `new Function` (`src/components/TerminalPanel.tsx:157-169`) and uses a separate in-memory filesystem from the IDE workspace (`src/components/TerminalPanel.tsx:23-35`).

> **🟡 WARNING:** Firebase auth is optional; when `NEXT_PUBLIC_FIREBASE_*` variables are unset the app falls back to localStorage demo auth (`src/lib/client.ts`, `src/lib/firebase.ts:37-73`), which is not production-grade.

### 2.1 Framework and language

- **Next.js 15** with `output: 'export'`, static generation, trailing slashes,
  and unoptimized images (`next.config.mjs:2-10`).
- **React 19** for the client application (`package.json:31-32`).
- **TypeScript 5.8** for type-checked application code (`package.json:41`).
- **App Router** with a client-rendered page and a shared metadata/layout
  (`app/page.tsx:1-8`, `app/layout.tsx:11-55`).

The application shell is currently a client component that owns view state,
auth state, command palette state, and modal state (`src/App.tsx:19-27`,
`src/App.tsx:103-145`).

### 2.2 UI and interaction

- **Tailwind CSS v4** for utility styling (`package.json:17`, `package.json:40`).
- **Motion** for transitions and animated surfaces (`package.json:27`,
  `src/App.tsx:88-121`).
- **Lucide React** for icons (`package.json:26`).
- **React Virtuoso** for virtualized file lists (`package.json:34`,
  `src/components/CloudOS.tsx:754-765`).
- **DOMPurify** is installed for sanitization (`package.json:22`).

The current UI already includes a mobile navigation drawer and responsive
layout behavior (`src/components/Navigation.tsx:102-159`), but the IDE itself
needs a formal small-screen interaction contract.

### 2.3 Editor and terminal

- **CodeMirror 6** is the editor core, wired through first-party React wrappers
  (`package.json:15-29`, `src/components/CloudCodeEditor.tsx:1-16`,
  `src/components/CloudDiffEditor.tsx:1-18`, `src/lib/editor/setup.ts:1-22`).
- The IDE supports tabs, split views, diffing, search, formatting, file
  operations, and ZIP export (`src/components/CloudOS.tsx:143-187`,
  `src/components/CloudOS.tsx:208-262`, `src/components/CloudOS.tsx:355-498`).
- **xterm.js** renders the terminal (`package.json:18-19`,
  `src/components/TerminalPanel.tsx:216-231`).
- The current terminal shell is an in-page JavaScript class with an in-memory
  filesystem and `new Function` execution (`src/components/TerminalPanel.tsx:23-35`,
  `src/components/TerminalPanel.tsx:56-198`).

### 2.4 Storage and identity

- `src/lib/storage.ts` defines an IndexedDB database with `files` and
  `metadata` stores (`src/lib/storage.ts:6-10`, `src/lib/storage.ts:23-49`).
- CloudOS currently loads and saves a whole workspace snapshot in
  `localStorage` (`src/components/CloudOS.tsx:290-322`).
- Cloud Firestore is the Forum/Admin data tier and shares the Firebase project
  config — no extra environment variables (`src/lib/firestore.ts`).
- Firebase is the optional production identity layer (Google/GitHub OAuth) surfaced
  through the unified `client.auth` facade; when the `NEXT_PUBLIC_FIREBASE_*`
  variables are unset it falls back to local demo auth
  (`src/lib/client.ts`, `src/lib/firebase.ts:37-73`).
- A Google Drive access token (Drive scopes) is captured at Google sign-in
  (`drive.readonly` browse/open + `drive.file` for the app-owned VantaOS folder) and
  cached in `sessionStorage` with a 45-minute TTL (`src/lib/drive.ts:42-96`). On
  sign-out, the Drive token is cleared.
- Demo users and sessions are stored in localStorage (`src/lib/demoAuth.ts:29-30`,
  `src/lib/demoAuth.ts:66-81`).

### 2.5 AI and models

- Omni-AI has a provider union of `ollama`, `openrouter`, `gemini`, and
  `openai` (`src/components/OmniAI.tsx:6-25`).
- Ollama calls target a configurable localhost URL (`src/components/OmniAI.tsx:37-56`,
  `src/components/OllamaLocal.tsx:17-83`).
- Cloud AI calls go to `/api/ai/generate` (`src/components/OmniAI.tsx:130-146`),
  which the Worker proxies to provider APIs (`workers/worker.ts:77-155`).
- The model hub contains a fixed catalog of Ollama models and streams
  `localhost:11434/api/pull` progress (`src/components/Showcase.tsx:14-105`,
  `src/components/Showcase.tsx:122-169`).

### 2.6 GitHub integration

- GitHub REST requests read a token from localStorage and call GitHub directly
  (`src/lib/github.ts:8-40`).
- Repository cloning is capped at the first 200 blobs with a warning
  (`src/components/GitHubManager.tsx:80-88`).
- Push creates blobs/tree/commit and updates the branch ref
  (`src/lib/github.ts:74-116`, `src/components/GitHubManager.tsx:124-171`).

### 2.7 Deployment

- Cloudflare Workers serves the static `out/` directory and intercepts `/api/*`
  (`wrangler.toml:1-11`, `workers/worker.ts:1-7`).
- The package scripts provide development, build, lint-as-typecheck, static
  start, deploy, and preview commands (`package.json:6-13`).
- `npm run lint` currently runs `tsc --noEmit`; there is no lint/test/E2E
  script in the current package file (`package.json:6-13`).

> **🔴 CRITICAL:** No lint/test/E2E script in `package.json:6-13`; the deployment section has no CI verification.

### ✅ Verification Gate — Section 2
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Editor/Terminal -->
## 3. 🎯 Target stack

### 3.1 Client application

**Keep:**

- Next.js App Router for the web shell and static asset delivery.
- React 19 and TypeScript.
- Tailwind CSS as the styling layer.
- Motion only for stateful transitions, with reduced-motion support.
- CodeMirror 6 as the editor surface.
- xterm.js as the terminal surface.

**Add:**

- a workspace domain package with pure operations and reducers;
- service ports for storage, identity, AI, GitHub, execution, model delivery,
  and telemetry;
- Web Workers for language services and heavy parsing;
- a service worker for shell caching and supported download resumption;
- route-level feature flags and capability detection;
- contract-tested API clients.

### 3.2 State and persistence

**Target primitives:**

- IndexedDB/OPFS as the canonical local store.
- Operation log with immutable operation IDs.
- Outbox for offline synchronization.
- Content hashes and byte sizes.
- Schema migrations.
- Atomic transactions for file/folder mutations.
- Tombstones for multi-device deletes.
- Export/import manifests with integrity checks.

**Why:** the current helper already chooses IndexedDB (`src/lib/storage.ts:6-10`),
but the IDE bypasses it for a localStorage snapshot (`src/components/CloudOS.tsx:290-322`).
The target makes the existing storage direction consistent and testable.

### 3.3 Editor and language tooling

- CodeMirror 6 stays the user-facing editor; language modes are lazy per mode
  where practical.
- Prettier remains a lazy-loaded formatter for supported languages
  (`src/components/CloudOS.tsx:219-243`).
- Add language-server-like workers for diagnostics, completions, symbols, and
  formatting.
- Add bounded file parsing and virtualized previews for large files.
- Treat ESLint and future tools as versioned, opt-in plugins rather than
  hard-coded component behavior.
- Keep editor state local-first and synchronize operations, not whole files,
  when multiple devices are active.

### 3.4 Terminal and execution

- Keep xterm for terminal rendering and accessibility.
- Add a command broker with allowlisted browser commands.
- Add a sandboxed JavaScript/TypeScript runner in a Worker or remote isolated
  runner.
- Add remote/native adapters for languages that cannot run safely in a browser.
- Enforce CPU, memory, wall-clock, output, and network quotas.
- Return run IDs, structured logs, exit codes, and cancellation events.

> **🔴 CRITICAL:** Terminal still uses `new Function` execution (`src/components/TerminalPanel.tsx:157-169`) — must be replaced with sandboxed runner before production.

This is required because the current terminal executes supplied JavaScript with
`new Function` (`src/components/TerminalPanel.tsx:157-169`) and uses a separate
in-memory filesystem from the IDE workspace (`src/components/TerminalPanel.tsx:23-35`).

### 3.5 AI stack

**Provider layer:**

- Ollama desktop adapter.
- Cloudflare-mediated OpenRouter, Gemini, and OpenAI adapters.
- Future provider adapters implement one stable interface.
- Streaming, cancellation, retries, timeouts, and error normalization live in
  the orchestrator, not the chat component.

**Model layer:**

- Ollama model catalog remains a desktop path.
- WebModel catalog adds browser-runnable packages for supported phones and
  laptops.
- Model selection considers runtime, memory, storage, context, task, license,
  latency, and privacy.

**Security:**

- Cloud API keys are held server-side or in a platform key store.
- Browser-local demo keys are not treated as production secrets.
- Prompts, outputs, and tool calls are redacted from telemetry.
- Tool permissions are explicit and user-visible.

### 3.6 WebModel stack

The WebModel path should be implemented as a separate runtime adapter:

- signed model manifests;
- immutable model versions;
- range-requestable shards;
- SHA-256 verification;
- resumable download manager;
- IndexedDB/OPFS model storage;
- WebGPU/WASM runtime detection;
- mobile and laptop model profiles;
- cloud/Ollama fallback.

See `docs/WEB_MODEL_SPEC.md` for the detailed contract.

### 3.7 Identity and integration stack

- Firebase Auth for production identity when configured (Google/GitHub OAuth).
- Google Drive via the Firebase-captured token: `drive.readonly` browse/open plus
  `drive.file` for the app-owned VantaOS folder.
- Explicit demo mode for local-only use when Firebase is not set.
- Server-side GitHub OAuth.
- Short-lived, scoped GitHub grants.
- Server-side role and repository authorization.
- Refresh-token and revocation handling outside browser storage.
- Sync API for workspace operations.

### 3.8 Edge and backend stack

**Cloudflare Workers:**

- static asset serving;
- API gateway and request validation;
- provider proxy;
- model manifest/shard proxy;
- OAuth exchange;
- rate limiting;
- health and readiness endpoints;
- structured redacted logs.

**Firebase Cloud Firestore:**

- Forum threads and replies;
- upvotes (deterministic doc IDs for dedupe);
- user profiles;
- Admin metrics via realtime queries;
- security rules mirroring the auth model.

**Object storage/CDN:**

- immutable model shards;
- signed manifests;
- cache-friendly range requests;
- publisher digest records.

**Optional runners:**

- isolated containers or VMs for native language execution;
- ephemeral credentials;
- resource quotas;
- artifact retention policies.

### ✅ Verification Gate — Section 3
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Editor/Terminal -->
## 4. 💻 Browser and device matrix

| Capability | Low mobile | Modern mobile | Laptop | Desktop |
|---|---|---|---|---|
| IDE editing | Required | Required | Required | Required |
| Offline workspace | Required | Required | Required | Required |
| WebGPU WebModel | Optional fallback | Target | Target | Target |
| WASM WebModel | Target fallback | Target fallback | Fallback | Fallback |
| Ollama | Not assumed | Not assumed | Supported adapter | Supported adapter |
| Cloud AI | Fallback | Fallback | Available | Available |
| Sandboxed JS | Required | Required | Required | Required |
| Native language runners | Remote/absent | Remote/absent | Optional | Optional |
| GitHub OAuth | Supported | Supported | Supported | Supported |
| Google Drive (read + app-owned write) | Supported | Supported | Supported | Supported |
| PWA install | Target | Target | Optional | Optional |

> **🔵 INFO:** Capability detection gates every feature — a missing runtime produces a clear alternative, never a dead control.

### ✅ Verification Gate — Section 4
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Data -->
## 5. 📚 Package and dependency policy

### Keep and justify

- The `@codemirror/*` editor packages for the in-bundle editor core.
- `@xterm/xterm` and `@xterm/addon-fit` for terminal rendering.
- `firebase` (auth, app, firestore) for the optional Firebase sign-in/provider
  layer and the Cloud Firestore data tier.
- `jszip` and `file-saver` for explicit user-initiated workspace export.
- `prettier` for lazy formatting.
- `motion`, Tailwind, Lucide, and Virtuoso for the current interface.

### Add after design review

- a test runner and browser E2E runner;
- a schema/contract validation library;
- a model manifest signing/verification library;
- a WebGPU/WASM runtime selected through a compatibility proof-of-concept;
- a structured logging/telemetry client;
- a dependency security scanner in CI;
- a migration framework for IndexedDB schemas.

### Dependency rules

1. Pin reproducible versions in lockfiles.
2. Review new native bindings and model-runtime dependencies for platform
   support and supply-chain risk.
3. Do not add a browser model runtime until its license, memory behavior,
   mobile support, and maintenance status are documented.
4. Keep secrets out of client dependencies and bundles.
5. Record the reason for every production dependency in a decision log.

> **🔵 INFO:** Dependency rules are intentionally conservative — every addition requires design review and supply-chain assessment.

### ✅ Verification Gate — Section 5
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: GitHub -->
## 6. 🧪 Testing stack

| Test class | Target tooling | Coverage goal |
|---|---|---|
| Pure workspace operations | Vitest or equivalent | Deterministic operation/reducer coverage |
| Storage migrations | IndexedDB test harness | Legacy snapshot and schema upgrade paths |
| API contracts | Contract tests against Worker handlers | Request/response and error compatibility |
| AI orchestration | Mock providers plus integration tests | Streaming, timeout, cancellation, redaction |
| Model delivery | Local fixture server | Resume, hash tamper, quota, atomic install |
| Sandbox execution | Worker/runner isolation tests | Privilege, quota, and escape boundaries |
| GitHub flows | Recorded API fixtures | OAuth, pagination, stale-parent, rate limits |
| UI accessibility | Playwright + axe-style checks | Keyboard, focus, labels, reduced motion |
| Mobile behavior | Playwright WebKit/Chromium device contexts | Small viewport, backgrounding, storage pressure |
| Production build | CI build/typecheck/lint | Every push and pull request |

> **🔴 CRITICAL:** No test script in `package.json:6-13` — no tests can be run today. The first implementation phase must add the test surface before any reliability claims can be made.

The current package has no test script (`package.json:6-13`), so the first
implementation phase must add the test surface before claiming reliability.

### ✅ Verification Gate — Section 6
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Deploy -->
## 7. 📊 Observability stack

Use structured, privacy-safe events with:

- correlation IDs;
- operation IDs;
- duration and outcome;
- device/runtime capability class;
- retry category;
- no source code, prompts, model output, tokens, or GitHub credentials.

Expose:

- client boot and route timing;
- workspace save/sync status;
- model download and verification progress;
- AI first-token/error/cancellation metrics;
- terminal run startup and quota failures;
- GitHub clone/push outcomes;
- edge health and dependency health.

### ✅ Verification Gate — Section 7
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Browser -->
## 8. 🔒 Security stack

- HTTPS-only deployment and secure cookies where cookies are used.
- Strict security headers from the edge.
- Server-side OAuth and short-lived grants.
- Signed model manifests and shard digests.
- Sandboxed execution with explicit quotas.
- Plugin capability manifests and signature verification.
- Redacted structured logs.
- Dependency and secret scanning in CI.
- Role-based authorization on every privileged endpoint.
- Explicit demo-mode labeling.

> **🔴 CRITICAL:** Current code inherits browser-stored GitHub tokens (`src/lib/github.ts:8-20`) and unrestricted terminal evaluation (`src/components/TerminalPanel.tsx:157-169`) — these are NOT production guarantees.

The current code provides useful starting functionality, but the target stack
must not inherit browser-stored GitHub tokens (`src/lib/github.ts:8-20`) or
unrestricted terminal evaluation (`src/components/TerminalPanel.tsx:157-169`)
as production guarantees.

### ✅ Verification Gate — Section 8
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Packages -->
## 9. 🚀 Deployment and release stack

1. Pull request checks: typecheck, lint, unit tests, contract tests, dependency
   audit, and static analysis.
2. Preview deployment: isolated environment and seeded test services.
3. Production build: immutable static assets and versioned Worker.
4. Progressive rollout: canary edge deployment and rollback.
5. Post-deploy checks: health, model catalog, AI proxy, auth, and browser smoke
   tests.
6. Release notes: distinguish implemented/tested, implemented/untested, and
    planned capabilities.

### ✅ Verification Gate — Section 9
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

<!-- AGENT: Testing -->
## 10. 📝 Architecture decisions to record

Before implementation, create short ADRs for:

1. IndexedDB versus OPFS as the canonical workspace store.
2. WebGPU/WASM runtime selection for WebModel.
3. Server-side versus browser-mediated GitHub OAuth.
4. Remote runner versus desktop companion for native execution.
5. SSE versus WebSocket for sync and real-time events.
6. Firestore security rules versus other access-control approaches for sync.
7. Firebase vs a custom OAuth backend for production identity (and where Drive
   token refresh lives).
8. Plugin signature and permission model.

Each ADR should include context, decision, consequences, alternatives, and a
verification plan.

### ✅ Verification Gate — Section 10
- [ ] All current statements match repo files
- [ ] All target statements are clearly marked as recommendations
- [ ] No dead references to removed features

## ✅ Master Verification Checklist
- [ ] All current statements are grounded in repo files
- [ ] All target choices are labeled as recommendations
- [ ] All file references are accurate
- [ ] All agent markers are present
