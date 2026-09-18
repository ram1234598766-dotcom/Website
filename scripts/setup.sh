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

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  VantaOS Cloud IDE — Setup Wizard"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "This wizard will configure your VantaOS instance."
echo "You can press Enter at any prompt to accept the sensible default."
echo ""

# --- Step 1: Node.js check ---
echo "── Step 1 of 4: Checking your environment ──"
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version)
  echo "  ✓ Node.js found: $NODE_VERSION"
else
  echo "  ✗ Node.js not found. Please install Node.js 20+ from https://nodejs.org"
  exit 1
fi
echo ""

# --- Step 2: Firebase configuration (optional) ---
echo "── Step 2 of 4: Firebase configuration (optional) ──"
echo "  Firebase connects your app to a real backend (user accounts,"
echo "  file persistence, chat data). If you don't have Firebase,"
echo "  VantaOS runs in demo mode with local data — nothing is lost."
echo ""
read -rp "  Enter Firebase API key (or press Enter to skip): " FIREBASE_KEY
if [ -n "$FIREBASE_KEY" ]; then
  echo "  ✓ Firebase API key recorded"
  if [ -f "$ENV_FILE" ]; then
    sed -i.bak "s/^NEXT_PUBLIC_FIREBASE_API_KEY=.*/NEXT_PUBLIC_FIREBASE_API_KEY=$FIREBASE_KEY/" "$ENV_FILE"
  else
    echo "NEXT_PUBLIC_FIREBASE_API_KEY=$FIREBASE_KEY" >> "$ENV_FILE"
  fi
else
  echo "  → Skipping Firebase — demo mode (local data only)"
fi
echo ""

# --- Step 3: Gemini AI key (optional) ---
echo "── Step 3 of 4: Omni-AI cloud provider (optional) ──"
echo "  Omni-AI can use cloud AI (Gemini, OpenRouter, OpenAI) for smarter"
echo "  assistance. You can also use in-browser AI models for free."
echo ""
read -rp "  Enter Gemini API key (or press Enter to skip): " GEMINI_KEY
if [ -n "$GEMINI_KEY" ]; then
  echo "  ✓ Gemini API key recorded"
  if [ -f "$ENV_FILE" ]; then
    sed -i.bak "s/^GEMINI_API_KEY=.*/GEMINI_API_KEY=$GEMINI_KEY/" "$ENV_FILE"
  else
    echo "GEMINI_API_KEY=$GEMINI_KEY" >> "$ENV_FILE"
  fi
else
  echo "  → Skipping — in-browser AI models will be used instead"
fi
echo ""

# --- Step 4: Start ---
echo "── Step 4 of 4: Ready! ──"
echo ""
echo "  Your VantaOS instance is configured."
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
