/**
 * VantaOS — Incident Runbooks.
 *
 * Standard operating procedures for responding to critical incidents.
 * Each runbook defines severity, detection criteria, immediate actions,
 * recovery steps, and post-incident checks.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface RunbookStep {
  /** Step number (1-based). */
  step: number;
  /** Action description. */
  action: string;
  /** Owner or role responsible. */
  owner: string;
  /** Maximum time to spend on this step (e.g. '5m'). */
  timeout?: string;
}

export interface IncidentRunbook {
  /** Unique identifier (e.g. 'CREDENTIAL_EXPOSURE'). */
  id: string;
  /** Human-readable title. */
  title: string;
  severity: Severity;
  /** Conditions that indicate this incident has occurred. */
  detectionCriteria: string[];
  /** Actions to take within the first minutes. */
  immediateActions: RunbookStep[];
  /** Steps to recover from the incident. */
  recoverySteps: RunbookStep[];
  /** Checks to perform after recovery. */
  postIncidentChecks: RunbookStep[];
}

export const INCIDENT_RUNBOOKS: IncidentRunbook[] = [
  {
    id: 'CREDENTIAL_EXPOSURE',
    title: 'Credential Exposure',
    severity: 'critical',
    detectionCriteria: [
      'API key or token found in public repository, log, or error report',
      'Unauthorized access detected from an unknown IP or device',
      'Rate-limited or blocked authentication attempts from a single source',
      'User reports unauthorized account activity',
      'Security scan flags exposed secrets in CI/CD output',
    ],
    immediateActions: [
      { step: 1, action: 'Revoke all exposed tokens, keys, and API credentials immediately', owner: 'Security Lead', timeout: '5m' },
      { step: 2, action: 'Rotate all secrets that may have been compromised (Firebase, AI providers, OAuth)', owner: 'Security Lead', timeout: '15m' },
      { step: 3, action: 'Revoke active user sessions tied to the compromised credentials', owner: 'Backend Engineer', timeout: '10m' },
      { step: 4, action: 'Remove exposed secrets from all public repositories and logs', owner: 'DevOps Engineer', timeout: '15m' },
      { step: 5, action: 'Notify affected users via email and in-app alert', owner: 'Product Manager', timeout: '30m' },
    ],
    recoverySteps: [
      { step: 1, action: 'Verify all rotated credentials are functional and no services are broken', owner: 'Backend Engineer', timeout: '30m' },
      { step: 2, action: 'Audit access logs for the 24 hours preceding the exposure', owner: 'Security Lead', timeout: '2h' },
      { step: 3, action: 'Implement secret scanning in CI/CD pipeline to prevent recurrence', owner: 'DevOps Engineer', timeout: '1d' },
      { step: 4, action: 'Update SECRET_SCANNING.md with lessons learned', owner: 'Security Lead', timeout: '1d' },
    ],
    postIncidentChecks: [
      { step: 1, action: 'Confirm no unauthorized access occurred during the exposure window', owner: 'Security Lead', timeout: '1h' },
      { step: 2, action: 'Run full dependency audit for downstream exposures', owner: 'Backend Engineer', timeout: '2h' },
      { step: 3, action: 'Verify secret scanning is active and alerting in all pipelines', owner: 'DevOps Engineer', timeout: '30m' },
      { step: 4, action: 'Schedule blameless post-incident review within 48 hours', owner: 'Engineering Manager', timeout: '48h' },
    ],
  },
  {
    id: 'MODEL_SUPPLY_CHAIN_FAILURE',
    title: 'Model Supply Chain Failure',
    severity: 'high',
    detectionCriteria: [
      'Model download fails checksum verification',
      'AI provider returns unexpected model version or tampered weights',
      'Manifest signature verification fails for a signed model',
      'Model manifest hash does not match published registry hash',
      'Unexpected behavior or output from a deployed model',
    ],
    immediateActions: [
      { step: 1, action: 'Stop serving requests through the affected model provider', owner: 'AI Engineer', timeout: '5m' },
      { step: 2, action: 'Switch to fallback provider or local model if available', owner: 'AI Engineer', timeout: '10m' },
      { step: 3, action: 'Quarantine the compromised model files and manifest', owner: 'DevOps Engineer', timeout: '15m' },
      { step: 4, action: 'Verify integrity of all cached model shards via SHA-256 recheck', owner: 'AI Engineer', timeout: '30m' },
      { step: 5, action: 'Notify users of potential degradation in AI quality', owner: 'Product Manager', timeout: '30m' },
    ],
    recoverySteps: [
      { step: 1, action: 'Re-download model from trusted registry with signature verification', owner: 'AI Engineer', timeout: '1h' },
      { step: 2, action: 'Validate model manifest signature against known-good publisher key', owner: 'AI Engineer', timeout: '30m' },
      { step: 3, action: 'Run model output smoke tests against known reference outputs', owner: 'AI Engineer', timeout: '1h' },
      { step: 4, action: 'Gradually restore traffic to the model provider (canary rollout)', owner: 'DevOps Engineer', timeout: '2h' },
      { step: 5, action: 'Update MODEL_TRUST_REGISTRY.md with verified sources', owner: 'AI Engineer', timeout: '1d' },
    ],
    postIncidentChecks: [
      { step: 1, action: 'Audit model download pipeline for supply chain vulnerabilities', owner: 'Security Lead', timeout: '1d' },
      { step: 2, action: 'Verify all model shards use HTTPS with certificate pinning', owner: 'DevOps Engineer', timeout: '1d' },
      { step: 3, action: 'Confirm fallback provider is healthy and latency is acceptable', owner: 'AI Engineer', timeout: '1h' },
      { step: 4, action: 'Document the root cause and update the model supply chain SOP', owner: 'AI Engineer', timeout: '2d' },
    ],
  },
  {
    id: 'SYNC_CORRUPTION',
    title: 'Sync Corruption',
    severity: 'critical',
    detectionCriteria: [
      'Oplog hash chain verification fails',
      'Sync conflict rate exceeds normal baseline (>5% of operations)',
      'Workspace state diverges between devices after sync',
      'IndexedDB corruption detected on app startup',
      'Merge tool reports unresolvable conflicts in >10% of documents',
    ],
    immediateActions: [
      { step: 1, action: 'Disable write operations to the corrupted workspace', owner: 'Backend Engineer', timeout: '5m' },
      { step: 2, action: 'Isolate the affected device from peer sync (pause push/pull)', owner: 'Backend Engineer', timeout: '10m' },
      { step: 3, action: 'Snapshot the current (corrupted) oplog for forensic analysis', owner: 'Backend Engineer', timeout: '15m' },
      { step: 4, action: 'Notify affected users that sync is paused and data is safe', owner: 'Product Manager', timeout: '15m' },
      { step: 5, action: 'Alert on-call SRE and sync team lead', owner: 'Engineering Manager', timeout: '5m' },
    ],
    recoverySteps: [
      { step: 1, action: 'Identify last known-good oplog checkpoint via hash chain', owner: 'Backend Engineer', timeout: '30m' },
      { step: 2, action: 'Rebuild workspace state from the last good checkpoint', owner: 'Backend Engineer', timeout: '1h' },
      { step: 3, action: 'Replay verified operations from peers since the checkpoint', owner: 'Backend Engineer', timeout: '1h' },
      { step: 4, action: 'Run full convergence test: two replicas must produce identical state', owner: 'QA Engineer', timeout: '30m' },
      { step: 5, action: 'Re-enable sync and monitor for recurrence for 24 hours', owner: 'Backend Engineer', timeout: '5m' },
    ],
    postIncidentChecks: [
      { step: 1, action: 'Verify all devices have converged to the same state', owner: 'Backend Engineer', timeout: '1h' },
      { step: 2, action: 'Audit oplog compaction process for corruption sources', owner: 'Backend Engineer', timeout: '1d' },
      { step: 3, action: 'Increase oplog hash verification frequency in sync protocol', owner: 'Backend Engineer', timeout: '1d' },
      { step: 4, action: 'Add automated sync integrity check to CI/CD pipeline', owner: 'QA Engineer', timeout: '2d' },
      { step: 5, action: 'Schedule blameless post-incident review', owner: 'Engineering Manager', timeout: '48h' },
    ],
  },
  {
    id: 'EDGE_DEPLOYMENT_ROLLBACK',
    title: 'Edge Deployment Rollback',
    severity: 'high',
    detectionCriteria: [
      'Error rate on edge workers exceeds 5% for more than 2 minutes',
      'Edge function cold-start time regresses by >200%',
      'Customer-facing features on edge are broken after deployment',
      'Health check endpoints return non-200 from edge nodes',
      'CDN cache hit rate drops by >50% after deployment',
    ],
    immediateActions: [
      { step: 1, action: 'Flag the current edge deployment as failing and stop new traffic routing', owner: 'DevOps Engineer', timeout: '5m' },
      { step: 2, action: 'Revert edge worker to previous known-good version', owner: 'DevOps Engineer', timeout: '10m' },
      { step: 3, action: 'Verify health endpoints return 200 on reverted version', owner: 'Backend Engineer', timeout: '5m' },
      { step: 4, action: 'Restore traffic routing to the reverted version', owner: 'DevOps Engineer', timeout: '5m' },
      { step: 5, action: 'Notify affected users and status page', owner: 'Product Manager', timeout: '15m' },
    ],
    recoverySteps: [
      { step: 1, action: 'Investigate deployment artifact and compare with known-good version', owner: 'Backend Engineer', timeout: '1h' },
      { step: 2, action: 'Identify the specific change that caused the regression', owner: 'Backend Engineer', timeout: '2h' },
      { step: 3, action: 'Fix the regression in a feature branch with enhanced tests', owner: 'Backend Engineer', timeout: '1d' },
      { step: 4, action: 'Deploy fix to staging and run full edge contract test suite', owner: 'QA Engineer', timeout: '1h' },
      { step: 5, action: 'Re-deploy to edge with canary rollout (5% → 25% → 100%)', owner: 'DevOps Engineer', timeout: '2h' },
    ],
    postIncidentChecks: [
      { step: 1, action: 'Verify error rates have returned to baseline on all edge nodes', owner: 'DevOps Engineer', timeout: '30m' },
      { step: 2, action: 'Confirm all edge contracts still pass after rollback', owner: 'QA Engineer', timeout: '30m' },
      { step: 3, action: 'Implement automated edge contract validation in deployment pipeline', owner: 'DevOps Engineer', timeout: '1d' },
      { step: 4, action: 'Add rollback automation (one-command revert) to deployment tooling', owner: 'DevOps Engineer', timeout: '1d' },
      { step: 5, action: 'Schedule blameless post-incident review within 48 hours', owner: 'Engineering Manager', timeout: '48h' },
    ],
  },
];

export function getRunbookById(id: string): IncidentRunbook | undefined {
  return INCIDENT_RUNBOOKS.find((rb) => rb.id === id);
}
