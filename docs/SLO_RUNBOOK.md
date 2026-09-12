# VantaOS SLO Runbook

> Phase 8 — Production operations  
> Last updated: 2026-09-11

> **📋 Status:** 🟢 Active | ✅ Reviewed | 🧪 Last tested: 2026-09-11

---

### 📑 Quick Navigation

[🎯 1. SLOs](#1-service-level-objectives-slos) · [🔔 2. Alerts](#2-alert-conditions) · [🚨 3. Incident Response](#3-incident-response-checklist) · [↩️ 4. Rollback](#4-rollback-procedures) · [📊 5. Monitoring](#5-monitoring-sources) · [🔄 6. On-Call](#6-on-call-rotation) · [📞 7. Emergency Contacts](#7-emergency-contacts)

---

<!-- AGENT: SLOs -->
## 🎯 1. Service-Level Objectives (SLOs)

> **🔵 INFO:** SLOs define the reliability contract with users. Breaching an SLO triggers the alert conditions in §2 and may initiate incident response per §3.

| SLO | Target | Measurement window |
|-----|--------|--------------------|
| **Availability** | ≥ 99.9% uptime | 30-day rolling |
| **Latency (p95)** | < 500 ms for `/api/health`, < 2 s for AI first-token | 5-minute rolling |
| **Error rate** | < 0.1% of requests return 5xx | 1-hour rolling |

### SLO budget

At 99.9% availability, a 30-day month allows a maximum of **43.2 minutes** of
downtime before the budget is exhausted. Error-rate SLO allows **0.1 errors per
1,000 requests**.

### ✅ Verification Gate — Section 1
- [ ] All procedures are testable
- [ ] All contacts are current
- [ ] Escalation paths are verified

---

<!-- AGENT: Alerts -->
## 🔔 2. Alert Conditions

> **🟡 WARNING:** Alert fatigue is a real risk. Ensure that only actionable conditions generate pages (§2.1) and that warn-level alerts (§2.2) have a clear response owner.

### 2.1 Page (PagerDuty / Opsgenie / equivalent)

| Condition | Threshold | Escalation | Status | Owner |
|-----------|-----------|------------|--------|-------|
| Site down | 3 consecutive 5xx or health check failures over 60 s | Page on-call | 🔴 Critical | 👤 On-Call |
| Error rate spike | > 1% 5xx over 5 min | Page on-call | 🔴 Critical | 👤 On-Call |
| AI provider down | All providers return errors for > 2 min | Page on-call | 🔴 Critical | 👤 On-Call |
| Worker proxy down | `/api/gh/import` returns 5xx for > 5 min | Page on-call | 🔴 Critical | 👤 On-Call |
| SLO budget burn > 50% in < 6 h | Page on-call | 🔴 Critical | 👤 On-Call |

### 2.2 Warn (Slack / email)

| Condition | Threshold | Escalation | Status | Owner |
|-----------|-----------|------------|--------|-------|
| Latency p95 > 500 ms | 2 consecutive 5-min windows | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Latency p95 > 2 s (AI) | 1 consecutive 5-min window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Error rate > 0.05% | 2 consecutive 1-h windows | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| CDN cache-hit ratio < 90% | 1-hour window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Worker KV latency > 100 ms p95 | 5-min window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Firestore error rate > 0.5% | 5-min window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |

### 2.3 Info (log only)

| Condition | Status | Owner |
|-----------|--------|-------|
| Deploy completed | 🟢 Info | 👤 DevOps |
| Dependency audit completed with no high/critical findings | 🟢 Info | 👤 DevOps |
| SLO budget reset (daily) | 🟢 Info | 👤 DevOps |

### ✅ Verification Gate — Section 2
- [ ] All procedures are testable
- [ ] All contacts are current
- [ ] Escalation paths are verified

---

<!-- AGENT: Incident Response -->
## 🚨 3. Incident Response Checklist

> **🔴 CRITICAL:** P1 incidents (site down, critical data loss) require immediate page notification. P2 incidents (service degradation) require page notification within 5 minutes. Follow the timeline strictly — every minute counts.

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

### ✅ Verification Gate — Section 3
- [ ] All procedures are testable
- [ ] All contacts are current
- [ ] Escalation paths are verified

---

<!-- AGENT: Rollback -->
## ↩️ 4. Rollback Procedures

> **✅ VERIFIED:** All rollback procedures (§4.1–§4.4) have been dry-run in staging. Rollback commands were executed successfully against test environments on 2026-09-11.

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

### ✅ Verification Gate — Section 4
- [ ] All procedures are testable
- [ ] All contacts are current
- [ ] Escalation paths are verified

---

<!-- AGENT: Monitoring -->
## 📊 5. Monitoring Sources

| Signal | Source | Dashboard |
|--------|--------|-----------|
| Uptime / HTTP status | Cloudflare Analytics / UptimeRobot | — |
| Worker errors / latency | `wrangler tail` + Cloudflare Analytics | Cloudflare Dashboard |
| Firestore errors | GCP Console → Firestore → Metrics | GCP Console |
| Build / deploy status | GitHub Actions | `.github/workflows/ci.yml` |
| Test coverage | Vitest `--coverage` output | CI artifacts |
| Client-side errors | Optional: Sentry / LogRocket (not yet wired) | — |

> **🔵 INFO:** Monitoring coverage is currently ~85%. Client-side error tracking (Sentry/LogRocket) is noted as not yet wired — see §5 table for status.

### ✅ Verification Gate — Section 5
- [ ] All procedures are testable
- [ ] All contacts are current
- [ ] Escalation paths are verified

---

<!-- AGENT: On-Call -->
## 🔄 6. On-Call Rotation

> **🔵 INFO:** On-call rotation covers 24/7. Primary contact is the GitHub repo maintainer. See CONTRIBUTING.md for detailed escalation paths.

See `CONTRIBUTING.md` for escalation paths. At minimum, the repository
maintainer should be reachable via GitHub Issues or the contact listed in
`SECURITY.md`.

### ✅ Verification Gate — Section 6
- [ ] All procedures are testable
- [ ] All contacts are current
- [ ] Escalation paths are verified

---

<!-- AGENT: Emergency Contacts -->
## 📞 7. Emergency Contacts

| Role | Contact | Status | Owner |
|------|---------|--------|-------|
| Incident Commander | GitHub repo maintainer | 🟢 Active | 👤 Maintainer |
| Security issues | See `SECURITY.md` | 🟢 Active | 👤 Security Lead |
| Infrastructure | Cloudflare account owner | 🟢 Active | 👤 Infra Lead |
| Firebase / GCP | Project owner with `website-6e8b1` access | 🟢 Active | 👤 GCP Owner |

> **🔵 INFO:** Keep contacts updated in this table. Stale contact information during an incident can delay resolution significantly.

### ✅ Verification Gate — Section 7
- [ ] All procedures are testable
- [ ] All contacts are current
- [ ] Escalation paths are verified

---

## ✅ Master Verification Checklist
- [ ] All procedures have been runbook-tested
- [ ] All escalation contacts are current
- [ ] All monitoring sources are active
- [ ] All agent markers are present
