/**
 * VantaOS WebModel — device capability detection.
 *
 * Probes the browser environment for features needed by a downloaded model
 * (WebGPU, WASM, memory budget, storage quota) and returns a coarse-grained
 * device profile.
 */

import type { DeviceProfile, RuntimeRequirements } from './manifest';

export interface DeviceCapabilities {
  profile: DeviceProfile;
  webgpu: boolean;
  wasm: boolean;
  deviceMemoryMB: number;
  storageQuotaMB: number;
  cores: number;
}

/**
 * Detect WebGPU support. Returns true when the browser exposes the `gpu`
 * property on navigator (Chrome 113+, Edge 113+). Firefox and Safari are
 * currently behind this flag; we gracefully fall back.
 */
async function hasWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator;
}

/**
 * Detect WebAssembly support — universal in modern browsers but still
 * worth checking for older environments.
 */
function hasWASM(): boolean {
  if (typeof WebAssembly === 'undefined') return false;
  try {
    new WebAssembly.Module(new Uint8Array([0, 97, 115, 109]));
    return true;
  } catch {
    return false;
  }
}

/**
 * Approximate available device memory in MiB.
 * `navigator.deviceMemory` returns a rough estimate (Chrome/Edge only).
 * When unavailable we fall back to a heuristic based on `navigator.hardwareConcurrency`.
 */
function detectMemoryMB(): number {
  if (typeof navigator === 'undefined') return 4096;

  const dm = (navigator as any).deviceMemory;
  if (typeof dm === 'number' && dm > 0) {
    return Math.floor(dm * 1024);
  }

  const cores = navigator.hardwareConcurrency || 2;
  if (cores <= 4) return 2048;
  if (cores <= 8) return 8192;
  return 16384;
}

/**
 * Query the StorageManager API for an estimate of remaining quota.
 */
async function detectStorageQuotaMB(): Promise<number> {
  if (typeof navigator === 'undefined' || !(navigator as any).storage?.estimate) {
    return 1024;
  }
  try {
    const est = await (navigator as any).storage.estimate();
    const bytes = est.quota ?? 0;
    return Math.floor(bytes / (1024 * 1024));
  } catch {
    return 1024;
  }
}

/**
 * Map hardware characteristics to one of four coarse device profiles.
 */
function classifyProfile(
  memoryMB: number,
  storageMB: number,
  cores: number,
  webgpu: boolean,
): DeviceProfile {
  const isMobile = typeof navigator !== 'undefined' &&
    /Mobi|Android|iPhone|iPad/i.test((navigator as any).userAgent || '');

  if (isMobile && memoryMB < 4096) return 'low-memory-mobile';
  if (isMobile) return 'modern-mobile';
  if (cores <= 4 || memoryMB <= 8192) return 'laptop';
  return 'desktop';
}

/**
 * Run all probes and return a complete device capability report.
 */
export async function detectDevice(): Promise<DeviceCapabilities> {
  const webgpu = await hasWebGPU();
  const wasm = hasWASM();
  const deviceMemoryMB = detectMemoryMB();
  const storageQuotaMB = await detectStorageQuotaMB();
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  const profile = classifyProfile(deviceMemoryMB, storageQuotaMB, cores, webgpu);

  return {
    profile,
    webgpu,
    wasm,
    deviceMemoryMB,
    storageQuotaMB,
    cores,
  };
}

/**
 * Synchronous subset of detectDevice for use in places where async is
 * inconvenient. Falls back to conservative values for async-only probes.
 */
export function detectDeviceSync(): DeviceCapabilities {
  const wasm = hasWASM();
  const deviceMemoryMB = detectMemoryMB();
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  const profile = classifyProfile(deviceMemoryMB, 1024, cores, false);

  return {
    profile,
    webgpu: false,
    wasm,
    deviceMemoryMB,
    storageQuotaMB: 1024,
    cores,
  };
}

/**
 * Check whether the current device meets the runtime requirements declared
 * by a model manifest.
 */
export function meetsRequirements(
  caps: DeviceCapabilities,
  req: RuntimeRequirements,
): boolean {
  return requirementGaps(caps, req).length === 0;
}

/**
 * Return a human-readable list of the reasons the given device does NOT
 * meet the manifest's runtime requirements. An empty array means the
 * device is compatible. Used to explain *why* a model is blocked, rather
 * than just showing an opaque "incompatible" badge.
 */
export function requirementGaps(
  caps: DeviceCapabilities,
  req: RuntimeRequirements,
): string[] {
  const gaps: string[] = [];
  if (req.webgpu && !caps.webgpu) gaps.push('WebGPU is not supported by this browser');
  if (req.wasm && !caps.wasm) gaps.push('WebAssembly is not available');
  if (caps.deviceMemoryMB < req.minMemoryMB) {
    gaps.push(`Needs ${req.minMemoryMB} MiB RAM (you have ${caps.deviceMemoryMB} MiB)`);
  }
  if (caps.storageQuotaMB < req.minStorageMB) {
    gaps.push(`Needs ${req.minStorageMB} MiB storage (you have ${caps.storageQuotaMB} MiB)`);
  }
  return gaps;
}
