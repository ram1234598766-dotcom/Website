/**
 * VantaOS Terminal — execution quota.
 *
 * Guards the browser tab from runaway shell usage: commands are rate-limited
 * per rolling window and the output of any single command is capped so a
 * noisy process cannot flood or freeze the UI.
 */

import type { QUOTA_LIMITS as Limits } from './types';
import { QUOTA_LIMITS } from './types';

type QuotaLimits = typeof Limits;

export interface QuotaLimitsConfig {
  maxCommandsPerWindow: number;
  windowMs: number;
  maxOutputChars: number;
}

export class ExecutionQuota {
  private readonly limits: QuotaLimitsConfig;
  private readonly runTimes: number[] = [];

  constructor(overrides?: Partial<QuotaLimitsConfig>) {
    this.limits = {
      ...QUOTA_LIMITS,
      ...overrides,
    };
  }

  /** Returns true if a new command may run now; false to reject + retryMs. */
  tryAcquire(): { allowed: boolean; retryMs: number } {
    const now = Date.now();
    const cutoff = now - this.limits.windowMs;
    while (this.runTimes.length > 0 && this.runTimes[0] < cutoff) {
      this.runTimes.shift();
    }
    if (this.runTimes.length >= this.limits.maxCommandsPerWindow) {
      return { allowed: false, retryMs: this.runTimes[0] + this.limits.windowMs - now };
    }
    this.runTimes.push(now);
    return { allowed: true, retryMs: 0 };
  }

  /** Caps a command's output at the char limit, appending a truncation marker. */
  capOutput(lines: readonly string[]): readonly string[] {
    if (lines.length === 0) return lines;
    let total = 0;
    for (const line of lines) total += line.length + 1;
    if (total <= this.limits.maxOutputChars) return lines;

    const capped: string[] = [];
    let used = 0;
    for (const line of lines) {
      if (used + line.length + 1 > this.limits.maxOutputChars) {
        break;
      }
      capped.push(line);
      used += line.length + 1;
    }
    capped.push(
      `[output truncated — command produced ${total} chars, limit ${this.limits.maxOutputChars}]`
    );
    return capped;
  }
}