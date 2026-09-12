/**
 * GET /api/models
 *
 * Returns a list of available WebModel manifests with metadata
 * (size, compatibility, download status) for the UI model browser.
 *
 * In production this queries a registry service; here it returns
 * static demo manifests validated against the schema.
 */

import { NextResponse } from 'next/server';
import { validateManifest, totalBytes } from '@/src/lib/models/manifest';

export const dynamic = 'force-static';

const DEMO_MANIFESTS = [
  {
    id: 'vanta-smollm2-135m',
    version: '1.0.0',
    publisher: 'VantaOS Labs',
    signatureScheme: 'ed25519' as const,
    signature: 'aB3_abc123demo_signature',
    shards: [
      { url: 'https://models.vantaos.dev/vanta-smollm2-135m/v1/shard-0.bin', byteLength: 50_000_000, sha256: 'a'.repeat(64) },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 1024, minStorageMB: 2048 },
    license: { name: 'MIT', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'vanta-phi3-mini-4k',
    version: '2.1.0',
    publisher: 'VantaOS Labs',
    signatureScheme: 'ed25519' as const,
    signature: 'bC4_def456demo_signature',
    shards: [
      { url: 'https://models.vantaos.dev/vanta-phi3-mini-4k/v2/shard-0.bin', byteLength: 80_000_000, sha256: 'b'.repeat(64) },
      { url: 'https://models.vantaos.dev/vanta-phi3-mini-4k/v2/shard-1.bin', byteLength: 80_000_000, sha256: 'c'.repeat(64) },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 2048, minStorageMB: 4096 },
    license: { name: 'MIT', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'vanta-llama3-8b-quant',
    version: '1.0.0',
    publisher: 'VantaOS Labs',
    signatureScheme: 'ed25519' as const,
    signature: 'cD5_ghi789demo_signature',
    shards: [
      { url: 'https://models.vantaos.dev/vanta-llama3-8b-quant/v1/shard-0.bin', byteLength: 150_000_000, sha256: 'd'.repeat(64) },
      { url: 'https://models.vantaos.dev/vanta-llama3-8b-quant/v1/shard-1.bin', byteLength: 150_000_000, sha256: 'e'.repeat(64) },
    ],
    runtimeRequirements: { webgpu: true, wasm: true, minMemoryMB: 4096, minStorageMB: 8192 },
    license: { name: 'Llama-3-Community', acceptableUse: ['research', 'personal'] },
  },
];

export async function GET() {
  try {
    const manifests = DEMO_MANIFESTS.map((raw) => {
      const validated = validateManifest(raw);
      return {
        ...validated,
        totalBytes: totalBytes(validated),
      };
    });

    return NextResponse.json({ models: manifests }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
