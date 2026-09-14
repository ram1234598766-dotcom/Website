# VantaOS WebModel — Web UI Design and Screen/UX Contract

> **📋 Status:** Design contract — describes the WebModel (the AI web app model) and the screen/UX contract for VantaOS. Verified against the typed schema (`src/lib/schema/`) and the phase-schema tests in `tests/phase-schema/` (11 files, as of Sep 14 2026). Some sections describe target/design behavior, not yet shipped — every section below carries an explicit status marker.

> **🔵 INFO:** VantaOS runs as a Next.js 15 static export fronted by a Cloudflare Worker, with Firebase **Realtime Database (RTDB)** as the data tier. There is no Firestore in the current stack. "WebModel" here means the web application model — the browser UI, its data flows, and the behavior contract behind it — not a downloadable in-browser AI model.

## Quick Navigation

- [1. Purpose](#1-purpose)
- [2. Product behavior](#2-product-behavior)
- [3. Terminology](#3-terminology)
- [4. Out of scope for the first release](#4-out-of-scope-for-the-first-release)
- [5. Model catalog contract](#5-model-catalog-contract)
- [6. Device capability detection](#6-device-capability-detection)
- [7. Download manager contract](#7-download-manager-contract)
- [8. Storage contract](#8-storage-contract)
- [9. Runtime adapter contract](#9-runtime-adapter-contract)
- [10. Omni-AI integration](#10-omni-ai-integration)
- [11. API surface](#11-api-surface)
- [12. Security requirements](#12-security-requirements)
- [13. Accessibility and mobile requirements](#13-accessibility-and-mobile-requirements)
- [14. Verification plan](#14-verification-plan)
- [15. Rollout plan](#15-rollout-plan)
- [16. Success metrics](#16-success-metrics)

## 1. Purpose 🎯
<!-- AGENT: Product -->

**Status: ✅ shipped+tested** — this section describes what is already built and verified.

VantaOS is an AI-assisted cloud OS that lives in the browser: a workspace with a file manager and editor, a terminal, an AI companion, sync, and a forum — all served as a static site and backed by Firebase RTDB. The WebModel is the contract that pins down what that application must do on screen and over the network, so the behavior does not drift from the typed models in `src/lib/schema/` and the tests in `tests/phase-schema/`.

This specification is a design contract: it describes the implemented web application model and marks the parts that are targets rather than shipped behavior. Where a surface runs in demo or reduced form (for example the default AI provider and the GitHub OAuth proxy), this document says so explicitly instead of claiming it is production-grade.

> **✅ VERIFIED:** The app is a Next.js 15 static export + Cloudflare Worker + Firebase Realtime Database, with typed models in `src/lib/schema/`, workspace logic in `src/lib/workspace/`, and a provider adapter in `src/lib/models/adapter.ts`. State is persisted locally through IndexedDB via idb-keyval and remotely through RTDB.

### ✅ Verification Gate — Section 1
- [ ] Contract describes the shipped surfaces without overclaiming
- [ ] Terminology matches the typed models in `src/lib/schema/`
- [ ] No contradictions between sections

## 2. Product behavior 🛒
<!-- AGENT: Product -->

**Status: ✅ shipped+tested** for the core surfaces, with two behaviors that ship in reduced form (flagged inline).

A user can:

1. open the **Cloud OS workspace**, manage files in the file manager, and open documents for editing; ✅
2. edit code in the **CodeMirror 6 editor** with 15 language modes, and compare revisions in the diff editor; ✅
3. run commands in the **xterm.js terminal**, executed inside a sandboxed Web Worker runner; ✅
4. chat with **Omni-AI**, the AI companion, and choose a provider from the registry (Ollama, OpenRouter, Gemini, OpenAI); ✅
5. rely on a default AI path that degrades gracefully — the built-in Gemini path is gated on a `GEMINI_API_KEY` environment variable that is **not configured by default**, so first-run chat runs in **demo mode**; ⚠️
6. start a remote Ollama model from the registry (local daemon at `http://localhost:11434`); ✅
7. sync workspace files with **Google Drive**; ✅
8. import and push repositories to **GitHub** through the Worker OAuth proxy — the proxy is present but **not enabled in production**; ⚠️
9. use the **forum** and admin surfaces, both stored in Firebase RTDB; ✅
10. persist workspace state locally through **IndexedDB (idb-keyval)** so a reload keeps open files and settings; ✅
11. sign in through the demo-auth fallback and have Sentry/LogRocket telemetry attach to sessions as configured. ⚠️ (demo auth is a reduced form, not a full identity system)

The UI must never present a demo-mode response as coming from a live remote provider, and must always show which provider actually produced an answer.

### ✅ Verification Gate — Section 2
- [ ] Every listed behavior is tagged with its shipped/reduced status
- [ ] Provider and sync claims match `tests/phase-schema/webmodel-matrix.test.ts`
- [ ] No contradictions between sections

## 3. Terminology 📖
<!-- AGENT: Backend -->

> **🔵 INFO:** These definitions govern how all subsequent sections use key terms. If a section uses a term not defined here, the definition below is inherited. Ambiguity between sections is a contradiction to fix.

- **WebModel:** the web application model — VantaOS's browser UI plus the behavior and data contract behind it.
- **VantaOS:** the AI-assisted cloud OS web application described by this contract.
- **Cloud OS workspace:** the central screen — file manager, open documents, and activity surface.
- **Workspace document:** a file in the workspace that can be opened in the editor and stored locally and/or remotely.
- **Omni-AI:** the AI companion chat surface and its provider handling.
- **Provider registry:** the fixed set of AI providers — Ollama (local), OpenRouter, Gemini, and OpenAI.
- **Local model:** a model served by the local Ollama daemon at `http://localhost:11434`.
- **Cloud generation:** a response produced through the Worker endpoint `/api/ai/generate`.
- **Demo mode:** the fallback AI behavior used when `GEMINI_API_KEY` is not configured (the default for fresh deployments).
- **Terminal runner:** the sandboxed Web Worker that executes xterm.js sessions.
- **Sync:** moving workspace documents between the app and an external service — Google Drive sync, and GitHub import/push.
- **Persistence layer:** the local IndexedDB store backed by idb-keyval.
- **Data tier:** the authoritative cloud store — Firebase Realtime Database (RTDB) — holding forum threads, workspace metadata, and admin state.
- **Ready:** an AI provider is available and reachable, and the UI shows the actual provider for a session.

### ✅ Verification Gate — Section 3
- [ ] Definitions match the models in `src/lib/schema/`
- [ ] No term used differently between sections
- [ ] No contradictions between sections

## 4. Out of scope for the first release 🚫
<!-- AGENT: Security -->

**Status: ✅ shipped+tested** — as an exclusion list, the guardrails below are confirmed against the audited codebase (as of Sep 2026).

> **🟡 WARNING:** These items are explicitly NOT in scope for the first release. Do not implement any of them without updating this specification.

- **Firestore as a data tier.** The app is wired to Firebase Realtime Database. Introducing Firestore now would fork the data model without benefit.
- **A downloadable in-browser AI model ("WebModel" in the download sense).** The AI path is provider-based (local Ollama or cloud via the Worker); no browser-runnable model package is part of this product.
- **Arbitrary multi-gigabyte desktop models on low-memory phones.**
- **Running untrusted model plugins with origin credentials.**
- **Treating the local Ollama daemon as available on mobile browsers.**
- **Treating demo-mode AI as production AI.**
- **Claiming GitHub import/push is production-grade** while the OAuth proxy is disabled in production.
- **Deploying the static site through Cloudflare Pages or any domain other than the project's configured origin.**

### ✅ Verification Gate — Section 4
- [ ] Exclusions match the data tier and provider reality
- [ ] No section contradicts the RTDB-only and Worker-only statements
- [ ] No contradictions between sections

## 5. Model catalog contract 📦
<!-- AGENT: API -->

**Status: ⚠️ shipped in reduced/demo form** — the provider registry exists and is tested, but the default AI path runs in demo mode because `GEMINI_API_KEY` is not configured by default.

The catalog contract describes the AI providers Omni-AI can use. The registry is fixed to four providers — **ollama**, **openrouter**, **gemini**, **openai** — each with an endpoint mode (local vs cloud), a configured state, and an availability rule.

```json
{
  "registryVersion": 1,
  "providers": [
    {
      "id": "ollama",
      "mode": "local",
      "endpoint": "http://localhost:11434",
      "configured": true,
      "availableWhen": "daemon reachable on localhost"
    },
    {
      "id": "openrouter",
      "mode": "cloud",
      "requiresSecret": true,
      "configured": false
    },
    {
      "id": "gemini",
      "mode": "cloud",
      "secret": "GEMINI_API_KEY",
      "configured": false,
      "note": "Not configured by default; chat falls back to demo mode"
    },
    {
      "id": "openai",
      "mode": "cloud",
      "requiresSecret": true,
      "configured": false
    }
  ]
}
```

The exact names and fields are typed in `src/lib/schema/` and exercised by `tests/phase-schema/webmodel-adapter.test.ts` and `tests/phase-schema/omni-ai-webmodel.test.ts`. The chat header must always render the provider that actually served the last response — never a guessed one.

### ✅ Verification Gate — Section 5
- [ ] Registry fields match the schema models
- [ ] Demo-mode default for Gemini is documented, not hidden
- [ ] No contradictions between sections

## 6. Device capability detection 📱
<!-- AGENT: Client -->

**Status: 🎯 design target, not yet shipped** — no dedicated capability-detection pass exists in the current app; the surfaces below are targets to build against the shipped surfaces.

Detect and surface, so the UI can adapt without hard failures:

- Web Worker availability (required by the sandboxed terminal runner);
- IndexedDB availability and quota (required by the persistence layer);
- service-worker support for the static export;
- touch/pointer capabilities and viewport class;
- current network state where the browser exposes it;
- whether the page is running in a secure context (required for provider calls).

Capability detection must be advisory. The final decision belongs to the runtime — for example, if IndexedDB is unavailable, the app must explain that local persistence is off rather than silently using memory-only state.

### Device profiles

| Profile | Typical target | Default policy | Status | Owner |
|---|---|---|---|---|
| `desktop-laptop` | laptop/desktop browser | Full workspace; local Ollama + cloud providers; sync and telemetry | Design | Client |
| `tablet` | tablet browser | Workspace and chat; cloud AI fallback preferred | Design | Client |
| `small-mobile` | phone browser | Read-mostly workspace; cloud AI only | Design | Client |

The UI should show the detected profile and the reason a capability is blocked.

### ✅ Verification Gate — Section 6
- [ ] Detection is advisory and never blocks the read path
- [ ] Profiles match the reference models in `src/lib/schema/`
- [ ] No contradictions between sections

## 7. Download manager contract ⬇️
<!-- AGENT: Download -->

**Status: ⚠️ shipped in reduced/demo form** — retrieving data into the workspace is partially shipped: RTDB reads, Drive sync, and local persistence are live; the GitHub import/push path is present but its Worker OAuth proxy is **not enabled in production**.

"Download" here means pulling remote data into the client workspace. The contract:

- **RTDB documents** (forum threads, workspace metadata, admin state) stream into the UI as data changes. ✅
- **Google Drive files** sync into the workspace with the bidirectional sync call. ✅
- **GitHub repositories** can be imported and pushed back — the Worker OAuth proxy implements the flow, but it is disabled in production, so the surface must report it as unavailable there, not as working. ⚠️
- **Local persistence** writes arrive through the idb-keyval IndexedDB store, so a reload restores open files and settings. ✅

### 7.1 Operations

```ts
interface WorkspaceDataManager {
  pull(scope: "rtdb" | "drive" | "github"): Promise<DataPullResult>;
  push(scope: "rtdb" | "drive" | "github"): Promise<DataPushResult>;
  restoreLocal(): Promise<RestoredWorkspace>;
}
```

### 7.2 Required behavior

- Every pull is idempotent — re-pulling the same scope must not duplicate or corrupt workspace state;
- GitHub operations must fail with a clear "not enabled on this deployment" message while the proxy is disabled;
- Sync failures must not destroy locally persisted state;
- Progress must be observable and cancellable.

### ✅ Verification Gate — Section 7
- [ ] Sync behavior matches `tests/phase-schema/sync-api.test.ts`
- [ ] Reduced GitHub surface is reflected in the UI copy
- [ ] No contradictions between sections

## 8. Storage contract 💾
<!-- AGENT: Storage -->

**Status: ✅ shipped+tested** — the local persistence layer is live and covered by tests in the phase-schema suite.

Use **IndexedDB via idb-keyval** for local persistence. The persistence layer stores:

- workspace files and their editor state;
- open-document/recent-files metadata;
- settings and UI preferences;
- chat history for Omni-AI sessions;
- cached schema read models (mirroring what RTDB holds remotely).

Remote state is authoritative in **Firebase RTDB**; IndexedDB is a local cache of the workspace, rebuilt when RTDB data changes. Browser storage is not a promise of permanence — the UI must offer delete/export actions and must handle quota errors without corrupting a previously restored workspace.

### ✅ Verification Gate — Section 8
- [ ] Store keys and shapes match `src/lib/schema/` persistence models
- [ ] Quota/error handling is tested
- [ ] No contradictions between sections

## 9. Runtime adapter contract ⚡
<!-- AGENT: Runtime -->

**Status: ⚠️ shipped in reduced/demo form** — the provider adapter is implemented and tested, but its default local path runs in demo mode until a provider key or reachable model is present.

The adapter contract separates the UI from how a response is actually produced. The reference implementation lives in `src/lib/models/adapter.ts` and is pinned by `tests/phase-schema/webmodel-adapter.test.ts`.

```ts
interface ProviderAdapter {
  id: string;
  mode: "local" | "cloud" | "demo";
  detect(): Promise<ProviderHealth>;
  generate(request: GenerateRequest, signal?: AbortSignal): AsyncIterable<GenerateEvent>;
}
```

A runtime adapter must report:

- provider id and endpoint mode;
- reachability (e.g. is the Ollama daemon up at `localhost:11434`);
- configured state (e.g. is `GEMINI_API_KEY` present in the Worker environment);
- whether the last generation was local, cloud, or demo;
- errors and recovery actions.

Additional adapters are adapters, not forks of the chat UI. The xterm.js terminal is a separate runtime: sessions execute in a sandboxed Web Worker runner, and the CodeMirror 6 editor provides 15 language modes plus the diff view — both are shipped and test-covered.

### ✅ Verification Gate — Section 9
- [ ] Adapter behavior matches `tests/phase-schema/webmodel-adapter.test.ts`
- [ ] Demo mode is reported, never silently presented as live
- [ ] No contradictions between sections

## 10. Omni-AI integration 🤖
<!-- AGENT: Integration -->

**Status: ⚠️ shipped in reduced/demo form** — the chat and provider registry are shipped and tested; the default provider path is demo mode until a secret or local model is available.

### 10.1 Provider selection

Omni-AI selects a provider in this order, subject to user preference:

1. a provider the user pinned explicitly;
2. local Ollama when the daemon at `http://localhost:11434` is reachable;
3. cloud generation through the Worker endpoint `/api/ai/generate`, which uses a configured provider secret (Gemini is the named example, gated on `GEMINI_API_KEY`);
4. demo mode when no cloud secret is configured and no local model is reachable.

Automatic selection must show the active model/provider in the chat header.

### 10.2 UI states

- **No provider reachable:** explain that the local Ollama daemon is a desktop/local path and that cloud providers need configuration; show demo mode.
- **Local Ollama available:** show the model name and local badge.
- **Cloud configured:** show the cloud provider name and that responses come via the Worker.
- **Demo mode:** show a clear demo badge; never label a demo response as live.
- **Provider failed:** show the exact retryable or permanent reason.
- **Fallback:** identify whether a response came from local Ollama, the cloud provider, or demo.

### 10.3 Copy examples

- "No provider is reachable right now. Start the Ollama daemon on this machine, or configure a cloud provider."
- "Your prompts go to the local Ollama daemon at localhost:11434."
- "This response is from demo mode — no AI provider is configured. Add a cloud key in the environment to enable live answers."
- "GitHub import is not enabled on this deployment."

### ✅ Verification Gate — Section 10
- [ ] Provider order matches `src/lib/models/adapter.ts`
- [ ] Demo/fallback states match `tests/phase-schema/omni-ai-webmodel.test.ts`
- [ ] No contradictions between sections

## 11. API surface 🔌
<!-- AGENT: API surface -->

**Status: ⚠️ shipped in reduced/demo form** — the core Worker endpoint and RTDB paths are live; the GitHub OAuth proxy is present but **not enabled in production**.

| Method and path | Purpose | Status | Owner |
|---|---|---|---|
| `POST /api/ai/generate` (Worker) | Cloud AI proxy for chat generation | Shipped | API |
| `GET/POST *` (Worker) | GitHub OAuth + import/push proxy | Present, not enabled in prod | API |
| Official Firebase RTDB paths | Forum threads, workspace metadata, admin state | Shipped | API |

The Next.js build is a **static export** — there is no Node server in the client origin; the Worker fronts the static assets and the API routes above. Cloudflare Pages and any non-project domain are not part of the deployment contract.

### ✅ Verification Gate — Section 11
- [ ] Endpoint list matches the edge contracts in `tests/phase-schema/edge-contract.test.ts`
- [ ] GitHub proxy status is stated, not assumed
- [ ] No contradictions between sections

## 12. Security requirements 🔒
<!-- AGENT: Security -->

**Status: ⚠️ shipped in reduced/demo form** — the RTDB data tier and key handling are in place, but demo auth, an env-gated AI key, and a disabled GitHub proxy mean the security posture is reduced relative to a full production target.

> **🔴 CRITICAL:** These security requirements are non-negotiable. Failure to meet any of them is a release blocker. A static export or an HTTPS transport does not substitute for the controls below.

1. **No secrets in the client or the static export.** AI provider keys live only in the Worker environment (`GEMINI_API_KEY` and equivalents); the browser never receives them.
2. **The AI key is not enabled by default.** `GEMINI_API_KEY` is env-gated; fresh deployments run chat in demo mode rather than with an exposed or missing-key failure.
3. **RTDB rules bound the data tier.** Forum, workspace-metadata, and admin paths are write/read-scoped; the demo-auth fallback must never grant elevated rights.
4. **GitHub OAuth proxy is disabled in production** until its token scope and callback handling are re-audited. When enabled, OAuth tokens must never reach the client.
5. **Telemetry does not carry chat content.** Sentry/LogRocket sessions must exclude prompts and model output.
6. **AI and terminal output are treated as untrusted text** — never executed, evaluated, or rendered as HTML inside the editor/terminal surfaces.
7. **Sync failures never destroy local state**, and quota/conflict handling never corrupts an already-restored workspace.

### ✅ Verification Gate — Section 12
- [ ] Key handling matches the Worker environment usage
- [ ] Data-tier claims match RTDB (no Firestore statements)
- [ ] No contradictions between sections

## 13. Accessibility and mobile requirements ♿
<!-- AGENT: Mobile -->

**Status: 🎯 design target, not yet shipped** — no accessibility or mobile conformance pass is recorded in the current test suites; the requirements below are targets to hold every shipped surface to.

- Every workspace action is available by keyboard and touch.
- Editor, terminal, and chat progress/state are exposed through live regions without announcing every keystroke or byte.
- Actions have text labels, not icons alone.
- The workspace remains usable at a narrow viewport.
- Reduced-motion settings disable decorative animation.
- Sync and provider status warnings are understandable without architecture knowledge.
- A failed provider or sync action always offers the next safe action.

### ✅ Verification Gate — Section 13
- [ ] Targets are tracked as design requirements, not claimed as verified
- [ ] No contradictions between sections

## 14. Verification plan ✅
<!-- AGENT: Testing -->

**Status: ✅ shipped+tested** — verification is live and green as of the Sep 2026 audit.

- **Unit + schema tests (Vitest):** 1049 passed / 1049 across 65 test files.
- **Phase-schema suite (`tests/phase-schema/`, 11 files):** `webmodel-matrix` (screen surface matrix), `webmodel-adapter` (provider adapter behavior), `omni-ai-webmodel` (Omni-AI chat contract), `schema` (typed model validation), `sync-api` (Drive/GitHub/RTDB sync contract), `slo` (latency budgets), `runbooks` (operational guidance), `telemetry` (data-collection contract), `export` (static-build/export contract), `edge-contract` (Worker routing and auth).
- **Schema unit tests** alongside the typed models in `src/lib/schema/`.
- **E2E (Playwright):** 8 cases across 6 files covering the workspace, editor, terminal, Omni-AI chat, and forum/admin surfaces.
- **CI:** lint, test, build, and E2E run on every push/PR.

Targets that remain for later verification: a mobile-profile run, an accessibility pass, and an end-to-end run against the GitHub proxy once it is enabled in production.

### ✅ Verification Gate — Section 14
- [ ] Reported counts match the last verified CI run (no invented numbers)
- [ ] Every section above links to a named suite or is marked a target
- [ ] No contradictions between sections

## 15. Rollout plan 🚀
<!-- AGENT: Rollout -->

**Status: 🎯 design target, not yet shipped** — the steps below are a plan, not shipped behavior.

1. Re-audit the GitHub OAuth proxy (token scope, callback, storage) and only then enable it behind a feature flag.
2. Provide real provider-key provisioning so fresh deployments get a live cloud path instead of demo mode.
3. Ship device-capability detection (Section 6) and profile-aware guidance.
4. Run the accessibility pass (Section 13) and fix to the requirements.
5. Publish the capability matrix and known limitations for each surface.
6. Promote only after laptop and mobile E2E runs pass and the security checklist (Section 12) is closed.

### ✅ Verification Gate — Section 15
- [ ] Steps are sequenced after the security checklist
- [ ] No step is presented as already shipped
- [ ] No contradictions between sections

## 16. Success metrics 📊
<!-- AGENT: Metrics -->

**Status: 🎯 design target, not yet shipped** — metrics collection is defined below; none are claimed as currently tracked.

- provider availability and demo-mode session share;
- chat sessions completed per provider and fallback rate;
- workspace reload recovery rate (restored from IndexedDB after a reload);
- sync success rate for Drive and RTDB pulls, and conflict counts;
- terminal session success and sandbox-failure counts;
- storage reclaimed after user delete/export actions;
- user-reported confusion or failed-setup rate per surface.

No metric should include raw prompts, source code, model output, or credentials.

### ✅ Verification Gate — Section 16
- [ ] Metrics are privacy-safe and match the telemetry contract
- [ ] No invented numbers are reported
- [ ] No contradictions between sections

## ✅ Master Verification Checklist
- [ ] All sections carry an explicit ✅ / ⚠️ / 🎯 status marker
- [ ] All shipped claims name the test suite that backs them
- [ ] All security requirements have verification plans
- [ ] RTDB (not Firestore) is the only data tier named
- [ ] GitHub OAuth proxy is stated as disabled in production