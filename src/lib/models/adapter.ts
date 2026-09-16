/**
 * VantaOS WebModel — runtime adapter.
 *
 * Coordinates model download (resumable, range-requestable),
 * SHA-256 verification, IndexedDB storage, runtime detection,
 * device profiling, model resolution by ID, and cryptographic
 * manifest signature verification (Ed25519 / HMAC-SHA256).
 */

import type { ModelManifest, DeviceProfile } from './manifest';
import { verifyModelSource, MODEL_PROXY_ALLOWED_HOSTS } from './sources';

const MAX_CACHED_MODELS = 20;

const enc = new TextEncoder();

export function base64UrlToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  let bin; try { bin = atob(b64); } catch(e: unknown) { const msg = e instanceof Error ? e.message : "unknown"; throw new Error("Invalid base64url input: " + msg); }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Deterministic canonical JSON: sorted keys, no whitespace. */
export function canonicalStringify(value: unknown, _seen?: WeakSet<object>): string {
  if (value === undefined) return 'null';
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object') {
    const seen = _seen ?? new WeakSet<object>();
    if (seen.has(value)) return '"[circular]"';
    seen.add(value);
    if (Array.isArray(value)) {
      return '[' + value.map((v) => canonicalStringify(v, seen)).join(',') + ']';
    }
    const entries = Object.keys(value as Record<string, unknown>).sort();
    return '{' + entries.map((k) => JSON.stringify(k) + ':' + canonicalStringify((value as Record<string, unknown>)[k], seen)).join(',') + '}';
  }
  return 'null';
}

// ─── IndexedDB Storage ──────────────────────────────────────

const DB_NAME = 'VantaOSWebModelDB';
const DB_VERSION = 1;
const STORE_MANIFESTS = 'manifests';
const STORE_SHARDS = 'shards';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MANIFESTS)) {
        db.createObjectStore(STORE_MANIFESTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SHARDS)) {
        db.createObjectStore(STORE_SHARDS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withDB<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  return openDB().then((db) => {
    return fn(db).finally(() => {
      try { db.close(); } catch { /* ignore */ }
    });
  });
}

function putManifest(manifest: ModelManifest): Promise<void> {
  return withDB((db) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MANIFESTS, 'readwrite');
      const store = tx.objectStore(STORE_MANIFESTS);
      const req = store.put(manifest);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

function getStoredManifest(id: string): Promise<ModelManifest | undefined> {
  return withDB((db) => {
    return new Promise<ModelManifest | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_MANIFESTS, 'readonly');
      const store = tx.objectStore(STORE_MANIFESTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ?? undefined);
      req.onerror = () => reject(req.error);
    });
  });
}

function storeShardData(key: string, data: ArrayBuffer): Promise<void> {
  return withDB((db) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SHARDS, 'readwrite');
      const store = tx.objectStore(STORE_SHARDS);
      const req = store.put({ key, data });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

function getShardData(key: string): Promise<ArrayBuffer | undefined> {
  return withDB((db) => {
    return new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_SHARDS, 'readonly');
      const store = tx.objectStore(STORE_SHARDS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.data);
      req.onerror = () => reject(req.error);
    });
  });
}

function hasShardData(key: string): Promise<boolean> {
  return withDB((db) => {
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_SHARDS, 'readonly');
      const store = tx.objectStore(STORE_SHARDS);
      const req = store.count(key);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => reject(req.error);
    });
  });
}

function deleteDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Module-level cache for resolveModel ────────────────────

const modelCache = new Map<string, ModelManifest>();

// ─── SHA-256 helper ─────────────────────────────────────────

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Internal helpers ───────────────────────────────────────

async function downloadRange(url: string, start: number, end: number): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
  } catch (err) {
    throw new Error(`Network error fetching model shard from ${url}: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
  if (!res.ok && res.status !== 206) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.arrayBuffer();
}

function concatenateBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
  const result = new ArrayBuffer(a.byteLength + b.byteLength);
  const view = new Uint8Array(result);
  view.set(new Uint8Array(a), 0);
  view.set(new Uint8Array(b), a.byteLength);
  return result;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Download all shards for a model manifest.
 *
 * Each shard is downloaded via HTTP range requests (resumable),
 * verified against its SHA-256 digest, and persisted to IndexedDB.
 *
 * Calls onProgress with the overall percentage (0–100) after each shard completes.
 *
 * @param manifest - The model manifest defining shards to download
 * @param onProgress - Optional callback receiving download percentage (0–100)
 * @returns Promise that resolves when all shards are downloaded and verified
 * @throws Error if manifest has no shards, a shard fails verification, or download fails
 */
export async function downloadModel(
  manifest: ModelManifest,
  onProgress?: (pct: number) => Promise<void>,
): Promise<void> {
  verifyModelSource(manifest);

  const totalBytes = manifest.shards.reduce((s, sh) => s + sh.byteLength, 0);
  if (totalBytes <= 0) {
    throw new Error(`Model ${manifest.id} has no shard data`);
  }
  let completedBytes = 0;

  if (modelCache.size >= MAX_CACHED_MODELS) {
    const firstKey = modelCache.keys().next().value;
    if (firstKey !== undefined) modelCache.delete(firstKey);
  }
  modelCache.set(manifest.id, manifest);
  await putManifest(manifest);

  for (let i = 0; i < manifest.shards.length; i++) {
    const shard = manifest.shards[i];
    const shardKey = `${manifest.id}/${i}`;

    const existingBytesVal = await existingBytes(shardKey);
    if (existingBytesVal >= shard.byteLength) {
      completedBytes += shard.byteLength;
      const pct = Math.round((completedBytes / totalBytes) * 100);
      if (onProgress) await onProgress(pct);
      continue;
    }

    let data: ArrayBuffer;
    if (existingBytesVal > 0) {
      const existingData = await getShardData(shardKey);
      if (!existingData) {
        throw new Error(`Shard ${i} metadata indicates ${existingBytesVal} bytes but data is unavailable for ${manifest.id}`);
      }
      const remaining = await downloadRange(shard.url, existingBytesVal, shard.byteLength - 1);
      data = concatenateBuffers(existingData, remaining);
    } else {
      data = await downloadRange(shard.url, 0, shard.byteLength - 1);
    }

    const actualHash = await sha256Hex(data);
    if (actualHash !== shard.sha256) {
      throw new Error(
        `SHA-256 mismatch for shard ${i}: expected ${shard.sha256}, got ${actualHash}`,
      );
    }

    await storeShardData(shardKey, data);

    completedBytes += shard.byteLength;
    const pct = Math.round((completedBytes / totalBytes) * 100);
    if (onProgress) await onProgress(pct);
  }
}

function existingBytes(key: string): Promise<number> {
  return getShardData(key).then((d) => (d ? d.byteLength : 0));
}

/**
 * Download a single shard and verify its SHA-256 against the expected digest.
 * Returns true when the digest matches, false otherwise.
 */
export async function verifyShard(
  url: string,
  expectedSha256: string,
): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const data = await res.arrayBuffer();
  const actual = await sha256Hex(data);
  return actual === expectedSha256;
}

/**
 * Detect browser runtime capabilities for WebModel execution.
 *
 * @returns Object with webgpu/wasm flags and a suitable boolean
 */
export function detectRuntime(): { webgpu: boolean; wasm: boolean; suitable: boolean } {
  const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const wasm = typeof WebAssembly !== 'undefined';
  return { webgpu, wasm, suitable: webgpu || wasm };
}

/**
 * Detect the device capability profile.
 *
 * @returns One of 'low-memory-mobile', 'modern-mobile', 'laptop', or 'desktop'
 */
export function getModelProfile(): 'low-memory-mobile' | 'modern-mobile' | 'laptop' | 'desktop' {
  if (typeof navigator === 'undefined') return 'laptop';

  const memoryMB = (() => {
    const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof dm === 'number' && dm > 0) return dm * 1024;
    const cores = navigator.hardwareConcurrency || 2;
    if (cores <= 4) return 2048;
    if (cores <= 8) return 8192;
    return 16384;
  })();

  const cores = navigator.hardwareConcurrency || 2;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');

  if (isMobile && memoryMB < 4096) return 'low-memory-mobile';
  if (isMobile) return 'modern-mobile';
  if (cores <= 4 || memoryMB <= 8192) return 'laptop';
  return 'desktop';
}

/**
 * Resolve a model manifest by ID.
 *
 * Checks the in-memory cache first, then IndexedDB storage.
 * Returns null when no manifest is found.
 *
 * @param manifestId - The manifest identifier to look up
 * @returns The manifest if found, otherwise null
 */
export async function resolveModel(manifestId: string): Promise<ModelManifest | null> {
  const cached = modelCache.get(manifestId);
  if (cached) return cached;

  const stored = await getStoredManifest(manifestId);
  if (stored) {
    modelCache.set(manifestId, stored);
    return stored;
  }

  return null;
}

/**
 * Verify a model manifest's cryptographic signature.
 *
 * For hmac-sha256: the publisher name is the HMAC key; the signature
 * covers the canonical (sorted-key, no-whitespace) JSON of the manifest
 * excluding the signature field itself.
 *
 * For ed25519: the signature is a base64url Ed25519 signature over the
 * same canonical payload; verification uses crypto.subtle with the
 * first shard URL's host as a public-key source placeholder (in
 * production the public key is obtained from a trusted key registry).
 *
 * Returns true when the signature is valid, false otherwise.
 *
 * @param manifest - The manifest to verify
 * @returns true if the signature is valid, false otherwise
 */
export async function verifyManifestSignature(manifest: ModelManifest): Promise<boolean> {
  const payload = canonicalStringify(
    (({ signature, ...rest }: ModelManifest) => rest)(manifest),
  );
  const payloadBytes = enc.encode(payload);

  if (manifest.signatureScheme === 'hmac-sha256') {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(manifest.publisher),
        { name: 'HMAC', hash: 'SHA-256'},
        false,
        ['verify'],
      );
      const sigBytes = base64UrlToBytes(manifest.signature);
      return crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
    } catch {
      return false;
    }
  }

  if (manifest.signatureScheme === 'ed25519') {
    try {
      // Derive a deterministic public key from the publisher name.
      // In production this would come from a trusted key registry.
      const pubKeyBytes = await crypto.subtle.digest('SHA-256', enc.encode(manifest.publisher));
      const key = await crypto.subtle.importKey(
        'raw',
        pubKeyBytes,
        { name: 'Ed25519' },
        false,
        ['verify'],
      );
      const sigBytes = base64UrlToBytes(manifest.signature);
      return crypto.subtle.verify('Ed25519', key, sigBytes, payloadBytes);
    } catch {
      return false;
    }
  }

  return false;
}

// ─── Runtime types ────────────────────────────────────

export interface RuntimeInstance {
  id: string;
  modelId: string;
  loadedAt: number;
}

export interface WebModelRuntime {
  load(modelPath: string): Promise<RuntimeInstance>;
  generate(prompt: string, instance: RuntimeInstance): Promise<string>;
  unload(instance: RuntimeInstance): Promise<void>;
}

// ─── Inference configuration ──────────────────────────

const INFERENCE_TIMEOUT_MS = 30000;

const SUPPORTED_MODEL_IDS = [
  'gpt2',
  'tinyllama',
  'Xenova/gpt2',
  'onnx-community/SmolLM2-135M-ONNX',
  'onnx-community/tiny-llama',
] as const;

export type SupportedModelId = (typeof SUPPORTED_MODEL_IDS)[number];

const MODEL_ID_MAP: Record<string, string> = {
  gpt2: 'Xenova/gpt2',
  tinyllama: 'onnx-community/SmolLM2-135M-ONNX',
  webmodel: 'onnx-community/SmolLM2-135M-ONNX',
};

export function resolveModelRepo(modelId: string): string {
  return MODEL_ID_MAP[modelId] || modelId;
}

// ─── Model proxy (browser) ─────────────────────────────

// Metadata, tokenizer, .onnx weight files, and .onnx_data external-data
// tensor shards are all routed through the same-origin CORS proxy so the
// WebModel works even when HuggingFace CDN is unreachable from the
// browser.  Cloudflare Workers have no enforced response-body size limit
// (streamed), so even 128 MB+ quantized ONNX / ONNX_DATA files pass
// through safely.
const MODEL_METADATA_EXTENSION_RE = /\.(json|txt|model|xml|onnx|onnx_data)$/i;

export function proxyFetchOverride(
  url: string | URL,
  init?: RequestInit,
): Promise<Response> | undefined {
  const input = url instanceof URL ? url.toString() : url;
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:') return undefined;
  if (!MODEL_PROXY_ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) return undefined;
  if (!MODEL_METADATA_EXTENSION_RE.test(parsed.pathname.toLowerCase())) return undefined;
  return fetch(`/api/model-proxy?url=${encodeURIComponent(input)}`, init);
}

function proxiedFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const proxied = proxyFetchOverride(url, init);
  return proxied ?? fetch(url, init);
}

const DOWNLOAD_FAILURE_MARKERS =
  /error occurred while trying to load file|Unauthorized access to file|Forbidden access to file|Could not locate file|Failed to fetch|NetworkError|Fetch failed|Service unavailable|\b50[234]\b/i;

function isDownloadFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return DOWNLOAD_FAILURE_MARKERS.test(err.message);
}

async function runInference(prompt: string, modelId: string, timeoutMs = INFERENCE_TIMEOUT_MS): Promise<string> {
  const transformers = await import('@huggingface/transformers');
  const { pipeline, env } = transformers;

  // Route Hugging Face downloads through the same-origin model proxy in the browser.
  if (typeof self !== 'undefined') {
    env.fetch = proxiedFetch;
  }
  env.allowLocalModels = false;

  const runtime = detectRuntime();
  const device: 'webgpu' | 'wasm' = runtime.webgpu ? 'webgpu' : 'wasm';

  const hfModelId = resolveModelRepo(modelId);

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Inference timed out after ${timeoutMs / 1000}s`)),
      timeoutMs,
    );
  });

  try {
    const inferencePromise = (async () => {
      const generator = await pipeline('text-generation', hfModelId, { device });
      const output = await generator(prompt, { max_new_tokens: 128, return_full_text: false });
      if (Array.isArray(output) && output.length > 0 && output[0].generated_text) {
        return output[0].generated_text;
      }
      throw new Error('Empty inference output');
    })();

    const result = await Promise.race([inferencePromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    const lastError = err instanceof Error ? err : new Error(String(err));

    // Fail fast on download/transport failures — a retry would re-run the heavy pipeline.
    if (isDownloadFailure(lastError)) {
      throw new Error(
        `The ${hfModelId} model failed to download. Models load from Hugging Face on first use — check your connection, or switch to a cloud provider (Gemini, OpenRouter) in Settings.`
      );
    }
    if (lastError.message.includes('timed out')) {
      throw new Error(
        'Model loading timed out. The model may be large for your device — try a smaller model or switch to a cloud provider in Settings.'
      );
    }
    throw new Error(`WebModel error: ${lastError.message}`);
  }
}

/**
 * Run a single-shot chat-style generation on a WebModel, without going
 * through the verified-manifest registry (Omni-AI chat path).
 *
 * Downloads the model from Hugging Face on first use and executes with
 * Transformers.js on WebGPU or WASM. Throws if the runtime is unsuitable
 * or inference fails/times out.
 *
 * @param prompt - The user prompt for generation
 * @param modelId - Supported short id: `gpt2`, `tinyllama`, or `webmodel`
 * @param timeoutMs - Optional timeout override (default 30s)
 * @returns The generated text
 */
export async function queryWebModel(
  prompt: string,
  modelId: SupportedModelId = 'gpt2',
  timeoutMs?: number,
): Promise<string> {
  return runInference(prompt, modelId, timeoutMs);
}

// ─── Runtime instance registry ────────────────────────

const activeInstances = new Map<string, RuntimeInstance>();

/**
 * Load a verified model into memory.
 *
 * Verifies the manifest signature and shard digests before creating
 * a runtime instance. Throws if verification fails or the model is
 * not found in IndexedDB.
 *
 * @param modelPath - The model ID or path to load
 * @returns The runtime instance once loaded and verified
 * @throws Error if model not found, signature invalid, or shard data missing
 */
export async function load(modelPath: string): Promise<RuntimeInstance> {
  const manifest = await resolveModel(modelPath);
  if (!manifest) {
    throw new Error(`Model not found: ${modelPath}`);
  }

  const sigOk = await verifyManifestSignature(manifest);
  if (!sigOk) {
    throw new Error(`Signature verification failed for ${modelPath}`);
  }

  for (let i = 0; i < manifest.shards.length; i++) {
    const shardKey = `${manifest.id}/${i}`;
    const data = await getShardData(shardKey);
    if (!data) {
      throw new Error(`Shard ${i} not found for ${modelPath}`);
    }
    const actualHash = await sha256Hex(data);
    if (actualHash !== manifest.shards[i].sha256) {
      throw new Error(`Shard ${i} digest mismatch for ${modelPath}`);
    }
  }

  const instanceId = `${manifest.id}@${manifest.version}`;
  if (activeInstances.has(instanceId)) {
    const instance = activeInstances.get(instanceId);
    if (instance) return instance;
  }
  const instance: RuntimeInstance = {
    id: instanceId,
    modelId: manifest.id,
    loadedAt: Date.now(),
  };
  activeInstances.set(instance.id, instance);
  return instance;
}

/**
 * Run inference on a loaded model instance.
 *
 * Attempts real model inference via @huggingface/transformers (WebGPU/WASM).
 * On any failure, falls back to a deterministic placeholder with a clear
 * message explaining why real inference was unavailable.
 *
 * Supported model IDs: gpt2, tinyllama (mapped to Xenova/gpt2
 * and onnx-community/SmolLM2-135M-ONNX respectively). Custom model IDs
 * are passed directly to Transformers.js.
 *
 * @param prompt - The input prompt for generation
 * @param instance - The loaded runtime instance
 * @returns Generated text, or deterministic fallback with reason
 * @throws Error if model or instance is not loaded
 */
export async function generate(prompt: string, instance: RuntimeInstance): Promise<string> {
  const manifest = await resolveModel(instance.modelId);
  if (!manifest) {
    throw new Error(`Model not found for instance ${instance.id}`);
  }
  if (!activeInstances.has(instance.id)) {
    throw new Error(`Instance ${instance.id} is not loaded (runtime inference unavailable)`);
  }

  try {
    const result = await runInference(prompt, instance.modelId);
    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    let promptHash = await sha256Hex(enc.encode(prompt));
    let modelHash = '';
    for (let i = 0; i < manifest.shards.length; i++) {
      const data = await getShardData(`${manifest.id}/${i}`);
      if (data) {
        modelHash = await sha256Hex(data);
        break;
      }
    }
    const combined = `${promptHash}:${modelHash}:${instance.modelId}:${instance.loadedAt}`;
    const combinedHash = await sha256Hex(enc.encode(combined));
    return `[Real inference unavailable: ${reason}. Deterministic fallback: ${combinedHash.slice(0, 32)}]`;
  }
}

/**
 * Unload a model instance, freeing resources.
 *
 * @param instance - The runtime instance to unload
 */
export async function unload(instance: RuntimeInstance): Promise<void> {
  activeInstances.delete(instance.id);
  modelCache.delete(instance.modelId);
}

export function clearActiveInstances(): void {
  activeInstances.clear();
}

/** Return a user-facing fallback message when the device cannot run WebModel locally. */
/**
 * Return a user-facing fallback message when the device cannot run WebModel locally.
 *
 * @param runtime - Detected runtime capabilities
 * @returns Empty string if suitable runtime exists, otherwise a user message
 */
export function getCloudFallbackMessage(runtime: { webgpu: boolean; wasm: boolean }): string {
  if (runtime.webgpu || runtime.wasm) return '';
  return 'No local runtime detected — falling back to cloud AI.';
}

/** Model size class label for a device profile. */
/**
 * Get the model size class label for a device profile.
 *
 * @param profile - The device capability profile
 * @returns A string label like '1B', '3B', '7B', or '70B'
 */
export function getModelClass(profile: DeviceProfile): string {
  switch (profile) {
    case 'low-memory-mobile': return '1B';
    case 'modern-mobile': return '3B';
    case 'laptop': return '7B';
    case 'desktop': return '70B';
  }
}

/** Check whether available storage in MB meets a required MB threshold. */
/**
 * Check whether available storage in MB meets a required MB threshold.
 *
 * @param availableMB - Currently available storage in megabytes
 * @param requiredMB - Required storage in megabytes
 * @returns Object with ok flag and optional reason string
 */
export function checkStorageQuota(availableMB: number, requiredMB: number): { ok: boolean; reason?: string } {
  if (availableMB < requiredMB) {
    return { ok: false, reason: `Insufficient storage: ${availableMB}MB available, ${requiredMB}MB required` };
  }
  return { ok: true };
}

export { deleteDB, modelCache, openDB };
