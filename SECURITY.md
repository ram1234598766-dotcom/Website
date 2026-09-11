# Security Policy

## Reporting a vulnerability

This project is a client-heavy web application (VantaOS) with backend
Workers (GitHub and Firebase token-boundary proxies). If you find a security
vulnerability, please report it **privately** — report it through the
[GitHub Security Advisories](https://github.com/ram1234598766-dotcom/Website/security/advisories/new)
flow ("Report a vulnerability") rather than opening a public issue.

Please include:

- The affected version, page, endpoint, or service.
- A minimal, reproducible description of the issue.
- Proof of impact (what an attacker can actually do), if any.
- Suggested fix, if you have one.

You should not need to disclose the vulnerability anywhere public before a
maintainer has had a chance to respond. Reporting is done without any
financially motivated expectations; this project has no bug-bounty program.

## What we take seriously

- **Cross-origin data exposure**: any token, credential, or workspace data
  reaching a context it should not (GitHub OAuth token boundary,
  Drive tokens, Firebase ID tokens).
- **Injection paths**: the terminal `SandboxRunner` (worker-based `js`/
  `node`/`calc` execution), the CodeMirror editors, the forum and file
  rendering pipelines (HTML sanitization).
- **Auth/logic flaws**: session/ID-token verification (RS256), auth-rule
  semantics in `firestore.rules`, and any privilege escalation in the demo
  vs. production identity paths.
- **Supply chain**: build, deploy, and CI configuration.

## Supported versions

Security fixes are applied to the latest commit on `main`. There are no
backport/release streams, so the supported version is always the current
`main` + the latest deploy.

## Security FAQ

- **Where is user data stored?** In the browser it is browser-local
  (IndexedDB/`localStorage`); user-owned cloud data lives in the user's own
  Firebase/Drive/GitHub accounts. The GitHub Worker proxies token-boundary
  operations and holds grants in Cloudflare KV.
- **Credentials claims:** VantaOS does not claim end-to-end encryption of
  everything. Tokens are short-lived, browser tokens are memory-only, and the
  sandbox runs untrusted code in an isolated worker with wall-clock/output/
  size caps. Treat deployments as trustworthy-network deployments.

## Verification

- Regression tests: `npm test` (Vitest).
- Type/lint gate: `npm run lint` (`tsc --noEmit`).
- CI runs both plus `npm run build` on every push and PR.
- Reproducible installs use `npm ci` and the committed `package-lock.json`;
  review dependency changes for supply-chain risk in PRs.

## Maintainers

- This file is maintained by the repository owner. Keep disclosure channels
  private and escalate through GitHub's security-advisory flow.