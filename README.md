# VantaOS

**The intelligent developer cloud.** Write, build, and deploy full-stack applications entirely in the browser.

VantaOS is a browser-based development environment — a zero-config web IDE (powered by an in-bundle CodeMirror 6 editor), an Omni-AI assistant, a local model hub, GitHub integration, and a built-in terminal, all in one cohesive workspace.

Deployed as a static Next.js export served from Cloudflare, with a lightweight Workers proxy for AI API calls.

---

## Features

### ☁️ Cloud OS Web IDE
A full in-browser code editor (CodeMirror 6, bundled — no CDN, no ~3MB runtime) with a file explorer, tabs, split views, a diff editor, code formatting (Prettier on save), and a virtual workspace that persists to `localStorage`. Create, edit, rename, delete, and organize files and folders. Export the entire workspace as a ZIP archive.

### ⌨️ Built-in Terminal
An xterm.js terminal with a virtual file system and command history. Run JavaScript inline (`js <code>`), navigate directories, create and edit files, and test code as you write. Toggle it with `` Ctrl+` ``.

### 🧠 Omni-AI Assistant
A chat interface that connects to the AI provider of your choice — **local Ollama models** or **cloud APIs** (OpenRouter, Gemini, OpenAI). Online-only: if no provider is connected, Omni-AI tells you how to connect one instead of faking offline answers. Includes live tool commands like `calc`, `js`, `weather`, and `fetch`.

### 🤖 Local Model Hub
Browse real open-source models (Llama 3, Phi-3, Gemma 2, Mistral, Qwen 2, and more) with their actual sizes. Pull models to a local Ollama daemon at `http://localhost:11434` and run them with one command.

### 🔗 GitHub Synchronization
Sign in with Google, GitHub (or Firebase OAuth — the default), clone any of your repositories into the workspace, edit files, and commit & push your changes back to the branch — without leaving the IDE.

### 💾 Google Drive
Sign in with your Google account (Firebase) and connect Google Drive. Browse every file in your Drive read-only, open any text document straight into the editor, and save work into a dedicated **VantaOS** folder the app owns — your own files are never overwritten.

### 🔐 Privacy
Your workspace data stays in your browser by default. Demo auth accounts are stored locally (passwords hashed with SHA-256). When Firebase is configured, sign-in and accounts use your Firebase project; the Forum, Admin metrics, and profiles are stored in your own Cloud Firestore database, protected by Firestore security rules. No tracking scripts, no telemetry resale.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Framework | Next.js 15 (static export) |
| Animation | Motion (`motion/react`) |
| Editor | CodeMirror 6 (@codemirror/*) |
| Terminal | xterm.js |
| AI | Ollama, OpenRouter, Gemini, OpenAI |
| Auth | Firebase (optional — Google/GitHub OAuth, Google Drive) |
| DB | Firebase (Cloud Firestore — Forum, Admin) |
| Deployment | Cloudflare Workers + static assets |

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- (Optional) A Firebase project for Google/GitHub sign-in + Google Drive + the Forum/Admin data tier (enable Firebase Authentication, Cloud Firestore, and the Google Drive API in the linked Google Cloud project)
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
- `NEXT_PUBLIC_FIREBASE_*` — Firebase auth + Drive + Cloud Firestore (optional; build-time)

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
    │                      # OllamaLocal, Showcase (model hub), GitHubManager, DriveManager,
    │                      # AuthModal, CommandPalette, AdminPanel, ...
    ├── lib/               # client (unified auth facade), firebase, firestore, drive, demoAuth, github, sanitize
    └── types.ts           # Shared TypeScript types
```

---

## Environment Variables

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | No (falls back to local demo auth) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (e.g. `<project>.firebaseapp.com`) | No |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | No |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web app ID | No |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket (optional) | No |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID (optional) | No |
| `NEXT_PUBLIC_APP_URL` | Public URL (for OAuth callbacks) | No |
| `GEMINI_API_KEY` | Worker-side secret for Omni-AI | No |

---

## License

Licensed under the Apache License 2.0.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, and review
checklist. Security issues: report privately via
[SECURITY.md](SECURITY.md), not a public issue.
