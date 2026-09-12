# WebModel Download and Runtime Specification

> **📋 Status:** This is a design contract — not all features are implemented. Sections marked as implemented have been verified against the current codebase; all others describe intended future behavior.

> **🔵 INFO:** WebModel is a browser-runnable, signed, quantized model package that enables on-device AI in supported phones and laptops. Ollama remains a separate desktop/local-daemon path and is not a substitute for WebModel on mobile.

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

Add a **WebModel** path to Omni-AI and the model hub so a supported phone or
laptop can discover, download, verify, load, and use a browser-runnable model.
Ollama remains a separate desktop/local-daemon path.

This specification is a design contract for a future implementation. It does
not state that WebModel downloads currently work. The current model hub calls a
local Ollama daemon at `http://localhost:11434` for tags, pulls, and generation
(`src/components/Showcase.tsx:122-169`, `src/components/OllamaLocal.tsx:17-83`).

> **✅ VERIFIED:** The current model hub implementation uses a local Ollama daemon at `http://localhost:11434` (`src/components/Showcase.tsx:122-169`, `src/components/OllamaLocal.tsx:17-83`). WebModel download path is not yet implemented.

### ✅ Verification Gate — Section 1
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 2. Product behavior 🛒
<!-- AGENT: Product -->

A user can:

1. open **Models** or **Omni-AI settings**;
2. see whether WebModel, Ollama, or cloud AI is available on the current device;
3. filter models by task, size, license, publisher, and device suitability;
4. see estimated storage/RAM/VRAM before starting a download;
5. start, pause, resume, cancel, verify, load, unload, or delete a WebModel;
6. use the model in Omni-AI when the runtime reports `ready`;
7. fall back to Ollama or cloud AI when the browser cannot run the model;
8. inspect the model's publisher, version, license, digest, and limitations.

The UI must never say that a model is mobile-ready solely because it appears in
the catalog.

### ✅ Verification Gate — Section 2
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 3. Terminology 📖
<!-- AGENT: Backend -->

> **🔵 INFO:** These definitions govern how all subsequent sections use
> key terms. If a section uses a term not defined here, it inherits the
> definition below. Ambiguity between sections is a contradiction to fix.

- **WebModel:** a browser-runnable, signed, quantized model package.
- **Ollama model:** a model managed by a local Ollama daemon, normally on a
  desktop or laptop.
- **Runtime adapter:** code that loads a model using WebGPU, WASM, or another
  supported browser runtime.
- **Manifest:** immutable metadata describing a model version and its shards.
- **Shard:** a range-requestable binary chunk of a model package.
- **Device profile:** a set of minimum and recommended capabilities for a model.
- **Ready:** the package is fully downloaded, verified, installed atomically,
  and successfully loaded by the selected runtime.

### ✅ Verification Gate — Section 3
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 4. Out of scope for the first release 🚫
<!-- AGENT: Security -->

> **🟡 WARNING:** These items are explicitly NOT in scope for the first
> release. Do not implement them without updating this specification.
> Adding any of these without a spec change is out of scope.

- Arbitrary multi-gigabyte desktop models on low-memory phones.
- Treating Ollama as available on mobile browsers.
- Running untrusted model plugins with origin credentials.
- Shipping a model without license and publisher metadata.
- Claiming offline AI when no local model is installed and no cloud provider is
  connected.

### ✅ Verification Gate — Section 4
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 5. Model catalog contract 📦
<!-- AGENT: API -->

### 5.1 Catalog response

```json
{
  "version": 1,
  "generatedAt": "2026-09-09T00:00:00Z",
  "models": [
    {
      "id": "tiny-code-1.5b-q4",
      "latestVersion": "2026.09.1",
      "publisher": "example-publisher",
      "title": "Tiny Code 1.5B Q4",
      "summary": "A small code-assistance model for supported browsers.",
      "tasks": ["chat", "code"],
      "manifestUrl": "/api/v1/models/tiny-code-1.5b-q4/manifests/2026.09.1.json",
      "signatureUrl": "/api/v1/models/tiny-code-1.5b-q4/manifests/2026.09.1.json.sig",
      "license": "example-license",
      "minimumTier": "modern-mobile",
      "recommendedTier": "laptop"
    }
  ]
}
```

### 5.2 Manifest

```json
{
  "schemaVersion": 1,
  "id": "tiny-code-1.5b-q4",
  "version": "2026.09.1",
  "runtime": {
    "name": "webgpu-wasm",
    "minimumVersion": "1.0.0"
  },
  "architecture": "decoder-only",
  "quantization": "q4",
  "contextLength": 4096,
  "tasks": ["chat", "code"],
  "languages": ["en"],
  "sizeBytes": 1073741824,
  "shards": [
    {
      "name": "shard-00001.bin",
      "url": "/models/tiny-code-1.5b-q4/2026.09.1/shard-00001.bin",
      "bytes": 536870912,
      "sha256": "hex-digest"
    }
  ],
  "requirements": {
    "webgpu": true,
    "minimumMemoryBytes": 2147483648,
    "recommendedMemoryBytes": 4294967296,
    "minimumStorageBytes": 2147483648,
    "sharedArrayBuffer": false
  },
  "profiles": {
    "low-mobile": { "allowed": false, "reason": "Insufficient memory budget" },
    "modern-mobile": { "allowed": true, "contextLength": 2048 },
    "laptop": { "allowed": true, "contextLength": 4096 },
    "desktop": { "allowed": true, "contextLength": 8192 }
  },
  "publisher": {
    "id": "example-publisher",
    "name": "Example Publisher",
    "website": "<publisher-site>"
  },
  "license": {
    "id": "example-license",
    "name": "Example License",
    "url": "/licenses/example"
  },
  "safety": {
    "knownLimitations": ["May produce incorrect code", "English-first"],
    "contentPolicyUrl": "/policy"
  },
  "changelogUrl": "/models/tiny-code-1.5b-q4/changes",
  "signature": {
    "algorithm": "Ed25519",
    "keyId": "publisher-key-1",
    "value": "base64-signature"
  }
}
```

The exact runtime name is a decision to be validated by a proof-of-concept. The
contract intentionally does not require a specific model runtime before one is
tested on mobile and laptop browsers.

### ✅ Verification Gate — Section 5
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 6. Device capability detection 📱
<!-- AGENT: Client -->

Detect and cache:

- browser name/version and user-agent class;
- WebGPU availability and adapter limits;
- WASM and SIMD availability;
- `hardwareConcurrency`;
- `deviceMemory` where exposed;
- StorageManager quota and persistence support;
- service-worker and background-sync support;
- touch/pointer capabilities;
- current network information where the browser exposes it;
- whether the page is running in a secure context.

Capability detection must be advisory. The final decision is made against the
model manifest and the runtime's actual load result.

### Device profiles

| Profile | Typical target | Default policy | Status | Owner |
|---|---|---|---|---|
| `low-mobile` | constrained phone | Small quantized models only; short context; cloud fallback | Design | Client |
| `modern-mobile` | current phone/tablet | Small/medium quantized models; WebGPU preferred | Design | Client |
| `laptop` | laptop browser | Medium models; larger context; optional Ollama | Design | Client |
| `desktop` | workstation | Larger models; advanced runtime settings | Design | Client |

The UI should show the detected profile and the reason a model is allowed or
blocked.

### ✅ Verification Gate — Section 6
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 7. Download manager contract ⬇️
<!-- AGENT: Download -->

### 7.1 Operations

```ts
interface ModelDownloadManager {
  inspect(modelId: string, version: string): Promise<ModelInstallPlan>;
  start(plan: ModelInstallPlan): Promise<string>;
  pause(downloadId: string): Promise<void>;
  resume(downloadId: string): Promise<void>;
  cancel(downloadId: string): Promise<void>;
  verify(downloadId: string): Promise<VerificationResult>;
  delete(modelId: string, version: string): Promise<void>;
  list(): Promise<InstalledModelSummary[]>;
}
```

### 7.2 State machine

```text
available
  -> checking-device
  -> planning
  -> queued
  -> downloading
  -> paused
  -> verifying
  -> installing
  -> loading
  -> ready
  -> failed-retryable
  -> failed-permanent
```

### 7.3 Progress event

```json
{
  "downloadId": "01J...",
  "modelId": "tiny-code-1.5b-q4",
  "version": "2026.09.1",
  "state": "downloading",
  "shard": "shard-00001.bin",
  "shardIndex": 1,
  "shardCount": 2,
  "shardCompletedBytes": 268435456,
  "shardTotalBytes": 536870912,
  "totalCompletedBytes": 268435456,
  "totalBytes": 1073741824,
  "bytesPerSecond": 4194304,
  "etaSeconds": 192,
  "canPause": true,
  "canCancel": true
}
```

### 7.4 Required behavior

- Range requests and byte-range validation.
- Pause and resume without marking a partial package ready.
- Explicit cancel that leaves a resumable or safely deletable state.
- Maximum concurrent shards based on device/network policy.
- Storage quota check before the first shard is committed.
- Per-shard digest verification.
- Manifest/signature verification before installation.
- Atomic rename/commit after all checks pass.
- Re-verification command for an installed package.
- No executable code is run while a shard is being downloaded.

### ✅ Verification Gate — Section 7
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 8. Storage contract 💾
<!-- AGENT: Storage -->

Use IndexedDB or OPFS for model bytes and metadata. Store:

- model ID/version;
- manifest and signature;
- shard metadata and verified ranges;
- content digests;
- install state;
- runtime adapter version;
- storage bytes;
- last verified timestamp;
- deletion/tombstone state.

The browser's storage quota is not a promise of permanence. The UI must offer
delete and re-verify actions and must handle quota errors without corrupting a
previously ready model.

### ✅ Verification Gate — Section 8
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 9. Runtime adapter contract ⚡
<!-- AGENT: Runtime -->

```ts
interface WebModelRuntime {
  id: string;
  capabilities: RuntimeCapability[];
  detect(): Promise<RuntimeHealth>;
  load(installedModel: InstalledModel): Promise<LoadedModel>;
  generate(request: ModelGenerateRequest, signal?: AbortSignal): AsyncIterable<ModelGenerateEvent>;
  unload(modelId: string): Promise<void>;
}
```

A runtime adapter must report:

- load time;
- memory/VRAM usage where available;
- supported context lengths;
- warm/cold state;
- errors and recovery actions;
- whether generation is local or delegated.

The first release should support one tested WebGPU/WASM runtime and one cloud
fallback. Additional runtimes are adapters, not forks of the model UI.

### ✅ Verification Gate — Section 9
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 10. Omni-AI integration 🤖
<!-- AGENT: Integration -->

### 10.1 Provider selection

Omni-AI should select in this order, subject to user preference:

1. installed and ready WebModel;
2. local Ollama model when a daemon is reachable;
3. configured cloud provider;
4. no-provider guidance.

The user can pin a provider or allow automatic selection. Automatic selection
must show the active model and device/runtime in the chat header.

### 10.2 UI states

- **No local runtime:** explain that Ollama is desktop/local and offer WebModel
  or cloud setup.
- **WebModel available:** show model name, size, local status, and unload action.
- **WebModel downloading:** show pause/resume/cancel and estimated storage.
- **WebModel verifying/installing:** show that the model is not usable yet.
- **WebModel failed:** show the exact retryable or permanent reason.
- **WebModel ready:** allow chat and show local-runtime badge.
- **Fallback:** identify whether the response came from Ollama or cloud.

### 10.3 Copy examples

- "This model needs more memory than this device reports. Choose a smaller
  WebModel or use cloud AI."
- "Download paused. Your workspace is safe; resume when you have enough
  storage."
- "The model package failed verification and was not installed."
- "Ollama is not available in this browser. Use a WebModel or connect a cloud
  provider."

### ✅ Verification Gate — Section 10
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 11. API surface 🔌
<!-- AGENT: API surface -->

| Method and path | Purpose | Status | Owner |
|---|---|---|---|
| `GET /api/v1/models` | List signed catalog entries | Design | API |
| `GET /api/v1/models/:id/manifests/:version` | Fetch immutable manifest | Design | API |
| `GET /api/v1/models/:id/manifests/:version.sig` | Fetch publisher signature | Design | API |
| `GET /api/v1/models/:id/shards/:version/:shard` | Range-request a shard | Design | API |
| `POST /api/v1/models/:id/installs` | Reserve storage and create an install plan | Design | API |
| `GET /api/v1/models/installs/:id/events` | SSE progress and state events | Design | API |

The browser must still verify signatures and digests; an HTTPS response is not
a substitute for package integrity.

### ✅ Verification Gate — Section 11
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 12. Security requirements 🔒
<!-- AGENT: Security -->

> **🔴 CRITICAL:** These security requirements are non-negotiable. Every
> implementation MUST satisfy all ten items before release. Failure to meet
> any of these is a release blocker. An HTTPS response does not substitute
> for package integrity verification — signatures and digests must always
> be checked independently by the browser.

1. Catalog and shard origins are allowlisted.
2. Manifests and shards use immutable versions and digests.
3. Publisher signatures are verified before installation.
4. Model packages cannot request browser permissions during download.
5. Model output is treated as untrusted text.
6. Prompts and outputs are excluded from analytics.
7. Installed models can be deleted and re-verified by the user.
8. A failed verification never changes the `ready` state.
9. A model cannot access GitHub, Firebase credential stores, AI provider keys, or
   arbitrary network endpoints through the runtime adapter.
10. License and acceptable-use metadata are visible before download.

### ✅ Verification Gate — Section 12
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 13. Accessibility and mobile requirements ♿
<!-- AGENT: Mobile -->

- Every model action is available by keyboard and touch.
- Progress is exposed through `role="status"`/live regions without announcing
  every byte.
- Pause, resume, cancel, delete, and verify have text labels, not icons alone.
- The model manager remains usable at a narrow viewport.
- Reduced-motion settings disable decorative animation.
- Storage and compatibility warnings are understandable without architecture
  knowledge.
- A failed download always offers the next safe action.

### ✅ Verification Gate — Section 13
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 14. Verification plan ✅
<!-- AGENT: Testing -->

### Unit tests

- manifest parsing and validation;
- device profile matching;
- download state transitions;
- range reconstruction;
- digest/signature verification;
- quota and cancellation behavior;
- runtime selection and fallback.

### Integration tests

- interrupted download resumes;
- modified shard is rejected;
- modified manifest is rejected;
- browser refresh preserves a resumable install;
- ready model loads in the tested runtime;
- non-WebGPU browser receives the fallback;
- Omni-AI reports the actual active provider.

### Browser/device tests

- low-memory mobile profile;
- modern mobile WebGPU path;
- laptop WebGPU path;
- laptop Ollama adapter;
- cloud fallback with no local runtime;
- storage-pressure pause/delete flow;
- background/refresh recovery where supported.

### ✅ Verification Gate — Section 14
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 15. Rollout plan 🚀
<!-- AGENT: Rollout -->

1. Add catalog/manifest contracts behind a feature flag.
2. Ship device detection and a no-download compatibility screen.
3. Add a local fixture model and verify resume/tamper behavior.
4. Add one licensed small WebModel runtime proof-of-concept.
5. Enable the model manager for a limited cohort.
6. Add cloud/Ollama fallback messaging.
7. Publish the capability matrix and known limitations.
8. Promote only after mobile and laptop E2E tests pass.

### ✅ Verification Gate — Section 15
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## 16. Success metrics 📊
<!-- AGENT: Metrics -->

- percentage of eligible devices that can discover a compatible model;
- download completion and resume rate;
- verification failure rate;
- time from download start to first token;
- model load failure rate by device/runtime;
- fallback selection rate;
- storage deleted/reclaimed after user action;
- user-reported confusion or failed setup rate.

No metric should include raw prompts, source code, model output, tokens, or
credentials.

### ✅ Verification Gate — Section 16
- [ ] All contracts match implementation or are clearly marked as future
- [ ] All JSON/TYPE blocks are valid
- [ ] No contradictions between sections

## ✅ Master Verification Checklist
- [ ] All contracts are testable
- [ ] All security requirements have verification plans
- [ ] All device profiles are tested
- [ ] All agent markers are present
