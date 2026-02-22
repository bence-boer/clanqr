#!/usr/bin/env bash
# dev-setup.sh -- Bootstrap the local development environment from a fresh clone.
# Idempotent: safe to re-run at any time.
#
# Prerequisites: bun, docker (with docker compose plugin)
# Usage: ./scripts/dev-setup.sh   (or: bun run dev:setup)

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

log()  { printf "[INFO] %s\n" "$*"; }
ok()   { printf "[ OK ] %s\n" "$*"; }
err()  { printf "[ERR ] %s\n" "$*" >&2; }
fail() { err "$@"; exit 1; }

# -- 1. Prerequisites ----------------------------------------------------------

for cmd in bun docker; do
  command -v "$cmd" &>/dev/null || fail "'$cmd' is not installed. See README.md for instructions."
done

docker compose version &>/dev/null || fail "'docker compose' plugin is not available."

if ! docker info &>/dev/null; then
  log "Docker daemon is not running. Attempting to start..."
  sudo systemctl start docker || fail "Could not start Docker. Start it manually and re-run."
fi
ok "Prerequisites satisfied"

# -- 2. Install dependencies ----------------------------------------------------

log "Installing server dependencies..."
(cd server && bun install)

log "Installing web dependencies..."
(cd web && bun install)

if [ -d e2e ]; then
  log "Installing E2E test dependencies..."
  (cd e2e && bun install)
fi
ok "Dependencies installed"

# -- 3. Playwright browsers -----------------------------------------------------

if [ -d e2e ]; then
  log "Installing Playwright browsers (chromium)..."
  (cd e2e && bun x playwright install --with-deps chromium) \
    || err "Playwright install failed. E2E tests will not work until resolved. Run: cd e2e && bun x playwright install --with-deps chromium"
fi

# -- 4. Git hooks ---------------------------------------------------------------

log "Installing git hooks..."
if [ -d .git ]; then
  mkdir -p .git/hooks
  cp scripts/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  ok "Pre-commit hook installed"
else
  err "Not a git repository -- skipping hook installation"
fi

# -- 5. Environment files -------------------------------------------------------
# Bun loads .env.local from the working directory. The server process runs from
# server/, so it needs its own copy.

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  log "Created .env.local from .env.example"
else
  log ".env.local already exists -- skipping"
fi

if [ ! -f server/.env.local ]; then
  cp .env.local server/.env.local
  log "Copied .env.local to server/.env.local"
else
  log "server/.env.local already exists -- skipping"
fi
ok "Environment files ready"

# -- 6. Docker stack (Postgres + PostgREST + nginx gateway) ---------------------

log "Starting local database stack..."
docker compose -f docker-compose.dev.yml up -d

log "Waiting for database to accept connections..."
for i in $(seq 1 30); do
  if docker exec ralph_dev_db pg_isready -U postgres &>/dev/null; then
    ok "Database is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "Database did not become ready within 30 seconds."
  fi
  sleep 1
done

# -- 7. Migrations + seed data --------------------------------------------------

log "Applying migrations and seed data..."
./scripts/dev-db-reset.sh

# -- Done -----------------------------------------------------------------------

ok "Setup complete"
echo ""
echo "Start developing:"
echo "  bun run dev           Start server + web (hot reload)"
echo "  bun run test          Run unit tests"
echo "  bun run test:e2e      Run E2E tests (requires dev stack running)"
echo "  bun run check         Type-check server + web"
echo "  bun run dev:db:reset  Reset database to clean state"
