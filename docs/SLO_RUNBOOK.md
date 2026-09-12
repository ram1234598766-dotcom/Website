# VantaOS SLO Runbook

> Phase 8 — Production operations  
> Last updated: 2026-09-11

---

## 1. Service-Level Objectives (SLOs)

| SLO | Target | Measurement window |
|-----|--------|--------------------|
| **Availability** | ≥ 99.9% uptime | 30-day rolling |
| **Latency (p95)** | < 500 ms for `/api/health`, < 2 s for AI first-token | 5-minute rolling |
| **Error rate** | < 0.1% of requests return 5xx | 1-hour rolling |

### SLO budget

At 99.9% availability, a 30-day month allows a maximum of **43.2 minutes** of
downtime before the budget is exhausted. Error-rate SLO allows **0.1 errors per
1,000 requests**.

---

## 2. Alert Conditions

### 2.1 Page (PagerDuty / Opsgenie / equivalent)

| Condition | Threshold | Escalation |
|-----------|-----------|------------|
| Site down | 3 consecutive 5xx or health check failures over 60 s | Page on-call |
| Error rate spike | > 1% 5xx over 5 min | Page on-call |
| AI provider down | All providers return errors for > 2 min | Page on-call |
| Worker proxy down | `/api/gh/import` returns 5xx for > 5 min | Page on-call |
| SLO budget burn > 50% in < 6 h | Page on-call |

### 2.2 Warn (Slack / email)

| Condition | Threshold | Escalation |
|-----------|-----------|------------|
| Latency p95 > 500 ms | 2 consecutive 5-min windows | Notify #vantaos-ops |
| Latency p95 > 2 s (AI) | 1 consecutive 5-min window | Notify #vantaos-ops |
| Error rate > 0.05% | 2 consecutive 1-h windows | Notify #vantaos-ops |
| CDN cache-hit ratio < 90% | 1-hour window | Notify #vantaos-ops |
| Worker KV latency > 100 ms p95 | 5-min window | Notify #vantaos-ops |
| Firestore error rate > 0.5% | 5-min window | Notify #vantaos-ops |

### 2.3 Info (log only)

| Condition |
|-----------|
| Deploy completed |
| Dependency audit completed with no high/critical findings |
| SLO budget reset (daily) |

---

## 3. Incident Response Checklist

Use this checklist for any P1/P2 incident. Assign an **Incident Commander (IC)**
at the start.

### T+0 min — Declare and notify
- [ ] Declare incident severity (P1/P2/P3) in #vantaos-ops
- [ ] Assign Incident Commander and Scribe
- [ ] Create incident thread with timestamp and initial symptom

### T+5 min — Assess scope
- [ ] Check `/api/health` — is it reachable? What does `status` say?
- [ ] Check Cloudflare / deployment dashboard for edge issues
- [ ] Check Worker logs (`wrangler tail`) for recent errors
- [ ] Check Firestore usage and error rates in GCP Console
- [ ] Determine blast radius: all users / region / feature

### T+15 min — Mitigate or escalate
- [ ] If deployment caused it → roll back (see §5)
- [ ] If provider is down → enable fallback (e.g., local AI / demo mode)
- [ ] If data corruption suspected → enable read-only mode and stop writes
- [ ] Post status update to #vantaos-ops every 15 min

### T+30 min — Root cause and fix
- [ ] Identify root cause from logs, traces, and metrics
- [ ] Implement minimal fix — avoid scope creep during incident
- [ ] Verify fix in staging before pushing to production

### T+60 min — Recover and verify
- [ ] Confirm SLOs restored (health check green, error rate normal)
- [ ] Run `npm test -- --run` to confirm no regressions
- [ ] Verify user-facing flows (sign-in, save, sync) manually or via E2E

### T+24 h — Postmortem
- [ ] Schedule postmortem within 24 h of resolution
- [ ] Document timeline, root cause, remediation, and follow-up actions
- [ ] Update runbook with new alert if this incident was undetected

---

## 4. Rollback Procedures

### 4.1 Static-site rollback (Cloudflare Pages)

```bash
# List recent deployments
wrangler pages deployment list

# Roll back to the previous deployment (alias: production)
wrangler pages deployment alias set <PREVIOUS_DEPLOYMENT_ID> production
```

Verify:
```bash
curl -s https://vantaos.dev/api/health
# Expected: {"status":"ok", ...}
```

### 4.2 Worker rollback (Cloudflare Workers)

```bash
# List recent Worker versions
wrangler versions list

# Roll back to a previous version
wrangler versions deploy --version <VERSION_ID>
```

Verify:
```bash
curl -s https://vantaos.dev/api/health
```

### 4.3 Firestore rules rollback

```bash
# Firestore rules are in firestore.rules — roll back via the Firebase CLI
firebase deploy --only firestore:rules --force

# Or roll back a specific release via the Firebase Console:
# Firestore → Rules → Release history → Rollback
```

### 4.4 Dependency regression

```bash
# Identify the breaking change
git log --oneline -10

# Revert the lockfile change and the offending commit
git revert <SHA>
npm ci
npm run build
npm test -- --run
git push
```

---

## 5. Monitoring Sources

| Signal | Source | Dashboard |
|--------|--------|-----------|
| Uptime / HTTP status | Cloudflare Analytics / UptimeRobot | — |
| Worker errors / latency | `wrangler tail` + Cloudflare Analytics | Cloudflare Dashboard |
| Firestore errors | GCP Console → Firestore → Metrics | GCP Console |
| Build / deploy status | GitHub Actions | `.github/workflows/ci.yml` |
| Test coverage | Vitest `--coverage` output | CI artifacts |
| Client-side errors | Optional: Sentry / LogRocket (not yet wired) | — |

---

## 6. On-Call Rotation

See `CONTRIBUTING.md` for escalation paths. At minimum, the repository
maintainer should be reachable via GitHub Issues or the contact listed in
`SECURITY.md`.

---

## 7. Emergency Contacts

| Role | Contact |
|------|---------|
| Incident Commander | GitHub repo maintainer |
| Security issues | See `SECURITY.md` |
| Infrastructure | Cloudflare account owner |
| Firebase / GCP | Project owner with `website-6e8b1` access |
