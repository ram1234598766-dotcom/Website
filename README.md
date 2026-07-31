# VantaOS

**The intelligent developer cloud.** Write, build, and deploy full-stack applications entirely in the browser.

VantaOS is a browser-based development environment — a zero-config web IDE (powered by Monaco Editor), an Omni-AI assistant, a local model hub, GitHub integration, and a built-in terminal, all in one cohesive workspace.

Deployed as a static Next.js export served from Cloudflare, with a lightweight Workers proxy for AI API calls.

---

## Features

### ☁️ Cloud OS Web IDE
A full in-browser code editor (Monaco) with a file explorer, tabs, split views, a diff editor, code formatting (Prettier on save), and a virtual workspace that persists to `localStorage`. Create, edit, rename, delete, and organize files and folders. Export the entire workspace as a ZIP archive.

### ⌨️ Built-in Terminal
An xterm.js terminal with a virtual file system and command history. Run JavaScript inline (`js <code>`), navigate directories, create and edit files, and test code as you write. Toggle it with `` Ctrl+` ``.

### 🧠 Omni-AI Assistant
A chat interface that connects to the AI provider of your choice — **local Ollama models** or **cloud APIs** (OpenRouter, Gemini, OpenAI). Online-only: if no provider is connected, Omni-AI tells you how to connect one instead of faking offline answers. Includes live tool commands like `calc`, `js`, `weather`, and `fetch`.

### 🤖 Local Model Hub
Browse real open-source models (Llama 3, Phi-3, Gemma 2, Mistral, Qwen 2, and more) with their actual sizes. Pull models to a local Ollama daemon at `http://localhost:11434` and run them with one command.

### 🔗 GitHub Synchronization
Sign in with a GitHub token (or Supabase OAuth when configured), clone any of your repositories into the workspace, edit files, and commit & push your changes back to the branch — without leaving the IDE.

### 🔐 Privacy
Your workspace data stays in your browser by default. Demo auth accounts are stored locally (passwords hashed with SHA-256). When Supabase is configured, auth and storage move to your own Supabase project with row-level security. No tracking scripts, no telemetry resale.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Framework | Next.js 15 (static export) |
| Animation | Motion (`motion/react`) |
| Editor | `@monaco-editor/react` |
| Terminal | xterm.js |
| AI | Ollama, OpenRouter, Gemini, OpenAI |
| Auth / DB | Supabase (optional) |
| Deployment | Cloudflare Workers + static assets |

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- (Optional) A Supabase project for real auth
- (Optional) A local [Ollama](https://ollama.com) install for the model hub
- (Optional) API keys for OpenRouter / Gemini / OpenAI to use cloud AI

### Install & Run

```bash
# Clone the repo
git clone https://github.com/ram1234598766-dotcom/Website.git
cd Website

# Install dependencies
npm install

# Configure environment (copy and fill in your values)
cp .env.example .env.local

# Run in development mode
npm run dev

# Build for production
npm run build
```

The production build produces a static export in `out/`.

### Deploy to Cloudflare

This project uses a Cloudflare Worker (`workers/worker.ts`) that serves the static export and proxies `/api/*` AI calls.

```bash
# Authenticate once
npx wrangler login

# Deploy
npm run build && npx wrangler deploy
```

Set environment variables / secrets in the Cloudflare dashboard or via `wrangler secret put`:
- `GEMINI_API_KEY` — for Omni-AI (optional)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — for real auth (optional)

---

## Project Structure

```
.
├── app/                   # Next.js app router (layout, page, robots, sitemap)
├── public/                # Static assets, _headers, manifest, OG image
├── workers/
│   └── worker.ts          # Cloudflare Worker (assets + AI API proxy)
└── src/
    ├── App.tsx            # Root shell — view routing, auth, keyboard shortcuts
    ├── components/        # Home, CloudOS (IDE), TerminalPanel, OmniAI,
    │                      # OllamaLocal, Showcase (model hub), GitHubManager,
    │                      # AuthModal, CommandPalette, AdminPanel, ...
    ├── lib/               # supabase (unified client), demoAuth, github, sanitize
    └── types.ts           # Shared TypeScript types
```

---

## Environment Variables

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | No (falls back to demo auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | No |
| `NEXT_PUBLIC_APP_URL` | Public URL (for OAuth callbacks) | No |
| `GEMINI_API_KEY` | Worker-side secret for Omni-AI | No |

---

## License

Licensed under the Apache License 2.0.
