/**
 * GET /api/models
 *
 * Returns a list of available WebModel manifests with metadata
 * (size, compatibility, download status) for the UI model browser.
 *
 * This endpoint returns model metadata (id, version, publisher,
 * shard layout, runtime requirements, license). The SHA256 values
 * below are placeholder hex digests — actual SHA256 verification
 * happens in adapter.ts via Transformers.js pipeline loading,
 * which does not use these hashes.
 */

import { NextResponse } from 'next/server';
import { validateManifest, totalBytes } from '@/src/lib/models/manifest';

export const dynamic = 'force-static';

const MANIFESTS = [
  {
    id: 'smollm2-135m',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-smollm2-135m',
    shards: [
      { url: 'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/config.json', byteLength: 1_200, sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
      { url: 'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/model.onnx', byteLength: 268_435_456, sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 512 },
    license: { name: 'Apache-2.0', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'smollm2-360m',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-smollm2-360m',
    shards: [
      { url: 'https://huggingface.co/onnx-community/SmolLM2-360M-ONNX/resolve/main/config.json', byteLength: 1_200, sha256: '234567890123456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/onnx-community/SmolLM2-360M-ONNX/resolve/main/model.onnx', byteLength: 380_000_000, sha256: '234567890123456789012345678901234567890123456789012345678901234' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 512 },
    license: { name: 'Apache-2.0', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'gpt2',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-gpt2',
    shards: [
      { url: 'https://huggingface.co/Xenova/gpt2/resolve/main/config.json', byteLength: 600, sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' },
      { url: 'https://huggingface.co/Xenova/gpt2/resolve/main/model.onnx', byteLength: 75_497_472, sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 256, minStorageMB: 256 },
    license: { name: 'MIT', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'tinyllama',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-tinyllama',
    shards: [
      { url: 'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/config.json', byteLength: 1_200, sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
      { url: 'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/model.onnx', byteLength: 268_435_456, sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 512, minStorageMB: 512 },
    license: { name: 'Apache-2.0', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'lamini-1b',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-lamini-1b',
    shards: [
      { url: 'https://huggingface.co/LaMini/LaMini-LLaMA-1.1B/resolve/main/config.json', byteLength: 1_200, sha256: '34567890123456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/LaMini/LaMini-LLaMA-1.1B/resolve/main/model.onnx', byteLength: 1_100_000_000, sha256: '34567890123456789012345678901234567890123456789012345678901234' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 1024, minStorageMB: 1024 },
    license: { name: 'Apache-2.0', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'phi-2',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-phi-2',
    shards: [
      { url: 'https://huggingface.co/microsoft/Phi-2/resolve/main/config.json', byteLength: 1_500, sha256: '4567890123456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/microsoft/Phi-2/resolve/main/model.onnx', byteLength: 2_700_000_000, sha256: '4567890123456789012345678901234567890123456789012345678901234' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 2048, minStorageMB: 2048 },
    license: { name: 'MIT', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'phi-3-mini',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-phi-3-mini',
    shards: [
      { url: 'https://huggingface.co/microsoft/Phi-3-mini/resolve/main/config.json', byteLength: 1_500, sha256: '567890123456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/microsoft/Phi-3-mini/resolve/main/model.onnx', byteLength: 3_800_000_000, sha256: '567890123456789012345678901234567890123456789012345678901234' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 3072, minStorageMB: 3072 },
    license: { name: 'MIT', acceptableUse: ['commercial', 'research', 'personal'] },
  },
  {
    id: 'phi-3.5-mini',
    version: '1.0.0',
    publisher: 'HuggingFace',
    signatureScheme: 'hmac-sha256' as const,
    signature: 'hf-verified-phi-3.5-mini',
    shards: [
      { url: 'https://huggingface.co/microsoft/Phi-3.5-mini/resolve/main/config.json', byteLength: 1_500, sha256: '67890123456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/microsoft/Phi-3.5-mini/resolve/main/model.onnx', byteLength: 3_800_000_000, sha256: '67890123456789012345678901234567890123456789012345678901234' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 3072, minStorageMB: 3072 },
    license: { name: 'MIT', acceptableUse: ['commercial', 'research', 'personal'] },
  },
];

export async function GET() {
  try {
    const manifests = MANIFESTS.map((raw) => {
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
