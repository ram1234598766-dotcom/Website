import { detectRuntime, resolveModel, modelCache, deleteDB } from '../models/adapter';
import type { ModelManifest, ModelShard } from '../models/manifest';
import type { ProviderConfig } from '../ai/providers';

export interface WebModelProviderInfo {
  suitable: boolean;
  runtime: { webgpu: boolean; wasm: boolean; suitable: boolean };
  models: { id: string; name: string }[];
}

export function buildWebModelProvider(
  runtime: { webgpu: boolean; wasm: boolean; suitable: boolean },
  models: { id: string; name: string }[],
): ProviderConfig | null {
  if (!runtime.suitable) return null;
  return {
    id: 'webmodel',
    name: 'WebModel',
    models: models.length > 0 ? models : [{ id: 'webmodel', name: 'WebModel' }],
    defaultModel: models.length > 0 ? models[0].id : 'webmodel',
    desc: 'Browser-runnable model — WebGPU or WASM required',
  };
}

export function getWebModelProviderInfo(): WebModelProviderInfo {
  const runtime = detectRuntime();
  const models: { id: string; name: string }[] = [];
  modelCache.forEach((manifest: ModelManifest) => {
    models.push({ id: manifest.id, name: `${manifest.id} (${manifest.version})` });
  });
  return {
    suitable: runtime.suitable,
    runtime,
    models,
  };
}

export { detectRuntime, resolveModel, modelCache, deleteDB };
