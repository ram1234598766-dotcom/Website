import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkSLOs, checkSLOByService } from '../../src/lib/slo';
import { sentryErrorStore } from '../../src/lib/slo/error-store';
import { telemetry, resetTelemetry } from '../../src/lib/telemetry';

const WINDOW_MS = 30 * 24 * 3600 * 1000;
const OLD_MS = 31 * 24 * 3600 * 1000;

describe('error-rate SLO', () => {
  beforeEach(() => {
    sentryErrorStore.clear();
  });

  afterEach(() => {
    resetTelemetry();
    sentryErrorStore.clear();
  });

  it('is green with 0 recorded errors', async () => {
    const status = await checkSLOByService('error-rate');
    expect(status).toBeDefined();
    expect(status!.met).toBe(true);
    expect(status!.actual).toBe(100);
    expect(status!.observations).toBe(0);
  });

  it('is red when the error rate exceeds the 0.1% threshold', async () => {
    const now = new Date();
    for (let i = 0; i < 2; i++) {
      sentryErrorStore.recordObservation(now);
      sentryErrorStore.recordError(now);
    }
    for (let i = 0; i < 998; i++) {
      sentryErrorStore.recordObservation(now);
    }
    const status = await checkSLOByService('error-rate');
    expect(status!.met).toBe(false);
    expect(status!.observations).toBe(1000);
    expect(status!.actual).toBe(99.8);
  });

  it('is green when the error rate is at or below the 0.1% threshold', async () => {
    const now = new Date();
    const total = 2000;
    sentryErrorStore.recordObservation(now);
    sentryErrorStore.recordError(now);
    for (let i = 1; i < total; i++) {
      sentryErrorStore.recordObservation(now);
    }
    const status = await checkSLOByService('error-rate');
    expect(status!.met).toBe(true);
    expect(status!.actual).toBeGreaterThanOrEqual(99.9);
  });

  it('counts only events within the SLO window', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - OLD_MS);
    sentryErrorStore.recordObservation(old);
    sentryErrorStore.recordError(old);
    sentryErrorStore.recordObservation(now);
    sentryErrorStore.recordObservation(now);
    const status = await checkSLOByService('error-rate');
    expect(status!.observations).toBe(2);
    expect(status!.met).toBe(true);
  });

  it('shares the same store across calls and clears cleanly', async () => {
    const now = new Date();
    sentryErrorStore.recordObservation(now);
    sentryErrorStore.recordError(now);
    const first = await checkSLOs();
    const second = await checkSLOs();
    const errorRate = first.find((s) => s.service === 'error-rate');
    expect(errorRate).toBeDefined();
    expect(first).toEqual(second);
    expect(sentryErrorStore.getWindowCounts(WINDOW_MS)).toEqual({
      errors: 1,
      observations: 1,
    });
    sentryErrorStore.clear();
    const cleared = await checkSLOByService('error-rate');
    expect(cleared!.met).toBe(true);
    expect(cleared!.observations).toBe(0);
    expect(sentryErrorStore.getWindowCounts(WINDOW_MS)).toEqual({
      errors: 0,
      observations: 0,
    });
  });

  it('is fed by real telemetry events, not fabricated counts', async () => {
    telemetry.event('slo-test-operation', { source: 'unit-test' });
    telemetry.error('slo-test-error', new Error('boom'));
    const counts = sentryErrorStore.getWindowCounts(WINDOW_MS);
    expect(counts.errors).toBe(1);
    expect(counts.observations).toBe(2);
  });
});