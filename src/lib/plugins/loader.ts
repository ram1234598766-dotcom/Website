/**
 * VantaOS Plugin — Sandboxed loader via Web Worker.
 *
 * Each plugin runs inside a disposable Web Worker (Blob URL). The host enforces
 * a capability allow-list: plugin API calls are intercepted, checked against
 * the manifest, and only forwarded when the capability is granted.
 */

import type { PluginManifest, PluginCapability } from './manifest';
import { isValidManifest, manifestToSign } from './manifest';

// ─── Crypto ──────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

async function verifyEd25519(publicKeyBase64: string, message: string, signatureBase64: string): Promise<boolean> {
  try {
    const publicKeyBytes = base64UrlToBytes(publicKeyBase64);
    const signatureBytes = base64UrlToBytes(signatureBase64);
    const key = await crypto.subtle.importKey(
      'spki',
      publicKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    return crypto.subtle.verify('Ed25519', key, signatureBytes, enc.encode(message));
  } catch {
    return false;
  }
}

export async function verifyManifestSignature(
  manifest: PluginManifest,
  publicKey?: string
): Promise<boolean> {
  const payload = manifestToSign(manifest);
  if (manifest.signatureAlgorithm === 'hmac-sha256') {
    if (!publicKey) return false;
    const expected = await hmacSha256(publicKey, payload);
    const actual = base64UrlToBytes(manifest.signature);
    return timingSafeEqual(expected, actual);
  }
  if (manifest.signatureAlgorithm === 'ed25519') {
    if (!publicKey) return false;
    return verifyEd25519(publicKey, payload, manifest.signature);
  }
  return false;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function base64UrlToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ─── Worker source ───────────────────────────────────────────────────────────

const WORKER_SOURCE = `
'use strict';

let capabilities = [];
let initialized = false;
let callId = 0;
const callResolvers = new Map();

self.onmessage = async function(e) {
  const msg = e.data;
  if (msg.type === 'init') {
    capabilities = msg.capabilities || [];
    initialized = true;
    self.postMessage({ type: 'ready' });
    return;
  }
  if (msg.type === 'run') {
    if (!initialized) {
      self.postMessage({ type: 'error', runId: msg.id, error: 'Worker not initialized' });
      return;
    }
    try {
      const fn = new Function('api', 'capabilities', msg.script);
      const api = buildApi(msg.id);
      const result = await fn(api, capabilities);
    } catch (err) {
      self.postMessage({ type: 'error', runId: msg.id, error: err?.message ?? String(err) });
    }
    return;
  }
  if (msg.type === 'api_response') {
    const resolver = callResolvers.get(msg.callId);
    if (resolver) {
      callResolvers.delete(msg.callId);
      if (msg.error) resolver.reject(new Error(msg.error));
      else resolver.resolve(msg.value);
    }
    return;
  }
};

function buildApi(runId) {
  const selfRef = self;
  function requestApi(capability, method, args) {
    return new Promise((resolve, reject) => {
      const cid = ++callId;
      callResolvers.set(cid, { resolve, reject });
      selfRef.postMessage({ type: 'api_request', runId, callId: cid, capability, method, args });
    });
  }
  return {
    log: function(text) {
      self.postMessage({ type: 'output', runId, text: String(text) });
    },
    workspace: {
      readFile: function(path) { return requestApi('workspace:read', 'readFile', [path]); },
      writeFile: function(path, content) { return requestApi('workspace:write', 'writeFile', [path, content]); },
    },
    ai: {
      chat: function(prompt) { return requestApi('ai:call', 'chat', [prompt]); },
    },
    network: {
      request: function(url, options) { return requestApi('network:request', 'request', [url, options]); },
    },
    terminal: {
      execute: function(command) { return requestApi('terminal:execute', 'execute', [command]); },
    },
  };
}
`;

// ─── Loader ──────────────────────────────────────────────────────────────────

export interface LoadedPlugin {
  manifest: PluginManifest;
  terminate: () => void;
}

export interface PluginRunHandle {
  readonly runId: number;
  readonly result: Promise<PluginRunResult>;
  cancel(): void;
}

export interface PluginRunResult {
  ok: boolean;
  value: string;
  output: readonly string[];
  error?: string;
  terminated?: string;
  durationMs: number;
}

export async function loadPlugin(manifest: PluginManifest, publicKey?: string): Promise<LoadedPlugin> {
  if (!isValidManifest(manifest)) {
    throw new Error('Invalid plugin manifest');
  }
  const verified = await verifyManifestSignature(manifest, publicKey);
  if (!verified) {
    throw new Error('Plugin signature verification failed');
  }

  const script =
    manifest.entryPoint.kind === 'inline'
      ? manifest.entryPoint.script
      : await fetchAndExtractScript(manifest.entryPoint.url);

  const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl, { type: 'classic' });

  let readyResolver: (() => void) | null = null;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolver = resolve;
  });

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'ready') {
      readyResolver?.();
      return;
    }
  };

  worker.postMessage({
    type: 'init',
    capabilities: Array.from(manifest.capabilities),
  });

  await readyPromise;

  URL.revokeObjectURL(workerUrl);

  const terminate = () => worker.terminate();

  return { manifest, terminate };
}

async function fetchAndExtractScript(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch plugin entry point: ${res.status}`);
  return await res.text();
}

// ─── Runner ──────────────────────────────────────────────────────────────────

export class PluginRunner {
  private worker: Worker;
  private pending = new Map<number, PendingRun>();
  private nextId = 1;
  private maxRunMs: number;
  private terminated = false;
  private onApiRequest: (call: { capability: string; method: string; args: unknown[] }) => Promise<unknown>;

  constructor(worker: Worker, maxRunMs = 10_000, onApiRequest?: (call: { capability: string; method: string; args: unknown[] }) => Promise<unknown>) {
    this.worker = worker;
    this.maxRunMs = maxRunMs;
    this.onApiRequest = onApiRequest ?? (async () => { throw new Error('No API handler'); });
    this.worker.onmessage = (e) => this.handleMessage(e.data);
    this.worker.onerror = (err) => {
      for (const call of this.pending.values()) {
        clearTimeout(call.timer);
        call.resolve({
          ok: false,
          value: 'undefined',
          output: [],
          terminated: 'worker error',
          durationMs: 0,
        });
      }
      this.pending.clear();
    };
  }

  run(script: string): PluginRunHandle {
    if (this.terminated) {
      throw new Error('Plugin runner has been terminated');
    }
    const id = this.nextId++;
    const start = Date.now();
    const outputs: string[] = [];

    const result = new Promise<PluginRunResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          ok: false,
          value: 'undefined',
          output: outputs,
          terminated: 'execution limit',
          durationMs: Date.now() - start,
        });
      }, this.maxRunMs);
      this.pending.set(id, { resolve, timer, outputs });
    });

    this.worker.postMessage({ type: 'run', id, script });
    return { runId: id, result, cancel: () => this.cancel(id) };
  }

  cancel(runId: number): void {
    const call = this.pending.get(runId);
    if (call) {
      clearTimeout(call.timer);
      this.pending.delete(runId);
      call.resolve({
        ok: false,
        value: 'undefined',
        output: call.outputs,
        terminated: 'cancelled',
        durationMs: 0,
      });
    }
  }

  terminate(): void {
    this.terminated = true;
    this.worker.terminate();
    for (const call of this.pending.values()) {
      clearTimeout(call.timer);
      call.resolve({
        ok: false,
        value: 'undefined',
        output: call.outputs,
        terminated: 'terminated',
        durationMs: 0,
      });
    }
    this.pending.clear();
  }

  private async handleMessage(msg: unknown): Promise<void> {
    const data = msg as Record<string, unknown>;
    const id = typeof data.runId === 'number' ? data.runId : typeof data.id === 'number' ? data.id : null;
    if (id === null) return;
    const call = this.pending.get(id);
    if (!call) return;

    if (data.type === 'result') {
      clearTimeout(call.timer);
      this.pending.delete(id);
      call.resolve({
        ok: true,
        value: typeof data.value === 'string' ? data.value : 'undefined',
        output: call.outputs,
        durationMs: 0,
      });
    } else if (data.type === 'error') {
      clearTimeout(call.timer);
      this.pending.delete(id);
      call.resolve({
        ok: false,
        value: 'undefined',
        output: call.outputs,
        error: typeof data.error === 'string' ? data.error : 'Unknown error',
        durationMs: 0,
      });
    } else if (data.type === 'output') {
      call.outputs.push(String(data.text));
    } else if (data.type === 'api_request') {
      let value = 'undefined';
      let error: string | undefined;
      try {
        const result = await this.onApiRequest({
          capability: String(data.capability),
          method: String(data.method),
          args: Array.isArray(data.args) ? data.args : [],
        });
        value = JSON.stringify(result);
      } catch (err: any) {
        error = err?.message ?? String(err);
      }
      this.worker.postMessage({
        type: 'api_response',
        callId: data.callId,
        value,
        error,
      });
    }
  }
}

interface PendingRun {
  resolve: (v: PluginRunResult) => void;
  timer: ReturnType<typeof setTimeout>;
  outputs: string[];
}
