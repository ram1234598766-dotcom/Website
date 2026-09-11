/**
 * Phase 2 test harness — runs the browser SandboxRunner protocol over Node's
 * `worker_threads` so tests get real isolation and real termination.
 */

import { Worker } from 'node:worker_threads';
import {
  buildNodeWorkerBridge,
  type SandboxWorkerFactory,
  type SandboxWorkerLike,
} from '../../src/lib/terminal/runner';

export const nodeSandboxWorkerFactory: SandboxWorkerFactory = (source) => {
  const src = buildNodeWorkerBridge() + source;
  const url = new URL(
    `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`
  );
  const worker = new Worker(url);
  return wrapWorker(worker);
};

function wrapWorker(worker: Worker): SandboxWorkerLike {
  return {
    onMessage(cb) {
      worker.on('message', (data) => cb(data));
    },
    onError(cb) {
      worker.on('error', (err) => cb(err));
    },
    post(message) {
      worker.postMessage(message);
    },
    terminate() {
      void worker.terminate();
    },
  };
}