#!/usr/bin/env bash
# dev-db-reset.sh -- Drop and recreate the local dev database.
# Applies all migrations and inserts seed data for local development.
# Idempotent: safe to re-run at any time.
#
# Usage: ./scripts/dev-db-reset.sh   (or: bun run dev:db:reset)

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DB_CONTAINER="ralph_dev_db"
DB_USER="postgres"
DB_NAME="postgres"

log()  { printf "[INFO] %s\n" "$*"; }
ok()   { printf "[ OK ] %s\n" "$*"; }
fail() { printf "[ERR ] %s\n" "$*" >&2; exit 1; }

docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" &>/dev/null \
  || fail "Container '$DB_CONTAINER' is not running. Start it with: bun run dev:db"

psql_cmd() {
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

log "Dropping existing schema..."
psql_cmd -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;"

log "Creating migration tracking schema..."
psql_cmd <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text,
  statements text[]
);
SQL

log "Applying migrations..."
for f in supabase/supabase/migrations/*.sql; do
  version=$(basename "$f" | cut -d_ -f1)
  name=$(basename "${f%.sql}" | sed 's/^[0-9]*_//')
  log "  $name"
  psql_cmd < "$f"
  psql_cmd -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$name') ON CONFLICT DO NOTHING;"
done

if [ -f "supabase/supabase/seed.sql" ]; then
  log "Inserting seed data from supabase/supabase/seed.sql..."
  psql_cmd < supabase/supabase/seed.sql
else
  log "No seed.sql found — skipping seed data"
fi

ok "Database reset complete"
echo "  Session token:       dev-session-token"
echo "  Admin session token: dev-admin-session-token"
