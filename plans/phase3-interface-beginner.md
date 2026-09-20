# Phase 3 — Interface & Beginner Experience

**Objective:** One-command quickstart works; plain-language README front door; `npm run setup` 4-step wizard; `.env.example` matches RTDB config.

**Branch:** `phase/3b-interface`
**Deadline:** Tomorrow (Sun Sep 21 2026)

---

## Step 1 — Quickstart Audit (30 min)
**Model tier:** default
**Dependencies:** none
**Rollback:** `git checkout -- app/page.tsx` (if changed during audit)

### Context
New users currently hit friction: manual env setup, unclear README, no dev-server verification. This step measures the current state before changing anything.

### Tasks
1. Fresh clone repo to `/tmp/vantaos-fresh` (`git clone`)
2. Run `npm install && npm run dev` — time wall-clock until interactive UI renders at `localhost:3000`
3. List every manual step a newcomer must take (env vars, DB setup, account creation, etc.)
4. Test demo mode default: does the app boot without `NEXT_PUBLIC_FIREBASE_*` env vars?
5. Check `.env.example` exists and accuracy (does it match actual `.env` or RTDB config?)

### Verification
- [ ] `time` output recorded (target: < 60s install-to-interactive)
- [ ] Friction points list has ≤ 5 items
- [ ] Demo mode boots without Firebase config (confirmed in code via `DEMO_MODE`)
- [ ] `.env.example` exists (if not — gap documented)

### Exit criteria
Friction points list + timing data ready for Step 2.

---

## Step 2 — `npm run setup` Wizard (45 min)
**Model tier:** default
**Dependencies:** Step 1 (knows the friction points)
**Rollback:** `git checkout -- scripts/setup.mjs package.json`

### Context
AGENTS.md requires a 4-step wizard: install → env → dev server → verify. Sensible defaults, zero manual config needed.

### Tasks
1. Scaffold `scripts/setup.mjs`:
   - Step A: `npm install` (or `npm ci` if lockfile present)
   - Step B: Copy `.env.example` → `.env` (if `.env` doesn't exist), prompt user to fill secrets
   - Step C: `npm run dev` (start dev server, wait for port 3000)
   - Step D: Verify HTTP 200 on `http://localhost:3000` (fetch check)
2. Wire `npm run setup` in `package.json` (executes `node scripts/setup.mjs`)
3. Run wizard end-to-end: `npm run setup`, verify all 4 steps complete
4. Add `--help` flag to script showing step descriptions

### Verification
- [ ] `npm run setup` runs from clean checkout without errors
- [ ] All 4 steps execute in order (A→B→C→D)
- [ ] `.env` is created from `.env.example` (not overwriting existing)
- [ ] Dev server starts and responds on port 3000
- [ ] `--help` shows step descriptions

### Exit criteria
Wizard runs clean from fresh checkout.

---

## Step 3 — README Front Door (30 min)
**Model tier:** default
**Dependencies:** Step 2 (wizard exists)
**Rollback:** `git checkout -- README.md`

### Context
README is currently not the first thing users see. AGENTS.md requires plain-language section ABOVE the architecture diagram.

### Tasks
1. Rewrite README top section (first 10 lines): what this is, how to run (3 commands)
2. Keep architecture diagram below the fold
3. Link to `npm run setup` as the entry point
4. Add "Demo mode" note (works without Firebase)

### Verification
- [ ] README renders top section in ≤ 10 lines
- [ ] Contains: "What is this?", "How to run" (3 commands), "Demo mode" note
- [ ] Architecture diagram still exists below the fold

### Exit criteria
README front door ships.

---

## Step 4 — `.env.example` + RTDB Config Sync (15 min)
**Model tier:** default
**Dependencies:** Step 1 (knows RTDB config)
**Rollback:** `git checkout -- .env.example`

### Context
`.env.example` must match RTDB config in `src/lib/firestore.ts` (project ID, bucket, etc.). Currently may be stale or missing.

### Tasks
1. Read RTDB config from `src/lib/firestore.ts` (project ID, bucket, API URL)
2. Read `.env.example` current state
3. Update `.env.example` to match: NEXT_PUBLIC_FIREBASE_* keys + RTDB-specific vars
4. Verify: `grep` RTDB values from `firestore.ts` → all present in `.env.example`

### Verification
- [ ] `.env.example` contains all `NEXT_PUBLIC_FIREBASE_*` keys from `firestore.ts`
- [ ] No stale values in `.env.example`
- [ ] `.env.example` has comments explaining each variable

### Exit criteria
`.env.example` is RTDB-accurate.

---

## Step 5 — Verification Gate (15 min)
**Model tier:** default
**Dependencies:** Steps 1–4
**Rollback:** none (verification only)

### Tasks
1. Fresh clone → `npm run setup` → check all 4 steps
2. Homepage renders (SSR HTML, no spinner gate) — `curl http://localhost:3000` returns HTML
3. Lighthouse Performance scan (if Lighthouse is installed) — target ≥ 90
4. `npm run lint` passes
5. `npm run build` passes

### Verification
- [ ] All 5 checks pass
- [ ] Any failure documented in FINDINGS

### Exit criteria
Phase 3 ready for commit + report.

---

## Parallel Opportunities
- Steps 3 and 4 can run in parallel (independent files: README vs .env.example)

## FINDINGS
(leave blank — fill during execution)
