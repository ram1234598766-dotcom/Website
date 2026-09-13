/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { telemetry, redactValue } from './index';

let sentryModule: typeof import('@sentry/react') | null = null;
let initAttempted = false;

function getSentryDSN(): string | null {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SENTRY_DSN) {
    return process.env.NEXT_PUBLIC_SENTRY_DSN;
  }
  return null;
}

export async function initSentry(): Promise<boolean> {
  if (initAttempted) {
    return sentryModule !== null;
  }
  const dsn = getSentryDSN();
  if (!dsn) {
    initAttempted = true;
    return false;
  }
  initAttempted = true;

  try {
    sentryModule = await import('@sentry/react');
    sentryModule.init({ dsn, tracesSampleRate: 1.0 });
    setupGlobalHandlers();
    return true;
  } catch {
    sentryModule = null;
    return false;
  }
}

function setupGlobalHandlers(): void {
  if (typeof window === 'undefined') return;

  if (!window.__vantaos_sentry_wired) {
    window.__vantaos_sentry_wired = true;

    window.addEventListener('error', (event) => {
      const error = event.error || new Error(event.message);
      if (sentryModule) {
        sentryModule!.captureException(error, {
          extra: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        });
      }
      telemetry.error('uncaught-exception', error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      if (sentryModule) {
        sentryModule!.captureException(reason);
      }
      telemetry.error('unhandled-rejection', reason);
    });
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (sentryModule) {
    sentryModule.captureException(error, context ? redactValue(context) as Record<string, unknown> : undefined);
  }
  const err =
    error instanceof Error ? error : new Error(String(error));
  telemetry.error('client-error', err, context);
}

export function isSentryInitialized(): boolean {
  return sentryModule !== null;
}

export type { QueuedEvent } from './index';

declare global {
  interface Window {
    __vantaos_sentry_wired?: boolean;
  }
}
