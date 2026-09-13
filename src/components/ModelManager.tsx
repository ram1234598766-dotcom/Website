/**
 * VantaOS — Model Manager UI.
 *
 * Lists available WebModel packages, shows compatibility with the current
 * device, and exposes download / verify / delete actions with progress
 * feedback.
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  HardDrive,
  Shield,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore Module resolution works at runtime via Next.js bundler
import { ModelManifest, DeviceProfile } from '@/src/lib/models/manifest';
// @ts-ignore Module resolution works at runtime via Next.js bundler
import { detectDevice, meetsRequirements } from '@/src/lib/models/device';

/* ------------------------------------------------------------------ */
/*  Demo data — in production this comes from a registry endpoint.     */
/* ------------------------------------------------------------------ */

const DEMO_MANIFESTS: ModelManifest[] = [
  {
    id: 'vanta-smollm2-135m',
    version: '1.0.0',
    publisher: 'VantaOS Labs',
    signatureScheme: 'ed25519',
    signature: 'aB3_abc123demo_signature',
    shards: [
      {
        url: 'https://models.vantaos.dev/vanta-smollm2-135m/v1/shard-0.bin',
        byteLength: 2 * 1024 * 1024,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 16 },
    license: {
      name: 'Apache-2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0',
      acceptableUse: ['research', 'commercial', 'fine-tuning'],
    },
  },
  {
    id: 'vanta-phi3-mini-4k',
    version: '2.1.0',
    publisher: 'VantaOS Labs',
    signatureScheme: 'hmac-sha256',
    signature: 'hmac_demo_sig_xyz',
    shards: [
      {
        url: 'https://models.vantaos.dev/vanta-phi3-mini-4k/v2/shard-0.bin',
        byteLength: 48 * 1024 * 1024,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      {
        url: 'https://models.vantaos.dev/vanta-phi3-mini-4k/v2/shard-1.bin',
        byteLength: 48 * 1024 * 1024,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ],
    runtimeRequirements: { webgpu: true, wasm: true, minMemoryMB: 4096, minStorageMB: 200 },
    license: {
      name: 'MIT',
      acceptableUse: ['research', 'commercial'],
    },
  },
  {
    id: 'vanta-llama3-8b-quant',
    version: '1.0.0',
    publisher: 'VantaOS Labs',
    signatureScheme: 'ed25519',
    signature: 'demo_llama3_sig',
    shards: [
      {
        url: 'https://models.vantaos.dev/vanta-llama3-8b-quant/v1/shard-0.bin',
        byteLength: 512 * 1024 * 1024,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ],
    runtimeRequirements: { webgpu: true, wasm: true, minMemoryMB: 16384, minStorageMB: 1024 },
    license: {
      name: 'LLaMA-3.0',
      url: 'https://ai.meta.com/llama/license/',
      acceptableUse: ['research'],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(b: number): string {
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MiB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KiB`;
  return `${b} B`;
}

function profileLabel(p: DeviceProfile): { text: string; color: string } {
  switch (p) {
    case 'low-memory-mobile': return { text: 'Low-memory mobile', color: 'text-red-400' };
    case 'modern-mobile': return { text: 'Modern mobile', color: 'text-yellow-400' };
    case 'laptop': return { text: 'Laptop', color: 'text-blue-400' };
    case 'desktop': return { text: 'Desktop', color: 'text-green-400' };
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ModelStatus {
  phase: 'idle' | 'downloading' | 'verifying' | 'installing' | 'done' | 'error';
  progress: number;
  error?: string;
}

const initialStatus: ModelStatus = { phase: 'idle', progress: 0 };

export default function ModelManager() {
  const [manifests] = useState<ModelManifest[]>(DEMO_MANIFESTS);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(null);
  const [deviceCaps, setDeviceCaps] = useState<any>(null);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});

  useEffect(() => {
    detectDevice().then((caps) => {
      setDeviceProfile(caps.profile);
      setDeviceCaps(caps);
    });
  }, []);

  const updateStatus = useCallback((modelId: string, patch: Partial<ModelStatus>) => {
    setStatuses((prev) => ({ ...prev, [modelId]: { ...prev[modelId], ...patch } }));
  }, []);

  const handleDownload = useCallback(
    async (manifest: ModelManifest) => {
      updateStatus(manifest.id, { phase: 'downloading', progress: 0 });
      try {
        const { downloadModel } = await import('../lib/models/downloader');
        await downloadModel(manifest, (p) => {
          const pct = p.totalBytes > 0 ? (p.bytesReceived / p.totalBytes) * 100 : 0;
          updateStatus(manifest.id, { phase: p.phase, progress: Math.round(pct), error: p.error });
        });
        updateStatus(manifest.id, { phase: 'done', progress: 100 });
      } catch (err) {
        updateStatus(manifest.id, {
          phase: 'error',
          error: err instanceof Error ? err.message : 'Download failed',
        });
      }
    },
    [updateStatus],
  );

  const handleDelete = useCallback((modelId: string) => {
    setStatuses((prev) => ({ ...prev, [modelId]: initialStatus }));
  }, []);

  const profileInfo = useMemo(() => deviceProfile ? profileLabel(deviceProfile) : null, [deviceProfile]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">Model Manager</h2>
      <p className="text-gray-400 mb-6 text-sm">
        Browse, download, and manage locally-executed AI models. Models run entirely
        in your browser — no data leaves your device.
      </p>

      {/* Device profile banner */}
      {deviceCaps && profileInfo && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-lg border border-gray-700 bg-gray-800/60 p-4 flex flex-wrap items-center gap-4"
        >
          <Cpu className="h-5 w-5 text-gray-400" />
          <div className="flex-1 min-w-[200px]">
            <span className="text-sm text-gray-300">Device profile: </span>
            <span className={`text-sm font-semibold ${profileInfo.color}`}>{profileInfo.text}</span>
            <span className="text-gray-500 text-xs ml-2">
              ({deviceCaps.cores} cores, {deviceCaps.deviceMemoryMB} MiB RAM,
              WebGPU {deviceCaps.webgpu ? '✓' : '✗'}, WASM {deviceCaps.wasm ? '✓' : '✗'})
            </span>
          </div>
          <HardDrive className="h-5 w-5 text-gray-400" />
          <span className="text-xs text-gray-400">
            {deviceCaps.storageQuotaMB.toLocaleString()} MiB storage available
          </span>
        </motion.div>
      )}

      {/* Model list */}
      <div className="space-y-4">
        {manifests.map((manifest) => {
          const status = statuses[manifest.id] ?? initialStatus;
          const totalSize = useMemo(() => manifest.shards.reduce((s, sh) => s + sh.byteLength, 0), [manifest.shards]);
          const compatible = useMemo(() => deviceCaps
            ? meetsRequirements(deviceCaps, manifest.runtimeRequirements)
            : null, [deviceCaps, manifest.runtimeRequirements]);

          return (
            <motion.div
              key={manifest.id}
              layout
              className="rounded-xl border border-gray-700 bg-gray-800/40 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[220px]">
                  <h3 className="text-white font-semibold text-lg">{manifest.id}</h3>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {manifest.signatureScheme}
                    </span>
                    <span>v{manifest.version}</span>
                    <span>{manifest.publisher}</span>
                    <span>{formatBytes(totalSize)}</span>
                    <span className="capitalize">{manifest.license.name}</span>
                  </div>

                  {/* Runtime badges */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {manifest.runtimeRequirements.webgpu && (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                          deviceCaps?.webgpu
                            ? 'bg-green-900/40 text-green-400'
                            : 'bg-red-900/40 text-red-400'
                        }`}
                      >
                        WebGPU {deviceCaps?.webgpu ? '✓' : '✗'}
                      </span>
                    )}
                    {manifest.runtimeRequirements.wasm && (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                          deviceCaps?.wasm
                            ? 'bg-green-900/40 text-green-400'
                            : 'bg-red-900/40 text-red-400'
                        }`}
                      >
                        WASM {deviceCaps?.wasm ? '✓' : '✗'}
                      </span>
                    )}
                    <span className="rounded bg-gray-700/40 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                      {manifest.runtimeRequirements.minMemoryMB} MiB RAM
                    </span>
                    <span className="rounded bg-gray-700/40 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                      {formatBytes(manifest.runtimeRequirements.minStorageMB * 1024 * 1024)} disk
                    </span>
                  </div>

                  {/* Acceptable-use list */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {manifest.license.acceptableUse.map((use) => (
                      <span
                        key={use}
                        className="rounded-full bg-indigo-900/30 px-2 py-0.5 text-[10px] text-indigo-300 capitalize"
                      >
                        {use}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-2">
                  {compatible === false && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      Incompatible with this device
                    </span>
                  )}

                  <AnimatePresence mode="wait">
                    {status.phase === 'idle' && (
                      <motion.button
                        key="dl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        disabled={compatible === false}
                        onClick={() => handleDownload(manifest)}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </motion.button>
                    )}

                    {(status.phase === 'downloading' || status.phase === 'verifying' || status.phase === 'installing') && (
                      <motion.div
                        key="progress"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-48"
                      >
                        <div className="flex items-center gap-2 text-xs text-gray-300 mb-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {status.phase === 'downloading' && `Downloading ${status.progress}%`}
                          {status.phase === 'verifying' && 'Verifying digests…'}
                          {status.phase === 'installing' && 'Installing…'}
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-indigo-500"
                            animate={{ width: `${status.progress}%` }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>
                      </motion.div>
                    )}

                    {status.phase === 'done' && (
                      <motion.div
                        key="done"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-green-400 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Installed
                      </motion.div>
                    )}

                    {status.phase === 'error' && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-red-400 text-xs"
                      >
                        <XCircle className="h-4 w-4" />
                        {status.error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {status.phase !== 'idle' && status.phase !== 'done' && (
                    <button
                      onClick={() => handleDelete(manifest.id)}
                      className="flex items-center gap-1 rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:border-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      Cancel
                    </button>
                  )}

                  {status.phase === 'done' && (
                    <button
                      onClick={() => handleDelete(manifest.id)}
                      className="flex items-center gap-1 rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:border-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Shard breakdown */}
              <div className="mt-3 flex flex-wrap gap-2">
                {manifest.shards.map((shard, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-gray-700/30 px-2 py-1 text-[11px] text-gray-400 font-mono"
                  >
                    shard-{i}: {formatBytes(shard.byteLength)}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
