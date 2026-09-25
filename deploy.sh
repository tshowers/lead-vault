#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

trap 'echo "Deploy aborted - a previous step failed, nothing was committed or deployed." >&2' ERR

echo "Running Lead Vault production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Building the production Lead Vault bundle..."
npm run build

echo "Running Lead Vault unit tests..."
npm run test:ci

echo "Running TypeScript validation..."
npm run typecheck

if [ -n "$(git status --porcelain)" ]; then
  echo "Build and checks passed - committing changes before deploy..."
  VERSION="$(node -p "require('./package.json').version")"
  git add -A
  git commit -m "Deploy: v${VERSION}"
else
  echo "No changes to commit - working tree already clean."
fi

echo "Deploying Lead Vault to Firebase Hosting site lead-vault..."
firebase deploy --project taliferrotech --only hosting:lead-vault

echo "Lead Vault hosting deploy complete."
