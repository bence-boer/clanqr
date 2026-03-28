#!/usr/bin/env bash
# gen-types.sh — Generate Supabase TypeScript types from any environment.
#
# Strategy:
#   1. If the dev DB container (ralph_dev_db) is running → use it directly (fast)
#   2. Otherwise → spin up an ephemeral container, apply all migrations, gen types, tear down
#
# This works on dev machines, CI, and the target (production) machine without
# conflicting with any running database.
#
# Usage: ./scripts/gen-types.sh   (or: bun run gen-types)

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

OUTPUT_FILE="server/src/database.types.ts"
MIGRATIONS_DIR="supabase/supabase/migrations"
EPHEMERAL_CONTAINER="ralph_types_db"
EPHEMERAL_PORT="54399"

log()  { printf "[gen-types] %s\n" "$*"; }
ok()   { printf "[gen-types] ✅ %s\n" "$*"; }
err()  { printf "[gen-types] ❌ %s\n" "$*" >&2; }

cleanup_ephemeral() {
    if docker inspect "$EPHEMERAL_CONTAINER" &>/dev/null 2>&1; then
        docker rm -f "$EPHEMERAL_CONTAINER" &>/dev/null 2>&1 || true
    fi
}

# ── Try dev DB first (fast path) ─────────────────────────────────────────────

if docker exec ralph_dev_db pg_isready -U postgres &>/dev/null 2>&1; then
    log "Using running dev database (ralph_dev_db on port 54322)"
    DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"
    TMPFILE="$(mktemp)"
    if npx supabase gen types typescript --db-url "$DB_URL" > "$TMPFILE" && [ -s "$TMPFILE" ]; then
        mv "$TMPFILE" "$OUTPUT_FILE"
        ok "Types generated from dev database"
    else
        rm -f "$TMPFILE"
        err "Failed to generate types from dev database"
        exit 1
    fi
    exit 0
fi

# ── Ephemeral container (works anywhere) ──────────────────────────────────────

log "No dev database found — using ephemeral container"

# Clean up any leftover from a previous failed run
cleanup_ephemeral

trap cleanup_ephemeral EXIT

log "Starting ephemeral PostgreSQL on port $EPHEMERAL_PORT..."
docker run -d \
    --name "$EPHEMERAL_CONTAINER" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=postgres \
    -p "${EPHEMERAL_PORT}:5432" \
    postgres:17-alpine \
    > /dev/null

# Wait for readiness (max 30s)
for attempt in $(seq 1 30); do
    if docker exec "$EPHEMERAL_CONTAINER" pg_isready -U postgres &>/dev/null 2>&1; then
        break
    fi
    if [ "$attempt" -eq 30 ]; then
        err "Ephemeral database did not start within 30 seconds"
        exit 1
    fi
    sleep 1
done

log "Applying migrations..."
PSQL="docker exec -i $EPHEMERAL_CONTAINER psql -U postgres -d postgres"

# Create migration tracking schema (matches deploy pipeline)
$PSQL <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    name text,
    statements text[]
);
SQL

for migration in "$MIGRATIONS_DIR"/*.sql; do
    name=$(basename "${migration%.sql}" | sed 's/^[0-9]*_//')
    log "  $name"
    $PSQL < "$migration" > /dev/null
done

DB_URL="postgresql://postgres:postgres@localhost:${EPHEMERAL_PORT}/postgres"
log "Generating types..."
TMPFILE="$(mktemp)"
if npx supabase gen types typescript --db-url "$DB_URL" > "$TMPFILE" && [ -s "$TMPFILE" ]; then
    mv "$TMPFILE" "$OUTPUT_FILE"
    ok "Types generated from ephemeral database"
else
    rm -f "$TMPFILE"
    err "Failed to generate types from ephemeral database"
    exit 1
fi
