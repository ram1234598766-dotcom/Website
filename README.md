# VantaOS

**The intelligent developer cloud.** Write, build, and deploy full-stack applications entirely in the browser.

VantaOS is a browser-based development environment — a zero-config web IDE (powered by Monaco Editor), an Omni-AI assistant, a local model hub, and a real-time community forum, all in one cohesive workspace.

Deployed as a static site on Cloudflare Pages, with lightweight serverless functions for the AI proxy, health checks, and security monitoring.

---

## Features

### ☁️ Cloud OS Web IDE
A full in-browser code editor (Monaco) with file explorer, split views, diff editor, code formatting (Prettier), and GitHub sync. Create, edit, rename, delete, and organize files in a virtual workspace. Export your entire workspace as a ZIP.

### 🧠 Omni-AI Assistant
A chat interface that connects to a server-side LLM endpoint. Supports "Deep Thinking" and "Quick Reply" modes. Conversation history is persisted in IndexedDB.

### 🤖 Local Model Hub
Browse real open-source models (Llama 3, Phi-3, Gemma 2, Mistral, Qwen 2, and more). Each card shows the true model size. Pull models from a local Ollama daemon at `http://localhost:11434`.

### 💬 Community Forum
A real-time discussion board backed by Supabase Postgres with row-level security and live subscriptions. Create threads, post replies, and upvote content.

### 🔐 Privacy & Data Ownership
Your data remains yours. Zero-trust architecture, TLS in transit, RLS-protected storage, no advertising, no telemetry resale.

### 🛡️ Security Watchdog
Live security monitoring in the footer. The watchdog checks for misconfigured API keys and server vulnerabilities.

### ⌨️ Command Palette
Press `Ctrl+K` (or `Cmd+K`) for fast navigation between all views and actions.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Animation | Motion (`motion/react`) |
| Editor | `@monaco-editor/react` |
| AI Proxy | Cloudflare Pages Function → Gemini REST API |
| Database / Auth | Supabase (Postgres + Auth + Realtime) — optional |
| Terminal | xterm.js with optional Socket.io backend |
| Deployment | Cloudflare Pages (static export) |

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- (Optional) A Supabase project for forum, auth, and admin features
- (Optional) A local [Ollama](https://ollama.com) install for the model hub
- (Optional) A Gemini API key for the Omni-AI assistant

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

The production build produces a static export in `out/` plus Cloudflare Pages Functions in `functions/`. Deploy both to Cloudflare Pages.

### Configure Cloudflare Pages Deployment

Connect your GitHub repo to Cloudflare Pages and set:
- **Build command**: `npm run build`
- **Build output**: `out/` (functions auto-detected from `functions/`)

Set these environment variables in the Cloudflare dashboard:
- `GEMINI_API_KEY` — for Omni-AI (optional)
- `NEXT_PUBLIC_SUPABASE_URL` — for forum/auth (optional)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — for forum/auth (optional)

---

## Project Structure

```
.
├── app/                   # Next.js app router (layout, page, globals)
├── functions/             # Cloudflare Pages Functions (API endpoints)
│   └── api/
│       ├── ai/generate.ts         # AI proxy (Gemini)
│       ├── health.ts              # Health check
│       └── security/scan.ts       # Security audit
├── public/
│   └── favicon.svg
└── src/
    ├── App.tsx            # Root shell — view routing, auth, security
    ├── components/        # UI surfaces
    │   ├── Home.tsx       # Landing page
    │   ├── CloudOS.tsx    # Cloud IDE workspace
    │   ├── OmniAI.tsx     # AI chat assistant
    │   ├── Forum.tsx      # Community discussion board
    │   ├── Showcase.tsx   # AI model gallery
    │   ├── AdminPanel.tsx # Admin dashboard
    │   ├── AuthModal.tsx  # Sign in / sign up
    │   ├── TerminalPanel.tsx # xterm.js terminal
    │   └── ...
    ├── lib/               # Supabase, Firebase, GitHub helpers
    ├── types.ts           # Shared TypeScript types
    └── utils/             # Activity logging, astrology service
```

---

## Environment Variables

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `GEMINI_API_KEY` | Server-side LLM calls for Omni-AI | No (AI disabled without it) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | No (forum/auth disabled) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | No |
| `NEXT_PUBLIC_APP_URL` | Public URL (for OAuth callbacks) | No |

---

## Security

The footer shows a live threat watchdog status driven by `POST /api/security/scan`. The endpoint performs real checks:
- Validates that `GEMINI_API_KEY` is set and not a placeholder
- Checks if the server is running as root

The UI reflects three honest states: **Secure Runtime**, **Review Recommended**, or **Watchdog Offline**.

---

## License

Licensed under the Apache License 2.0.
