# VantaOS

**The open-source developer cloud.** VantaOS is a browser-based operating system for
software development — a zero-config web IDE, an integrated AI assistant, a local model
hub, and a real-time community, all in one cohesive workspace.

VantaOS runs as a single-page React application. It can be deployed as a static site to
Cloudflare Pages, with lightweight Cloudflare Pages Functions used for the AI proxy,
health check, and security watchdog. Optional integrations (Supabase, Firebase, a local
Ollama runtime) unlock real-time collaboration, authentication, and private model
inference. When those integrations are not configured, the app degrades gracefully and
clearly reports what is unavailable.

---

## Features

### Cloud OS Web IDE
A full in-browser editor (Monaco) with a file explorer and GitHub synchronization.
Files can be edited in the browser and committed back to any repository the
authenticated user can access.

The live terminal requires a Node server (e.g. Railway / Render). On Cloudflare Pages
the terminal UI is shown but reports that a backend process is required.

### Omni-AI Assistant
A chat interface that calls the server endpoint `POST /api/ai/generate`. The server
relays the conversation to a configured LLM and returns the model's text.
Conversation history is persisted locally in the browser (IndexedDB).

### Ollama Local Model Hub
Lists real open-source models (Llama 3, Phi-3, Gemma 2, Mistral, Qwen 2, LLaVA, Code
Llama, DeepSeek Coder, Mixtral, TinyLlama). Each card shows the true model size and
emits the correct `ollama run <tag>` command. The "Pull" action issues a real request
to a local Ollama daemon at `http://localhost:11434`.

### Community Forum
A real-time discussion board backed by Supabase Postgres with row-level security and
`postgres_changes` subscriptions. Threads, replies, and upvotes are stored in real
tables and update live across connected clients.

### Privacy & Data Ownership
A dedicated page explaining data sovereignty, TLS in transit, RLS-protected storage,
and the absence of advertising or telemetry resale.

### Admin Dashboard
For admin users, a live view of registered-user, thread, and reply counts queried
directly from Supabase, plus quick OAuth provider diagnostics.

### Command Palette
A `Cmd/Ctrl + K` palette for fast navigation between views and actions.

---

## Tech Stack

| Layer        | Technology |
|--------------|------------|
| UI           | React 19, TypeScript, Tailwind CSS v4 |
| Animation    | Motion (`motion/react`) |
| Editor       | `@monaco-editor/react` |
| 3D backdrop  | `three` / `@react-three/fiber` / `@react-three/drei` |
| AI           | Serverless function (`/api/ai/generate`) calling the Gemini REST API |
| Realtime/DB  | Supabase (Postgres + Auth + Realtime) — optional |
| Auth         | Supabase Auth (email + GitHub OAuth) and Firebase (anonymous session for Firestore features) |
| Local models | Ollama HTTP API — optional |

---

## Project Structure

```
.
├── app/
│   ├── layout.tsx       # Next.js root layout
│   ├── page.tsx         # Client-only entry point (loads src/App)
│   └── globals.css      # Design system tokens + Tailwind
├── functions/
│   └── api/
│       ├── ai/generate.ts        # AI proxy (calls Gemini REST API)
│       ├── health.ts             # Runtime health check
│       ├── security/scan.ts      # Real configuration/security audit
│       └── edge-functions/auth-sync.ts  # Auth token validation
├── prisma/
│   └── schema.prisma    # Postgres schema (LionModules, UserTrainingJobs, SystemLogs)
├── public/
│   └── favicon.svg
└── src/
    ├── App.tsx          # Top-level shell, routing between views, security watchdog
    ├── components/      # UI surfaces (Home, CloudOS, OmniAI, Forum, Showcase, ...)
    ├── lib/             # supabase, supabaseClient, firebase, github helpers
    └── types.ts         # Shared TypeScript types
```

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- (Optional) A Supabase project for the forum, auth, and admin metrics
- (Optional) A local [Ollama](https://ollama.com) install for the model hub
- (Optional) A `GEMINI_API_KEY` for the Omni-AI assistant

### Install
```bash
npm install
```

### Configure environment
Copy `.env.example` to `.env.local` (for local dev) or set the variables in your
hosting provider's environment/secrets UI.

```bash
cp .env.example .env.local
```

**NEXT_PUBLIC_*** variables are inlined into the client bundle at build time, so they
must be present in the build environment (Cloudflare Pages build settings, or
`.env.local` for local dev) — not just at runtime.

GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY are server-only and are never exposed to
the browser.

### Run in development
```bash
npm run dev
```

### Build for production / Cloudflare Pages
```bash
npm run build
```
This produces a static export in `out/` plus Cloudflare Pages Functions in
`functions/`. Deploy both to Cloudflare Pages.

### Type check
```bash
npm run lint
```

---

## Environment Variables

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `GEMINI_API_KEY` | Server-side LLM calls for Omni-AI | No (AI disabled without it) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | No (forum/auth disabled without it) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key | No |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployment | No |

---

## Security

The footer shows a live "Threat Watchdog" status driven by `POST /api/security/scan`. The
endpoint performs genuine checks and returns a `threatsFound` flag plus a list of
findings:

- Flags `GEMINI_API_KEY` that is unset or still a placeholder (AI endpoints would fail).
- Flags the server process running as root (`uid 0`).

The UI reflects three honest states: **Secure Runtime**, **Review Recommended** (real
findings present, with a tooltip listing them), and **Watchdog Offline** (server
unreachable). There is no simulated scanning or fabricated threat state.

---

## Deployment

### Cloudflare Pages
Connect your GitHub repository to Cloudflare Pages. Set the build command to
`npm run build`. Set the following environment variables in the Cloudflare dashboard:

- `GEMINI_API_KEY` — set as a secret (not a build env var)
- `NEXT_PUBLIC_SUPABASE_URL` — set as a build env var
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — set as a build env var

Push to the branch connected to Cloudflare Pages and it will build and deploy
automatically. The static frontend is served from `out/` and the API routes are served
from `functions/`.

### Vercel / Node host
The project is also compatible with a standard Node.js server. Build with
`npm run build` and serve `out/` with any static host, or run the Next.js dev/prod
server with `npm run dev` / `npm start`.

---

## Notes & Limitations

- **AI requires a key.** Omni-AI only works when `GEMINI_API_KEY` is set on the server.
- **Forum/auth require Supabase.** Without `NEXT_PUBLIC_SUPABASE_URL` and an anon key,
  those views are disabled with honest messaging.
- **Terminal** requires a Node server (e.g. Railway / Render). The Cloudflare Pages
  deployment shows the terminal UI but reports that the backend is unavailable.
- **Local models** require an Ollama daemon running on `localhost:11434` with CORS
  allowed (`OLLAMA_ORIGINS="*"`).
- Every metric, message, and list shown to the user is either fetched from a real
  source (Supabase, Ollama, the LLM API) or entered by the user. No part of the UI is
  backed by hardcoded sample rows — empty states are rendered explicitly.

---

## License

Licensed under the Apache License 2.0. See the repository for details.
#   F i x   a p p l i e d   f o r   w r a n g l e r   v 4   a s s e t s . d i r e c t o r y  
 