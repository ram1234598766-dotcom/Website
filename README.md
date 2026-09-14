# VantaOS

**The intelligent developer cloud.** Write, build, and deploy full-stack applications entirely in the browser.

VantaOS (`vantaos` v2.0.0, private) is a Cloud OS web app: a browser-based workspace that ships with a file manager, a CodeMirror 6 editor spanning 15 languages, a diff editor, an xterm.js terminal, an Omni-AI chat assistant, Google Drive sync, GitHub import/push, and a Firebase forum with an admin panel. It's built as a static Next.js 15 export served by a single Cloudflare Worker, with Firebase Realtime Database as its data tier. It's for developers who want a zero-config cloud workspace that starts offline-friendly in demo mode and can also talk to on-device models on `localhost`.

---

## Features

### ☁️ Cloud OS workspace
File manager with tabs, split views, a CodeMirror 6 editor covering 15 languages, a diff editor, and ZIP export. Files persist in the browser via idb-keyval (IndexedDB database `vantaos_cloudos_files_v2`) — no server storage required.

### ⌨️ Built-in terminal
xterm.js terminal with a virtual file system and command history. Run inline JavaScript, browse and edit files, and test code as you write — all sandboxed in a Web Worker through `SandboxRunner` (`new Function`), so shell code never executes on the page thread.

### 🧠 Omni-AI assistant
Chat with cloud AI through the Worker's `/api/ai/generate` proxy, or stay fully local using models served by a local Ollama daemon (`localhost:11434`) and `@huggingface/transformers`. Live tool commands like `calc`, `js`, `weather`, and `fetch` are available; Omni-ai uses `dompurify` to sanitize all rendered HTML.

### 🤖 Local model hub
Browse real open-source models with their actual sizes, pull them into a local Ollama daemon, and run them in one command — no cloud account required.

### 🔗 GitHub synchronization
Import your repositories, edit files, and push back to the branch via blob/tree/commit/ref requests (with a 200-blob UI cap). GitHub sign-in is wired to the live Firebase project (`website-6e8b1`); the Worker-side GitHub OAuth proxy is opt-in and currently disabled in production.

### 💾 Google Drive
Connect Google Drive via Google (Firebase) sign-in, browse your files read-only, open any text document into the editor, and save work into a dedicated VantaOS folder the app owns — your own files are never overwritten.

### 🔐 Privacy
Keys live in environment variables and are never printed. HTML is sanitized with DOMPurify. The Worker proxy is rate-limited, and when no `NEXT_PUBLIC_FIREBASE_*` variables are present the app runs in demo mode with local accounts — nothing touches the cloud until you configure Firebase.

---

## Architecture

```
Client (browser) — file manager, CodeMirror 6 (15 languages), diff editor,
xterm.js terminal, Omni-AI, forum/admin
   │
   ▼
Next.js 15 static app (React 19, TypeScript ~5.8.2, Tailwind v4) → out/ via next build
   │
   ├───────────────────────────────────────────────────────────────┐
   ▼                                                               ▼
Cloudflare Worker (workers/worker.ts)                         Firebase Realtime Database
serves the static bundle and proxies                           (profiles/, threads/, replies/,
/api/health, /api/ai/generate, /api/gh/*                      upvotes/ — streamed via onValue)
(rate-limited: 100 req/60s)
   │
   ├── Google OAuth · GitHub OAuth (Firebase project "website-6e8b1";
   │    Worker GitHub OAuth proxy opt-in, not enabled in production)
   └── Local Ollama (localhost:11434) — on-device model hub
```

**Data tier:** Firebase Realtime Database. RTDB paths are `profiles/{uid}`, `threads/{id}`, `replies/{id}`, and `upvotes/{uid}_{tid}_{rid}`, written with `increment()` counters and streamed via `onValue`. Security rules live in `database.rules.json` and deploy with `firebase deploy --only database`. The client lives in the legacy-named module `src/lib/firestore.ts` — an obsolete filename for the same RTDB client (`isFirestoreAvailable()` is a legacy alias); don't be misled by the name.

---

## Quickstart

```bash
git clone https://github.com/ram1234598766-dotcom/Website.git
cd Website
npm ci

# Environment is entirely optional — the app runs in demo mode without it
cp .env.example .env.local     # fill in values only if you want Firebase/Gemini
npm run dev
```

Open the printed localhost URL. Every `NEXT_PUBLIC_FIREBASE_*` variable is optional: without them the app starts in demo mode with local accounts. To enable Omni-AI cloud generation, just set the `GEMINI_API_KEY` env var (plus the Firebase variables your setup needs). No config is required for the editors, terminal, GitHub browsing, Google Drive demo, or a local Ollama install.

---

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server (`next dev`) |
| `npm run build` | Production build → static export in `out/` (`next build`) |
| `npm run lint` | Type-check without emitting (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite — 1032/1032 tests across 64 files |
| `npm run deploy` | `npm run build && npx wrangler deploy` — one Worker unit with assets |
| `npm run cf-preview` | Preview the Worker with the static bundle locally |

**Stale script:** `firebase:deploy` (package.json line 15) is outdated — it still targets `firestore:rules/indexes`. RTDB is the live data tier; deploy its rules with `firebase deploy --only database` instead.

---

## Testing

- **Unit/integration** — `npm test` runs Vitest: 1032/1032 tests passing across 64 files (Sep 13, 2026).
- **E2E** — Playwright: 8 `test()` cases across 6 files in `tests/e2e/flows` (auth 2, terminal 2, files 1, home 1, ide 1, omni-ai 1), run with `npx playwright test --config=tests/e2e/playwright.config.ts`; the config's webServer serves the static `out/` build.
- **CI** (`.github/workflows/ci.yml`) — on push/PR with Node 22: `npm ci`, lint (`tsc --noEmit`), unit tests (`vitest run`, excluding `tests/e2e/**`), build (`next build`), then Playwright E2E. There is **no npm audit job** — dependency vulnerability scanning is not part of CI.

---

## Deployment

```bash
npm run build          # next build → static export in out/
npx wrangler deploy    # single Cloudflare Worker unit: Worker code + static assets
```

- **Live URL:** https://website.vasudevaya.workers.dev (current Worker version `f7532256`).
- The Worker (`workers/worker.ts`) serves the static bundle and the API routes `/api/health`, `/api/ai/generate`, and `/api/gh/*`.
- **Rollback:** revert to a previous version with `npx wrangler rollback`.
- **RTDB rules:** deploy separately with `firebase deploy --only database`.

---

## Security

- Keys are environment-only: `GEMINI_API_KEY`, `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, and `GH_GRANT_SECRET` live in the Worker's env and are never printed or logged.
- The Worker's `/api/gh/*` GitHub OAuth proxy is guarded by `GH_GRANT_SECRET` and `GitHubOAuthService`, and is presence-gated (secret unset = disabled). It is not enabled in production — an optional, opt-in surface.
- API routes are rate-limited to 100 requests / 60 s.
- All rendered HTML sourced from users is sanitized with DOMPurify.
- The terminal executes code in a sandboxed Web Worker (`SandboxRunner`, `new Function`), never on the page thread.
- `GH_TOKENS` (Workers KV) holds OAuth tokens for the GitHub proxy; demo mode keeps accounts local until Firebase is configured.

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key (RTDB data tier, auth, Drive) | No (demo-mode fallback) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | No |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | No |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | No |
| `GEMINI_API_KEY` | Worker secret backing `/api/ai/generate` (Omni-AI) — set the env var to enable | No |
| `GH_GRANT_SECRET` | Guards the Worker GitHub OAuth proxy (`/api/gh/*`) | No (proxy off by default) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth proxy credentials for `/api/gh/*` | No |

Firebase is configured only when all four `NEXT_PUBLIC_FIREBASE_*` variables are present (`isFirebaseConfigured()`); Omni-AI cloud generation is on only when `GEMINI_API_KEY` is set. Without them the app starts in demo mode.

---

## License

Licensed under the Apache License 2.0.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, and review checklist. Report security issues privately via [SECURITY.md](SECURITY.md), not a public issue.