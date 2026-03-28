#!/usr/bin/env bash
# apply-migrations.sh — Apply pending SQL migrations to the dev database.
# Skips migrations already recorded in supabase_migrations.schema_migrations.
#
# Usage: ./scripts/apply-migrations.sh

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

# Ensure migration tracking schema exists
psql_cmd <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text,
  statements text[]
);
SQL

applied=0
skipped=0

for f in supabase/supabase/migrations/*.sql; do
  version=$(basename "$f" | cut -d_ -f1)
  name=$(basename "${f%.sql}" | sed 's/^[0-9]*_//')

  already_applied=$(psql_cmd -tA -c "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '$version'")
  if [ "$already_applied" -gt 0 ]; then
    skipped=$((skipped + 1))
    continue
  fi

  log "Applying: $name"
  psql_cmd < "$f"
  psql_cmd -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$name');"
  applied=$((applied + 1))
done

ok "Done — $applied applied, $skipped skipped"
