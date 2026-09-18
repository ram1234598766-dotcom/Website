import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { parseSseStream } from '../../src/lib/ai/stream-utils';
import { handleApiRequest, serverEnv } from '../../src/lib/server/api-router';

/* ------------------------------------------------------------------ */
/*  SSE parser unit tests                                              */
/* ------------------------------------------------------------------ */

describe('parseSseStream', () => {
  function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      async start(controller) {
        for (const c of chunks) {
          controller.enqueue(new TextEncoder().encode(c));
        }
        controller.close();
      },
    });
  }

  it('parses a single complete SSE event', async () => {
    const stream = makeStream(['data: {"hello":"world"}\n\n']);
    const tokens: string[] = [];
    for await (const data of parseSseStream(stream)) {
      tokens.push(data);
    }
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toBe('{"hello":"world"}');
  });

  it('parses multiple SSE events streamed across chunks', async () => {
    // Tokens arrive split across multiple chunks and events
    const stream = makeStream([
      'data: {"content":"hello"}\n\n',
      'data: {"content":" "}\n\n',
      'data: {"content":"world"}\n\n',
    ]);
    const tokens: string[] = [];
    for await (const data of parseSseStream(stream)) {
      const parsed = JSON.parse(data);
      if (parsed.content !== undefined) tokens.push(parsed.content);
    }
    expect(tokens).toEqual(['hello', ' ', 'world']);
  });

  it('handles the done signal', async () => {
    const stream = makeStream([
      'data: {"content":"token"}\n\n',
      'data: {"done":true}\n\n',
    ]);
    const events: Record<string, unknown>[] = [];
    for await (const data of parseSseStream(stream)) {
      events.push(JSON.parse(data));
    }
    expect(events).toHaveLength(2);
    expect((events[0] as any).content).toBe('token');
    expect((events[1] as any).done).toBe(true);
  });

  it('yields nothing for an empty stream', async () => {
    const stream = makeStream([]);
    const tokens: string[] = [];
    for await (const _ of parseSseStream(stream)) {
      tokens.push('should-not-run');
    }
    expect(tokens).toHaveLength(0);
  });

  it('handles events split mid-way across read() calls', async () => {
    // First read delivers the header of an event, second read the rest.
    const stream = makeStream([
      'data: {"content":"a"}',
      '\n\ndata: {"content":"b"}\n\n',
    ]);
    const tokens: string[] = [];
    for await (const data of parseSseStream(stream)) {
      const parsed = JSON.parse(data);
      if ((parsed as any).content !== undefined) tokens.push((parsed as any).content);
    }
    expect(tokens).toEqual(['a', 'b']);
  });

  it('skips comment lines (lines starting with :)', async () => {
    const stream = makeStream([
      ': this is a comment\n',
      'data: {"value":42}\n\n',
    ]);
    const events: Record<string, unknown>[] = [];
    for await (const data of parseSseStream(stream)) {
      events.push(JSON.parse(data));
    }
    expect(events).toHaveLength(1);
    expect((events[0] as any).value).toBe(42);
  });

  it('handles error events', async () => {
    const stream = makeStream([
      'data: {"error":"rate limit exceeded"}\n\n',
    ]);
    const events: Record<string, unknown>[] = [];
    for await (const data of parseSseStream(stream)) {
      events.push(JSON.parse(data));
    }
    expect(events).toHaveLength(1);
    expect((events[0] as any).error).toBe('rate limit exceeded');
  });

  it('throws on malformed JSON in data line', async () => {
    const stream = makeStream([
      'data: not-json\n\n',
    ]);
    const items: string[] = [];
    try {
      for await (const data of parseSseStream(stream)) {
        // Attempting to parse the yielded data as JSON should throw
        JSON.parse(data);
        items.push(data);
      }
    } catch {
      // Expected — JSON.parse fails on 'not-json'
      return;
    }
    // If we get here, JSON.parse didn't throw — fail the test
    expect.fail('Expected JSON.parse to throw on malformed data');
  });
});

/* ------------------------------------------------------------------ */
/*  Server-side streaming integration tests                            */
/* ------------------------------------------------------------------ */

describe('POST /api/ai/generate — streaming', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function cloudRequest(
    provider: string,
    extraHeaders: Record<string, string> = {},
  ): Request {
    return new Request('https://example.com/api/ai/generate?stream=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Origin': 'https://website.vasudevaya.workers.dev',
        'Sec-Fetch-Site': 'same-origin',
        ...extraHeaders,
      },
      body: JSON.stringify({
        provider,
        model: 'test-model',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
  }

  /**
   * Build a fake upstream SSE response body for OpenRouter/OpenAI style
   * streaming: each chunk is `data: {...}\n\n` with choices[0].delta.content.
   */
  function mockUpstreamSse(
    tokens: string[],
  ): ReadableStream<Uint8Array> {
    const events = tokens.map(
      (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`,
    );
    events.push('data: [DONE]\n\n');
    return new ReadableStream({
      async start(controller) {
        for (const e of events) {
          controller.enqueue(new TextEncoder().encode(e));
        }
        controller.close();
      },
    });
  }

  it('returns text/event-stream with progressive content tokens for OpenRouter', async () => {
    const upstream = mockUpstreamSse(['Hello', ' world', '!']);
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/event-stream']]),
      body: upstream,
    });

    const req = cloudRequest('openrouter');
    const res = await handleApiRequest(req, serverEnv());

    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value);
    }

    // Parse the SSE stream
    const events: Record<string, any>[] = [];
    for (const chunk of raw.split('\n\n')) {
      if (!chunk.trim()) continue;
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (dataLine) {
        try {
          events.push(JSON.parse(dataLine.slice(5).trimStart()));
        } catch { /* skip non-JSON */ }
      }
    }

    const contentEvents = events.filter((e) => e.content !== undefined);
    const doneEvents = events.filter((e) => e.done === true);
    expect(contentEvents.map((e) => e.content)).toEqual(['Hello', ' world', '!']);
    expect(doneEvents.length).toBe(1);
  });

  it('returns text/event-stream with progressive tokens for Gemini', async () => {
    const upstream = mockUpstreamSse(['Gemini', ' response']);
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/event-stream']]),
      body: upstream,
    });

    const req = cloudRequest('gemini', {
      'X-Forwarded-For': '1.2.3.4',
    });
    const res = await handleApiRequest(req, { ...serverEnv(), GEMINI_API_KEY: 'AIza-test' });

    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value);
    }

    const events: Record<string, any>[] = [];
    for (const chunk of raw.split('\n\n')) {
      if (!chunk.trim()) continue;
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (dataLine) {
        try {
          events.push(JSON.parse(dataLine.slice(5).trimStart()));
        } catch { /* skip */ }
      }
    }

    const contentEvents = events.filter((e) => e.content !== undefined);
    expect(contentEvents.map((e) => e.content)).toEqual(['Gemini', ' response']);
  });

  it('returns text/event-stream for OpenAI via stream param', async () => {
    const upstream = mockUpstreamSse(['OpenAI', ' token']);
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/event-stream']]),
      body: upstream,
    });

    const req = cloudRequest('openai');
    const res = await handleApiRequest(req, serverEnv());

    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value);
    }

    const events: Record<string, any>[] = [];
    for (const chunk of raw.split('\n\n')) {
      if (!chunk.trim()) continue;
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (dataLine) {
        try {
          events.push(JSON.parse(dataLine.slice(5).trimStart()));
        } catch { /* skip */ }
      }
    }

    const contentEvents = events.filter((e) => e.content !== undefined);
    expect(contentEvents.map((e) => e.content)).toEqual(['OpenAI', ' token']);
  });

  it('emits error event on upstream failure', async () => {
    (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('upstream down'));

    const req = cloudRequest('openrouter');
    const res = await handleApiRequest(req, serverEnv());

    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value);
    }

    const events: Record<string, any>[] = [];
    for (const chunk of raw.split('\n\n')) {
      if (!chunk.trim()) continue;
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (dataLine) {
        try {
          events.push(JSON.parse(dataLine.slice(5).trimStart()));
        } catch { /* skip */ }
      }
    }

    const errorEvents = events.filter((e) => e.error !== undefined);
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(String(errorEvents[0].error)).toContain('AI stream failed');
  });

  it('non-stream path still returns {text} (regression)', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Hello there' } }] }),
    });

    // No stream param, no Accept header
    const req = new Request('https://example.com/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'openrouter',
        model: 'test',
        apiKey: 'key',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    const res = await handleApiRequest(req, serverEnv());
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as Record<string, any>;
    expect(body).toHaveProperty('text');
    expect(body.text).toBe('Hello there');
  });

  it('stream path does not break when Gemini uses server key with same-site header', async () => {
    const upstream = mockUpstreamSse(['Server', ' Gemini']);
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/event-stream']]),
      body: upstream,
    });

    // No apiKey — uses server key, must come from same-site
    const req = new Request('https://example.com/api/ai/generate?stream=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Origin': 'https://website.vasudevaya.workers.dev',
        'Sec-Fetch-Site': 'same-origin',
      },
      body: JSON.stringify({
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    const res = await handleApiRequest(req, { ...serverEnv(), GEMINI_API_KEY: 'AIza-server' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value);
    }
    expect(raw).toContain('Server');
    expect(raw).toContain(' Gemini');
  });
});
