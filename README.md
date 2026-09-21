# VantaOS

**The intelligent developer cloud.** Write, build, and deploy full-stack applications entirely in the browser.

VantaOS (`vantaos` v2.0.0, private) is a Cloud OS web app: a browser-based workspace that ships with a file manager, a CodeMirror 6 editor spanning 15 languages, a diff editor, an xterm.js terminal, an Omni-AI chat assistant, Google Drive sync, GitHub import/push, and a Firebase forum with an admin panel. It's built as a Next.js 15 **hybrid-rendered** app — a static `/` shell plus server-rendered API routes — served by a single Cloudflare Worker via OpenNext, with Firebase Realtime Database as its data tier. It's for developers who want a zero-config cloud workspace that starts offline-friendly in demo mode and can also run an in-browser WebModel (Transformers.js on WebGPU/WASM) with no external service.

---

## Features

### ☁️ Cloud OS workspace
File manager with tabs, split views, a CodeMirror 6 editor covering 15 languages, a diff editor, and ZIP export. Files persist in the browser via idb-keyval (IndexedDB database `vantaos_cloudos_files_v2`) — no server storage required.

### ⌨️ Built-in terminal
xterm.js terminal with a virtual file system and command history. Run inline JavaScript, browse and edit files, and test code as you write — all sandboxed in a Web Worker through `SandboxRunner` (`new Function`), so shell code never executes on the page thread.

### 🧠 Omni-AI assistant
Chat with cloud AI through the Worker's `/api/ai/generate` proxy, or run `@huggingface/transformers` models entirely in your browser (WebGPU/WASM) with no API key. Cloud providers OpenRouter, Gemini, and OpenAI are available via API key — called through the proxy, with a direct-call fallback for OpenRouter and Gemini when the proxy isn't deployed. Live tool commands like `calc`, `js`, `weather`, and `fetch` are available; Omni-ai uses `dompurify` to sanitize all rendered HTML.

### 🧠 In-browser model manager
Browse and download WebModel packages (`@huggingface/transformers` on WebGPU/WASM) that run entirely in your browser — content-hash verified against trusted sources, no daemon or install required.

> **Omni-AI troubleshooting — "Service unavailable" in chat.** The in-browser WebModel downloads a small AI model from Hugging Face into your browser on first use. Model files (config, tokenizer, and `.onnx` / `.onnx_data` weight binaries) are routed through the site's same-origin worker proxy (`/api/model-proxy`), so they don't depend on the browser being able to reach Hugging Face directly. If chat shows "Service unavailable" or the download fails, your network or browser is usually blocked from reaching Hugging Face. Retry once — if it still fails, open the chat's **Settings** and switch to a cloud provider (OpenRouter, Gemini, or OpenAI), which only needs an API key and doesn't depend on Hugging Face.

### 🔗 GitHub synchronization
Import your repositories, edit files, and push back to the branch via blob/tree/commit/ref requests (with a 200-blob UI cap). GitHub sign-in is wired to the live Firebase project (`website-6e8b1`); the Worker-side GitHub OAuth proxy is opt-in and currently disabled in production.

### 💾 Google Drive
Connect Google Drive via Google (Firebase) sign-in, browse your files read-only, open any text document into the editor, and save work into a dedicated VantaOS folder the app owns — your own files are never overwritten.

### 🔐 Privacy
Keys live in environment variables and are never printed. HTML is sanitized with DOMPurify. The Worker proxy is rate-limited, and when no `NEXT_PUBLIC_FIREBASE_*` variables are present the app runs in demo mode with local accounts — nothing touches the cloud until you configure Firebase.

---

## What this is, in plain English

VantaOS is a development environment that runs entirely in your browser — think of it as a laptop inside a tab. You get a file manager, a code editor with 15 language support, a sandboxed terminal for JavaScript and shell commands, and an AI assistant. Everything works offline by default: your files live in your browser's local storage. When you want more, you can plug in Firebase for real user accounts and file sync, or add a Gemini API key for smarter AI. No installation, no server to manage, no account required. Open the URL and start coding.

---

## Troubleshooting

**"No peers found" / "Can't connect"** — VantaOS runs as a single-browser instance by default. The file manager, editor, terminal, and AI all work locally. If you added Firebase, your data syncs across devices. If features seem limited, check that you're not in a restricted network — some AI model downloads need access to huggingface.co.

**"Port already in use"** — If `npm run dev` complains about port 3000, either stop the other process (`lsof -i :3000` then `kill <PID>`) or start on a different port: `npx next dev -p 3001`.

**"Omni-AI says Service Unavailable"** — The in-browser AI model downloads from Hugging Face on first use. If your network blocks Hugging Face, retry once. If it still fails, go to the chat **Settings** and switch to a cloud provider (Gemini, OpenRouter, or OpenAI) — those only need an API key.

**"Files don't persist after refresh"** — Files are stored in your browser's IndexedDB. Make sure you're not in private/incognito mode (some browsers block persistent storage there). If the issue continues, clear site data and reload.

**"Terminal won't run JavaScript"** — The terminal runs code in a sandboxed Web Worker. If you see a blank screen after running `js`, try clicking inside the terminal panel first to focus it. Press Ctrl+` to toggle the terminal panel open/closed.

**"VPN shows elevated privilege required"** — The VPN service (`/api/vpn`) requires the host machine to have network administration privileges (CAP_NET_ADMIN on Linux, Administrator on Windows). Without these, the VPN toggle will display an error. This is by design — running a TUN device requires OS-level permission.

---

## Architecture

```
Client (browser) — file manager, CodeMirror 6 (15 languages), diff editor,
xterm.js terminal, Omni-AI, forum/admin
   │
   ▼
Next.js 15 hybrid app (React 19, TypeScript ~5.8.2, Tailwind v4) → app/ routes
   │  static: /, /api/models, /robots.txt, /sitemap.xml
   │  dynamic (ƒ): /api/health, /api/ai/generate, /api/gh/*, /api/ready, ...
   ▼
OpenNext worker (.open-next/worker.js — app/api/* route handlers)
serves the app shell, static assets, and the API routes
(rate-limited: 100 req/60s)
   │
   ├── Firebase Realtime Database
   │    (profiles/, threads/, replies/, upvotes/ — streamed via onValue)
   ├── Google OAuth · GitHub OAuth (Firebase project "website-6e8b1";
   │    Worker GitHub OAuth proxy opt-in, not enabled in production)
   └── In-browser WebModel (Transformers.js, WebGPU/WASM) — on-device model manager
```

**Data tier:** Firebase Realtime Database. RTDB paths are `profiles/{uid}`, `threads/{id}`, `replies/{id}`, and `upvotes/{uid}_{tid}_{rid}`, written with `increment()` counters and streamed via `onValue`. Security rules live in `database.rules.json` and deploy with `firebase deploy --only database`. The client lives in the legacy-named module `src/lib/firestore.ts` — an obsolete filename for the same RTDB client (`isFirestoreAvailable()` is a legacy alias); don't be misled by the name.

---

## Quickstart

```bash
git clone https://github.com/ram1234598766-dotcom/Website.git
cd Website

# One command — installs deps, sets up env, starts the server
make quickstart

# Or do it manually:
npm ci
npm run dev
```

Open the printed localhost URL. Every `NEXT_PUBLIC_FIREBASE_*` variable is optional: without them the app starts in demo mode with local accounts. No config is required for the editors, terminal, GitHub browsing, Google Drive demo, in-browser WebModel, or the model manager.

### First-time setup?

Run `npm run setup` for a guided wizard that walks you through Firebase and AI configuration with friendly prompts and sensible defaults.

---

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server (`next dev`) |
| `npm run build` | Next.js production build + OpenNext Worker bundle (`.open-next/`) |
| `npm run deploy` | `npx wrangler deploy` — ships the single Worker unit (worker + assets) |
| `npm run cf-preview` | Preview the built OpenNext worker locally via `wrangler dev` |
| `npm run lint` | Type-check without emitting (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite — 1327/1327 tests across 87 files |
| `npm run test:rules` | Run the RTDB security-rules suite against the local emulator |
| `npm run setup` | Guided 4-step setup wizard (`scripts/setup.sh`) |
| `make quickstart` | Install deps, create `.env.local`, start the dev server |

**RTDB rules:** the live data tier is Realtime Database. Deploy its rules with `firebase deploy --only database` — that is exactly what the `npm run firebase:deploy` script runs.

---

## Testing

- **Unit/integration** — `npm test` runs Vitest: 1327/1327 tests passing across 87 files.
- **E2E** — Playwright: 9 `test()` cases across 7 files in `tests/e2e/flows` (auth 2, terminal 2, files 1, home 1, ide 1, ide-run 1, omni-ai 1), run with `npx playwright test --config=tests/e2e/playwright.config.ts`; the config's webServer builds and serves the hybrid app (`npx next build && npx next start -p 4173`).
- **CI** (`.github/workflows/ci.yml`) — on push/PR with Node 22: `npm ci`, lint (`tsc --noEmit`), unit tests (`vitest run`, excluding `tests/e2e/**`), build (`next build`), Playwright E2E, and an **`npm audit` job** (`npm audit --audit-level=high`; 0 vulnerabilities as of Sep 14, 2026).

---

## Deployment

```bash
npm run deploy           # npx wrangler deploy (build via [build] in wrangler.toml) → single Worker + assets
```

- **Live URL:** https://website.vasudevaya.workers.dev (current deployment `1a381352-e1f4-4de6-b2b0-4e4b6ecb4726`).
- The OpenNext worker (built from the `app/api/*` route handlers in `src/lib/server/*`) serves the app shell, static assets, and the `/api/*` routes.
- **Rollback:** revert to a previous version with `npx wrangler rollback [version-id]`.
- **RTDB rules:** deploy separately with `firebase deploy --only database`.

---

## Security

- Keys are environment-only: `GEMINI_API_KEY`, `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, and `GH_GRANT_SECRET` live in the Worker's env and are never printed or logged.
- The `/api/gh/*` GitHub OAuth proxy is guarded by `GH_GRANT_SECRET` and `GitHubOAuthService`, and is presence-gated (secret unset = disabled). It is not enabled in production — an optional, opt-in surface. There is no KV namespace: OAuth-token storage is absent by design, so the grant flow fails closed if the required secrets/token store are not provisioned.
- API routes are rate-limited to 100 requests / 60 s.
- All rendered HTML sourced from users is sanitized with DOMPurify.
- The terminal executes code in a sandboxed Web Worker (`SandboxRunner`, `new Function`), never on the page thread.
- GitHub OAuth token storage is **not implemented** (no KV binding; `GH_TOKENS` is undefined at runtime, so the grant path fails closed). Demo mode keeps accounts local until Firebase is configured.

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key (auth, RTDB data tier, Drive) | No (demo-mode fallback) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | No |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | No |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID | No |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Overrides the Realtime Database URL; blank means the project default | No |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` / `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional Firebase extras; unused by the data tier | No |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin | No |
| `GEMINI_API_KEY` | Worker secret backing `/api/ai/generate` (Omni-AI) — set the env var to enable | No |
| `GH_GRANT_SECRET` | Guards the Worker GitHub OAuth proxy (`/api/gh/*`) | No (proxy off by default) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth proxy credentials for `/api/gh/*` | No |

Firebase is configured only when the four core values — API key, auth domain, project ID, and app ID — are all present (`isFirebaseConfigured()`); Omni-AI cloud generation is on only when `GEMINI_API_KEY` is set. Without them the app starts in demo mode, with local accounts and local data.

---

## License

Licensed under the Apache License 2.0.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, and review checklist. Report security issues privately via [SECURITY.md](SECURITY.md), not a public issue.