/**
 * VantaOS Phase 3 — Provider Registry.
 *
 * Central registry for AI providers. Holds provider instances by ID
 * and exposes registration, lookup, listing, removal, and clearing.
 * Also provides rate-limit tracking per provider.
 */

/** Capability descriptor. */
export interface ModelCapability {
  name: string;
  maxTokens: number;
}

export interface ModelDescriptor {
  id: string;
  name: string;
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
}

export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

/** Full provider interface per ARCHITECTURE.md §5.1. */
export interface AIProvider {
  id: string;
  capabilities: ModelCapability[];
  listModels(signal?: AbortSignal): Promise<ModelDescriptor[]>;
  chat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatEvent>;
  cancel?(requestId: string): Promise<void>;
}

class StubProvider implements AIProvider {
  constructor(
    public readonly id: string,
    public readonly capabilities: ModelCapability[] = [],
  ) {}

  async listModels(_signal?: AbortSignal): Promise<ModelDescriptor[]> {
    return [];
  }

  async *chat(
    _request: ChatRequest,
    _signal?: AbortSignal,
  ): AsyncIterable<ChatEvent> {
    yield { type: 'done' };
  }
}

export interface RateLimitInfo {
  max: number;
  remaining: number;
  resetAt: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  max: number;
}

export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private rateLimits = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT_WINDOW_MS = 60_000;
  private readonly DEFAULT_MAX_REQUESTS = 60;

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  list(): readonly AIProvider[] {
    return [...this.providers.values()];
  }

  remove(id: string): boolean {
    return this.providers.delete(id);
  }

  clear(): void {
    this.providers.clear();
  }

  private getEntry(providerId: string): RateLimitEntry {
    const now = Date.now();
    const entry = this.rateLimits.get(providerId);
    if (entry && now - entry.windowStart < this.RATE_LIMIT_WINDOW_MS) {
      return entry;
    }
    const fresh: RateLimitEntry = {
      count: 0,
      windowStart: now,
      max: this.DEFAULT_MAX_REQUESTS,
    };
    this.rateLimits.set(providerId, fresh);
    return fresh;
  }

  recordRequest(providerId: string): void {
    const entry = this.getEntry(providerId);
    entry.count++;
  }

  isRateLimited(providerId: string): boolean {
    const entry = this.getEntry(providerId);
    return entry.count >= entry.max;
  }

  getRateLimit(providerId: string): RateLimitInfo {
    const entry = this.getEntry(providerId);
    const resetAt = entry.windowStart + this.RATE_LIMIT_WINDOW_MS;
    return {
      max: entry.max,
      remaining: entry.max - entry.count,
      resetAt,
    };
  }
}

export const providerRegistry = new ProviderRegistry();

export function registerDefaultProviders(registry: ProviderRegistry): void {
  registry.register(new StubProvider('openrouter'));
  registry.register(new StubProvider('gemini'));
  registry.register(new StubProvider('openai'));
}