#!/usr/bin/env bash
# VantaOS Cloud IDE — Guided setup script (equivalent to `cli init`)
# Usage: bash scripts/setup.sh  or  npm run setup
#
# Walks through plain-language prompts to configure your VantaOS instance.
# Sensible defaults are provided — just press Enter to accept them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

# Upsert KEY="value" into .env.local without leaving .bak litter behind.
write_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if [ -f "$ENV_FILE" ]; then
    grep -v "^${key}=" "$ENV_FILE" > "$tmp" || true
  fi
  printf '%s="%s"\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
}

ensure_env_file() {
  [ -f "$ENV_FILE" ] || cp "$ENV_EXAMPLE" "$ENV_FILE"
}

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  VantaOS Cloud IDE — Setup Wizard"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "This wizard will configure your VantaOS instance."
echo "You can press Enter at any prompt to accept the sensible default."
echo ""

# Non-interactive shells (CI, piped stdin) would hang on the first prompt.
if [ ! -t 0 ]; then
  echo "  No interactive terminal detected — cannot ask questions."
  echo "  Copy .env.example to .env.local and edit it directly instead,"
  echo "  or run this wizard from a real terminal."
  exit 0
fi

# --- Step 1: Node.js check ---
echo "── Step 1 of 3: Checking your environment ──"
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version)
  echo "  ✓ Node.js found: $NODE_VERSION"
else
  echo "  ✗ Node.js not found. Please install Node.js 22+ from https://nodejs.org"
  exit 1
fi
echo ""

# --- Step 2: Gemini AI key (optional) ---
echo "── Step 2 of 3: Omni-AI cloud provider (optional) ──"
echo "  Omni-AI can use cloud AI (Gemini, OpenRouter, OpenAI) for smarter"
echo "  assistance. You can also use in-browser AI models for free."
echo ""
read -rp "  Enter Gemini API key (or press Enter to skip): " GEMINI_KEY
if [ -n "$GEMINI_KEY" ]; then
  ensure_env_file
  write_env GEMINI_API_KEY "$GEMINI_KEY"
  echo "  ✓ Gemini API key recorded"
else
  echo "  → Skipping — in-browser AI models will be used instead"
fi
echo ""

# --- Step 3: Start ---
echo "── Step 3 of 3: Ready! ──"
echo ""
echo "  Your VantaOS instance is configured."
echo ""
echo "  Firebase needs no setup: the hosted app is already provisioned, and a"
echo "  local run starts in demo mode (local accounts, local data) on its own."
echo ""
echo "  Next step: start the dev server with one of:"
echo ""
echo "    make quickstart    ← full setup + start"
echo "    npm run dev        ← start now"
echo ""
echo "  Then open http://localhost:3000 in your browser."
echo ""
echo "  In demo mode, all features work except cloud sync and AI."
echo "  Everyone starts here — no config needed!"
echo ""
