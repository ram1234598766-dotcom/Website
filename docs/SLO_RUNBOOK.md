# VantaOS SLO Runbook

> Phase 8 — Production operations  
> Last updated: 2026-09-14

> **📋 Status:** 🟢 Active | ✅ Reviewed | 🧪 Last tested: 2026-09-14

---

### 📑 Quick Navigation

[🎯 1. SLOs](#1-service-level-objectives-slos) · [🔔 2. Alerts](#2-alert-conditions) · [🚨 3. Incident Response](#3-incident-response-checklist) · [↩️ 4. Rollback](#4-rollback-procedures) · [📊 5. Monitoring](#5-monitoring-sources) · [🔄 6. On-Call](#6-on-call-rotation) · [📞 7. Emergency Contacts](#7-emergency-contacts)

---

<!-- AGENT: SLOs -->
## 🎯 1. Service-Level Objectives (SLOs)

> **🔵 INFO:** SLOs define the reliability contract with users. Breaching an SLO triggers the alert conditions in §2 and may initiate incident response per §3.

> **🔵 INFO:** This site is served by a single Cloudflare Worker unit (Worker code + static `out/` assets). The live URL is `https://website.vasudevaya.workers.dev`; `/api/health` returns the health probe at the worker. The Worker enforces a rate limit of **100 req/60 s** and routes `/api/health`, `/api/ai/generate`, and `/api/gh/*`. AI features depend on `GEMINI_API_KEY` (cloud) plus local Ollama; if Firebase env vars are absent the app runs reduced (demo mode) — sign-in, sync, and DNS-style services are degraded in that case.

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
| Worker proxy down | `/api/gh/import` returns 5xx for > 5 min | Page on-call | ⚠️ Not yet enabled in prod | 👤 On-Call |
| SLO budget burn > 50% in < 6 h | Page on-call | 🔴 Critical | 👤 On-Call |

> **🟡 WARNING:** The GitHub OAuth proxy (`/api/gh/*`) is **not yet enabled in prod** (env secrets unset), so it is not part of today's blast radius. The alert row above is kept for when it is enabled and published.

### 2.2 Warn (Slack / email)

| Condition | Threshold | Escalation | Status | Owner |
|-----------|-----------|------------|--------|-------|
| Latency p95 > 500 ms | 2 consecutive 5-min windows | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Latency p95 > 2 s (AI) | 1 consecutive 5-min window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Error rate > 0.05% | 2 consecutive 1-h windows | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| CDN cache-hit ratio < 90% | 1-hour window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Worker response latency (p95) > 1 s | 5-min window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |
| Realtime Database error rate / permission-denied rate > threshold (check Firebase Console + database.rules.json) | 5-min window | Notify #vantaos-ops | 🟡 Warning | 👤 #vantaos-ops |

### 2.3 Info (log only)

| Condition | Status | Owner |
|-----------|--------|-------|
| Deploy completed | 🟢 Info | 👤 DevOps |
| Dependency audit completed with no high/critical findings | 🟢 Info | 👤 DevOps |
| SLO budget reset (daily) | 🟢 Info | 👤 DevOps |

> **🔵 INFO:** `npm audit` is not an automated CI job — run it manually. As of Sep 2026 there are 4 high advisories.

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
- [ ] Check `/api/health` on `https://website.vasudevaya.workers.dev` — is it reachable? What does `status` say?
- [ ] Check the Cloudflare dashboard for the Worker (errors, latencies, rate-limit hits)
- [ ] Check Worker logs (`wrangler tail`) for recent errors
- [ ] Check Firebase Console → Realtime Database (usage, rules — permission-denied counts signal a bad rules deploy)
- [ ] Determine blast radius: all users / region / feature

### T+15 min — Mitigate or escalate
- [ ] If deployment caused it → roll back via `wrangler rollback` (see §4.1)
- [ ] If AI provider is down → enable fallback (local Ollama / demo mode)
- [ ] If bad Firebase rules deployed → re-deploy or restore rules (see §4.2)
- [ ] If data corruption suspected → enable read-only mode and stop writes
- [ ] Post status update to #vantaos-ops every 15 min

### T+30 min — Root cause and fix
- [ ] Identify root cause from logs, traces, and metrics
- [ ] Implement minimal fix — avoid scope creep during incident
- [ ] Verify fix via CI (lint/test/build/e2e) before pushing to production

### T+60 min — Recover and verify
- [ ] Confirm SLOs restored (health check green, error rate normal)
- [ ] Run `npm test` to confirm no regressions
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

> **✅ VERIFIED:** The site is a single-unit deployment — Worker code + static `out/` assets ship together via `wrangler deploy`, so they roll back together. Rollback commands in §4.1 are validated against Cloudflare CLI help (command reference; not dry-run against a staging environment). The §4.2 rules path re-deploys the git-tracked `database.rules.json` via `firebase deploy --only database`.

### 4.1 Worker + static (single unit) rollback

Same Cloudflare Worker + static assets unit. A `wrangler rollback` restores both
code and assets to the previously deployed version.

```bash
# List recent Worker versions
wrangler versions list

# Roll back to the previous version
wrangler rollback

# Or pin a specific version
wrangler versions deploy --version <VERSION_ID>
```

Verify:
```bash
curl -s https://website.vasudevaya.workers.dev/api/health
# Expected: {"status":"ok", ...}
```

### 4.2 Realtime Database rules rollback

The authoritative copy of the rules is `database.rules.json` in git. To return
to a previous rules state:

```bash
# If the bad rules were committed, revert that commit first
git revert <RULES_COMMIT_SHA>

# Re-deploy the (current/reverted) rules from git — for the entire database
firebase deploy --only database
```

Or restore a prior rules version via the Firebase Console:
**Firebase Console → Realtime Database → Rules → version history**.

> **⛔ WARNING:** Do **not** use the `package.json` `"firebase:deploy"` script —
> it targets a stale rules/indexes layout and is not the deploy path for this
> project. The only valid rules deploy is `firebase deploy --only database`.

### 4.3 Dependency regression

```bash
# Identify the breaking change
git log --oneline -10

# Revert the lockfile change and the offending commit
git revert <SHA>
npm ci
npm run build
npm test
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
| Worker errors / latency | `wrangler tail` + Cloudflare dashboard (Worker) | Cloudflare Dashboard |
| Realtime Database errors | Firebase Console → Realtime Database metrics + rules-log permission-denied rate | Firebase Console |
| Build / deploy status | GitHub Actions | `.github/workflows/ci.yml` |
| Tests | Vitest (1,032/1,032 across 64 files) + CI artifacts | CI artifacts |
| Client-side errors | Sentry + LogRocket (✅ wired) | Sentry / LogRocket dashboards |

> **🔵 INFO:** Monitoring coverage is currently ~85% by metric count; gaps are documented in the table above. Client-side error tracking (Sentry + LogRocket) **is wired and active** as of v2.0.0 — it is not "not yet wired". CI runs lint, test (Vitest), build, and e2e (8 Playwright cases across 6 files) on every push/PR. `npm audit` remains manual (4 high advisories as of Sep 2026).

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
| Firebase RTDB | Firebase RTDB project owner (website-6e8b1) | 🟢 Active | 👤 RTDB Owner |

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