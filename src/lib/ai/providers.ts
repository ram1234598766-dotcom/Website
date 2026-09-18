export type ProviderId = 'webmodel' | 'openrouter' | 'gemini' | 'openai';

export interface ProviderModel {
  id: string;
  name: string;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  models: ProviderModel[];
  defaultModel: string;
  desc: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'webmodel', name: 'WebModel',
    models: [
      { id: 'gpt2', name: 'GPT-2 (124M)' },
      { id: 'tinyllama', name: 'SmolLM2-135M' },
      { id: 'smollm2-360m', name: 'SmolLM2-360M' },
      { id: 'lamini-1b', name: 'LaMini-1.1B' },
      { id: 'phi-2', name: 'Phi-2 (2.7B)' },
      { id: 'phi-3-mini', name: 'Phi-3-mini (3.8B)' },
      { id: 'phi-3.5-mini', name: 'Phi-3.5-mini (3.8B)' },
    ],
    defaultModel: 'gpt2',
    desc: 'Runs in your browser via Transformers.js (WebGPU/WASM). No API key.' },
  { id: 'openrouter', name: 'OpenRouter',
    models: [{ id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash' }],
    defaultModel: 'openai/gpt-4o', desc: '200+ models. Get key at openrouter.ai/keys' },
  { id: 'gemini', name: 'Gemini',
    models: [{ id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' }], defaultModel: 'gemini-3.6-flash',
    desc: 'Free key at aistudio.google.com' },
  { id: 'openai', name: 'OpenAI',
    models: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }], defaultModel: 'gpt-4o-mini',
    desc: 'Key at platform.openai.com/api-keys' },
];

export function getProviderById(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
