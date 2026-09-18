/**
 * VantaOS — Service Level Objectives (SLOs).
 *
 * Defines measurable reliability targets for each core service.
 * Each SLO specifies a service name, metric, target percentage, and
 * observation window. The `checkSlo` function evaluates current
 * compliance against historical telemetry data.
 */

export interface ServiceSLO {
  /** Short identifier for the service (e.g. 'boot'). */
  service: string;
  /** Human-readable metric description (e.g. 'Boot time p95'). */
  metric: string;
  /** Target as a percentage (e.g. 99.9 means 99.9% of requests meet the threshold). */
  target: number;
  /** Observation window (e.g. '30d' for 30 days). */
  window: string;
  /** Threshold the metric must stay under (in ms for latency, seconds for boot). */
  threshold: number;
  /** Unit of the threshold value. */
  thresholdUnit: 'ms' | 's' | '%';
}

export interface SLOStatus {
  service: string;
  metric: string;
  target: number;
  window: string;
  threshold: number;
  thresholdUnit: 'ms' | 's' | '%';
  /** Actual measured compliance percentage (0–100). */
  actual: number;
  /** Whether the SLO is currently being met. */
  met: boolean;
  /** Number of observations in the current window. */
  observations: number;
}

export const SLO_MONITORING_ENABLED = true;

import { sentryErrorStore } from './error-store';
import { setTelemetryEventObserver } from '../telemetry';

setTelemetryEventObserver((event) => {
  sentryErrorStore.recordObservation();
  if (event.type === 'error') {
    sentryErrorStore.recordError();
  }
});

const ERROR_RATE_WINDOW_MS = 30 * 24 * 3600 * 1000;

function computeErrorRateSLO(): SLOStatus {
  const counts = sentryErrorStore.getWindowCounts(ERROR_RATE_WINDOW_MS);
  const observations = counts.observations;
  const errors = counts.errors;
  const actual = observations > 0 ? ((observations - errors) / observations) * 100 : 100;
  return {
    service: 'error-rate',
    metric: 'Error rate',
    target: 99.9,
    window: '30d',
    threshold: 0.1,
    thresholdUnit: '%',
    actual: Math.round(actual * 10) / 10,
    met: actual >= 99.9,
    observations,
  };
}

export const SLO_DEFINITIONS: ServiceSLO[] = [
  {
    service: 'boot',
    metric: 'Boot time p95',
    target: 99.9,
    window: '30d',
    threshold: 2000,
    thresholdUnit: 'ms',
  },
  {
    service: 'save',
    metric: 'Save latency p95',
    target: 99.9,
    window: '30d',
    threshold: 200,
    thresholdUnit: 'ms',
  },
  {
    service: 'sync',
    metric: 'Sync latency p95',
    target: 99.9,
    window: '30d',
    threshold: 500,
    thresholdUnit: 'ms',
  },
  {
    service: 'model-download',
    metric: 'Model download p95 (< 100 MB)',
    target: 95.0,
    window: '30d',
    threshold: 30000,
    thresholdUnit: 'ms',
  },
  {
    service: 'ai',
    metric: 'AI first-token latency p95',
    target: 99.0,
    window: '30d',
    threshold: 1000,
    thresholdUnit: 'ms',
  },
  {
    service: 'terminal',
    metric: 'Terminal startup p95',
    target: 99.9,
    window: '30d',
    threshold: 500,
    thresholdUnit: 'ms',
  },
  {
    service: 'error-rate',
    metric: 'Error rate',
    target: 99.9,
    window: '30d',
    threshold: 0.1,
    thresholdUnit: '%',
  },
];

/**
 * Simulated historical observations per service.
 * In production this would query a metrics backend (Prometheus, etc.).
 * Returns latency samples in ms.
 */
function getHistoricalSamples(service: string): number[] {
  switch (service) {
    case 'boot':
      return [800, 1100, 1500, 1900, 2200, 900, 1200, 1800, 1600, 1400];
    case 'save':
      return [45, 80, 120, 180, 250, 60, 90, 150, 300, 110];
    case 'sync':
      return [80, 150, 220, 350, 600, 120, 280, 400, 380, 200];
    case 'model-download':
      return [5000, 12000, 25000, 35000, 15000, 8000, 22000, 28000, 18000, 10000];
    case 'ai':
      return [200, 400, 600, 900, 1200, 300, 500, 800, 1100, 700];
    case 'terminal':
      return [50, 100, 180, 250, 600, 120, 200, 300, 450, 350];
    default:
      return [];
  }
}

/**
 * Compute the p95 (95th percentile) of a sorted array of numbers.
 * Uses the nearest-rank method.
 */
function computeP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Check all SLOs and return their current compliance status.
 *
 * Evaluates each SLO by computing the p95 from historical samples
 * and comparing against the threshold. In production this would
 * query real metrics data.
 */
export async function checkSLOs(): Promise<SLOStatus[]> {
  return SLO_DEFINITIONS.map((slo) => {
    const samples = getHistoricalSamples(slo.service);
    const p95 = computeP95(samples);
    const passing = samples.filter((v) => v <= slo.threshold).length;
    const actual = samples.length > 0 ? (passing / samples.length) * 100 : 0;

    return {
      service: slo.service,
      metric: slo.metric,
      target: slo.target,
      window: slo.window,
      threshold: slo.threshold,
      thresholdUnit: slo.thresholdUnit,
      actual: Math.round(actual * 10) / 10,
      met: actual >= slo.target,
      observations: samples.length,
    };
  });
}

/**
 * Check a single SLO by service name.
 */
export async function checkSLOByService(service: string): Promise<SLOStatus | undefined> {
  if (service === 'error-rate') {
    return computeErrorRateSLO();
  }
  const statuses = await checkSLOs();
  return statuses.find((s) => s.service === service);
}
