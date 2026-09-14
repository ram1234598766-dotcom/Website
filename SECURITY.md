# Security Policy

This policy applies to the current deploy of **VantaOS** — a Next.js 15
static export served from a Cloudflare Worker (`https://website.vasudevaya.workers.dev`,
build `f7532256`) backed by Firebase **Realtime Database (RTDB)** for its
data tier. Status: actively maintained; last audited September 2026. This is
a single-maintainer / small-team project, so expectations are calibrated
accordingly: acknowledge within 72 hours, coordinated disclosure, no bounty.

## Supported versions

Security fixes are applied to the latest commit on `main`. There are no
backport or release streams, so the supported version is always the current
`main` plus the latest deploy. If you run your own deployment, track `main`.

## Reporting a vulnerability

If you find a security vulnerability, report it **privately** through the
[GitHub Security Advisories](https://github.com/ram1234598766-dotcom/Website/security/advisories/new)
flow ("Report a vulnerability") rather than opening a public issue.

Please include:

- The affected product, version, and component (page, endpoint, service, or
  module).
- A minimal, step-by-step reproduction of the issue.
- The impact — what an attacker can actually do, and under what conditions
  (e.g. authenticated vs. demo mode, prod vs. local).
- A suggested fix, if you have one.

You should not need to disclose the vulnerability publicly before a
maintainer has had a chance to respond (target: first response within 72
hours). Disclosure is expected to be coordinated and private until a fix is
shipped. There is no bug-bounty program.

**Out of scope:**

- Issues that only affect **demo mode** (an in-browser-only identity) and
  cannot reach the authenticated production tier or RTDB.
- Upstream vulnerabilities in third-party dependencies — report those to the
  dependency's maintainers; we track our own dependency risk below.
- Social engineering, phishing, or attacks against the maintainer's
  personal accounts.
- Brute-forcing Google sign-in: authentication is delegated to
  Firebase/Google.
- Data risk inherent to running untrusted code in the browser sandbox (the
  sandbox is documented as an isolated Web Worker, not a hardened VM).

## What we take seriously

Prioritised threat model. For each item: what a realistic attacker could
do, the current mitigation, and its honest status.

1. **Authorization (top priority) — RTDB rules.** The app is a static
   client that talks to Firebase RTDB directly, so `database.rules.json` is
   the *only* server-side enforcement layer. Paths of record:
   `profiles/{uid}`, `threads/{id}`, `replies/{id}`,
   `upvotes/{uid}_{tid}_{rid}`; rules deploy via `firebase deploy --only
   database`. *Attacker:* with too-permissive rules, read or write other
   users' profiles, forge replies, or tamper with upvotes. *Mitigation:*
   every rule change is reviewed against the documented access model before
   deploy; the file is treated as the enforcement boundary. *Status:*
   rules-dependent — a misconfiguration here is the single highest-impact
   risk in the system and the first thing we check on any report.

2. **Cross-origin / data isolation.** *Attacker:* exfiltrate RTDB data or a
   token past its intended origin, or have a malicious page read VantaOS
   data. *Mitigation:* Firebase auth scopes data per-UID via RTDB rules; the
   GitHub OAuth flow is proxied through the Cloudflare Worker (`/api/gh/*`)
   so tokens never appear in the client bundle; the Workers proxy is
   presence-guarded by env secrets and a `GH_TOKENS` KV. *Status:*
   mitigated as designed; reviewed whenever the proxy or rules change.

3. **Injection & XSS.** *Attacker:* store a payload in forum/reply content
   or run malicious code in the edit/exec sandbox. *Mitigation:* all user
   HTML is sanitized with DOMPurify before rendering, and React's default
   escaping applies where sanitization is not used. The terminal runs user
   code in a Web Worker via `new Function` with no filesystem or network
   access by design. *Status:* mitigated, but sanitization is only as strong
   as the current DOMPurify version and its configuration — keep both
   current.

4. **Authentication & session handling.** *Attacker:* impersonate an
   identity or reuse a stale session. *Mitigation:* Google sign-in via
   Firebase auth (project `website-6e8b1`). When `NEXT_PUBLIC_FIREBASE_*`
   vars are absent, `src/lib/env.ts` (`isFirebaseConfigured`, four vars)
   falls back to **demo mode**; the demo identity lives only in the browser
   (`src/lib/demoAuth.ts`) and is not a real auth layer — it grants no RTDB
   access. *Status:* partially mitigated — demo mode must never be deployed
   where real data is served; treat its presence in a prod bundle as a
   configuration error.

5. **Rate limiting.** *Attacker:* spam or exhaust the AI proxy. *Mitigation:*
   the Worker rate-limits `/api/ai/generate` to 100 requests per 60 seconds.
   *Status:* worker-only — the static export and other endpoints have no
   per-user limits, which is acceptable for read-only surfaces but worth
   re-checking if any new expensive endpoint appears.

6. **Secret handling.** *Attacker:* extract a key from bundle, logs, or
   source to burn AI quota or abuse the GitHub proxy. *Mitigation:*
   `GEMINI_API_KEY` gates `/api/ai/generate` and is env-only, never logged or
   printed. GitHub proxy secrets (`GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`, `GH_GRANT_SECRET`) plus the `GH_TOKENS` KV guard
   `/api/gh/*` and are **not enabled in production** (secrets unset; the
   feature is off by default). Keys are never bundled client-side for the
   proxy flow. Client-side telemetry (`@sentry/react`, LogRocket) receives
   event/error data, not RTDB contents or tokens. *Status:* mitigated;
   revisit before ever enabling the GitHub flow in production.

7. **Supply chain.** *Attacker:* a compromised dependency injected into a
   build or deploy. *Mitigation:* reproducible installs via `npm ci` and the
   committed lockfile; CI gates run lint (`tsc --noEmit`), test (Vitest,
   1032/1032 across 64 files), build, and e2e (8 Playwright cases across 6
   files) on every push/PR. *Status:* known gap — there is **no automated
   `npm audit` job in CI**; it is run manually as `npm audit
   --audit-level=moderate`. As of 2026-09-13 there are **4 high-severity
   advisories pending**. Automating dependency audit/pinning in CI is the
   top open hardening item.

## Security-related configuration checklist

| Item | What to check | Recommended state |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (RTDB) | All four vars must be set in `src/lib/env.ts` before Firebase is used; otherwise demo mode activates. | Set all four, including the RTDB URL; no prod deploy runs in `DEMO_MODE`. Note: `src/lib/firestore.ts` is the legacy-named RTDB data-tier module. |
| `database.rules.json` | Review every path: `profiles/{uid}`, `threads/{id}`, `replies/{id}`, `upvotes/{uid}_{tid}_{rid}`. | Match the documented access model; validate via `firebase deploy --only database` against a staging project before prod. |
| `GH_*` proxy secrets | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GH_GRANT_SECRET`, `GH_TOKENS` KV. | Off by default; only set if enabling GitHub repo import/push. Tokens never in the client bundle. |
| `GEMINI_API_KEY` | `/api/ai/generate` in `workers/worker.ts`. | Env-only; never logged or printed. |
| DOMPurify | All user HTML sanitized before render. | Keep DOMPurify current; never bypass for user content. |
| Worker rate limit | `/api/ai/generate`. | 100 req/60s; raise only behind separate auth. |
| `npm audit` | Run `npm audit --audit-level=moderate` manually. | Run before every deploy; track the 4 high-severity advisories (Sep 2026); plan to automate in CI. |

## Incident response

For the operational runbook — detection, escalation, rollback of Workers /
RTDB rules, and post-incident review — see `docs/SLO_RUNBOOK.md`. Report
security issues only through the channel above (72-hour acknowledgement,
coordinated disclosure, no bounty).

## Maintainers

This file is maintained by the repository owner. Keep disclosure channels
private and escalate through GitHub's security-advisory flow.