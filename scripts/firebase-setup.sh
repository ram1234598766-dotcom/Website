#!/bin/bash
# VantaOS — Firebase Firestore setup script
# Run this once to provision a Firestore database for the website-6e8b1 project.
# Prerequisites: Firebase CLI (npm install -g firebase-tools) and gcloud auth.

set -e

echo "=== VantaOS Firebase Setup ==="

# 1. Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
  echo "Installing Firebase CLI..."
  npm install -g firebase-tools
fi

# 2. Ensure gcloud auth is configured (headless-compatible)
echo "Checking gcloud auth..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
  echo "No active gcloud auth. Authenticating..."
  gcloud auth login --no-launch-browser
fi

# 3. Use the VantaOS project
echo "Using project: website-6e8b1"
firebase use website-6e8b1

# 4. Enable Firestore (if not already enabled)
echo "Enabling Firestore..."
firebase firestore:create-database website-6e8b1 --location=nam5 2>/dev/null || echo "Firestore may already be enabled."

# 5. Deploy security rules
echo "Deploying Firestore security rules..."
firebase deploy --only firestore:rules

# 6. Deploy indexes
echo "Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

echo "=== Setup complete ==="
echo "Firestore is now active for project website-6e8b1"
echo "Rules: firestore.rules"
echo "Indexes: firestore.indexes.json"