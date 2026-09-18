/**
 * SentryErrorStore — records errors and observations captured at the app's
 * real error boundary (the telemetry funnel that `captureException` and the
 * global error handlers already call), so the error-rate SLO is computed
 * from real captured events instead of simulated samples.
 *
 * The store is session-scoped and in-memory: counts are trimmed to the
 * SLO's rolling observation window on read.
 */

export interface SentryErrorCounts {
  errors: number;
  observations: number;
}

export class SentryErrorStore {
  private errors: number[] = [];
  private observations: number[] = [];

  recordError(timestamp: Date = new Date()): void {
    this.errors.push(timestamp.getTime());
  }

  recordObservation(timestamp: Date = new Date()): void {
    this.observations.push(timestamp.getTime());
  }

  getWindowCounts(windowMs: number, now: Date = new Date()): SentryErrorCounts {
    if (windowMs <= 0) return { errors: 0, observations: 0 };
    const cutoff = now.getTime() - windowMs;
    const countWithin = (timestamps: number[]): number =>
      timestamps.filter((t) => t > cutoff).length;
    return {
      errors: countWithin(this.errors),
      observations: countWithin(this.observations),
    };
  }

  clear(): void {
    this.errors = [];
    this.observations = [];
  }
}

export const sentryErrorStore = new SentryErrorStore();