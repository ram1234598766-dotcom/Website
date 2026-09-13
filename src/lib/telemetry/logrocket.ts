/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { telemetry, redactValue } from "./index";
import type { QueuedEvent } from "./index";

let logRocketModule: typeof import("logrocket") | null = null;
let initSucceeded = false;
let initializedEnv = "";

function getLogRocketID(): string | null {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_LOGROCKET_ID) {
    return process.env.NEXT_PUBLIC_LOGROCKET_ID;
  }
  return null;
}

/** Keys that must be redacted from user details before sending to any third party. */
const LOGROCKET_REDACT_KEYS = new Set([
  'token',
  'secret',
  'password',
  'credential',
  'apikey',
  'key',
  'source',
  'prompt',
  'output',
]);

export async function initLogRocket(environment: string): Promise<boolean> {
  if (initSucceeded && initializedEnv === environment) {
    return true;
  }
  const id = getLogRocketID();
  if (!id) return false;
  try {
    logRocketModule = await import("logrocket");
    logRocketModule.init(id);
    initSucceeded = true;
    initializedEnv = environment;
    return true;
  } catch {
    logRocketModule = null;
    initSucceeded = false;
    return false;
  }
}

/**
 * Scrub PII / secrets from user details before sending to LogRocket.
 * Uses the same redaction keys as the telemetry pipeline for consistency.
 */
function scrubUserDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (LOGROCKET_REDACT_KEYS.has(k.toLowerCase())) {
      scrubbed[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      scrubbed[k] = scrubUserDetails(v as Record<string, unknown>);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
}

export function identifyUser(
  userId: string,
  user?: Record<string, unknown>,
): void {
  if (!userId) {
    telemetry.event("user-identify-error", { reason: "missing-user-id" });
    return;
  }
  const scrubbed = scrubUserDetails(user);
  if (logRocketModule) {
    logRocketModule.identify(userId, scrubbed as Record<string, string | number | boolean>);
  }
  telemetry.event("user-identify", {
    userId,
    ...(scrubbed ? { userDetails: scrubbed } : {}),
  });
}

export function trackEvent(
  name: unknown,
  data?: Record<string, unknown>,
): void {
  if (!name || typeof name !== "string") {
    return;
  }
  const sanitized = name.replace(/[^a-zA-Z0-9_()-]/g, "");
  if (!sanitized) {
    return;
  }
  const scrubbedData = scrubUserDetails(data);
  if (logRocketModule) {
    logRocketModule.track(sanitized, scrubbedData as Record<string, string | number | boolean | string[] | number[] | boolean[]>);
  }
  telemetry.event(`logrocket-${sanitized}`, scrubbedData ?? {});
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (logRocketModule) {
    const err = error instanceof Error ? error : new Error(String(error));
    logRocketModule.captureException(err, {
      ...scrubUserDetails(context),
    });
  }
  import("./sentry").then(({ captureException: sentryCapture }) => {
    sentryCapture(error, context);
  }).catch(() => {});
  const e = error instanceof Error ? error : new Error(String(error));
  telemetry.error("logrocket-error", e, context);
}

export function isLogRocketInitialized(): boolean {
  return logRocketModule !== null;
}

export type { QueuedEvent };
