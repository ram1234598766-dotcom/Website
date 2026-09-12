/**
 * VantaOS WebModel — resumable shard downloader.
 *
 * Downloads shard blobs using HTTP Range requests, supports pause/resume via
 * AbortController, and performs atomic installation (temp file → verify →
 * move).
 *
 * Progress events are emitted through an async iterator so consumers can
 * update a progress bar without callback nesting.
 */

import type { ModelShard } from './manifest';

export type DownloadPhase = 'downloading' | 'verifying' | 'installing' | 'done' | 'error';

export interface ShardProgress {
  shardIndex: number;
  phase: DownloadPhase;
  /** Bytes received so far for this shard (0 during verify/install). */
  bytesReceived: number;
  /** Total bytes expected for this shard. */
  totalBytes: number;
  /** Human-readable speed estimate in bytes/sec (approximate). */
  speedBps?: number;
  error?: string;
}

export interface DownloadOptions {
  /** Called on every progress update. */
  onProgress: (p: ShardProgress) => void;
  /** Maximum retries per shard before the download is rejected. */
  maxRetries?: number;
  /** Chunk size for Range requests (default 256 KiB). */
  chunkSize?: number;
}

const DEFAULT_CHUNK_SIZE = 256 * 1024;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Fetch a byte range [start, end] (inclusive end) from `url`.
 * Throws on network error or non-2xx / non-206 response.
 */
async function fetchRange(
  url: string,
  start: number,
  end: number,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    signal,
  });

  if (res.status === 416) throw new Error(`Range not satisfiable: ${start}-${end}`);
  if (res.status === 429) throw new Error('Rate-limited — retry later');
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);

  const buf = await res.arrayBuffer();
  return buf;
}

/**
 * ResumableShardDownloader downloads a single shard into a temporary file
 * (an ArrayBuffer-backed blob) and reports progress.
 */
export class ResumableShardDownloader {
  private abortController: AbortController | null = null;
  private _paused = false;
  private _cancelled = false;

  get paused(): boolean { return this._paused; }
  get cancelled(): boolean { return this._cancelled; }

  pause(): void {
    this._paused = true;
    this.abortController?.abort();
  }

  resume(): void {
    this._paused = false;
  }

  cancel(): void {
    this._cancelled = true;
    this.abortController?.abort();
  }

  /** Download one shard, returning its full ArrayBuffer. */
  async download(
    shard: ModelShard,
    shardIndex: number,
    onProgress: (p: ShardProgress) => void,
    existingOffset = 0,
    maxRetries = DEFAULT_MAX_RETRIES,
    chunkSize = DEFAULT_CHUNK_SIZE,
  ): Promise<ArrayBuffer> {
    this.abortController = new AbortController();
    const remaining = shard.byteLength - existingOffset;
    const chunks: ArrayBuffer[] = [];
    let received = existingOffset;
    const startTime = performance.now();
    let lastReport = startTime;

    for (let offset = existingOffset; offset < shard.byteLength; offset += chunkSize) {
      if (this._cancelled) {
        onProgress({
          shardIndex,
          phase: 'error',
          bytesReceived: received,
          totalBytes: shard.byteLength,
          error: 'Download cancelled',
        });
        throw new Error('Download cancelled');
      }

      while (this._paused) {
        await new Promise((r) => setTimeout(r, 100));
        if (this._cancelled) {
          onProgress({
            shardIndex,
            phase: 'error',
            bytesReceived: received,
            totalBytes: shard.byteLength,
            error: 'Download cancelled',
          });
          throw new Error('Download cancelled');
        }
      }

      const end = Math.min(offset + chunkSize - 1, shard.byteLength - 1);
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          const buf = await fetchRange(shard.url, offset, end, this.abortController.signal);
          chunks.push(buf);
          received += buf.byteLength;
          const now = performance.now();

          if (now - lastReport >= 200) {
            const elapsed = (now - startTime) / 1000;
            onProgress({
              shardIndex,
              phase: 'downloading',
              bytesReceived: received,
              totalBytes: shard.byteLength,
              speedBps: elapsed > 0 ? Math.round(received / elapsed) : undefined,
            });
            lastReport = now;
          }
          break;
        } catch (err) {
          attempt++;
          if (attempt >= maxRetries) {
            onProgress({
              shardIndex,
              phase: 'error',
              bytesReceived: received,
              totalBytes: shard.byteLength,
              error: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }

    // Final progress report
    onProgress({
      shardIndex,
      phase: 'downloading',
      bytesReceived: shard.byteLength,
      totalBytes: shard.byteLength,
    });

    // Concatenate chunks into a single ArrayBuffer
    const result = new ArrayBuffer(shard.byteLength);
    const view = new Uint8Array(result);
    let pos = 0;
    for (const c of chunks) {
      view.set(new Uint8Array(c), pos);
      pos += c.byteLength;
    }
    return result;
  }

  /** Verify digest of downloaded bytes. */
  static async verifyDigest(data: ArrayBuffer, expectedHex: string): Promise<boolean> {
    const hash = await crypto.subtle.digest('SHA-256', data);
    const arr = new Uint8Array(hash);
    const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === expectedHex;
  }

  /** Atomically install: write to temp dir, verify, then return the Blob.
   *
   *  In a browser context we can't write to a real temp directory, but we
   *  simulate atomicity by returning a Blob that the caller can persist.
   */
  static async installShard(
    shard: ModelShard,
    shardIndex: number,
    downloader: ResumableShardDownloader,
    onProgress: (p: ShardProgress) => void,
    maxRetries = DEFAULT_MAX_RETRIES,
    chunkSize = DEFAULT_CHUNK_SIZE,
  ): Promise<Blob> {
    // Phase: downloading
    const data = await downloader.download(shard, shardIndex, onProgress, 0, maxRetries, chunkSize);

    // Phase: verifying
    onProgress({ shardIndex, phase: 'verifying', bytesReceived: 0, totalBytes: shard.byteLength });

    const ok = await ResumableShardDownloader.verifyDigest(data, shard.sha256);
    if (!ok) {
      onProgress({
        shardIndex,
        phase: 'error',
        bytesReceived: shard.byteLength,
        totalBytes: shard.byteLength,
        error: `SHA-256 mismatch for shard ${shardIndex}`,
      });
      throw new Error(`Digest verification failed for shard ${shardIndex}`);
    }

    // Phase: installing (simulated atomic move)
    onProgress({ shardIndex, phase: 'installing', bytesReceived: shard.byteLength, totalBytes: shard.byteLength });
    // Brief async tick so the UI can paint the "installing" state
    await new Promise((r) => setTimeout(r, 0));

    const blob = new Blob([data], { type: 'application/octet-stream' });

    onProgress({ shardIndex, phase: 'done', bytesReceived: shard.byteLength, totalBytes: shard.byteLength });
    return blob;
  }
}

/**
 * Download all shards for a model manifest and return installed Blobs.
 */
export async function downloadModel(
  manifest: { shards: ModelShard[] },
  onProgress: (p: ShardProgress) => void,
  options?: Partial<DownloadOptions>,
): Promise<Blob[]> {
  const downloader = new ResumableShardDownloader();
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const blobs: Blob[] = [];

  for (let i = 0; i < manifest.shards.length; i++) {
    const blob = await ResumableShardDownloader.installShard(
      manifest.shards[i],
      i,
      downloader,
      onProgress,
      maxRetries,
      chunkSize,
    );
    blobs.push(blob);
  }
  return blobs;
}
