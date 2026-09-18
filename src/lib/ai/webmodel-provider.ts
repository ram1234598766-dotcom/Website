/**
 * VantaOS Omni-AI — Model list ordered by parameter count (low → high).
 * These are the models available for local in-browser execution via
 * Transformers.js (WebGPU/WASM).
 *
 * Source: HuggingFace ONNX-quantized models compatible with
 * `pipeline('text-generation', ...)` in the browser.
 */
export const WEB_MODEL_SIZES: { id: string; name: string; params: number }[] = [
  { id: 'gpt2',          name: 'GPT-2',            params: 124  },
  { id: 'tinyllama',     name: 'SmolLM2-135M',     params: 135  },
  { id: 'smollm2-360m',  name: 'SmolLM2-360M',     params: 360  },
  { id: 'lamini-1b',     name: 'LaMini-LLaMA-1.1B', params: 1100 },
  { id: 'phi-2',         name: 'Phi-2',            params: 2700 },
  { id: 'phi-3-mini',    name: 'Phi-3-mini',       params: 3800 },
  { id: 'phi-3.5-mini',  name: 'Phi-3.5-mini',     params: 3800 },
];

export function getModelByParams(params: number): { id: string; name: string } | null {
  let best: { id: string; name: string } | null = null;
  let bestDiff = Infinity;
  for (const m of WEB_MODEL_SIZES) {
    const diff = Math.abs(m.params - params);
    if (diff < bestDiff) { bestDiff = diff; best = { id: m.id, name: m.name }; }
  }
  return best;
}

/**
 * Build a WebModel provider config when the device has a suitable runtime.
 * Returns null when WebGPU/WASM is unavailable.
 */
export function buildWebModelProvider(
  runtime: { webgpu: boolean; wasm: boolean; suitable: boolean },
  models: { id: string; name: string }[],
): { id: string; name: string; models: { id: string; name: string }[]; defaultModel: string; desc: string } | null {
  if (!runtime.suitable) return null;
  const defaultModel = models[0]?.id ?? 'gpt2';
  return {
    id: 'webmodel',
    name: 'WebModel',
    models: models.length ? models : [{ id: 'gpt2', name: 'GPT-2' }, { id: 'tinyllama', name: 'SmolLM2-135M' }],
    defaultModel,
    desc: 'Free, private, runs entirely in your browser with Transformers.js (WebGPU/WASM).',
  };
}

/**
 * Return metadata about the WebModel provider (for UI display / diagnostics).
 */
export function getWebModelProviderInfo(): { id: string; name: string; backend: string; local: boolean } {
  return {
    id: 'webmodel',
    name: 'WebModel',
    backend: 'transformers.js',
    local: true,
  };
}
