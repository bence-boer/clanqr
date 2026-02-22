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

log "Inserting seed data..."
psql_cmd <<'SQL'
-- Dev project
INSERT INTO projects (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dev Project', 'Local development test project')
ON CONFLICT (id) DO NOTHING;

-- Dev passkey (bypasses real WebAuthn)
INSERT INTO passkeys (id, credential_id, public_key, counter, device_type, display_name)
VALUES ('dev-passkey', 'dev-credential', 'dev-public-key', 0, 'singleDevice', 'Dev Passkey')
ON CONFLICT (id) DO NOTHING;

-- Admin passkey
INSERT INTO passkeys (id, credential_id, public_key, counter, device_type, display_name, role)
VALUES ('dev-admin', 'dev-admin-credential', 'dev-admin-key', 0, 'singleDevice', 'Dev Admin', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Long-lived dev session (expires 2099)
INSERT INTO sessions (id, passkey_id, token, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'dev-passkey',
  'dev-session-token',
  '2099-12-31T23:59:59Z'
) ON CONFLICT (id) DO NOTHING;

-- Admin session (expires 2099)
INSERT INTO sessions (id, passkey_id, token, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'dev-admin',
  'dev-admin-session-token',
  '2099-12-31T23:59:59Z'
) ON CONFLICT (id) DO NOTHING;
SQL

ok "Database reset complete"
echo "  Session token:       dev-session-token"
echo "  Admin session token: dev-admin-session-token"
