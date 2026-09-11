# WebModel Download and Runtime Specification

## 1. Purpose

Add a **WebModel** path to Omni-AI and the model hub so a supported phone or
laptop can discover, download, verify, load, and use a browser-runnable model.
Ollama remains a separate desktop/local-daemon path.

This specification is a design contract for a future implementation. It does
not state that WebModel downloads currently work. The current model hub calls a
local Ollama daemon at `http://localhost:11434` for tags, pulls, and generation
(`src/components/Showcase.tsx:122-169`, `src/components/OllamaLocal.tsx:17-83`).

## 2. Product behavior

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

## 3. Terminology

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

## 4. Out of scope for the first release

- Arbitrary multi-gigabyte desktop models on low-memory phones.
- Treating Ollama as available on mobile browsers.
- Running untrusted model plugins with origin credentials.
- Shipping a model without license and publisher metadata.
- Claiming offline AI when no local model is installed and no cloud provider is
  connected.

## 5. Model catalog contract

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

## 6. Device capability detection

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

| Profile | Typical target | Default policy |
|---|---|---|
| `low-mobile` | constrained phone | Small quantized models only; short context; cloud fallback |
| `modern-mobile` | current phone/tablet | Small/medium quantized models; WebGPU preferred |
| `laptop` | laptop browser | Medium models; larger context; optional Ollama |
| `desktop` | workstation | Larger models; advanced runtime settings |

The UI should show the detected profile and the reason a model is allowed or
blocked.

## 7. Download manager contract

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

## 8. Storage contract

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

## 9. Runtime adapter contract

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

## 10. Omni-AI integration

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

- “This model needs more memory than this device reports. Choose a smaller
  WebModel or use cloud AI.”
- “Download paused. Your workspace is safe; resume when you have enough
  storage.”
- “The model package failed verification and was not installed.”
- “Ollama is not available in this browser. Use a WebModel or connect a cloud
  provider.”

## 11. API surface

| Method and path | Purpose |
|---|---|
| `GET /api/v1/models` | List signed catalog entries |
| `GET /api/v1/models/:id/manifests/:version` | Fetch immutable manifest |
| `GET /api/v1/models/:id/manifests/:version.sig` | Fetch publisher signature |
| `GET /api/v1/models/:id/shards/:version/:shard` | Range-request a shard |
| `POST /api/v1/models/:id/installs` | Reserve storage and create an install plan |
| `GET /api/v1/models/installs/:id/events` | SSE progress and state events |

The browser must still verify signatures and digests; an HTTPS response is not
a substitute for package integrity.

## 12. Security requirements

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

## 13. Accessibility and mobile requirements

- Every model action is available by keyboard and touch.
- Progress is exposed through `role="status"`/live regions without announcing
  every byte.
- Pause, resume, cancel, delete, and verify have text labels, not icons alone.
- The model manager remains usable at a narrow viewport.
- Reduced-motion settings disable decorative animation.
- Storage and compatibility warnings are understandable without architecture
  knowledge.
- A failed download always offers the next safe action.

## 14. Verification plan

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

## 15. Rollout plan

1. Add catalog/manifest contracts behind a feature flag.
2. Ship device detection and a no-download compatibility screen.
3. Add a local fixture model and verify resume/tamper behavior.
4. Add one licensed small WebModel runtime proof-of-concept.
5. Enable the model manager for a limited cohort.
6. Add cloud/Ollama fallback messaging.
7. Publish the capability matrix and known limitations.
8. Promote only after mobile and laptop E2E tests pass.

## 16. Success metrics

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
