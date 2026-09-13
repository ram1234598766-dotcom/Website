import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkSLOs,
  checkSLOByService,
  SLO_DEFINITIONS,
  SLO_MONITORING_ENABLED,
  type ServiceSLO,
  type SLOStatus,
} from '../../src/lib/slo';

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── SLO Definitions ────────────────────────────────────

describe('SLO_DEFINITIONS', () => {
  it('defines exactly 6 SLOs covering all required services', () => {
    expect(SLO_DEFINITIONS).toHaveLength(6);
    const services = SLO_DEFINITIONS.map((s) => s.service);
    expect(services).toContain('boot');
    expect(services).toContain('save');
    expect(services).toContain('sync');
    expect(services).toContain('model-download');
    expect(services).toContain('ai');
    expect(services).toContain('terminal');
  });

  it('each SLO has the required interface fields', () => {
    for (const slo of SLO_DEFINITIONS) {
      expect(slo).toHaveProperty('service');
      expect(slo).toHaveProperty('metric');
      expect(slo).toHaveProperty('target');
      expect(slo).toHaveProperty('window');
      expect(slo).toHaveProperty('threshold');
      expect(slo).toHaveProperty('thresholdUnit');
    }
  });

  it('boot SLO target is 2000ms threshold with 99.9% target', () => {
    const boot = SLO_DEFINITIONS.find((s) => s.service === 'boot');
    expect(boot).toBeDefined();
    expect(boot!.threshold).toBe(2000);
    expect(boot!.thresholdUnit).toBe('ms');
    expect(boot!.target).toBe(99.9);
  });

  it('save SLO target is 200ms threshold with 99.9% target', () => {
    const save = SLO_DEFINITIONS.find((s) => s.service === 'save');
    expect(save).toBeDefined();
    expect(save!.threshold).toBe(200);
    expect(save!.thresholdUnit).toBe('ms');
    expect(save!.target).toBe(99.9);
  });

  it('sync SLO target is 500ms threshold with 99.9% target', () => {
    const sync = SLO_DEFINITIONS.find((s) => s.service === 'sync');
    expect(sync).toBeDefined();
    expect(sync!.threshold).toBe(500);
    expect(sync!.thresholdUnit).toBe('ms');
    expect(sync!.target).toBe(99.9);
  });

  it('model-download SLO target is 30000ms threshold with 95.0% target', () => {
    const model = SLO_DEFINITIONS.find((s) => s.service === 'model-download');
    expect(model).toBeDefined();
    expect(model!.threshold).toBe(30000);
    expect(model!.thresholdUnit).toBe('ms');
    expect(model!.target).toBe(95.0);
  });

  it('AI SLO target is 1000ms threshold with 99.0% target', () => {
    const ai = SLO_DEFINITIONS.find((s) => s.service === 'ai');
    expect(ai).toBeDefined();
    expect(ai!.threshold).toBe(1000);
    expect(ai!.thresholdUnit).toBe('ms');
    expect(ai!.target).toBe(99.0);
  });

  it('terminal SLO target is 500ms threshold with 99.9% target', () => {
    const terminal = SLO_DEFINITIONS.find((s) => s.service === 'terminal');
    expect(terminal).toBeDefined();
    expect(terminal!.threshold).toBe(500);
    expect(terminal!.thresholdUnit).toBe('ms');
    expect(terminal!.target).toBe(99.9);
  });
});

// ─── SLO Monitoring Flag ────────────────────────────────

describe('SLO_MONITORING_ENABLED', () => {
  it('is exported and true', () => {
    expect(SLO_MONITORING_ENABLED).toBe(true);
  });
});

// ─── checkSLOs ──────────────────────────────────────────

describe('checkSLOs', () => {
  it('returns a Promise that resolves to an array of SLOStatus', async () => {
    const result = await checkSLOs();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(6);
  });

  it('each status contains all required SLOStatus fields', async () => {
    const result = await checkSLOs();
    for (const status of result) {
      expect(status).toHaveProperty('service');
      expect(status).toHaveProperty('metric');
      expect(status).toHaveProperty('target');
      expect(status).toHaveProperty('window');
      expect(status).toHaveProperty('threshold');
      expect(status).toHaveProperty('thresholdUnit');
      expect(status).toHaveProperty('actual');
      expect(status).toHaveProperty('met');
      expect(status).toHaveProperty('observations');
    }
  });

  it('actual is a number between 0 and 100', async () => {
    const result = await checkSLOs();
    for (const status of result) {
      expect(typeof status.actual).toBe('number');
      expect(status.actual).toBeGreaterThanOrEqual(0);
      expect(status.actual).toBeLessThanOrEqual(100);
    }
  });

  it('met is a boolean', async () => {
    const result = await checkSLOs();
    for (const status of result) {
      expect(typeof status.met).toBe('boolean');
    }
  });

  it('observations is a positive integer', async () => {
    const result = await checkSLOs();
    for (const status of result) {
      expect(Number.isInteger(status.observations)).toBe(true);
      expect(status.observations).toBeGreaterThan(0);
    }
  });

  it('target values match the SLO_DEFINITIONS', async () => {
    const result = await checkSLOs();
    for (const status of result) {
      const def = SLO_DEFINITIONS.find((d) => d.service === status.service);
      expect(def).toBeDefined();
      expect(status.target).toBe(def!.target);
    }
  });

  it('service names match SLO_DEFINITIONS order', async () => {
    const result = await checkSLOs();
    const services = result.map((s) => s.service);
    expect(services).toEqual(['boot', 'save', 'sync', 'model-download', 'ai', 'terminal']);
  });

  it('threshold values match SLO_DEFINITIONS', async () => {
    const result = await checkSLOs();
    for (const status of result) {
      const def = SLO_DEFINITIONS.find((d) => d.service === status.service);
      expect(status.threshold).toBe(def!.threshold);
    }
  });

  it('checkSLOByService returns the matching SLO status', async () => {
    const bootStatus = await checkSLOByService('boot');
    expect(bootStatus).toBeDefined();
    expect(bootStatus!.service).toBe('boot');
  });

  it('checkSLOByService returns undefined for unknown service', async () => {
    const unknown = await checkSLOByService('nonexistent');
    expect(unknown).toBeUndefined();
  });
});
