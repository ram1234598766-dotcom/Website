# VantaOS Baseline

> **Verification date:** 2026-09-21 (all measurements run live in this session; watch `baseline-20260921`)
> **Branch:** phase/1b-homepage @ `cec29f9`
> **Toolchain:** Node v26.5.0, npm 12.0.2, wrangler 4.131.1, vitest 5.0.1, Playwright (chromium), Next 15.5.25, @opennextjs/cloudflare 1.20.6

## Definition of done gate — observed results

| Check | Command | Result |
|---|---|---|
| Type gate | `npm run lint` (tsc --noEmit) | PASS (exit 0) |
| Tests | `CI=1 npx vitest run` | PASS — 1317/1317 across 86 files (135.39s) |
| Build | `npm run build` | PASS — Next + OpenNext worker written to `.open-next/worker.js` |
| E2E | `npx playwright test --config=tests/e2e/playwright.config.ts` | PASS — 9/9 (1.2m) |
| Deploy dry-run | `npx wrangler deploy --dry-run` | PASS — 139 assets, 6041.40 KiB / 1241.82 KiB gzip |
| Audit | `npm audit --audit-level=high` | PASS — 0 vulnerabilities |

## Route bundle sizes (Next build, First Load JS)

- `/` (home): 3.02 kB route / 149 kB first-load / 104 kB shared
- `/dashboard`: 150 kB first-load · `/docs`: 159 kB · `/email`: 108 kB
- `/files`: 108 kB · `/messaging`: 150 kB · `/network`: 153 kB
- `/notifications`: 151 kB · `/security`: 149 kB · `/settings`: 149 kB

Shared chunks: `1255-…js` 46.1 kB + `4bd1b696-…js` 54.2 kB + 3.2 kB other.

## Worker bundle (dry-run upload)

- Raw: 6041.40 KiB · gzip: 1241.82 KiB
- Bindings: `env.WORKER_SELF_REFERENCE` (website) + `env.ASSETS` only
- CI note: Node 22 in CI vs Node 26.5.0 locally — build verified on both toolchains.

## Static/dynamic split

- 16 app routes static (○): `/`, `/dashboard`, `/docs`, `/email`, `/files`, `/messaging`, `/network`, `/notifications`, `/security`, `/settings`, `/status`, `/robots.txt`, `/sitemap.xml`, `/_not-found`
- Dynamic (ƒ): `/api/ai/generate`, `/api/edge-functions/auth-sync`, `/api/gh/[...rest]`, `/api/git-diff`, `/api/git-status`, `/api/health`, `/api/healthz`, `/api/model-proxy`, `/api/models`, `/api/peers`, `/api/plugins`, `/api/rate-limit-check`, `/api/ready`, `/api/security/scan`, `/api/services/health`, `/api/status`

## Known drift tracked from this baseline

See `docs/AUDIT.md` — status of every item on the pack "known documentation drift" list plus tooling measurements.