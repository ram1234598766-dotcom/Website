/**
 * SSE (Server-Sent Events) stream parser.
 *
 * Reads a ReadableStream of bytes, decodes via TextDecoderStream,
 * and yields parsed SSE data-payload objects (one per `data: ...` line).
 *
 * Protocol: each event is `data: {...}\n\n`. Lines starting with `:`
 * are comments and skipped. Multiple `data:` lines are concatenated
 * with newlines (per spec); here we join them — JSON parsers tolerate
 * the trailing newline and the consumer splits on the protocol level.
 */

/** A single parsed SSE event's data field, as a string (raw). */
export interface SseEvent {
  data: string;
}

/**
 * Parse a byte stream as SSE.  Yields the `data:` payload string
 * for each complete event.  Returns when the stream is consumed.
 *
 * Throws on malformed JSON inside a `data:` line (caller may treat
 * as a stream failure and fall back to non-stream).
 */
const MAX_SSE_BUFFER_CHARS = 1_000_000;

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > MAX_SSE_BUFFER_CHARS) {
        throw new Error('SSE buffer exceeded maximum size');
      }

      // SSE events are separated by blank lines (\n\n).
      // Process complete events only; keep the tail in buffer.
      const events = buffer.split('\n\n');
      // The last element is either empty (if buffer ended with \n\n)
      // or an incomplete event (keep in buffer).
      buffer = events.pop() ?? '';

      for (const event of events) {
        if (event.length === 0) continue;
        // Parse the event: extract the first `data:` line.
        // An event may contain multiple data: lines (concatenated per spec),
        // but our protocol always uses a single data: line per event.
        const lines = event.split('\n');
        let data = '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trimStart();
            data += (data ? '\n' : '') + payload;
          } else if (line.startsWith(':')) {
            // comment — skip
          }
        }
        if (data) {
          try {
            JSON.parse(data);
          } catch {
            throw new Error('Malformed SSE JSON payload');
          }
          yield data;
        }
      }
    }

    // Process any remaining buffer as a final event.
    if (buffer.length > 0) {
      const lines = buffer.split('\n');
      let data = '';
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trimStart();
          data += (data ? '\n' : '') + payload;
        }
      }
      if (data) {
        try {
          JSON.parse(data);
        } catch {
          throw new Error('Malformed SSE JSON payload');
        }
        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
