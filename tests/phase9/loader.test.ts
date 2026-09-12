import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadPlugin, verifyManifestSignature, PluginRunner } from '../../src/lib/plugins/loader';
import type { PluginManifest } from '../../src/lib/plugins/manifest';

const SECRET = 'test-secret-key';

async function makeSignedManifest(overrides: Partial<PluginManifest> = {}): Promise<PluginManifest> {
  const base: PluginManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    capabilities: ['workspace:read', 'ai:call'],
    entryPoint: { kind: 'inline', script: 'return 42;' },
    signatureAlgorithm: 'hmac-sha256',
    signature: '',
  };
  const manifest = { ...base, ...overrides };
  const payload = JSON.stringify({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    capabilities: manifest.capabilities,
    entryPoint: manifest.entryPoint,
  });
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const result = { ...manifest, signature: b64 };
  if (overrides.signature !== undefined) result.signature = overrides.signature;
  return result;
}

function createMockWorkerClass() {
  class MockWorker {
    postMessage = vi.fn(function(this: any, msg: any) {
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({ data: { type: 'ready' } });
        }
      }, 0);
    });
    terminate = vi.fn();
    onmessage: ((e: any) => void) | null = null;
    onerror: ((err: any) => void) | null = null;
  }
  return MockWorker;
}

describe('loader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (global as any).Worker = createMockWorkerClass();
  });

  it('rejects an invalid manifest', async () => {
    await expect(loadPlugin({ id: '', name: '', version: '', description: '', author: '', capabilities: [], entryPoint: { kind: 'inline', script: '' }, signatureAlgorithm: 'hmac-sha256', signature: '' }))
      .rejects.toThrow('Invalid plugin manifest');
  });

  it('rejects a manifest with a bad signature', async () => {
    const manifest = await makeSignedManifest({ signature: 'bad' });
    await expect(loadPlugin(manifest, SECRET)).rejects.toThrow('Plugin signature verification failed');
  });

  it('loads a valid signed manifest', async () => {
    (global as any).Worker = createMockWorkerClass();
    const manifest = await makeSignedManifest();
    const plugin = await loadPlugin(manifest, SECRET);
    expect(plugin.manifest.id).toBe('test-plugin');
    plugin.terminate();
  });
});

describe('PluginRunner', () => {
  function createFakeWorker() {
    const fakeWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as ((e: any) => void) | null,
      onerror: null as ((err: any) => void) | null,
    };
    return { worker: fakeWorker };
  }

  it('returns the result of a simple script', async () => {
    const { worker } = createFakeWorker();
    worker.postMessage.mockImplementation((msg: any) => {
      if (msg.type === 'run') {
        setTimeout(() => {
          worker.onmessage?.({ data: { type: 'result', runId: msg.id, value: '42' } });
        }, 0);
      }
    });

    const runner = new PluginRunner(worker as any);
    const handle = runner.run('return 21 * 2;');
    const res = await handle.result;
    expect(res.ok).toBe(true);
    expect(res.value).toBe('42');
    runner.terminate();
  });

  it('cancels a pending run', async () => {
    const { worker } = createFakeWorker();
    const runner = new PluginRunner(worker as any);
    const handle = runner.run('while (true) {}');
    handle.cancel();
    const res = await handle.result;
    expect(res.terminated).toBe('cancelled');
    runner.terminate();
  });

  it('terminates the worker', async () => {
    const { worker } = createFakeWorker();
    const runner = new PluginRunner(worker as any);
    runner.terminate();
    expect(worker.terminate).toHaveBeenCalled();
  });
});
