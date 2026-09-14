# Phase 3 Deliverable — Hybrid Rendering Migration

> Generated 2026-09-14. Deployment `1a381352-e1f4-4de6-b2b0-4e4b6ecb4726` live at https://website.vasudevaya.workers.dev

---

## 1. Static vs Dynamic Page Map

| Route | Rendering | Size | Notes |
|---|---|---|---|
| `/` | `○ static` | 45 kB | App shell, prerendered at build time |
| `/_not-found` | `○ static` | — | Next.js 404 page, prerendered |
| `/robots.txt` | `○ static` | — | Static file |
| `/sitemap.xml` | `○ static` | — | Static file |
| `/api/models` | `○ static` | — | Model registry JSON, prerendered |
| `/api/health` | `ƒ dynamic` | — | GET-only; cache-control: no-store |
| `/api/ready` | `ƒ dynamic` | — | Readiness probe |
| `/api/ai/generate` | `ƒ dynamic` | — | POST, gated on GEMINI_API_KEY |
| `/api/plugins` | `ƒ dynamic` | — | Plugin registry |
| `/api/gh/[...rest]` | `ƒ dynamic` | — | GitHub OAuth proxy (not enabled in prod) |
| `/api/model-proxy` | `ƒ dynamic` | — | Model proxy |
| `/api/rate-limit-check` | `ƒ dynamic` | — | Rate-limit status |
| `/api/security/scan` | `ƒ dynamic` | — | Security scan endpoint |
| `/api/edge-functions/auth-sync` | `ƒ dynamic` | — | Edge auth sync |

---

## 2. Deviation Notes (old worker → OpenNext)

| # | Behavior | Old (`workers/worker.ts`) | New (OpenNext) | Impact |
|---|---|---|---|---|
| 1 | `HEAD /api/health` | 200 (same as GET) | 404 (`x-opennext: 1`) | Monitoring must use GET |
| 2 | `GET /api/nonexistent` | JSON `{"error":"Not found"}` | Next.js HTML 404 page | Non-API 404s are HTML now |
| 3 | Unexported HTTP methods on `/api/health` (e.g. PUT) | JSON 405 | HTTP 405 Method Not Allowed | Correct REST semantics, but body shape changed |
| 4 | `cache-control` on health | `no-cache` | `private, no-cache, no-store` | Stricter; no CDN/edge caching |
| 5 | Deploy command | `npx wrangler deploy` | `npm run deploy` (`opennextjs-cloudflare build && opennextjs-cloudflare deploy`) | Different build pipeline |
| 6 | Rollback command | `npx wrangler rollback` | `npx wrangler rollback [version-id]` | Same, but version IDs from `wrangler deployments list` |
| 7 | GitHub OAuth token store | `GH_TOKENS` KV namespace | No KV — fails closed | OAuth proxy is inert by design |
| 8 | Build output | `out/` (static export) | `.open-next/worker.js` + `.open-next/assets/` | Different artifact structure |
| 9 | Page shell | Fully static, no server rendering | Hybrid: `/` static, API routes dynamic | Same user-facing behavior; server now handles routes on-demand |

---

## 3. Manual QA Checklist

### Prerequisites
- Node 22+
- Firebase project configured (or app runs in demo mode)
- `GEMINI_API_KEY` set (optional — enables cloud AI fallback)

### Build
```bash
npm ci
npm run build
# Expect: .open-next/worker.js + .open-next/assets/ produced
```

### Unit / Integration Tests
```bash
npm test
# Expect: 1047/1047 passing across 65 files
```

### E2E Tests
```bash
npx playwright test --config=tests/e2e/playwright.config.ts
# Expect: 9/9 passing
#   auth(2), terminal(2), files(1), home(1), ide(1), ide-run(1), omni-ai(1)
```

### Lint
```bash
npm run lint
# Expect: clean (tsc --noEmit, zero errors)
```

### Deploy
```bash
npm run deploy
# opennextjs-cloudflare build && opennextjs-cloudflare deploy
# Expect: deployment ID printed, site live at https://website.vasudevaya.workers.dev
```

### Post-Deploy Smoke Tests
```bash
# Health check (GET only — HEAD returns 404 with x-opennext: 1)
curl -s https://website.vasudevaya.workers.dev/api/health | jq .
# Expect: { "status": "ok", "firebase": {...}, "ai": {...}, "github": {...}, "drive": {...} }

# App shell
curl -s -o /dev/null -w "%{http_code}" https://website.vasudevaya.workers.dev/
# Expect: 200

# 404 for nonexistent API routes (HTML, not JSON)
curl -s -o /dev/null -w "%{http_code}" https://website.vasudevaya.workers.dev/api/nonexistent
# Expect: 404

# HEAD on health (OpenNext per-method routing)
curl -s -o /dev/null -w "%{http_code}" -X HEAD https://website.vasudevaya.workers.dev/api/health
# Expect: 404 (use GET for monitoring)

# Static assets
curl -s -o /dev/null -w "%{http_code}" https://website.vasudevaya.workers.dev/robots.txt
# Expect: 200
```

### Rollback (if needed)
```bash
npx wrangler deployments list       # find version-id
npx wrangler rollback [version-id]  # revert to previous deployment
```
