# TECH_STACK.md — Deep Audit Report

**Audited file**: `C:\Users\Mrityunjay\Website\docs\TECH_STACK.md` (526 lines)
**Date**: 2026-09-13
**Method**: Every file:line reference, package.json reference, status marker, and test count was verified against actual repo files.

> ⚠️ **Scope note (2026-09-14):** This report documents the state of the repo
> **as of 2026-09-13**, before the Realtime Database migration. Since then:
> `package.json` was reorganized to its current 88-line form — the "correct
> reference" line numbers listed under *CATEGORY 1* no longer match the current
> file (recompute against the live file before reuse). The data tier moved to
> **Firebase Realtime Database**; any Firestore-as-data-tier wording here is
> historical. This report is preserved as a dated audit record; current
> references live in the rewritten `docs/TECH_STACK.md`.

---

## Summary of Findings

| Category | Count | Severity |
|---|---|---|
| Package.json line references wrong | 11 | High (misleads developers) |
| File:line references wrong or misleading | 5 | High |
| Status (✅/🎯/🔄) inaccurate | 2 | Medium |
| Test count unverifiable / likely wrong | 2 | Medium |
| Correctly verified references | 55+ | ✅ |

---

## CATEGORY 1: Package.json Line References — 11 Errors

### Error 1.1 — Section 1, line 45: `package.json:56`
- **Doc claims**: Application layer references `package.json:56` for Next.js/React/TypeScript.
- **Actual line 56**: `"motion": "^12.23.12"` — not Next.js, React, or TypeScript.
- **Correct reference**: `package.json:57` (next), `package.json:60` (react), `package.json:80` (typescript).

### Error 1.2 — Section 1, line 45: `package.json:59-60`
- **Doc claims**: Application layer references `package.json:59-60`.
- **Actual line 59**: `"prettier"`, line 60: `"react"` — mixed; react-dom is on line 61, not included.
- **Correct reference**: `package.json:60-61` (react, react-dom).

### Error 1.3 — Section 1, line 46: `package.json:44`
- **Doc claims**: Tailwind CSS v4 at `package.json:44`.
- **Actual line 44**: `"@sentry/react": "^10.74.0"`.
- **Correct reference**: `package.json:45` (@tailwindcss/postcss) or `package.json:79` (tailwindcss).

### Error 1.4 — Section 1, line 46: `package.json:55`
- **Doc claims**: Motion at `package.json:55`.
- **Actual line 55**: `"lucide-react": "^0.511.0"`.
- **Correct reference**: `package.json:56` (motion).

### Error 1.5 — Section 1, line 46: `package.json:54`
- **Doc claims**: Lucide at `package.json:54`.
- **Actual line 54**: `"jszip": "^3.10.1"`.
- **Correct reference**: `package.json:55` (lucide-react).

### Error 1.6 — Section 1, line 48: `package.json:45-46`
- **Doc claims**: xterm.js packages at `package.json:45-46`.
- **Actual line 45**: `"@tailwindcss/postcss"`, line 46: `"@xterm/addon-fit"` — only one of two is correct.
- **Correct reference**: `package.json:46-47` (@xterm/addon-fit, @xterm/xterm).

### Error 1.7 — Section 2.2, line 96: `package.json:44` and `package.json:78`
- **Doc claims**: Tailwind CSS v4 at `package.json:44` and `package.json:78`.
- **Actual line 44**: `"@sentry/react"`, line 78: `"fake-indexeddb"`.
- **Correct reference**: `package.json:45` (@tailwindcss/postcss) or `package.json:79` (tailwindcss).

### Error 1.8 — Section 2.2, line 97: `package.json:55`
- **Doc claims**: Motion at `package.json:55`.
- **Actual line 55**: `"lucide-react"`.
- **Correct reference**: `package.json:56` (motion).

### Error 1.9 — Section 2.2, line 99: `package.json:54`
- **Doc claims**: Lucide at `package.json:54`.
- **Actual line 54**: `"jszip"`.
- **Correct reference**: `package.json:55` (lucide-react).

### Error 1.10 — Section 2.2, line 101: `package.json:61`
- **Doc claims**: React Virtuoso at `package.json:61`.
- **Actual line 61**: `"react-dom": "^19.0.1"`.
- **Correct reference**: `package.json:62` (react-virtuoso).

### Error 1.11 — Section 2.2, line 102: `package.json:49`
- **Doc claims**: DOMPurify at `package.json:49`.
- **Actual line 49**: `"diff": "^9.0.0"`.
- **Correct reference**: `package.json:50` (dompurify).

**Root cause**: These all stem from the same off-by-one pattern — the doc author appears to have referenced package.json lines before the `@sentry/react` line, but the actual packages are on different lines. A systematic re-check against the actual file fixes all of these.

---

## CATEGORY 2: File:Line References — 5 Errors

### Error 2.1 — Section 1, line 53: `src/lib/drive.ts:41-43` for Drive scopes
- **Doc claims**: Lines 41-43 show `drive.readonly`/`drive.file` scopes.
- **Actual lines 41-43**: Variable declarations (`let driveAccessToken`, `let driveAccessExpiresAt`, blank line). Scope descriptions are in comment header (lines 8-9).
- **Fix**: Change to `src/lib/drive.ts:8-9` or remove the specific line reference.

### Error 2.2 — Section 2.3, line 117: `src/components/TerminalPanel.tsx:28-36`
- **Doc claims**: xterm.js renders the terminal at lines 28-36.
- **Actual lines 28-36**: Component signature (`export default function TerminalPanel`) and React hooks — not xterm rendering.
- **Note**: The same section also cites `TerminalPanel.tsx:14-36` (line 117) which is more accurate (covers xterm imports through component).
- **Fix**: Change to `src/components/TerminalPanel.tsx:14-36` for consistency.

### Error 2.3 — Section 6, line 419: `tests/phase-schema/` cited as "9 files"
- **Doc claims**: `tests/phase-schema/` has 9 files.
- **Actual**: 10 `.test.*` files exist in `tests/phase-schema/`:
  1. schema.test.ts
  2. runbooks.test.ts
  3. omni-ai-webmodel.test.ts
  4. export.test.ts
  5. edge-contract.test.ts
  6. telemetry.test.ts
  7. sync-api.test.ts
  8. slo.test.ts
  9. webmodel-adapter.test.ts
  10. webmodel-matrix.test.ts
- **Fix**: Change "9 files" to "10 files".

### Error 2.4 — Section 6, line 411: `tests/phase2/` cited as "5 files"
- **Doc claims**: `tests/phase2/` has 5 files.
- **Actual**: 4 test files (runner.test.ts, commands.test.ts, keyboard.test.tsx, a11y.test.tsx). The other 2 files (`test-utils.tsx`, `node-worker.ts`) are test helpers, not tests.
- **Fix**: Change "5 files" to "4 files" or clarify "4 test files + 2 helpers".

### Error 2.5 — Section 1, line 53: `src/lib/drive.ts:1-253` (line range accuracy)
- **Doc claims**: Drive integration spans lines 1-253.
- **Actual**: drive.ts has 253 lines. ✅ The range is correct.

---

## CATEGORY 3: Status (✅/🎯/🔄) Errors — 2 Errors

### Error 3.1 — Section 6, line 423: Production build row marked 🎯
- **Doc claims**: `| Production build | CI pipeline (...) | 🎯 Every push/PR (pipeline to be created) |`
- **Actual**: CI pipeline exists at `.github/workflows/ci.yml` with lint (typecheck), test (Vitest), build, e2e (Playwright), and an `npm audit` job running on every push/PR. Publish/deploy runs through Cloudflare's own Workers Builds / Pages integration.
- **Fix**: Change 🎯 to ✅ and update description to "CI pipeline runs on every push/PR". ✅ Resolved 2026-09-14.

### Error 3.2 — Section 5, line 384: Dependency scanner marked 🎯 with "implemented"
- **Doc claims**: `a dependency security scanner in CI 🎯 implemented (npm audit --audit-level=moderate, pending CI pipeline creation)`
- **Actual**: Fixed. `.github/workflows/ci.yml` now includes an `audit` job running `npm audit --audit-level=high` on every push/PR. `npm audit --audit-level=moderate` was verified clean (0 vulnerabilities) as of 2026-09-14.
- **Fix**: The audit claim is now true: the scanner is automated in CI. ✅ Resolved 2026-09-14.

---

## CATEGORY 4: Test Count Issues — 2 Issues

### Issue 4.1 — Test count verification (RESOLVED Sep 13 2026)
- **Doc claims**: 873 Vitest tests across 55 files.
- **Verification**: `npx vitest run` reconfirmed on Sep 13 2026 after the
  e2e exclusion in `vitest.config.ts`: **1032 tests passing across 65 files**
  (`vitest run --exclude 'tests/e2e/**'`). All docs updated accordingly
  (re-verified Sep 14 2026: **1049/1049 across 65 files**; see correction log item 16).

### Issue 4.2 — 8 Playwright E2E tests claim
- **Doc claims**: 8 Playwright E2E tests in `tests/e2e/`.
- **Actual**: 6 E2E test files exist (auth, files, home, ide, omni-ai,
  terminal) containing **8 `test()` cases** (auth 2, files 1, home 1, ide 1,
  omni-ai 1, terminal 2). `@playwright/test` is declared as a devDependency
  and a `npx playwright test --config=tests/e2e/playwright.config.ts` CI job
  now runs them; `tests/e2e/` is excluded from Vitest so unit and E2E suites
  stay separate. Note: the E2E webServer serves `out/`, so a build must run
  before the E2E suite (handled in `ci.yml`).
- **Action resolved**: count clarified to 8 tests across 6 files; CI job added.

---

## CATEGORY 5: Verified References (✅)

The following references were verified as accurate:

| Reference | Location | Verified |
|---|---|---|
| README.md:3-8 | Cloudflare Worker description | ✅ |
| workers/worker.ts:1-7 | Worker header comment | ✅ |
| workers/worker.ts:89-208 | Fetch handler | ✅ |
| workers/worker.ts:1-11 | Worker imports | ✅ |
| next.config.mjs:3-8 | output:'export', trailingSlash, unoptimized images | ✅ |
| package.json:6-13 | Scripts block | ✅ |
| package.json:22-43 | @codemirror/* packages | ✅ |
| package.json:79 | typescript "~5.8.2" | ✅ |
| package.json:6-13 | Package scripts | ✅ |
| src/lib/storage.ts:10-13 | DB_NAME, DB_VERSION, FILES_STORE='files', META_STORE='metadata' | ✅ |
| src/lib/storage.ts:38-54 | openDB() with store creation | ✅ |
| src/components/CloudOS.tsx:327 | localStorage.getItem('vantaos_cloudos_files_v2') | ✅ |
| src/components/OmniAI.tsx:1-25 | Imports + PROVIDER_ICONS (ollama, openrouter, gemini, openai) | ✅ |
| src/components/OmniAI.tsx:37-56 | Settings with ollamaUrl | ✅ |
| src/components/OmniAI.tsx:165-177 | Cloud AI via /api/ai/generate | ✅ |
| src/components/Showcase.tsx:14-25 | REAL_MODELS (Ollama catalog) | ✅ |
| src/components/Showcase.tsx:122-142 | pullModel() with localhost:11434/api/pull | ✅ |
| src/lib/drive.ts:1-253 | Full Drive integration file (253 lines) | ✅ |
| src/lib/drive.ts:63-64 | TTL assignment | ✅ |
| src/lib/github.ts:39-40 | grant/directToken variables | ✅ |
| src/lib/github.ts:163-189 | connectGitHubWithFirebase/importGitHubAccessToken | ✅ |
| src/lib/firebase.ts:38-47 | isFirebaseConfigured() | ✅ |
| src/lib/demoAuth.ts:27-32 | USERS_KEY/SESSION_KEY, memoryUsers | ✅ |
| src/lib/demoAuth.ts:63-80 | Session management | ✅ |
| src/components/GitHubManager.tsx:107-111 | 200 blob cap warning | ✅ |
| src/components/GitHubManager.tsx:147-175 | Push flow (blob/tree/commit/ref) | ✅ |
| wrangler.toml:1-11 | Full config | ✅ |
| src/components/CloudCodeEditor.tsx:1-16 | CodeMirror wrapper intro | ✅ |
| src/components/CloudDiffEditor.tsx:1-18 | Diff editor intro | ✅ |
| src/lib/editor/setup.ts:1-22 | CodeMirror setup imports | ✅ |
| src/components/TerminalPanel.tsx:14-36 | xterm imports + component setup | ✅ |
| src/lib/terminal/runner.ts:98 | new Function(code)() in worker | ✅ |
| src/lib/terminal/runner.ts:159 | SandboxRunner export | ✅ |
| src/lib/workspace/operations.ts | Oplog description | ✅ |
| app/page.tsx:1-8 | Client-rendered page | ✅ |
| app/layout.tsx:11-55 | Metadata export | ✅ |
| src/App.tsx:19-27 | State declarations | ✅ |
| src/App.tsx:103-145 | Navigation + main content | ✅ |
| src/App.tsx:92-141 | Motion usage | ✅ |
| src/components/CloudOS.tsx:240-244 | Prettier formatting | ✅ |
| src/components/CloudOS.tsx:485-514 | Delete handler | ✅ |
| src/components/CloudOS.tsx:521-540 | Rename/move handlers | ✅ |
| src/components/CloudOS.tsx:563-598 | ZIP export handler | ✅ |
| src/components/CloudOS.tsx:867 | Virtuoso usage | ✅ |
| src/lib/firestore.ts | Firestore data tier (exists, 311 lines) | ✅ |
| src/components/DriveManager.tsx | Drive manager (exists) | ✅ |
| workers/grants.ts | Grants module (exists) | ✅ |
| src/lib/schema/ | Schema directory (exists) | ✅ |
| src/lib/models/adapter.ts | WebModel adapter (exists) | ✅ |
| src/lib/telemetry/index.ts | Telemetry (exists) | ✅ |
| src/lib/workspace/export.ts | Export/import (exists) | ✅ |
| .github/workflows/ci.yml | CI pipeline (exists, 193 lines) | ✅ |
| src/components/Navigation.tsx:102-159 | Mobile nav drawer | ✅ |
| src/components/OllamaLocal.tsx:69-82 | Ollama generate call | ✅ |
| src/lib/client.ts | Client facade (exists) | ✅ |
| src/components/CloudOS.tsx:563-598 | ZIP export | ✅ |
| src/components/CloudOS.tsx:485-514 | File operations | ✅ |
| src/components/CloudOS.tsx:521-540 | Rename/move | ✅ |
| src/components/CloudOS.tsx:867 | Virtualized lists | ✅ |
| src/components/CloudOS.tsx:240-244 | Prettier | ✅ |
| src/lib/workspace/operations.ts | Oplog | ✅ |
| src/lib/terminal/runner.ts:98 | Sandbox execution | ✅ |
| src/lib/terminal/runner.ts:159 | SandboxRunner class | ✅ |

---

## Recommended Fixes

The following changes should be applied to `TECH_STACK.md`:

1. **Line 45**: Fix all `package.json` references in Application row
2. **Line 46**: Fix all `package.json` references in UI row  
3. **Line 48**: Fix `package.json:45-46` → `package.json:46-47` in Terminal row
4. **Line 53**: Fix `src/lib/drive.ts:41-43` → `src/lib/drive.ts:8-9` for scopes
5. **Line 96**: Fix `package.json:44` and `package.json:78` → `package.json:45` or `package.json:79`
6. **Line 97**: Fix `package.json:55` → `package.json:56`
7. **Line 99**: Fix `package.json:54` → `package.json:55`
8. **Line 101**: Fix `package.json:61` → `package.json:62`
9. **Line 102**: Fix `package.json:49` → `package.json:50`
10. **Line 117**: Fix `TerminalPanel.tsx:28-36` → `TerminalPanel.tsx:14-36` (or remove duplicate reference)
11. **Line 411**: Fix `tests/phase2/` "5 files" → "4 files" — ✅ applied (row now reads `4 test + 2 helpers`)
12. **Line 419**: Fix `tests/phase-schema/` "9 files" → "10 files" — ✅ applied (now 10 files, 326 tests; later grown to 11 files, 336 tests with `database-rules.test.ts`, Sep 14 2026)
13. **Line 423**: Fix Production build row from 🎯 to ✅ — ✅ row removed (Section 6 table now lists test classes only)
14. **Line 424**: Update success message to match corrected table — ✅ applied
15. **Line 384**: Correct scanner status — ✅ now automated: CI `audit` job runs `npm audit --audit-level=high`; verified 0 vulnerabilities Sep 14 2026.
16. **Various**: Run E2E to confirm test count — resolved Sep 13 2026: E2E suite is 8 `test()` cases across 6 files in `tests/e2e/flows/`; `@playwright/test` now declared as a devDependency and a CI e2e job added. Vitest excludes `tests/e2e/**` (1049/1049 across 65 files as of Sep 14 2026; `tests/phase-schema/` now includes `database-rules.test.ts` — 11 files, 336 tests).
