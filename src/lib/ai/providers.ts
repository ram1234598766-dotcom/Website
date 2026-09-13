export type ProviderId = 'ollama' | 'openrouter' | 'gemini' | 'openai' | 'webmodel';

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
  { id: 'ollama', name: 'Local Ollama',
    models: [{ id: 'llama3', name: 'llama3' }],
    defaultModel: 'llama3',
    desc: 'Run: set OLLAMA_ORIGINS=* && ollama serve' },
  { id: 'openrouter', name: 'OpenRouter',
    models: [{ id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
    defaultModel: 'openai/gpt-4o', desc: '200+ models. Get key at openrouter.ai/keys' },
  { id: 'gemini', name: 'Gemini',
    models: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }], defaultModel: 'gemini-2.5-flash',
    desc: 'Free key at aistudio.google.com' },
  { id: 'openai', name: 'OpenAI',
    models: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }], defaultModel: 'gpt-4o-mini',
    desc: 'Key at platform.openai.com/api-keys' },
];

export function getProviderById(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
