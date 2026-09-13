# VantaOS Public API Documentation

> **Verification date:** 2026-09-13
> **Source verification:** All signatures were read directly from source files and confirmed to match actual export declarations.

---

## Table of Contents

1. [Workspace API](#1-workspace-api)
2. [Terminal API](#2-terminal-api)
3. [Sync API](#3-sync-api)
4. [Model API](#4-model-api)
5. [Telemetry API](#5-telemetry-api)
6. [AI Provider API](#6-ai-provider-api)
7. [Cross-Reference Matrix](#7-cross-reference-matrix)

## 1. Workspace API

**Source:** src/lib/workspace/index.ts (re-exports from ./types, ./operations, ./indexes, ./conflict, ./adapter, ./capabilities, ./paths, ./workspace)

### 1.1 Types (re-exported from ./types)

| Type | Defined in | Description |
|------|-----------|-------------|
| WorkspaceNode | src/lib/workspace/types.ts:13 | A file or folder node in the workspace tree |
| NodeKind | src/lib/workspace/types.ts:11 | file or folder |
| Operation | src/lib/workspace/types.ts:109 | Discriminated union of all operation types |
| OperationKind | src/lib/workspace/types.ts:27 | create_node, create_folder, update_content, rename_node, move_node, delete_node |
| CreateNodeOp | src/lib/workspace/types.ts:46 | Operation that creates a file node |
| CreateFolderOp | src/lib/workspace/types.ts:58 | Operation that creates a folder node |
| UpdateContentOp | src/lib/workspace/types.ts:67 | Operation that updates file content |
| RenameNodeOp | src/lib/workspace/types.ts:76 | Operation that renames a node |
| MoveNodeOp | src/lib/workspace/types.ts:87 | Operation that moves a node |
| DeleteNodeOp | src/lib/workspace/types.ts:98 | Operation that deletes a node |
| WorkspaceState | src/lib/workspace/types.ts:119 | Derived workspace state (nodes, indexes, dirty set) |
| WorkspaceConfig | src/lib/workspace/types.ts:192 | Workspace configuration (conflict policy, limits, adapters) |
| ConflictRecord | src/lib/workspace/types.ts:134 | A detected conflict between local and remote operations |
| ConflictPolicy | src/lib/workspace/types.ts:143 | last-writer-wins, ask-user, auto-merge |
| AdapterKind | src/lib/workspace/types.ts:147 | disk, github, gitlab, cloudos |
| AdapterCapabilities | src/lib/workspace/types.ts:149 | Read/write/delete/move/sync capability flags |
| Adapter | src/lib/workspace/types.ts:157 | Interface for external storage backends |
| CapabilitySlot | src/lib/workspace/types.ts:173 | Named provider slots |
| CapabilityProvider | src/lib/workspace/types.ts:182 | A provider registered for a capability slot |
| DEFAULT_WORKSPACE_CONFIG | src/lib/workspace/types.ts:202 | Default workspace configuration constant |

### 1.2 Operation Log Functions (from ./operations)

#### appendOp

 appendOp(
  kind: OperationKind,
  source: Operation[" source],
 payload: Operation[\payload],
 idempotencyKey?: string
): Promise<Operation>


**Source:** src/lib/workspace/operations.ts:87

Appends an operation to the append-only oplog and persists it to IndexedDB. Returns the sealed operation (with assigned id, timestamp, and seq). If an idempotencyKey is provided and a matching operation already exists, the existing operation is returned instead.

**Returns:** Promise<Operation> - The sealed operation with assigned metadata.

#### bulkAppendOps

 bulkAppendOps(ops: readonly Operation[]): Promise<void> 

**Source:** src/lib/workspace/operations.ts:136

Bulk-appends operations, used during migration from localStorage. Assigns sequence numbers to operations that lack them.

#### loadOps

 loadOps(): Promise<readonly Operation[]> 

**Source:** src/lib/workspace/operations.ts:169

Loads all operations from the oplog, sorted by sequence number.

**Returns:** Promise<readonly Operation[]> - All operations sorted by seq.

#### loadOpsAfter

 loadOpsAfter(seq: number): Promise<readonly Operation[]> 

**Source:** src/lib/workspace/operations.ts:185

Loads operations with a sequence number greater than the given value. Used for incremental sync.

#### clearOps

 clearOps(): Promise<void> 

**Source:** src/lib/workspace/operations.ts:199

Deletes all operations from the oplog (used during compaction). Resets the sequence counter to 0.

#### replaceOps

 replaceOps(ops: readonly Operation[]): Promise<void> 

**Source:** src/lib/workspace/operations.ts:211

Replaces the entire oplog. Used after compaction: clears then bulk-appends.

#### initSeqCounter

 initSeqCounter(startFrom: number): void 

**Source:** src/lib/workspace/operations.ts:67

Initializes the in-memory sequence counter. No-op if startFrom is less than the current counter value.

#### findOpByIdempotencyKey

 findOpByIdempotencyKey(key: string): Promise<Operation | undefined> 

**Source:** src/lib/workspace/operations.ts:121

Finds an existing operation by its idempotency key.

#### Op Factory Functions

\\	ypescript
These functions create *unsealed* operation objects (with seq: 0). The seq field is overwritten when passed to appendOp.

| Function | Signature | Source |
|----------|-----------|--------|
| makeCreateNodeOp | (params: { path, name, parentId, content, language }, source?, idempotencyKey?) => CreateNodeOp | operations.ts:221 |
| makeCreateFolderOp | (params: { path, name, parentId }, source?, idempotencyKey?) => CreateFolderOp | operations.ts:247 |
| makeUpdateContentOp | (params: { nodeId, content, contentHash }, source?) => UpdateContentOp | operations.ts:271 |
| makeRenameNodeOp | (params: { nodeId, oldName, newName, oldPath, newPath }, source?) => RenameNodeOp | operations.ts:290 |
| makeMoveNodeOp | (params: { nodeId, oldParentId, newParentId, oldPath, newPath }, source?) => MoveNodeOp | operations.ts:311 |
| makeDeleteNodeOp | (params: { nodeId, path, snapshot }, source?) => DeleteNodeOp | operations.ts:332 |

### 1.3 Index Functions (from ./indexes)

| Function | Signature | Returns | Source |
|----------|-----------|---------|--------|
| contentHash | (text: string) => string | Simple non-crypto hash (base-36) | indexes.ts:17 |
| detectLanguage | (filename: string) => string | Language name from file extension | indexes.ts:48 |
| buildState | (ops: readonly Operation[]) => WorkspaceState | Replays ops into full workspace state (pure function) | indexes.ts:64 |
| getChildren | (state: WorkspaceState, parentId: string | null) => readonly WorkspaceNode[] | Children sorted (folders first, alphabetical) | indexes.ts:204 |
| getNodeByPath | (state: WorkspaceState, path: string) => WorkspaceNode | undefined | Node at the given path | indexes.ts:221 |
| getDescendants | (state: WorkspaceState, nodeId: string) => readonly WorkspaceNode[] | All descendants (recursive) | indexes.ts:230 |
| getPathParts | (path: string) => readonly string[] | Path segments | indexes.ts:250 |
| buildPath | (...parts: string[]) => string | Joins segments with / | indexes.ts:255 |

### 1.4 Conflict Functions (from ./conflict)

| Function | Signature | Source |
|----------|-----------|--------|
| detectConflicts | (localOps: readonly Operation[], remoteOps: readonly Operation[]) => ConflictRecord[] | conflict.ts:77 |
| resolveConflicts | (conflicts: readonly ConflictRecord[], policy: ConflictPolicy) => readonly Operation[] | conflict.ts:121 |
| markResolved | (conflict: ConflictRecord) => ConflictRecord | conflict.ts:156 |

### 1.5 Adapter Functions and Classes (from ./adapter)

| Export | Type | Source |
|--------|------|--------|
| InMemoryAdapter | class | adapter.ts:30 |
| GitHubAdapter | class | adapter.ts:87 |
| registerAdapter | (adapter: Adapter) => void | adapter.ts:178 |
| getAdapter | (id: string) => Adapter | undefined | adapter.ts:182 |
| getAllAdapters | () => readonly Adapter[] | adapter.ts:186 |
| removeAdapter | (id: string) => boolean | adapter.ts:190 |
| initDefaultAdapters | () => void | adapter.ts:195 |

### 1.6 Capability Registry Functions (from ./capabilities)

| Function | Signature | Source |
|----------|-----------|--------|
| registerCapability | (provider: CapabilityProvider) => void | capabilities.ts:15 |
| getCapability | (slot: CapabilitySlot) => CapabilityProvider | undefined | capabilities.ts:30 |
| getCapabilities | (slot: CapabilitySlot) => readonly CapabilityProvider[] | capabilities.ts:36 |
| removeCapability | (id: string) => boolean | capabilities.ts:41 |
| clearCapabilities | () => void | capabilities.ts:57 |
| occupiedSlots | () => CapabilitySlot[] | capabilities.ts:62 |

### 1.7 Path Utility Functions (from ./paths)

| Function | Signature | Returns | Source |
|----------|-----------|---------|--------|
| validatePath | (path: string) => PathValidation | { valid: boolean; error?: string } | paths.ts:31 |
| validateName | (name: string) => PathValidation | { valid: boolean; error?: string } | paths.ts:65 |
| buildCanonicalPath | (parentPath: string | null, childName: string) => string | null | paths.ts:79 |
| parentPathOf | (path: string) => string | null | paths.ts:94 |
| pathDepth | (path: string) => number | paths.ts:103 |
| isDescendantOf | (path: string, ancestor: string) => boolean | paths.ts:108 |
| normalizePath | (path: string) => string | null | paths.ts:117 |
| sanitizeName | (name: string) => string | paths.ts:139 |

### 1.8 React Provider (from ./workspace)

| Export | Type | Source |
|--------|------|--------|
| WorkspaceProvider | React component | workspace.tsx:112 |
| useWorkspace | () => WorkspaceContextValue | workspace.tsx:97 |


## 2. Terminal API

**Source:** src/lib/terminal/runner.ts

\\	ypescript
The Terminal API provides sandboxed JavaScript execution using Web Workers (or worker_threads on Node), with wall-clock timeouts, output caps, and automatic cleanup. Each run gets a fresh worker for isolation.

### 2.1 Interfaces and Types

| Type | Signature / Shape | Source |
|------|-------------------|--------|
| SandboxWorkerLike | { onMessage(cb): void; onError(cb): void; post(msg): void; terminate(): void } | runner.ts:26 |
| SandboxWorkerFactory | (source: string) => SandboxWorkerLike | runner.ts:33 |
| SandboxRunnerConfig | { maxRunMs: number; maxOutputChars: number; maxCodeChars: number } | runner.ts:35 |
| SandboxRunResult | { ok: boolean; value: string; output: readonly string[]; error?: string; terminated?: string; durationMs: number } | runner.ts:43 |
| SandboxRunHandle | { readonly runId: number; readonly result: Promise<SandboxRunResult>; cancel(): void } | runner.ts:57 |
| JsRunner | { run(code: string): SandboxRunHandle } | runner.ts:65 |

### 2.2 Functions

#### buildSandboxWorkerSource

 buildSandboxWorkerSource(): string 

**Source:** src/lib/terminal/runner.ts:81

Returns the JavaScript source code for the sandboxed worker body. The worker intercepts console methods (log/error/warn/info) to emit messages back to the host, executes code via new Function, and restores console on completion.

**Returns:** string - Ready-to-inject worker source.

#### buildNodeWorkerBridge

 buildNodeWorkerBridge(): string 

**Source:** src/lib/terminal/runner.ts:120

Returns the Node.js worker_threads bridge source that prepends parentPort aliasing to the worker body, enabling the same protocol over Node worker_threads.

**Returns:** string - Bridge source code.

### 2.3 Classes

#### SandboxRunner

 new SandboxRunner(factory?: SandboxWorkerFactory, config?: Partial<SandboxRunnerConfig>): SandboxRunner 

**Source:** src/lib/terminal/runner.ts:159

\\	ypescript
Implements JsRunner. Manages sandboxed code execution with isolation, timeouts, and output limits.

**Constructor parameters:**
- **factory:** SandboxWorkerFactory (default: browserSandboxWorkerFactory) - Factory that creates worker instances
- **config:** Partial<SandboxRunnerConfig> - Override defaults (maxRunMs: 10000, maxOutputChars: QUOTA_LIMITS.maxOutputChars, maxCodeChars: 200000)

**Methods:**
| Method | Signature | Description |
|--------|-----------|-------------|
| run | (code: string) => SandboxRunHandle | Execute code in a sandboxed worker |

**Example:**
`	ypescript
import { SandboxRunner } from " src/lib/terminal\;

const runner = new SandboxRunner(undefined, { maxRunMs: 5000 });
const handle = runner.run(\2 + 2\);
const result = await handle.result;
console.log(result.ok, result.value);
`

## 3. Sync API

**Source:** src/lib/sync/protocol.ts

\\	ypescript
The Sync API defines pull/push/presence protocol messages and includes a mock transport for testing. Designed for a future backend; tests use MockSyncTransport.

### 3.1 Types (from sync/types.ts)

| Type | Description |
|------|-------------|
| SyncMessage | Base protocol message with type, deviceId, timestamp, payload |
| SyncMessageType | pull_request | pull_response | push_request | push_ack | push_nack | presence_heartbeat | cursor_broadcast |
| SyncTransport | { send(msg): Promise<void>; onMessage(fn): void; offMessage?(fn): void } |
| PullRequest | { sinceSeq: number; deviceId: string } |
| PullResponse | { ops: readonly SyncOp[]; tombstones: readonly Tombstone[]; hasMore: boolean } |
| PushRequest | { batch: OperationBatch } |
| PushAck | { accepted: boolean; conflicts: ConflictInfo[]; serverLamport: number } |
| PushNack | { reason: string; retryAfterMs: number } |
| PresenceHeartbeat | { deviceId; label; online; lastCursor? } |
| ConflictInfo | { nodeId; localLamport; remoteLamport } |
| PeerPresence | { deviceId; label; online; lastSeen; cursor } |
| SyncState | synced | syncing | offline | conflict |
| SyncStatus | { state; lastSyncAt; pendingOps; peers; conflicts; deviceId } |
| OperationBatch | { header: BatchHeader; operations: readonly SyncOp[]; tombstones: readonly Tombstone[] } |
| Tombstone | { nodeId; deletedAt; deletedBy } |
| SyncOp | { id; kind; timestamp; deviceId; lamport; payload } |

### 3.2 Message Builder Functions

| Function | Signature | Source |
|----------|-----------|--------|
| buildPullRequest | (sinceSeq: number, deviceId: string) => SyncMessage | protocol.ts:30 |
| buildPullResponse | (ops, tombstones, hasMore, deviceId) => SyncMessage | protocol.ts:34 |
| buildPushRequest | (batch: OperationBatch, deviceId: string) => SyncMessage | protocol.ts:48 |
| buildPushAck | (accepted, conflicts, serverLamport, deviceId) => SyncMessage | protocol.ts:52 |
| buildPushNack | (reason: string, retryAfterMs: number, deviceId: string) => SyncMessage | protocol.ts:61 |
| buildPresenceHeartbeat | (deviceId, label, online, cursor?) => SyncMessage | protocol.ts:65 |
| buildCursorBroadcast | (deviceId, nodeId, position: number) => SyncMessage | protocol.ts:74 |

### 3.3 Protocol State

**ProtocolState interface:**
- deviceId: string (readonly)
- label: string (readonly)
- lamport: number
- vectorClock: Record<string, number>
- lastSyncSeq: number
- lastSyncAt: number | null
- pendingOps: number
- peers: Map<string, PeerPresence>
- state: SyncState
- conflicts: ConflictInfo[]

#### createProtocolState

 createProtocolState(deviceId: string, label: string): ProtocolState 

Creates a new protocol state initialized to defaults (lamport 0, empty vector clock, state: synced, no peers, no conflicts).

### 3.4 Sync Engine

**SyncEngine interface:**
- state: ProtocolState (readonly)
- pull(sinceSeq: number): Promise<PullResponse>
- push(batch: OperationBatch): Promise<PushAck | PushNack>
- heartbeat(): Promise<void>
- broadcastCursor(nodeId: string, position: number): Promise<void>
- onPeerPresence(handler: (peer: PeerPresence) => void): void

#### createSyncEngine

 createSyncEngine(deviceId: string, label: string, transport: SyncTransport, options?: SyncEngineOptions): SyncEngine 

Creates a sync engine bound to a transport. The engine handles message routing (push_ack, push_nack, presence_heartbeat, cursor_broadcast) and updates protocol state accordingly.

**SyncEngine methods:**
| Method | Description |
|--------|-------------|
| pull(sinceSeq) | Request operations after the given sequence number |
| push(batch) | Push an operation batch; returns ack or nack |
| heartbeat() | Send a presence heartbeat marking self as online |
| broadcastCursor(nodeId, position) | Broadcast cursor position for collaborative editing |
| onPeerPresence(handler) | Register a handler for peer presence updates |

### 3.5 Mock Transport

#### MockSyncTransport

 class MockSyncTransport implements SyncTransport 

\\	ypescript
A test transport that can be paired with another MockSyncTransport so messages sent by one are received by the other, simulating a network link.

**Methods:**
| Method | Description |
|--------|-------------|
| pairWith(other) | Pair with another MockSyncTransport |
| send(message) | Send a message (delivers to paired transport and listeners) |
| onMessage(handler) | Register message handler |
| offMessage(handler) | Remove message handler |
| getLog() | Get message history |
| clear() | Clear history and handlers |

### 3.6 Helper Functions

| Function | Signature | Source |
|----------|-----------|--------|
| getSyncStatus | (state: ProtocolState) => SyncStatus | protocol.ts:322 |
| countOnlinePeers | (state: ProtocolState) => number | protocol.ts:333 |


## 4. Model API

**Source:** src/lib/models/adapter.ts

\\	ypescript
The Model API manages WebModel lifecycle: download (resumable, verified), storage (IndexedDB), runtime detection, model resolution, cryptographic signature verification, and inference execution.

### 4.1 Public Functions

#### canonicalStringify

 canonicalStringify(value: unknown): string 

**Source:** src/lib/models/adapter.ts:34

\\	ypescript
Deterministic canonical JSON serialization: sorted keys, no whitespace. Used for signature verification payloads.

#### downloadModel

 downloadModel(manifest: ModelManifest, onProgress?: (pct: number) => Promise<void>): Promise<void> 

**Source:** src/lib/models/adapter.ts:198

Downloads all shards for a model manifest. Each shard is downloaded via HTTP range requests (resumable), verified against its SHA-256 digest, and persisted to IndexedDB. Calls onProgress with the overall percentage (0-100) after each shard completes.

#### verifyShard

 verifyShard(url: string, expectedSha256: string): Promise<boolean> 

**Source:** src/lib/models/adapter.ts:264

Downloads a single shard and verifies its SHA-256 against the expected digest. Returns true when the digest matches, false otherwise.

#### detectRuntime

 detectRuntime(): { webgpu: boolean; wasm: boolean; suitable: boolean } 

**Source:** src/lib/models/adapter.ts:282

Detects browser runtime capabilities for WebModel execution.

#### getModelProfile

 getModelProfile(): " low-memory-mobile\ | \modern-mobile\ | \laptop\ | \desktop\ 

**Source:** src/lib/models/adapter.ts:293

Detects the device capability profile based on device memory, CPU cores, and user agent.

#### resolveModel

 resolveModel(manifestId: string): Promise<ModelManifest | null> 

**Source:** src/lib/models/adapter.ts:323

Resolves a model manifest by ID. Checks the in-memory cache first, then IndexedDB storage. Returns null when no manifest is found.

#### verifyManifestSignature

 verifyManifestSignature(manifest: ModelManifest): Promise<boolean> 

**Source:** src/lib/models/adapter.ts:353

\\	ypescript
Verifies a model manifest cryptographic signature. Supports HMAC-SHA256 and Ed25519 schemes. Returns true if valid, false otherwise.

#### load

 load(modelPath: string): Promise<RuntimeInstance> 

**Source:** src/lib/models/adapter.ts:487

Loads a verified model into memory. Verifies manifest signature and shard digests before creating a runtime instance. Throws if verification fails or the model is not found.

#### generate

 generate(prompt: string, instance: RuntimeInstance): Promise<string> 

**Source:** src/lib/models/adapter.ts:539

Runs inference on a loaded model instance. Attempts real model inference via @huggingface/transformers (WebGPU/WASM). On any failure, falls back to a deterministic placeholder.

#### unload

 unload(instance: RuntimeInstance): Promise<void> 

**Source:** src/lib/models/adapter.ts:573

Unloads a model instance, freeing resources.

#### clearActiveInstances

 clearActiveInstances(): void 

**Source:** src/lib/models/adapter.ts:578

Clears all active runtime instances from the registry.

#### getCloudFallbackMessage

 getCloudFallbackMessage(runtime: { webgpu: boolean; wasm: boolean }): string 

**Source:** src/lib/models/adapter.ts:589

Returns a user-facing message when no local runtime is available. Returns empty string when suitable runtime exists.

#### getModelClass

 getModelClass(profile: DeviceProfile): string 

**Source:** src/lib/models/adapter.ts:601

\\	ypescript
Maps a device profile to a model size class label.

| Profile | Returns |
|---------|---------|
| low-memory-mobile | 1B |
| modern-mobile | 3B |
| laptop | 7B |
| desktop | 70B |

#### checkStorageQuota

 checkStorageQuota(availableMB: number, requiredMB: number): { ok: boolean; reason?: string } 

**Source:** src/lib/models/adapter.ts:618

Checks whether available storage meets a required threshold.

#### deleteDB, openDB

Exported from src/lib/models/adapter.ts for direct IndexedDB access.

### 4.2 Exported Interfaces

| Interface | Source | Description |
|-----------|--------|-------------|
| RuntimeInstance | adapter.ts:406 | { id: string; modelId: string; loadedAt: number } |
| WebModelRuntime | adapter.ts:412 | { load, generate, unload } |

### 4.3 Exported Type

| Type | Source | Description |
|------|--------|-------------|
| SupportedModelId | adapter.ts:430 | gpt2 | tinyllama | onnx-community/gpt-2 | onnx-community/SmolLM2-135M-ONNX | onnx-community/tiny-llama |

### 4.4 Cross-Reference with src/types.ts

\\	ypescript
The top-level src/types.ts defines AIModel (id, name, description, architecture, parameters, performance, category, downloads). This type is used in the UI layer to display model listings. The Model API ModelManifest type (from src/lib/models/manifest.ts) is the runtime counterpart used for download/verification. The AIModel.id typically maps to a ModelManifest.id.

### 4.5 Example


import { downloadModel, detectRuntime, load, generate, unload, verifyManifestSignature, resolveModel } from " src/lib/models\;

const runtime = detectRuntime();
if (!runtime.suitable) {
 console.log(getCloudFallbackMessage(runtime));
}

const manifest = await resolveModel(\tinyllama\);
if (manifest) {
 await downloadModel(manifest, (pct) => console.log(\Download: \ + pct + \%\));
 const sigOk = await verifyManifestSignature(manifest);
 if (!sigOk) throw new Error(\Signature invalid\);

 const instance = await load(\tinyllama\);
 const response = await generate(\Explain recursion\, instance);
 console.log(response);
 await unload(instance);
}


## 5. Telemetry API

**Source:** src/lib/telemetry/index.ts

\\	ypescript
The Telemetry API records events, timings, and errors. Events are queued in memory and flushed automatically when the queue reaches 50 events or every 5 seconds. Sensitive keys (token, secret, password, apikey, key, source, prompt, output) are automatically redacted.

### 5.1 Types

| Type | Source | Description |
|------|--------|-------------|
| TelemetryEventType | index.ts:59 | event | timing | error |
| QueuedEvent | index.ts:61 | { type, name, payload, correlationId, timestamp } |

### 5.2 Telemetry Object

**telemetry** object with methods:

#### telemetry.event

 event(name: string, data?: Record<string, unknown>): void 

Record a custom telemetry event. Sensitive keys are auto-redacted.

#### telemetry.timing

 timing(name: string, duration: number): void 

Record a timing measurement.

#### telemetry.error

 error(name: string, error: unknown, data?: Record<string, unknown>): void 

Record an error event. The error parameter can be an Error object, string, or unknown value.

### 5.3 Utility Functions

| Function | Signature | Source |
|----------|-----------|--------|
| getTelemetryQueue | () => QueuedEvent[] | index.ts:189 |
| clearTelemetryQueue | () => void | index.ts:196 |
| setTelemetryFlushHandler | (handler: ((events: QueuedEvent[]) => void) | null) => void | index.ts:205 |
| flushTelemetry | () => void | index.ts:214 |
| resetTelemetry | () => void | index.ts:221 |
| initLogRocket | (environment: string) => Promise<boolean> | index.ts:227 |

## 6. AI Provider API

**Source:** src/lib/ai/orchestrator.ts

\\	ypescript
The AI Provider API provides secret redaction, streaming AI with cancellation and timeout, and provider orchestration with fallback and health tracking.

### 6.1 Secret Redaction

| Function | Signature | Source |
|----------|-----------|--------|
| redact | (value: string) => string | orchestrator.ts:30 |
| redactForLog | (value: string) => string | orchestrator.ts:38 |
| redactContext | (context?: Record<string, any>) => Record<string, any> | undefined | orchestrator.ts:42 |

### 6.2 RedactedError

 class RedactedError extends Error 

**Source:** orchestrator.ts:61

\\	ypescript
Wraps errors so secrets never leak through error messages. Has isRedacted = true property.

**Static method:** RedactedError.from(error: unknown): RedactedError

### 6.3 AI Stream Types

| Type | Description |
|------|-------------|
| StreamChunk | { index: number; text: string; delta: string } |
| StreamStatus | streaming | done | cancelled | timeout | error |
| StreamResult | { status: StreamStatus; text: string; chunks: readonly StreamChunk[] } |
| AIStreamHandle | { status, text, chunks, cancel(), onStatusChange(cb) } |

#### createAIStream

 createAIStream(opts: { provider: string; prompt: string; chunks: string[]; chunkIntervalMs?: number; timeoutMs?: number }): AIStreamHandle 

**Source:** orchestrator.ts:112

Creates a streaming AI handle. Chunk delivery uses setInterval so each call to advanceTimersByTimeAsync advances exactly one chunk. Reliable under fake timers.

#### streamDrain

 streamDrain(viInstance?: typeof globalThis.vi): Promise<void> 

\\	ypescript
Flush microtasks after advancing fake timers.

#### createImmediateDoneHandle

 createImmediateDoneHandle(): AIStreamHandle 

Returns a handle that is immediately done with no chunks.

#### consumeStream

 consumeStream(stream: AIStreamHandle, timeoutMs?: number): Promise<string> 

\\	ypescript
Consume all chunks from a stream and return the accumulated text.

### 6.4 Provider Orchestrator

#### ProviderOrchestrator

 class ProviderOrchestrator 

**Source:** orchestrator.ts:267

\\	ypescript
Tries providers in priority order, falls back on failure, and exposes per-provider health state.

| Method | Signature | Description |
|--------|-----------|-------------|
| register | (entry: Omit<ProviderEntry, \health\ | \errorCount\>) => void | Register a provider |
| getProviders | () => readonly ProviderEntry[] | Get all providers sorted by priority |
| getActiveProvider | () => ProviderEntry | null | Get the active provider |
| query | (call: ProviderCallFn) => Promise<ProviderCallResult> | Try providers in order |
| markHealthy | (providerId: string) => void | Mark a provider as healthy |

**Types:**
| Type | Description |
|------|-------------|
| ProviderHealth | healthy | degraded | unhealthy |
| ProviderEntry | { id, name, priority, health, errorCount, lastError? } |
| ProviderCallResult | { text: string; providerId: string } |
| ProviderCallFn | (entry: ProviderEntry) => Promise<ProviderCallResult> |

## 7. Cross-Reference Matrix

\\	ypescript
Mapping between documented APIs and types defined in src/types.ts:

| src/types.ts Type | Consumed By | Usage |
|-------------------|-------------|-------|
| ViewState | Workspace React provider | Page state management |
| AIModel | Model API | Model listing in UI |
| Profile | General app types | User profiles |
| Thread | General app types | Forum threads |
| Reply | General app types | Forum replies |
| Upvote | General app types | Upvotes |
| Topic | General app types | Topics |
| Tutorial | General app types | Tutorials |

## Verification Summary

\\	ypescript
All documented APIs were verified against source code as of 2026-09-13:

| API Module | File | Verified |
|------------|------|----------|
| Workspace API | src/lib/workspace/index.ts | All 35+ exports verified |
| Terminal API | src/lib/terminal/runner.ts | All interfaces and classes verified |
| Sync API | src/lib/sync/protocol.ts | All builders, engine, and transport verified |
| Model API | src/lib/models/adapter.ts | All 14 functions and 2 interfaces verified |
| Telemetry API | src/lib/telemetry/index.ts | All 6 functions and telemetry object verified |
| AI Provider API | src/lib/ai/orchestrator.ts | All functions, classes, and types verified |

### Cross-Reference with src/types.ts (verified)

\\	ypescript
File: src/types.ts contains 7 types: ViewState, Profile, Thread, Reply, Upvote, Topic, AIModel, Tutorial. All are referenced in the documentation above with their usage context.

---

*End of API Documentation*
