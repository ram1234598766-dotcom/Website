import { describe, it, expect } from 'vitest';
import {
  INCIDENT_RUNBOOKS,
  getRunbookById,
  type IncidentRunbook,
} from '../../src/lib/incident-runbooks';

// ─── Runbook Collection ─────────────────────────────────

describe('INCIDENT_RUNBOOKS', () => {
  it('defines exactly 4 runbooks', () => {
    expect(INCIDENT_RUNBOOKS).toHaveLength(4);
  });

  it('includes all required runbook IDs', () => {
    const ids = INCIDENT_RUNBOOKS.map((rb) => rb.id);
    expect(ids).toContain('CREDENTIAL_EXPOSURE');
    expect(ids).toContain('MODEL_SUPPLY_CHAIN_FAILURE');
    expect(ids).toContain('SYNC_CORRUPTION');
    expect(ids).toContain('EDGE_DEPLOYMENT_ROLLBACK');
  });
});

// ─── Runbook Structure ──────────────────────────────────

describe('Runbook structure', () => {
  for (const runbook of INCIDENT_RUNBOOKS) {
    it(`${runbook.id} has required fields`, () => {
      expect(runbook).toHaveProperty('id');
      expect(runbook).toHaveProperty('title');
      expect(runbook).toHaveProperty('severity');
      expect(runbook).toHaveProperty('detectionCriteria');
      expect(runbook).toHaveProperty('immediateActions');
      expect(runbook).toHaveProperty('recoverySteps');
      expect(runbook).toHaveProperty('postIncidentChecks');
    });

    it(`${runbook.id} has a valid severity level`, () => {
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      expect(validSeverities).toContain(runbook.severity);
    });

    it(`${runbook.id} has a non-empty title`, () => {
      expect(runbook.title.length).toBeGreaterThan(0);
    });

    it(`${runbook.id} detectionCriteria is a non-empty array`, () => {
      expect(Array.isArray(runbook.detectionCriteria)).toBe(true);
      expect(runbook.detectionCriteria.length).toBeGreaterThan(0);
      for (const c of runbook.detectionCriteria) {
        expect(typeof c).toBe('string');
        expect(c.length).toBeGreaterThan(0);
      }
    });

    it(`${runbook.id} immediateActions has ordered steps starting at 1`, () => {
      expect(runbook.immediateActions.length).toBeGreaterThan(0);
      for (let i = 0; i < runbook.immediateActions.length; i++) {
        expect(runbook.immediateActions[i].step).toBe(i + 1);
      }
    });

    it(`${runbook.id} recoverySteps has ordered steps starting at 1`, () => {
      expect(runbook.recoverySteps.length).toBeGreaterThan(0);
      for (let i = 0; i < runbook.recoverySteps.length; i++) {
        expect(runbook.recoverySteps[i].step).toBe(i + 1);
      }
    });

    it(`${runbook.id} postIncidentChecks has ordered steps starting at 1`, () => {
      expect(runbook.postIncidentChecks.length).toBeGreaterThan(0);
      for (let i = 0; i < runbook.postIncidentChecks.length; i++) {
        expect(runbook.postIncidentChecks[i].step).toBe(i + 1);
      }
    });

    it(`${runbook.id} every step has action and owner`, () => {
      const allSteps = [
        ...runbook.immediateActions,
        ...runbook.recoverySteps,
        ...runbook.postIncidentChecks,
      ];
      for (const step of allSteps) {
        expect(step).toHaveProperty('action');
        expect(step).toHaveProperty('owner');
        expect(typeof step.action).toBe('string');
        expect(step.action.length).toBeGreaterThan(0);
        expect(typeof step.owner).toBe('string');
        expect(step.owner.length).toBeGreaterThan(0);
      }
    });
  }
});

// ─── Individual Runbook Content ─────────────────────────

describe('CREDENTIAL_EXPOSURE runbook', () => {
  const rb = getRunbookById('CREDENTIAL_EXPOSURE');
  it('is critical severity', () => {
    expect(rb).not.toBeUndefined();
    expect(rb!.severity).toBe('critical');
  });
  it('detection criteria mention tokens and keys', () => {
    expect(rb!.detectionCriteria.some((c) => c.includes('token') || c.includes('key'))).toBe(true);
  });
  it('immediate actions include revoking tokens', () => {
    const actions = rb!.immediateActions.map((a) => a.action.toLowerCase());
    expect(actions.some((a) => a.includes('revoke'))).toBe(true);
    expect(actions.some((a) => a.includes('rotate'))).toBe(true);
  });
  it('recovery steps include verifying rotated credentials', () => {
    const steps = rb!.recoverySteps.map((s) => s.action.toLowerCase());
    expect(steps.some((s) => s.includes('verify') && s.includes('credential'))).toBe(true);
  });
  it('post-incident checks include confirming no unauthorized access', () => {
    const checks = rb!.postIncidentChecks.map((s) => s.action.toLowerCase());
    expect(checks.some((c) => c.includes('unauthorized'))).toBe(true);
  });
});

describe('MODEL_SUPPLY_CHAIN_FAILURE runbook', () => {
  const rb = getRunbookById('MODEL_SUPPLY_CHAIN_FAILURE');
  it('is high severity', () => {
    expect(rb).not.toBeUndefined();
    expect(rb!.severity).toBe('high');
  });
  it('detection criteria mention checksum and manifest', () => {
    const criteria = rb!.detectionCriteria.join(' ').toLowerCase();
    expect(criteria.includes('checksum') || criteria.includes('manifest')).toBe(true);
  });
  it('immediate actions include switching to fallback', () => {
    const actions = rb!.immediateActions.map((a) => a.action.toLowerCase());
    expect(actions.some((a) => a.includes('fallback'))).toBe(true);
  });
  it('recovery steps include re-download with verification', () => {
    const steps = rb!.recoverySteps.map((s) => s.action.toLowerCase());
    expect(steps.some((s) => s.includes('download') && s.includes('verif'))).toBe(true);
  });
  it('post-incident checks include auditing supply chain', () => {
    const checks = rb!.postIncidentChecks.map((s) => s.action.toLowerCase());
    expect(checks.some((c) => c.includes('supply chain'))).toBe(true);
  });
});

describe('SYNC_CORRUPTION runbook', () => {
  const rb = getRunbookById('SYNC_CORRUPTION');
  it('is critical severity', () => {
    expect(rb).not.toBeUndefined();
    expect(rb!.severity).toBe('critical');
  });
  it('detection criteria mention oplog and divergence', () => {
    const criteria = rb!.detectionCriteria.join(' ').toLowerCase();
    expect(criteria.includes('oplog') || criteria.includes('diverge')).toBe(true);
  });
  it('immediate actions include disabling writes', () => {
    const actions = rb!.immediateActions.map((a) => a.action.toLowerCase());
    expect(actions.some((a) => a.includes('disable') && a.includes('write'))).toBe(true);
  });
  it('recovery steps include rebuilding from checkpoint', () => {
    const steps = rb!.recoverySteps.map((s) => s.action.toLowerCase());
    expect(steps.some((s) => s.includes('checkpoint') || s.includes('rebuild'))).toBe(true);
  });
  it('post-incident checks include verifying convergence', () => {
    const checks = rb!.postIncidentChecks.map((s) => s.action.toLowerCase());
    expect(checks.some((c) => c.includes('converge'))).toBe(true);
  });
});

describe('EDGE_DEPLOYMENT_ROLLBACK runbook', () => {
  const rb = getRunbookById('EDGE_DEPLOYMENT_ROLLBACK');
  it('is high severity', () => {
    expect(rb).not.toBeUndefined();
    expect(rb!.severity).toBe('high');
  });
  it('detection criteria mention error rate and cold-start', () => {
    const criteria = rb!.detectionCriteria.join(' ').toLowerCase();
    expect(criteria.includes('error rate') || criteria.includes('cold-start')).toBe(true);
  });
  it('immediate actions include reverting to previous version', () => {
    const actions = rb!.immediateActions.map((a) => a.action.toLowerCase());
    expect(actions.some((a) => a.includes('revert') || a.includes('previous'))).toBe(true);
  });
  it('recovery steps include canary rollout', () => {
    const steps = rb!.recoverySteps.map((s) => s.action.toLowerCase());
    expect(steps.some((s) => s.includes('canary'))).toBe(true);
  });
  it('post-incident checks include adding rollback automation', () => {
    const checks = rb!.postIncidentChecks.map((s) => s.action.toLowerCase());
    expect(checks.some((c) => c.includes('rollback'))).toBe(true);
  });
});

// ─── getRunbookById ─────────────────────────────────────

describe('getRunbookById', () => {
  it('returns the correct runbook for existing IDs', () => {
    for (const id of ['CREDENTIAL_EXPOSURE', 'MODEL_SUPPLY_CHAIN_FAILURE', 'SYNC_CORRUPTION', 'EDGE_DEPLOYMENT_ROLLBACK']) {
      const rb = getRunbookById(id);
      expect(rb).toBeDefined();
      expect(rb!.id).toBe(id);
    }
  });

  it('returns undefined for non-existent ID', () => {
    expect(getRunbookById('NONEXISTENT')).toBeUndefined();
  });
});
