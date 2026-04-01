#!/usr/bin/env bash
# test-db-reset.sh — Drop, rebuild, and seed the test database.
# Applies all migrations from supabase/supabase/migrations/ in order,
# then inserts dev seed data (users, sessions, project).
#
# Usage: ./scripts/test-db-reset.sh
# Requires: ralph_test_db container running (docker-compose.test.yml)

set -euo pipefail

CONTAINER="ralph_test_db"
DB_USER="postgres"
DB_NAME="postgres"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/supabase/migrations" && pwd)"

run_sql() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "$1"
}

run_sql_file() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$1"
}

echo "==> Resetting public schema..."
run_sql "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;"

echo "==> Creating supabase_migrations tracking schema..."
run_sql "
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT,
    statements_applied BIGINT DEFAULT 0
);
"

echo "==> Applying migrations..."
for migration in "$MIGRATIONS_DIR"/*.sql; do
  filename="$(basename "$migration")"
  version="${filename%%_*}"
  name="${filename%.sql}"
  name="${name#*_}"
  echo "    Applying $filename"
  run_sql_file "$migration"
  run_sql "INSERT INTO supabase_migrations.schema_migrations (version, name, statements_applied) VALUES ('$version', '$name', 1) ON CONFLICT (version) DO NOTHING;"
done

echo "==> Seeding test data..."
run_sql "
-- Test users (GitHub OAuth)
INSERT INTO users (id, github_id, username, display_name, avatar_url, email, role)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'dev-user', 'Dev User', 'https://avatars.githubusercontent.com/u/1', 'dev@test.local', 'member'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 2, 'dev-admin', 'Dev Admin', 'https://avatars.githubusercontent.com/u/2', 'admin@test.local', 'admin');

-- Dev session tokens (expire far in the future)
INSERT INTO sessions (user_id, token, github_access_token, expires_at)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'dev-session-token', 'gho_fake_user_token', NOW() + INTERVAL '1 year'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'dev-admin-session-token', 'gho_fake_admin_token', NOW() + INTERVAL '1 year');

-- Test project
INSERT INTO projects (name, description, status, created_by)
VALUES ('Test Project', 'Seeded by test-db-reset.sh', 'active', 'aaaaaaaa-0000-0000-0000-000000000002');
"

echo "==> Done. Test database is ready."
