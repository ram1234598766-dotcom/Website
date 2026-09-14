# Contributing to VantaOS

Thanks for contributing. VantaOS is a browser-based IDE/orchestration layer
with Firebase Realtime Database and GitHub integration. The site builds as a
static export (Next.js 15 App Router, `output: 'export'`) and is served by a
single Cloudflare Worker. This guide covers how to set up, run, and ship
changes — and the ground rules we review against.

## Ground rules

- **Security- and correctness-first.** The sandbox that executes terminal
  commands runs untrusted code; changes to `src/lib/terminal/runner.ts` or how
  tokens are handled require tests that prove the new behavior.
- **One logical change per PR**, with a Conventional Commits message:
  `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- **Never commit secrets or real credentials.** `.env*` files are
  git-ignored (`.env.example` is not). Tests must pass without live
  credentials — use fakes.
- **Never weaken a test** to make the suite pass. If a test encodes wrong
  behavior, change the expectation with an explicit comment or a separate
  PR and explain why.
- **Keep line length sane** (roughly 80 columns) and keep CI green on every
  push/PR.

## Prerequisites

- Node.js 22+ (LTS) and npm.
- A browser for the UI (Chrome or Firefox is fine).
- Optional, only for deploy-adjacent work: `wrangler login` (deploy) and the
  Firebase CLI (rules deploy and `firebase:setup`).

## Quickstart

```bash
git clone <repo-url>
cd Website
npm ci          # reproducible install
npm run dev     # start the Next.js dev server
```

Open `http://localhost:3000`. The app runs in **Firebase demo mode** with no
environment variables — forum, admin, drive, and GitHub features activate
only when `NEXT_PUBLIC_FIREBASE_*` (and optionally `GH_*` / `GEMINI_API_KEY`)
are set in `.env.local`. Nothing is available to break until you add keys.

## Development workflow

1. Create a branch off `main`: `git checkout -b fix/my-change`.
2. Write or update tests first for behavior changes (Vitest).
3. Implement, then run `npm run lint` and `npm test` until both pass.
4. Run `npm run build` if the change touches pages, data plumbing, or build
   config (the static export must still succeed).
5. For UI/E2E-relevant changes, build first and run Playwright (see below).
6. Open a PR. Reference the issue or roadmap item in the description.

### Commands

| Command              | What it does                                             |
|----------------------|----------------------------------------------------------|
| `npm run dev`        | Dev server (`next dev`)                                  |
| `npm run lint`       | Type-check gate (`tsc --noEmit`)                         |
| `npm test`           | Full Vitest suite (`vitest run`; excludes `tests/e2e/**`)|
| `npx playwright test --config=tests/e2e/playwright.config.ts` | E2E suite — requires `npm run build` first (webServer serves `out/`) |
| `npm run build`      | Static export build (`next build` → `out/`)              |
| `npm run start`      | Serve the static `out/` locally (`npx serve out`)        |
| `npm run deploy`     | Build + `npx wrangler deploy` (single Worker unit; rollback via `wrangler rollback`) |
| `npm run cf-preview` | Cloudflare Workers preview via `wrangler dev`            |
| `npm run firebase:setup` | One-time Firebase config bootstrap (bash script)    |

CI (`.github/workflows/ci.yml`) runs `lint`, `test`, `build`, and `e2e` jobs
on Node 22 with `npm ci`. `npm run lint` and `npm test` are the mandatory
pre-push gates.

### Test layout

- Vitest: 1047/1047 tests across 65 files (audited Sep 2026), including
  `tests/phase1`, `tests/phase2`, `tests/phase9`, `tests/phase-schema`
  (11 files), plus telemetry/Sentry/LogRocket audits and
  plugin/manifest/edge/operations coverage.
- Playwright E2E: 9 `test()` cases across 7 files in `tests/e2e/flows/` —
  auth (2), terminal (2), files, home, ide, omni-ai.
- Imports: use relative imports; the `@/*` alias is **not** mapped to `src`.

## Commit conventions

Follow Conventional Commits, one logical change per commit:

- `feat:` — new capability
- `fix:` — bug fix
- `refactor:` — behavior-preserving change
- `test:` — tests only
- `docs:` — documentation only
- `chore:` — tooling/housekeeping

## Pull request checklist

- [ ] `npm run lint` passes (`tsc --noEmit` clean)
- [ ] `npm test` passes (full Vitest suite green)
- [ ] Playwright E2E passes where the change touches UI/flow (build first)
- [ ] `npm run build` succeeds for changes touching pages/build config
- [ ] Docs updated — including `docs/ARCHITECTURE.md` §13 tracker and the
      README/docs status tables whenever behavior or status changes
- [ ] No secrets, tokens, or keys committed
- [ ] No `new Function`/`eval` reintroduced on the main thread

## Directory map

| Path                    | Purpose                                                        |
|-------------------------|----------------------------------------------------------------|
| `app/`                  | Next.js pages and layout (App Router, static export)           |
| `src/components`        | React components                                               |
| `src/lib`               | Data/plumbing: IndexedDB storage (`idb-keyval`), `firestore.ts` (legacy-named RTDB data tier), `env.ts`, `github.ts`, `drive.ts`, `terminal/runner.ts` (SandboxRunner), `workspace/` (opslog + export), `models/adapter.ts`, `telemetry/`, `schema/`, `demoAuth.ts`, `client.ts` |
| `workers/`              | `worker.ts` (the Cloudflare Worker that serves the static site) and `grants.ts` |
| `tests/` + `tests/e2e/flows/` | Unit/component tests and Playwright E2E flows      |
| `docs/`                 | Architecture, roadmap, and audit documentation                |

## Common pitfalls

- **The `firebase:deploy` script is stale** — it targets `firestore:rules`
  and `firestore:indexes`. The correct rules deploy is
  `firebase deploy --only database` (rule file: `database.rules.json`).
- **E2E requires a build first.** The Playwright webServer serves the static
  `out/` directory, so run `npm run build` before
  `npx playwright test --config=tests/e2e/playwright.config.ts`.
- **Auth is demo mode until env vars exist.** Identity and data-backed
  features stay in demo mode until `NEXT_PUBLIC_FIREBASE_*` (and the
  optional `GH_*` / `GEMINI_API_KEY`) are set.
- **Keep `file:line` references in docs audited and current.** Claims must
  match reality; `docs/TECH_STACK_AUDIT_REPORT.md` documents the last full
  audit (Sep 2026).
- **Dependencies are audited in CI.** The `audit` job runs
  `npm audit --audit-level=high` on every push/PR and fails the build on
  high/critical advisories; keep the lockfile in sync when touching deps.

## Where to get help

- Open questions and bugs: [GitHub Issues](../../issues).
- Security vulnerabilities: do **not** open a public issue — report via
  `SECURITY.md`.