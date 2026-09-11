# Contributing to VantaOS

Thanks for contributing. VantaOS is a browser-based IDE/orchestration layer
with Firebase and GitHub integration. This guide covers how to set up, run,
and ship changes — and the ground rules we review against.

## Ground rules

- **Security- and correctness-first.** The sandbox that executes `js`/`node`/
  `calc` runs untrusted code; changes to `src/lib/terminal/runner.ts` or how
  tokens are handled require tests that prove the new behavior.
- **One logical change per PR**, with a Conventional Commits message:
  `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- **Never commit secrets or real credentials.** `.env*` files are
  git-ignored (`.env.example` is not). Tests must pass without live
  credentials — use fakes.
- **Never weaken a test** to make the suite pass. If a test encodes wrong
  behavior, change the expectation with an explicit comment or a separate
  PR and explain why.
- **Update docs** (`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`) when behavior
  changes; §13 tracks implemented-and-tested vs. untested.

## Set up

```bash
npm install        # or `npm ci` for a reproducible install
npm run dev        # start the Next.js dev server
```

Prerequisites: Node.js 22+ (LTS). Firefox/Chrome for the browser UI.

## Commands

| Command               | What it does                                  |
|----------------------|-----------------------------------------------|
| `npm test`           | Run the full Vitest suite (`tests/phase2`, `tests/phase5`, …) |
| `npm run lint`       | Type-check everything (`tsc --noEmit`)        |
| `npm run build`      | Static export build (`next build`)            |
| `npm run dev`        | Dev server                                    |
| `npm run cf-preview` | Cloudflare Workers preview via `wrangler dev` |
| `npm run deploy`     | Build + `wrangler deploy` (owner only)        |

Run `npm test` and `npm run lint` before pushing. CI runs
`npm ci && npm run lint && npm test && npm run build` on every push/PR.

## Making a change

1. Create a branch off `main`: `git checkout -b fix/my-change`.
2. Write or update tests first for behavior changes (Vitest).
3. Implement, then run `npm test` and `npm run lint` until both pass.
4. Check `npm run build` if the change touches pages or build config.
5. Open a PR. Reference the issue/roadmap item in the description.

## Test layout

- `tests/phase2/` — IDE reliability: terminal sandbox runner and shell wiring.
- `tests/phase5/` — identity/security: Firebase ID-token verification, HMAC
  grant lifecycle, GitHub OAuth token-boundary proxy, push-safety.
- Test and source importing: relative imports; the `@/*` alias is **not**
  mapped to `src`, so use `../lib/...`.

## Review checklist

- Tests added/updated for the change; suite green; `tsc --noEmit` clean.
- No credentials, tokens, or keys committed.
- No `new Function`/`eval` reintroduced on the main thread.
- Docs §13 evidence updated when status changes.

## Security

See `SECURITY.md` for reporting vulnerabilities. Do not open public issues
for security bugs.