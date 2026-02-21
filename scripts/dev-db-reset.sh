#!/usr/bin/env bash
# dev-db-reset.sh — Drop and recreate the local dev database, applying all migrations.
# Run from the repo root: ./scripts/dev-db-reset.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DB_CONTAINER="ralph_dev_db"
DB_USER="postgres"
DB_NAME="postgres"

if ! docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" &>/dev/null; then
  echo "❌ Database container '$DB_CONTAINER' is not running."
  echo "   Start it with: docker compose -f docker-compose.dev.yml up -d"
  exit 1
fi

psql_cmd() {
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

echo "🗑️  Dropping existing schema..."
psql_cmd -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;"

# Create the supabase_migrations tracking table so the same migration logic works
echo "📋 Creating migration tracking..."
psql_cmd <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text,
  statements text[]
);
SQL

echo "📋 Applying migrations..."
for f in supabase/supabase/migrations/*.sql; do
  version=$(basename "$f" | cut -d_ -f1)
  name=$(basename "${f%.sql}" | sed 's/^[0-9]*_//')
  echo "  → $name"
  psql_cmd < "$f"
  psql_cmd -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '$name') ON CONFLICT DO NOTHING;"
done

echo "🌱 Seeding dev data..."
psql_cmd <<'SQL'
-- Insert a dev project
INSERT INTO projects (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dev Project', 'Local development test project')
ON CONFLICT (id) DO NOTHING;

-- Insert a passkey for local dev (bypasses real WebAuthn)
INSERT INTO passkeys (id, credential_id, public_key, counter, device_type, display_name)
VALUES ('dev-passkey', 'dev-credential', 'dev-public-key', 0, 'singleDevice', 'Dev Passkey')
ON CONFLICT (id) DO NOTHING;

-- Insert an admin passkey
INSERT INTO passkeys (id, credential_id, public_key, counter, device_type, display_name, role)
VALUES ('dev-admin', 'dev-admin-credential', 'dev-admin-key', 0, 'singleDevice', 'Dev Admin', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Create a long-lived dev session
INSERT INTO sessions (id, passkey_id, token, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'dev-passkey',
  'dev-session-token',
  '2099-12-31T23:59:59Z'
) ON CONFLICT (id) DO NOTHING;

-- Create an admin session
INSERT INTO sessions (id, passkey_id, token, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'dev-admin',
  'dev-admin-session-token',
  '2099-12-31T23:59:59Z'
) ON CONFLICT (id) DO NOTHING;
SQL

echo "✅ Database reset complete with dev seed data."
echo "   Dev session token: dev-session-token"
echo "   Admin session token: dev-admin-session-token"
