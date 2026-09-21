'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PluginManifest, PluginCapability } from './manifest';
import { hasCapability } from './manifest';

export interface PluginApiContextValue {
  manifest: PluginManifest;
  can: (capability: string) => boolean;
  isLoaded: boolean;
  error: string | null;
}

const PluginApiContext = createContext<PluginApiContextValue | null>(null);

export function PluginApiProvider({
  manifest,
  children,
}: {
  manifest: PluginManifest;
  children: ReactNode;
}) {
  const value = useMemo<PluginApiContextValue>(
    () => ({
      manifest,
      can: (capability: string) => hasCapability(manifest, capability),
      isLoaded: true,
      error: null,
    }),
    [manifest]
  );

  return <PluginApiContext.Provider value={value}>{children}</PluginApiContext.Provider>;
}

export function usePluginApi(): PluginApiContextValue {
  const ctx = useContext(PluginApiContext);
  if (!ctx) {
    throw new Error('usePluginApi must be used within <PluginApiProvider>');
  }
  return ctx;
}

export function createPluginApi(manifest: PluginManifest): PluginApiContextValue {
  return {
    manifest,
    can: (capability: string) => hasCapability(manifest, capability),
    isLoaded: true,
    error: null,
  };
}

export type { PluginCapability };
