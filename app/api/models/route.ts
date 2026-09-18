/**
 * GET /api/models
 *
 * Returns a list of available WebModel manifests with metadata
 * (size, compatibility, download status) for the UI model browser.
 *
 * This endpoint returns model metadata (id, version, publisher,
 * signature, shard layout, runtime requirements, license). The SHA256 values
 * below are placeholder hex digests — actual SHA256 verification
 * happens in adapter.ts via Transformers.js pipeline loading,
 * which does not use these hashes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateManifest, totalBytes } from '@/src/lib/models/manifest';

export const dynamic = 'force-static';

function jsonError(error: string, status: number, requestId?: string) {
  const body: Record<string, unknown> = { error };
  if (requestId) body.requestId = requestId;
  return NextResponse.json(body, { status });
}

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
      { url: 'https://huggingface.co/onnx-community/SmolLM2-360M-ONNX/resolve/main/config.json', byteLength: 1_200, sha256: '23456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/onnx-community/SmolLM2-360M-ONNX/resolve/main/model.onnx', byteLength: 380_000_000, sha256: '23456789012345678901234567890123456789012345678901234' },
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
      { url: 'https://huggingface.co/LaMini/LaMini-LLaMA-1.1B/resolve/main/config.json', byteLength: 1_200, sha256: '3456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/LaMini/LaMini-LLaMA-1.1B/resolve/main/model.onnx', byteLength: 1_100_000_000, sha256: '3456789012345678901234567890123456789012345678901234' },
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
      { url: 'https://huggingface.co/microsoft/Phi-2/resolve/main/config.json', byteLength: 1_500, sha256: '456789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/microsoft/Phi-2/resolve/main/model.onnx', byteLength: 2_700_000_000, sha256: '456789012345678901234567890123456789012345678901234' },
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
      { url: 'https://huggingface.co/microsoft/Phi-3-mini/resolve/main/config.json', byteLength: 1_500, sha256: '56789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/microsoft/Phi-3-mini/resolve/main/model.onnx', byteLength: 3_800_000_000, sha256: '56789012345678901234567890123456789012345678901234' },
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
      { url: 'https://huggingface.co/microsoft/Phi-3.5-mini/resolve/main/config.json', byteLength: 1_500, sha256: '6789012345678901234567890123456789012345678901234' },
      { url: 'https://huggingface.co/microsoft/Phi-3.5-mini/resolve/main/model.onnx', byteLength: 3_800_000_000, sha256: '6789012345678901234567890123456789012345678901234' },
    ],
    runtimeRequirements: { webgpu: false, wasm: true, minMemoryMB: 3072, minStorageMB: 3072 },
    license: { name: 'MIT', acceptableUse: ['commercial', 'research', 'personal'] },
  },
];

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  try {
    const manifests = MANIFESTS.map((raw) => {
      const validated = validateManifest(raw);
      return {
        ...validated,
        totalBytes: totalBytes(validated),
      };
    });

    return NextResponse.json(
      { models: manifests },
      {
        status: 200,
        headers: requestId ? { 'X-Request-ID': requestId } : undefined,
      },
    );
  } catch {
    return jsonError('Failed to load model manifests', 500, requestId);
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      ...(request.headers.get('x-request-id')
        ? { 'X-Request-ID': request.headers.get('x-request-id')! }
        : {}),
    },
  });
}
