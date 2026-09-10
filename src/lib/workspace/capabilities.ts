/**
 * VantaOS Workspace — Capability Registry.
 *
 * Named provider slots that components claim at boot. The workspace routes
 * requests to the highest-priority provider for each slot.
 */

import type { CapabilitySlot, CapabilityProvider } from './types';

// ─── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<CapabilitySlot, CapabilityProvider[]>();

/** Register a provider for a capability slot. */
export function registerCapability(provider: CapabilityProvider): void {
  const existing = registry.get(provider.slot) ?? [];
  // Insert sorted by priority (lower = higher priority).
  const insertAt = existing.findIndex(
    (p) => p.priority > provider.priority
  );
  if (insertAt === -1) {
    existing.push(provider);
  } else {
    existing.splice(insertAt, 0, provider);
  }
  registry.set(provider.slot, existing);
}

/** Get the highest-priority provider for a slot. */
export function getCapability(slot: CapabilitySlot): CapabilityProvider | undefined {
  const providers = registry.get(slot);
  return providers?.[0];
}

/** Get all providers for a slot, sorted by priority. */
export function getCapabilities(slot: CapabilitySlot): readonly CapabilityProvider[] {
  return registry.get(slot) ?? [];
}

/** Remove a provider by id from all slots. */
export function removeCapability(id: string): boolean {
  let removed = false;
  for (const [slot, providers] of registry) {
    const idx = providers.findIndex((p) => p.id === id);
    if (idx !== -1) {
      providers.splice(idx, 1);
      removed = true;
      if (providers.length === 0) {
        registry.delete(slot);
      }
    }
  }
  return removed;
}

/** Clear all registered capabilities. */
export function clearCapabilities(): void {
  registry.clear();
}

/** List all occupied slots. */
export function occupiedSlots(): CapabilitySlot[] {
  return Array.from(registry.keys());
}
