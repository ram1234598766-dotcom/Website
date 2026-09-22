# VantaOS — Agent Operating Brief

You are working on VantaOS, a browser-based cloud IDE. Read this entire file before running any command. It is the standing rulebook for every task in this repo.

## 1. What the product is
A browser workspace shipping: a file manager with tabs and split views, a CodeMirror 6 editor covering ~15 languages, a diff editor, an xterm.js terminal, an "Omni-AI" chat assistant (cloud providers + an in-browser WebModel), a WebModel manager, GitHub import/push, Google Drive sync, and a Firebase-backed forum with an admin panel.

## 2. Stack — verified from package.json, assume nothing beyond this
- Next.js ^15.1.0, React ^19.0.1, TypeScript ~5.8.2, Tailwind v4 (@tailwindcss/postcss)
- Deployed as one Cloudflare Worker.
    "build":     "next build && npx opennextjs-cloudflare build --skipNextBuild"
  "postbuild":  "node scripts/fix-cache.mjs"   (injects immutable Cache-Control on /_next/static/*)
  Worker entry: worker.ts (verified wrangler.toml `main`). Config: wrangler.toml.
- Editor: @codemirror/{state,view,language,commands,search,autocomplete,merge} 6.x +
  lang packs (cpp, css, go, html, java, javascript, json, markdown, php, python, rust,
  sql, xml, yaml) + @lezer/highlight.
- Terminal: @xterm/xterm ^6 + addons fit, search, web-links, webgl.
- In-browser AI: @huggingface/transformers ^4.2.0 (WebGPU/WASM).
- Animation: motion ^12.23.12 (import from "motion/react").
- Data: firebase ^12 (Realtime Database — NOT Firestore), idb-keyval ^6 for local files.
- Also present: react-virtuoso, dompurify, jszip, file-saver, diff, node-forge,
  date-fns, lucide-react, prettier, @sentry/react, logrocket.
- Dev/test: vitest ^5, @testing-library/react, @playwright/test, jsdom, fake-indexeddb,
  axe-core, @firebase/rules-unit-testing, wrangler ^4, @opennextjs/cloudflare.

## 3. Commands
  npm run dev          next dev
  npm run lint         tsc --noEmit        <- the type gate; there is no ESLint
  npm test             vitest run          <- baseline 1383 tests / 92 files, green (verified 2026-09-22)
  npm run build        next build + opennextjs-cloudflare build
  npm run cf-preview   npx wrangler dev
  npm run deploy       npx wrangler deploy  <- YOU MAY NEVER RUN THIS
  E2E                  npx playwright test --config=tests/e2e/playwright.config.ts
  CI (.github/workflows/ci.yml, Node 22): npm ci -> tsc --noEmit -> vitest run
  (excluding tests/e2e/**) -> next build -> Playwright -> npm audit --audit-level=high

## 4. Architecture facts
- Client -> Next build -> one Cloudflare Worker (worker.ts) that serves the
  bundle and proxies /api/health, /api/ai/generate, /api/gh/*, rate-limited 100 req/60s.
- Data tier is Firebase **Realtime Database**. Paths: profiles/{uid}, threads/{id},
  replies/{id}, upvotes/{uid}_{tid}_{rid}. Uses increment() and onValue streaming.
  Rules in database.rules.json, deployed via `firebase deploy --only database`.
- NAMING TRAP: the RTDB client lives in src/lib/firestore.ts and exposes a legacy alias
  isFirestoreAvailable(). There is no Firestore anywhere. Never "fix" this by migrating
  to Firestore. If you rename the module, update every import and both tsconfigs.
- Local editor files persist in IndexedDB via idb-keyval under `vantaos_cloudos_files_v2`.
- Terminal code runs in a sandboxed Web Worker (SandboxRunner, `new Function`), never on
  the page thread. Never move sandboxed execution to the main thread.
- Firebase project id: website-6e8b1. The Worker GitHub OAuth proxy (/api/gh/*) is
  presence-gated on GH_GRANT_SECRET and intentionally disabled in production.
- With no NEXT_PUBLIC_FIREBASE_* vars the app must still boot in demo mode with local
  accounts. Demo mode is the default first-run experience. Never break it.

## 5. Known documentation drift — resolve, do not silently pick a side
- README describes a "static export" served from out/; package.json builds through
  @opennextjs/cloudflare; the Playwright config reportedly serves out/. These cannot all
  be true. Establish what actually happens and make all four agree.
- README `firebase:deploy` claim (was stale) — fixed, script already points at
  `firebase deploy --only database`
- next.config.mjs says `output: 'standalone'` (NOT `output: 'export'`). The README says
  "static export". Playwright webServer uses `npx next build && npx next start -p 4173`.
  wrangler.toml builds via `npm run build` (which runs next build + opennextjs-cloudflare).
  Resolution needed: decide which story is true and make all four agree.

## 6. AUTONOMY CONTRACT — what you may do without asking

### You MAY, freely and without confirmation:
- Install, remove and upgrade npm packages, including transitive fixes.
- Run any npm script, any vitest/playwright invocation, any `npx` tool.
- Create files and directories, create branches, stage and commit.
- Run `npx wrangler dev`, `npx wrangler types`, `npx wrangler deploy --dry-run`,
  `npx wrangler d1 migrations apply --local`, `npx wrangler kv key list --local`.
- Run codemods, generators and formatters over files inside the current task scope.
- Spawn local servers, run Lighthouse, run load tests against localhost.
- Read any file in the repo.

### Always use non-interactive flags so nothing hangs waiting for input:
  npm install <pkg> --no-fund --no-audit
  npx --yes <tool>
  CI=1 npm test
  npx playwright install --with-deps chromium
  git commit -m "..."        (never open an editor)
  git -c core.pager=cat log  (never invoke a pager)
Set `export CI=1` at the start of the session. (On Windows PowerShell, use `$env:CI=1`.)

### You MAY NOT, ever, without my explicit go-ahead in that same message:
- `npx wrangler deploy` or `npm run deploy` (production deploy). Dry-run only.
- `firebase deploy` of any kind.
- `git push`, `git push --force`, `git rebase` onto a shared branch, or any history
  rewrite on main.
- Delete or modify .env, .env.local, or anything matching *.key / *.pem.
- Print, echo, log, or commit the value of any secret: GEMINI_API_KEY,
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GH_GRANT_SECRET, service-account JSON,
  or real NEXT_PUBLIC_FIREBASE_* values. Reference them by name only.
- Change account_id, routes, zone or custom domains in wrangler.toml.
- Major-version upgrade next, react, react-dom, tailwindcss, typescript or firebase.
- `npm audit fix --force`.
- Disable, skip or weaken a CI check, a test, or a type error. No `--no-verify`,
  no `.skip`, no `@ts-ignore`, no `any`, no non-null `!` used as a silencer.
- `rm -rf` anything outside this repo, or node_modules/.next/out inside it without
  saying so first.

### Install discipline — follow this every single time you add a package:
1. Check it is real and compatible before installing:
     npm info <pkg> version peerDependencies dependencies
   If a peer range conflicts with what is already installed (vitest ^5, react ^19,
   next ^15, typescript ~5.8), say so and pick a compatible version or an alternative.
   Never resolve a conflict with --force or --legacy-peer-deps without telling me.
2. Install with an exact-ish range and record the resolved version in the report.
3. Immediately run: npm run lint && CI=1 npm test && npm run build
4. Report the bundle delta: initial JS before vs after, in KB, per affected route.
5. If anything broke, roll back cleanly:
     git checkout -- package.json package-lock.json && npm ci
   and report what failed instead of patching around it.
6. Never add a package that duplicates something already in package.json. Check first.
   (You already have: prettier, diff, dompurify, jszip, date-fns, lucide-react,
   react-virtuoso, node-forge. Do not add lodash, moment, axios, or a second
   syntax highlighter.)

### Git discipline
- One branch per phase: `phase/<n>-<slug>`.
- Conventional commits, one logical change each: feat / fix / refactor / test / docs /
  chore, body explains why, not what.
- Commit before any risky or large change so there is always a checkpoint.
- Never batch unrelated fixes into one commit.
- Run the phase gate before the final commit of a phase, not after.

## 7. Engineering rules
1. Read before writing. Read every file you modify, in full. No blind edits.
2. Zero drive-by changes. If you notice an unrelated problem, put it in FINDINGS.
3. Fix types properly. `npm run lint` must exit 0 with no suppressions added.
4. Never delete or weaken a test to make it pass. If a test is genuinely wrong, explain
   why before touching it.
5. All user-sourced HTML stays sanitized with DOMPurify.
6. Validate every external input at the boundary — request bodies, URL params, postMessage
   payloads, IndexedDB reads, localStorage reads. Treat all of them as hostile.
7. Accessibility is a requirement: keyboard reachable, visible focus, correct ARIA,
   prefers-reduced-motion honoured.
8. Heavy modules (CodeMirror, xterm, transformers, jszip, firebase) stay dynamically
   imported and client-only. They must never land in the initial bundle or evaluate
   during SSR/prerender.
9. Backend: every handler validates auth before business logic, every response goes
   through the shared error envelope, every log line is structured and free of user
   content and secrets.
10. When you are uncertain between two designs, implement the smaller reversible one and
    put the alternative in FINDINGS. Do not build speculative abstraction.

## 8. Phase structure

### Phase 0 — Baseline (read-only)
Verify tooling and project health before any feature work.
```
npm run lint            # tsc --noEmit — must exit 0
CI=1 npm test           # vitest run — baseline 1383 tests / 92 files, green
npm run build           # next build + opennextjs-cloudflare — must succeed
npx wrangler deploy --dry-run   # deploy dry-run — must succeed
npm audit --audit-level=high    # 0 vulnerabilities
```
Gate beyond the baseline (Phase 0 deliverable): `npx playwright test --config=tests/e2e/playwright.config.ts`

### Phase 1 — Correctness & performance (homepage first)
Homepage must render static SSR HTML with no spinner gate. Lighthouse Performance 100/100. Verify `file:line` for every claim.
- `app/page.tsx` — static SSR hero, preview IDE, features, footer
- Motion tokens in `src/lib/motion/tokens.ts`
- Reduced-motion honoured in `app/globals.css`
- Lighthouse via `scripts/lighthouse-run.cjs` (port 3000, server running first)
- E2E home test in `tests/e2e/flows`

### Phase 2 — Security fixes
Firebase RTDB rules hardened, auth verified, secrets managed via wrangler secret (never committed). Verify each fix with a named test.
- `database.rules.json` — indexOn, validation, auth rules
- `verifyFirebaseIdToken` gated by `isFirebaseConfigured`
- No secrets in wrangler.toml [vars] — use `wrangler secret put`

### Phase 3 — Interface & beginner experience
One-command quickstart works. Plain-language README front door. `npm run setup` 3-step wizard. `.env.example` matches RTDB config.
- `make quickstart` — install, env, dev server start
- README plain-language section above architecture diagram
- `npm run setup` wizard with sensible defaults

### Phase 4 — Advanced capabilities (plugin API, transport, rate limiter)
Plugin system integration, real WebSocket/SSE transport replacing mock, Durable Object rate limiting (opt-in binding).
- `src/lib/plugins/` — PluginApiContext, createPluginApi, capability checks
- `src/lib/sync/transport.ts` — WebSocketSyncTransport (auto-reconnect, backoff)
- `src/lib/server/rate-limit.ts` + `rate-limit-durable.ts` — RateLimitDO (opt-in DO binding in wrangler.toml)
- All behind explicit opt-in; never change default behavior

### Phase 5 — Full graphical interface (optional, after Phase 2 fixes)
Web dashboard served at localhost:8080. Every screen backed by real API endpoints. No mocked or hardcoded data in UI.
- Dashboard — node identity, uptime, resource use
- Network/Peers — peer list + topology visualization
- Per-service panels — Files, Messaging, Email, Docs, Models, Security, Settings, Notifications
- All screens pass accessibility/responsiveness/theme quality bar

## 9. Definition of done for every phase
Gate (all must pass, paste real output):
  npm run lint
  CI=1 npm test
  npm run build
  npx playwright test --config=tests/e2e/playwright.config.ts
  npx wrangler deploy --dry-run
  npm audit --audit-level=high
Report, in this exact shape:
  SUMMARY    3-6 bullets: what changed and why
  FILES      every file touched, one line each
  PACKAGES   every package added/removed/upgraded, resolved version, KB delta
  COMMANDS   every command you ran and its result
  METRICS    before -> after for any number this phase was supposed to move
  RISKS      what could regress, and the exact rollback command
  FINDINGS   out-of-scope problems noticed but not touched
  BLOCKED    anything unfinished, stated plainly
Never describe intended behaviour as if you verified it. If you did not run it, write
"not verified". Partial completion reported honestly is always better than a confident false report.