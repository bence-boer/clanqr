#!/usr/bin/env bash
# dev-setup.sh — One-time local development environment setup
# Run from the repo root: ./scripts/dev-setup.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== Ralph Agent Workspace — Local Dev Setup ==="

# 1. Check prerequisites
for cmd in bun docker; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ Missing prerequisite: $cmd"
    echo "   Install bun: https://bun.sh"
    echo "   Install docker: sudo pacman -S docker docker-compose"
    exit 1
  fi
done

# 2. Ensure Docker is running
if ! docker info &>/dev/null; then
  echo "⚠️  Docker daemon is not running. Starting it..."
  sudo systemctl start docker
fi

# 3. Install dependencies
echo "📦 Installing dependencies..."
(cd server && bun install)
(cd web && bun install)

# 4. Install Playwright browsers (for E2E tests)
echo "🎭 Installing Playwright browsers..."
(cd e2e && bun x playwright install --with-deps chromium) || echo "⚠️  Playwright install failed — E2E tests may not work until you run: cd e2e && bun x playwright install --with-deps chromium"

# 5. Set up git hooks
echo "🪝 Installing git hooks..."
bun run prepare

# 6. Start local database
echo "🐘 Starting local Postgres + PostgREST..."
docker compose -f docker-compose.dev.yml up -d

# 7. Wait for DB to be ready
echo "⏳ Waiting for database..."
for i in $(seq 1 30); do
  if docker exec ralph_dev_db pg_isready -U postgres &>/dev/null; then
    echo "✅ Database is ready"
    break
  fi
  sleep 1
done

# 8. Apply migrations
echo "📋 Applying database migrations..."
./scripts/dev-db-reset.sh

# 9. Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "📝 Created .env.local from .env.example"
else
  echo "📝 .env.local already exists — skipping"
fi

echo ""
echo "✅ Setup complete! Start developing with:"
echo "   bun run dev          — Start server + web with hot reload"
echo "   bun run test         — Run unit tests"
echo "   bun run test:e2e     — Run E2E tests"
echo "   bun run check        — Type-check everything"
