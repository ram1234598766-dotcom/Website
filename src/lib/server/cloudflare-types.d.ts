declare interface DurableObjectState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<{ keys: string[] }>;
  };
}

declare interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

declare interface WorkerRequest {
  url: string;
  method: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
}

declare interface WorkerResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
}
