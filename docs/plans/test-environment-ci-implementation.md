# Implementation Plan: Test Environment & Dual CI/CD Pipeline

> **Status:** Ready for implementation
> **Branch:** `feature/test-environment-ci`
> **Based on:** `docs/plans/test-environment-ci.md` (plan-plan)
> **Methodology:** Meta-engineer framework — release + integration scenarios

---

## Table of Contents

1. [Core Invariant & Architecture Decisions](#1-core-invariant--architecture-decisions)
2. [Phase 1: Infrastructure — Dual Database & Services](#2-phase-1-infrastructure--dual-database--services)
3. [Phase 2: Nginx & SSL](#3-phase-2-nginx--ssl)
4. [Phase 3: GitHub Actions Workflows](#4-phase-3-github-actions-workflows)
5. [Phase 4: E2E Test Adaptation](#5-phase-4-e2e-test-adaptation)
6. [Phase 5: CI E2E Integration](#6-phase-5-ci-e2e-integration)
7. [Phase 6: Branch Protection & Promotion Flow](#7-phase-6-branch-protection--promotion-flow)
8. [Failure Mode Analysis](#8-failure-mode-analysis)
9. [Validation Checklist](#9-validation-checklist)
10. [Rollback & Recovery](#10-rollback--recovery)
11. [Appendix: Complete File Inventory](#11-appendix-complete-file-inventory)

---

## 1. Core Invariant & Architecture Decisions

### 1.1 Core Invariant

> **Production (`main` → `clanqr.dev`) never receives code that has not passed E2E tests on the test environment (`develop` → `test.clanqr.dev`).**

This is enforced by:
- Branch protection on `main` requiring the `e2e` status check from `deploy-test.yml`
- The `e2e` check only runs on `develop` pushes (after deploying to test)
- PRs to `main` can only come from `develop` (enforced by convention and review)

### 1.2 Architecture Decisions

Every decision below was evaluated against alternatives documented in the plan-plan. Rationale follows each.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Test auth strategy | **Option B**: Allow dev tokens when `NODE_ENV === 'test'` | Minimal code change (one condition in auth.ts). Test env is distinct from production. Dev tokens are explicitly allowlisted, not a blanket bypass. Option A (`NODE_ENV=development`) enables ALL dev bypasses. Options C-E require significant new infrastructure. |
| D2 | Checkout directories | **Separate clones**: prod at existing path, test at `/home/scoy/Developer/repositories/ralph-test` | `git reset --hard` is destructive. Shared checkout would cause race conditions between deploy-test and deploy-production. |
| D3 | systemd service pattern | **Template units**: `ralph-api@.service`, `ralph-web@.service` | DRY. One template serves both `@prod` and `@test` instances. Environment-specific config comes from `EnvironmentFile`. Eliminates copy-paste drift. |
| D4 | Deploy trigger mechanism | **Per-environment path units**: `.deploy-trigger-prod` and `.deploy-trigger-test` watched by `ralph-deploy@{prod,test}.path` | Keeps existing systemd-path-trigger pattern. Each environment restarts independently. |
| D5 | Test database lifecycle | **Persistent with pre-E2E reset option** | Full reset before every E2E run ensures deterministic test state. Migrations are applied from scratch each time. Fast on Pi (17 migrations, seconds). |
| D6 | GitHub Actions secrets | **GitHub Actions environments** (`production` and `test`) with environment-scoped secrets | Native GHA feature. Cleaner than prefixed secret names. Enables environment-level approval gates later. |
| D7 | E2E job structure | **Separate `e2e` job** (not a step in deploy) | Can be re-run independently without re-deploying. Clear pass/fail signal in PR status checks. |
| D8 | Playwright on ARM64 | **apt-installed Chromium** with `executablePath` in playwright config | Playwright's bundled Chromium may not have ARM64 builds. System Chromium via `apt install chromium-browser` is reliable on Raspberry Pi OS. |
| D9 | Agent execution tests | **Skip in CI initially** via `test.skip` with `CI` env check | These tests require Docker daemon + Copilot CLI + GPT-4.1 access + 10min timeouts. Too slow and resource-intensive for CI gating. Enable later as a separate optional workflow. |
| D10 | PR checks working directory | **Temporary directory via `actions/checkout`** | PR checks don't deploy, so they don't need a persistent checkout. Standard checkout action is simpler and avoids interfering with deployment directories. However, since this is a self-hosted runner and `actions/checkout` may conflict with the destructive `git reset` approach, use a dedicated `/tmp/ralph-pr-${{ github.run_id }}` directory with cleanup. |
| D11 | Copilot CLI dual instances | **Share the same binary, different `PORT` env var** | The Copilot CLI headless server uses `PORT` to listen. Two systemd services (`copilot-cli@prod.service`, `copilot-cli@test.service`) with different `PORT` values in their env files. Same auth token (same GitHub account). |
| D12 | Git merge strategy | **`--no-ff` merge** (no linear history requirement) | Per AGENTS.md §12: "Merge with `git merge --no-ff`". Branch protection should NOT require linear history. |
| D13 | Nginx configuration | **Separate config files per domain** in `/etc/nginx/sites-available/` | Standard nginx pattern. Enables independent enable/disable per domain. |
| D14 | SSL certificates | **Individual certs** (not wildcard) via certbot nginx plugin | Simpler setup. Wildcard requires DNS challenge (more complex). Two certbot invocations. |
| D15 | Test DB container naming | `ralph_test_db` (Postgres), `ralph_test_rest` (PostgREST), `ralph_test_gateway` (Nginx) | Consistent with dev naming pattern (`ralph_dev_db`, etc.). |
| D16 | Domain transition | **Parallel operation** — keep `agents.benceboer.com` working alongside `clanqr.dev` during transition | Zero-downtime migration. Remove old domain config after verification. |
| D17 | `PUBLIC_API_URL` in web build | **Empty string** for both environments (relative API paths through nginx proxy) | Current production already uses `PUBLIC_API_URL=` (empty). Nginx proxies `/api/*` to the correct backend per domain. |
| D18 | Web port for test environment | **Port 3012** (SvelteKit node adapter) | Non-conflicting with production port 3002. |
| D19 | Rate limiting for test env | **Same as production** (100 req/min global) | Test environment should behave like production for accurate E2E. `NODE_ENV=test` is not `development`, so the 500/min dev rate doesn't apply. The E2E tests run sequentially with 1 worker, which should stay well under limits. |

### 1.3 Port Allocation (Finalized)

| Service | Production | Test | Development (local) |
|---------|-----------|------|-------------------|
| API (Hono) | 3001 | 3011 | 3001 |
| Web (SvelteKit) | 3002 | 3012 | 5173 |
| Supabase Gateway | 54321 | 54331 | 54321 |
| Postgres (host-mapped) | 5432 (in container) | 5433 | 54322 |
| Copilot CLI | 4321 | 4322 | — |

### 1.4 Environment Variables (Finalized)

| Variable | Production (`/etc/ralph-api-prod.env`) | Test (`/etc/ralph-api-test.env`) |
|----------|---------------------------------------|--------------------------------|
| `PORT` | `3001` | `3011` |
| `NODE_ENV` | `production` | `test` |
| `SUPABASE_URL` | `http://172.17.0.1:54321` | `http://172.17.0.1:54331` |
| `SUPABASE_KEY` | `<prod-jwt-secret>` | `<test-jwt-secret>` |
| `RP_ID` | `clanqr.dev` | `test.clanqr.dev` |
| `RP_ORIGIN` | `https://clanqr.dev` | `https://test.clanqr.dev` |
| `FRONTEND_URL` | `https://clanqr.dev` | `https://test.clanqr.dev` |
| `COPILOT_BIN` | `/home/scoy/.local/bin/copilot` | `/home/scoy/.local/bin/copilot` |
| `LOG_LEVEL` | `info` | `debug` |
| `MAX_CONCURRENT_AGENTS` | `3` | `2` |
| `WORKSPACE_DIR` | (default — `agents/workspace`) | `/home/scoy/Developer/repositories/ralph-test/agents/workspace` |

### 1.5 GitHub Actions Secrets (Environment-Scoped)

Create two GitHub Actions environments: `production` and `test`.

| Secret | `production` value | `test` value |
|--------|-------------------|-------------|
| `SUPABASE_KEY` | Current production service-role key | Generated test JWT secret |
| `RP_ID` | `clanqr.dev` | `test.clanqr.dev` |
| `RP_ORIGIN` | `https://clanqr.dev` | `https://test.clanqr.dev` |
| `FRONTEND_URL` | `https://clanqr.dev` | `https://test.clanqr.dev` |

Repository-level secret (shared):
| Secret | Value |
|--------|-------|
| `GITHUB_TOKEN` | (automatic) |

---

## 2. Phase 1: Infrastructure — Dual Database & Services

### 2.1 Deliverables

- [ ] `docker-compose.test.yml` for test Supabase stack
- [ ] `nginx.test.conf` for test Supabase gateway (inside Docker)
- [ ] `scripts/test-db-reset.sh` for test DB seeding
- [ ] systemd template unit files documented (created on Pi during deploy)
- [ ] Separate git clone for test environment initialized on Pi

### 2.2 File: `docker-compose.test.yml`

**Create new file** at repository root, modeled after `docker-compose.dev.yml`.

```yaml
# docker-compose.test.yml — Test environment Supabase stack
# Runs alongside production Supabase on different ports.
# Started by deploy-test.yml workflow.
services:
  db:
    image: postgres:17-alpine
    container_name: ralph_test_db
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres-test-env
      POSTGRES_DB: postgres
    volumes:
      - ralph_test_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10

  rest:
    image: postgrest/postgrest:v12.2.8
    container_name: ralph_test_rest
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      PGRST_DB_URI: postgres://postgres:postgres-test-env@db:5432/postgres
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: postgres
      PGRST_JWT_SECRET: test-environment-jwt-secret-with-at-least-32-characters-long
      PGRST_DB_USE_LEGACY_GUCS: "false"
    depends_on:
      db:
        condition: service_healthy

  gateway:
    image: nginx:alpine
    container_name: ralph_test_gateway
    restart: unless-stopped
    ports:
      - "54331:80"
    volumes:
      - ./nginx.test.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - rest

volumes:
  ralph_test_pgdata:
```

**Key differences from `docker-compose.dev.yml`:**
- Container names: `ralph_test_*` (not `ralph_dev_*`)
- Host Postgres port: `5433` (not `54322`)
- Host gateway port: `54331` (not `54321`)
- Different password: `postgres-test-env` (not `postgres`)
- Different JWT secret
- `restart: unless-stopped` (persistent — not dev-only)

### 2.3 File: `nginx.test.conf`

**Create new file** at repository root. Identical routing to `nginx.dev.conf` — strips `/rest/v1/` prefix for Supabase JS client compatibility.

```nginx
server {
    listen 80;
    server_name localhost;

    location /rest/v1/ {
        rewrite ^/rest/v1/(.*)$ /$1 break;
        proxy_pass http://rest:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://rest:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

> **Note:** This is the Docker-internal nginx gateway for PostgREST. The _external_ nginx (§3) handles domain routing to the backend/frontend services.

### 2.4 File: `scripts/test-db-reset.sh`

**Create new file.** Adapted from `scripts/dev-db-reset.sh`, targeting `ralph_test_db`.

```bash
#!/usr/bin/env bash
# test-db-reset.sh — Reset and seed the test environment database.
# Targets: ralph_test_db container (from docker-compose.test.yml)
# Idempotent: safe to re-run before each E2E test run.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CONTAINER="ralph_test_db"

log()  { printf "[INFO] %s\n" "$*"; }
ok()   { printf "[ OK ] %s\n" "$*"; }
err()  { printf "[ERR ] %s\n" "$*" >&2; }

run_sql() {
    docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "$1"
}

run_sql_file() {
    docker exec -i "$CONTAINER" psql -U postgres -d postgres < "$1"
}

# -- 1. Drop and recreate schema -----------------------------------------------
log "Dropping existing schema..."
run_sql "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;"

# -- 2. Create migration tracking ----------------------------------------------
run_sql "CREATE SCHEMA IF NOT EXISTS supabase_migrations;"
run_sql "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    name text,
    statements text[]
);"

# -- 3. Apply all migrations ---------------------------------------------------
log "Applying migrations..."
for f in "$ROOT"/supabase/supabase/migrations/*.sql; do
    filename=$(basename "$f")
    version="${filename%%_*}"
    name="${filename#*_}"
    name="${name%.sql}"

    log "  Applying: $filename"
    run_sql_file "$f"
    run_sql "INSERT INTO supabase_migrations.schema_migrations (version, name)
             VALUES ('$version', '$name') ON CONFLICT DO NOTHING;"
done

# -- 4. Seed test data ---------------------------------------------------------
log "Inserting seed data..."

run_sql "INSERT INTO projects (id, name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Test Project')
    ON CONFLICT (id) DO NOTHING;"

run_sql "INSERT INTO passkeys (id, credential_id, public_key, counter, device_type) VALUES
    ('dev-passkey', 'dev-credential', 'dev-public-key', 0, 'singleDevice'),
    ('dev-admin', 'dev-admin-credential', 'dev-admin-key', 0, 'singleDevice')
    ON CONFLICT (id) DO NOTHING;"

run_sql "UPDATE passkeys SET role = 'admin' WHERE id = 'dev-admin';"

run_sql "INSERT INTO sessions (id, passkey_id, token, expires_at) VALUES
    ('00000000-0000-0000-0000-000000000002', 'dev-passkey', 'dev-session-token', '2099-12-31T23:59:59Z'),
    ('00000000-0000-0000-0000-000000000003', 'dev-admin', 'dev-admin-session-token', '2099-12-31T23:59:59Z')
    ON CONFLICT (id) DO NOTHING;"

ok "Test database reset complete"
echo "  Session token:       dev-session-token"
echo "  Admin session token: dev-admin-session-token"
```

**Make executable:** `chmod +x scripts/test-db-reset.sh`

### 2.5 systemd Service Templates (Documentation — Created on Pi)

These files are **not committed to the repo** — they are created on the Pi during initial setup. The plan documents them for the implementing agent.

#### `ralph-api@.service`

```ini
# /etc/systemd/system/ralph-api@.service
[Unit]
Description=Ralph API (%i)
After=network.target docker.service

[Service]
Type=simple
User=scoy
WorkingDirectory=/home/scoy/Developer/repositories/ralph-%i
EnvironmentFile=/etc/ralph-api-%i.env
ExecStart=/home/scoy/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Instances:** `ralph-api@prod.service` and `ralph-api@test.service`

**Working directories:**
- `ralph-prod` → symlink or rename of existing `clanqr`
- `ralph-test` → new clone at `/home/scoy/Developer/repositories/ralph-test`

> **Decision:** Rather than renaming the existing directory (which would break many scripts and references), create a symlink: `ln -s clanqr ralph-prod`. This preserves backward compatibility while enabling the template pattern.

#### `ralph-web@.service`

```ini
# /etc/systemd/system/ralph-web@.service
[Unit]
Description=Ralph Web (%i)
After=ralph-api@%i.service

[Service]
Type=simple
User=scoy
WorkingDirectory=/home/scoy/Developer/repositories/ralph-%i/web
EnvironmentFile=/etc/ralph-web-%i.env
ExecStart=/home/scoy/.bun/bin/bun run build/index.js
Environment=PORT=%i_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> **Note:** The `PORT` for web must be set differently. Since systemd `%i` can't do arithmetic, use a separate env file:
> - `/etc/ralph-web-prod.env`: `PORT=3002`
> - `/etc/ralph-web-test.env`: `PORT=3012`

#### Deploy trigger path units

```ini
# /etc/systemd/system/ralph-deploy@.path
[Unit]
Description=Watch deploy trigger for Ralph (%i)

[Path]
PathModified=/home/scoy/Developer/repositories/ralph-%i/.deploy-trigger

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/ralph-deploy@.service
[Unit]
Description=Restart Ralph services (%i)

[Service]
Type=oneshot
ExecStart=/bin/systemctl restart ralph-api@%i.service
ExecStart=/bin/systemctl restart ralph-web@%i.service
```

> **Symlink note:** For production, the path unit watches `ralph-prod/.deploy-trigger` which resolves through the symlink to `clanqr/.deploy-trigger`.

### 2.6 Test Environment Initialization (One-Time Pi Setup)

The implementing agent must run these commands on the Pi (via the self-hosted runner or SSH):

```bash
# 1. Create test clone
cd /home/scoy/Developer/repositories
git clone https://github.com/bence-boer/clanqr.git ralph-test
cd ralph-test && git checkout develop

# 2. Create prod symlink
cd /home/scoy/Developer/repositories
ln -sfn clanqr ralph-prod

# 3. Start test Docker stack
cd ralph-test && docker compose -f docker-compose.test.yml up -d

# 4. Wait for test DB
for i in $(seq 1 30); do
  docker exec ralph_test_db pg_isready -U postgres && break
  sleep 1
done

# 5. Run initial test DB setup
./scripts/test-db-reset.sh

# 6. Install systemd units (copy the templates above)
sudo cp ralph-api@.service ralph-web@.service ralph-deploy@.path ralph-deploy@.service /etc/systemd/system/
sudo systemctl daemon-reload

# 7. Create env files
sudo tee /etc/ralph-api-test.env > /dev/null <<'EOF'
PORT=3011
NODE_ENV=test
SUPABASE_URL=http://172.17.0.1:54331
SUPABASE_KEY=<test-service-role-key>
RP_ID=test.clanqr.dev
RP_ORIGIN=https://test.clanqr.dev
FRONTEND_URL=https://test.clanqr.dev
LOG_LEVEL=debug
MAX_CONCURRENT_AGENTS=2
EOF
sudo chmod 600 /etc/ralph-api-test.env

sudo tee /etc/ralph-web-test.env > /dev/null <<'EOF'
PORT=3012
EOF

# 8. Rename existing env file
sudo mv /etc/ralph-api.env /etc/ralph-api-prod.env
sudo tee /etc/ralph-web-prod.env > /dev/null <<'EOF'
PORT=3002
EOF

# 9. Enable and start services
sudo systemctl enable --now ralph-api@prod ralph-api@test
sudo systemctl enable --now ralph-web@prod ralph-web@test
sudo systemctl enable --now ralph-deploy@prod.path ralph-deploy@test.path

# 10. Disable old services (if they exist)
sudo systemctl disable --now ralph-api ralph-web 2>/dev/null || true
```

### 2.7 Resource Budget Estimation

| Resource | Production | Test | Total | Pi Capacity | Risk |
|----------|-----------|------|-------|-------------|------|
| RAM — Postgres | ~100MB | ~100MB | ~200MB | 8GB | Low |
| RAM — PostgREST | ~30MB | ~30MB | ~60MB | | Low |
| RAM — Bun API | ~150MB | ~150MB | ~300MB | | Low |
| RAM — Bun Web | ~100MB | ~100MB | ~200MB | | Low |
| RAM — Nginx (Docker) | ~10MB | ~10MB | ~20MB | | Low |
| **Total baseline** | **~390MB** | **~390MB** | **~780MB** | **8GB** | **Low** |
| Disk — Postgres data | ~200MB | ~50MB | ~250MB | 64GB+ | Low |
| Disk — Git clone | ~500MB | ~500MB | ~1GB | | Low |

**With agents running** (worst case): Each agent container uses ~200-500MB. With `MAX_CONCURRENT_AGENTS=3` (prod) + `2` (test) = 5 concurrent agents → +2.5GB. Total peak: ~3.3GB / 8GB = 41%. **Acceptable.**

### 2.8 Phase 1 Done Definition

- Both Postgres containers respond to `pg_isready`
- Both PostgREST gateways respond on their ports (54321 and 54331)
- Both backend services start and `/health` returns `{"status":"ok"}`
- Both frontend builds serve the app on their ports (3002 and 3012)
- `free -h` shows <80% RAM usage with both environments idle

---

## 3. Phase 2: Nginx & SSL

### 3.1 Deliverables

- [ ] Nginx virtual host config for `clanqr.dev` (production)
- [ ] Nginx virtual host config for `test.clanqr.dev` (test)
- [ ] SSL certificates via certbot for both domains
- [ ] HTTP → HTTPS redirect for both domains
- [ ] Both domains resolve and serve correct environments

### 3.2 Prerequisites to Verify

Before implementing, verify on the Pi:

```bash
# Check existing nginx
nginx -v
cat /etc/nginx/nginx.conf
ls /etc/nginx/sites-available/ /etc/nginx/sites-enabled/

# Check DNS
dig clanqr.dev +short        # Must return Pi's public IP
dig test.clanqr.dev +short   # Must return Pi's public IP

# Check current config (likely for agents.benceboer.com)
cat /etc/nginx/sites-available/*

# Check if certbot is installed
certbot --version
```

**If DNS is not configured:** This is a blocking prerequisite. The domain owner must add A records for both `clanqr.dev` and `test.clanqr.dev` pointing to the Pi's public IP.

### 3.3 Nginx Config: `clanqr.dev`

```nginx
# /etc/nginx/sites-available/clanqr.dev
server {
    listen 80;
    server_name clanqr.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name clanqr.dev;

    ssl_certificate /etc/letsencrypt/live/clanqr.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clanqr.dev/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }

    # Health check (direct to API, no /api prefix strip needed)
    location = /health {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }

    # Frontend proxy
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3.4 Nginx Config: `test.clanqr.dev`

```nginx
# /etc/nginx/sites-available/test.clanqr.dev
server {
    listen 80;
    server_name test.clanqr.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name test.clanqr.dev;

    ssl_certificate /etc/letsencrypt/live/test.clanqr.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test.clanqr.dev/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API proxy — test ports
    location /api/ {
        proxy_pass http://127.0.0.1:3011;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }

    location = /health {
        proxy_pass http://127.0.0.1:3011;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3012;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3.5 SSL Setup Commands

```bash
# Install certbot if not present
sudo apt install -y certbot python3-certbot-nginx

# Get certificates (requires DNS to be configured)
sudo certbot --nginx -d clanqr.dev --non-interactive --agree-tos -m <email>
sudo certbot --nginx -d test.clanqr.dev --non-interactive --agree-tos -m <email>

# Enable sites
sudo ln -sf /etc/nginx/sites-available/clanqr.dev /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/test.clanqr.dev /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t && sudo systemctl reload nginx

# Verify auto-renewal timer
sudo systemctl status certbot.timer
```

### 3.6 Domain Transition from `agents.benceboer.com`

**Strategy:** Parallel operation during transition.

1. Keep the existing `agents.benceboer.com` nginx config active
2. Add `clanqr.dev` and `test.clanqr.dev` configs alongside
3. Update `FRONTEND_URL` and `RP_ORIGIN` in production env to `https://clanqr.dev`
4. Update passkey RP_ID — **this is a breaking change for existing passkeys**

> **Critical:** Changing `RP_ID` from `agents.benceboer.com` to `clanqr.dev` will invalidate all existing passkey registrations. Users will need to re-register passkeys. Plan this migration carefully:
> - Announce the domain change to users
> - During transition, consider accepting both RP_IDs (requires auth middleware change)
> - Or: wipe passkey records and have users re-register (acceptable for small user base)

### 3.7 Phase 2 Done Definition

- `curl -sf https://clanqr.dev/health` returns `{"status":"ok"}`
- `curl -sf https://test.clanqr.dev/health` returns `{"status":"ok"}`
- `curl -sf http://clanqr.dev` redirects to HTTPS (301)
- `curl -sf http://test.clanqr.dev` redirects to HTTPS (301)
- SSL certificates are valid (`openssl s_client -connect clanqr.dev:443`)
- `sudo certbot renew --dry-run` succeeds

---

## 4. Phase 3: GitHub Actions Workflows

### 4.1 Deliverables

- [ ] `deploy-production.yml` (replaces `deploy-pi.yml`)
- [ ] `deploy-test.yml` (new)
- [ ] `pr-checks.yml` (new)
- [ ] GitHub Actions environments configured
- [ ] Remove old `deploy-pi.yml`

### 4.2 File: `.github/workflows/deploy-production.yml`

**Replaces:** `.github/workflows/deploy-pi.yml`

```yaml
name: Deploy Production

on:
  push:
    branches: ['main']
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  APP_DIR: /home/scoy/Developer/repositories/clanqr
  BUN_INSTALL: /home/scoy/.bun

jobs:
  sanity-checks:
    runs-on: [self-hosted, pi]
    steps:
      - name: Pull latest code
        run: |
          cd $APP_DIR
          git fetch https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${{ github.repository }}.git main
          git reset --hard FETCH_HEAD

      - name: Install dependencies
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/server && bun install --frozen-lockfile
          cd $APP_DIR/web && bun install --frozen-lockfile

      - name: Type-check server
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/server && bun run --bun tsc --noEmit

      - name: Type-check web
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/web && bun run --bun check

      - name: Run unit tests
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/server && bun test

  deploy:
    needs: sanity-checks
    runs-on: [self-hosted, pi]
    environment: production
    env:
      ENV_FILE: /etc/ralph-api-prod.env
    steps:
      - name: Setup environment
        run: |
          cat > /tmp/ralph-api-prod.env << 'ENVEOF'
          SUPABASE_URL=http://172.17.0.1:54321
          SUPABASE_KEY=${{ secrets.SUPABASE_KEY }}
          RP_ID=${{ secrets.RP_ID }}
          RP_ORIGIN=${{ secrets.RP_ORIGIN }}
          FRONTEND_URL=${{ secrets.FRONTEND_URL }}
          NODE_ENV=production
          PORT=3001
          ENVEOF
          sudo cp /tmp/ralph-api-prod.env $ENV_FILE
          sudo chmod 600 $ENV_FILE
          rm /tmp/ralph-api-prod.env

      - name: Build agent base image
        run: |
          cd $APP_DIR
          docker build -t ralph-agent-base:latest -f server/Dockerfile.agent server/

      - name: Apply database migrations
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR

          APPLIED=$(docker exec supabase_db_supabase psql -U postgres -d postgres -t -A -c \
            "SELECT version FROM supabase_migrations.schema_migrations" 2>/dev/null || echo "")

          for f in supabase/supabase/migrations/*.sql; do
            VERSION=$(basename "$f" | cut -d_ -f1)
            if echo "$APPLIED" | grep -q "^${VERSION}$"; then
              echo "  Skip (already applied): $(basename $f)"
              continue
            fi
            echo "  Applying: $(basename $f)"
            NAME=$(basename "$f" | sed 's/^[0-9]*_//; s/\.sql$//')
            {
              echo "BEGIN;"
              cat "$f"
              echo "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$VERSION', '$NAME');"
              echo "COMMIT;"
            } | docker exec -i supabase_db_supabase psql -U postgres -d postgres
            if [ $? -ne 0 ]; then
              echo "::error::Migration failed: $(basename $f)"
              exit 1
            fi
          done

      - name: Build web
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/web
          PUBLIC_API_URL= bun --bun run build

      - name: Trigger service restart
        run: touch $APP_DIR/.deploy-trigger

      - name: Verify deployment
        run: |
          sleep 10
          for i in $(seq 1 6); do
            if docker run --rm --network host curlimages/curl \
              -sf http://localhost:3001/health; then
              echo "API health check passed"
              break
            fi
            if [ "$i" -eq 6 ]; then
              echo "::error::API health check failed after 6 attempts"
              exit 1
            fi
            echo "Retry $i/6..."
            sleep 5
          done

          for i in $(seq 1 6); do
            if docker run --rm --network host curlimages/curl \
              -sf http://localhost:3002; then
              echo "Web health check passed"
              break
            fi
            if [ "$i" -eq 6 ]; then
              echo "::error::Web health check failed after 6 attempts"
              exit 1
            fi
            echo "Retry $i/6..."
            sleep 5
          done

      - name: Rollback on failure
        if: failure()
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR
          echo "::warning::Rolling back to previous commit"
          git reset --hard HEAD~1
          cd server && bun install --frozen-lockfile
          cd ../web && bun install --frozen-lockfile
          PUBLIC_API_URL= bun --bun run build
          cd ..
          touch .deploy-trigger
          echo "::warning::Rollback complete. NOTE: Database migrations were NOT rolled back."
```

### 4.3 File: `.github/workflows/deploy-test.yml`

```yaml
name: Deploy Test

on:
  push:
    branches: ['develop']
  workflow_dispatch:

concurrency:
  group: deploy-test
  cancel-in-progress: false

env:
  APP_DIR: /home/scoy/Developer/repositories/ralph-test
  BUN_INSTALL: /home/scoy/.bun

jobs:
  sanity-checks:
    runs-on: [self-hosted, pi]
    steps:
      - name: Pull latest code
        run: |
          cd $APP_DIR
          git fetch https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${{ github.repository }}.git develop
          git reset --hard FETCH_HEAD

      - name: Install dependencies
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/server && bun install --frozen-lockfile
          cd $APP_DIR/web && bun install --frozen-lockfile

      - name: Type-check server
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/server && bun run --bun tsc --noEmit

      - name: Type-check web
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/web && bun run --bun check

      - name: Run unit tests
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/server && bun test

  deploy:
    needs: sanity-checks
    runs-on: [self-hosted, pi]
    environment: test
    env:
      ENV_FILE: /etc/ralph-api-test.env
    steps:
      - name: Ensure test database is running
        run: |
          cd $APP_DIR
          docker compose -f docker-compose.test.yml up -d
          for i in $(seq 1 30); do
            if docker exec ralph_test_db pg_isready -U postgres; then break; fi
            sleep 1
          done

      - name: Setup environment
        run: |
          cat > /tmp/ralph-api-test.env << 'ENVEOF'
          SUPABASE_URL=http://172.17.0.1:54331
          SUPABASE_KEY=${{ secrets.SUPABASE_KEY }}
          RP_ID=${{ secrets.RP_ID }}
          RP_ORIGIN=${{ secrets.RP_ORIGIN }}
          FRONTEND_URL=${{ secrets.FRONTEND_URL }}
          NODE_ENV=test
          PORT=3011
          LOG_LEVEL=debug
          MAX_CONCURRENT_AGENTS=2
          ENVEOF
          sudo cp /tmp/ralph-api-test.env $ENV_FILE
          sudo chmod 600 $ENV_FILE
          rm /tmp/ralph-api-test.env

      - name: Build agent base image
        run: |
          cd $APP_DIR
          docker build -t ralph-agent-base:latest -f server/Dockerfile.agent server/

      - name: Reset and seed test database
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR
          ./scripts/test-db-reset.sh

      - name: Build web
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/web
          PUBLIC_API_URL= bun --bun run build

      - name: Trigger service restart
        run: touch $APP_DIR/.deploy-trigger

      - name: Verify deployment
        run: |
          sleep 10
          for i in $(seq 1 6); do
            if docker run --rm --network host curlimages/curl \
              -sf http://localhost:3011/health; then
              echo "Test API health check passed"
              break
            fi
            if [ "$i" -eq 6 ]; then
              echo "::error::Test API health check failed"
              exit 1
            fi
            sleep 5
          done

          for i in $(seq 1 6); do
            if docker run --rm --network host curlimages/curl \
              -sf http://localhost:3012; then
              echo "Test Web health check passed"
              break
            fi
            if [ "$i" -eq 6 ]; then
              echo "::error::Test Web health check failed"
              exit 1
            fi
            sleep 5
          done

      - name: Rollback on failure
        if: failure()
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR
          git reset --hard HEAD~1
          cd server && bun install --frozen-lockfile
          cd ../web && bun install --frozen-lockfile
          PUBLIC_API_URL= bun --bun run build
          cd ..
          touch .deploy-trigger

  e2e:
    needs: deploy
    runs-on: [self-hosted, pi]
    steps:
      - name: Install Playwright dependencies
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/e2e
          bun install --frozen-lockfile
          # Use system chromium on ARM64
          sudo apt-get update -qq && sudo apt-get install -y -qq chromium-browser || true

      - name: Run E2E tests
        env:
          BASE_URL: https://test.clanqr.dev
          API_URL: http://localhost:3011
          CI: "true"
          PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: /usr/bin/chromium-browser
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $APP_DIR/e2e
          bun x playwright test --reporter=github,html

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ github.run_id }}
          path: ${{ env.APP_DIR }}/e2e/playwright-report/
          retention-days: 14

      - name: Upload test screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-screenshots-${{ github.run_id }}
          path: ${{ env.APP_DIR }}/e2e/test-results/
          retention-days: 7
```

### 4.4 File: `.github/workflows/pr-checks.yml`

```yaml
name: PR Checks

on:
  pull_request:
    branches: ['develop', 'main']

concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

env:
  BUN_INSTALL: /home/scoy/.bun

jobs:
  checks:
    runs-on: [self-hosted, pi]
    steps:
      - name: Checkout PR code
        run: |
          WORK_DIR="/tmp/ralph-pr-${{ github.run_id }}"
          mkdir -p "$WORK_DIR"
          cd "$WORK_DIR"
          git init
          git fetch --depth=1 https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${{ github.repository }}.git ${{ github.event.pull_request.head.sha }}
          git checkout FETCH_HEAD
          echo "WORK_DIR=$WORK_DIR" >> $GITHUB_ENV

      - name: Install dependencies
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $WORK_DIR/server && bun install --frozen-lockfile
          cd $WORK_DIR/web && bun install --frozen-lockfile

      - name: Type-check server
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $WORK_DIR/server && bun run --bun tsc --noEmit

      - name: Type-check web
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $WORK_DIR/web && bun run --bun check

      - name: Run unit tests
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $WORK_DIR/server && bun test

      - name: Lint
        run: |
          export PATH="$BUN_INSTALL/bin:$PATH"
          cd $WORK_DIR && bun run lint

      - name: Cleanup
        if: always()
        run: rm -rf "/tmp/ralph-pr-${{ github.run_id }}"
```

### 4.5 Workflow File Transition

1. **Delete** `.github/workflows/deploy-pi.yml`
2. **Create** `.github/workflows/deploy-production.yml`
3. **Create** `.github/workflows/deploy-test.yml`
4. **Create** `.github/workflows/pr-checks.yml`

> **Note:** The transition must happen in a single commit to avoid a state where neither old nor new workflows are active. Since the old workflow triggers on `main` and the new production workflow also triggers on `main`, there's no gap — the new file replaces the old one.

### 4.6 GitHub Actions Environment Setup

```bash
# Using gh CLI
gh api repos/bence-boer/clanqr/environments/production -X PUT
gh api repos/bence-boer/clanqr/environments/test -X PUT

# Set environment-scoped secrets
gh secret set SUPABASE_KEY --env production --body "<prod-key>"
gh secret set RP_ID --env production --body "clanqr.dev"
gh secret set RP_ORIGIN --env production --body "https://clanqr.dev"
gh secret set FRONTEND_URL --env production --body "https://clanqr.dev"

gh secret set SUPABASE_KEY --env test --body "<test-key>"
gh secret set RP_ID --env test --body "test.clanqr.dev"
gh secret set RP_ORIGIN --env test --body "https://test.clanqr.dev"
gh secret set FRONTEND_URL --env test --body "https://test.clanqr.dev"
```

### 4.7 Concurrency Protection

Both deploy workflows use `concurrency` groups with `cancel-in-progress: false`. This means:
- If a second push to `develop` arrives while `deploy-test` is running, the second run **queues** (doesn't cancel the first)
- PR checks use `cancel-in-progress: true` — a new push to a PR cancels the old check run

**Cross-workflow protection:** `deploy-production` and `deploy-test` use different concurrency groups, so they can run simultaneously. This is safe because they operate on different directories, different ports, and different DB containers.

### 4.8 Phase 3 Done Definition

- Push to `develop` triggers `deploy-test.yml` (visible in Actions tab)
- Push to `main` triggers `deploy-production.yml`
- PR to either branch triggers `pr-checks.yml`
- `deploy-test.yml` runs E2E tests in a separate `e2e` job
- Environments appear in GitHub repo settings
- Secrets are scoped per environment

---

## 5. Phase 4: E2E Test Adaptation

### 5.1 Deliverables

- [ ] Auth middleware change: allow dev tokens when `NODE_ENV === 'test'`
- [ ] `e2e/playwright.config.ts` updated for configurable URLs
- [ ] All test files updated: configurable API URL and cookie domain
- [ ] Shared auth helpers extracted to reduce duplication
- [ ] Agent execution tests skipped in CI

### 5.2 File Change: `server/src/middleware/auth.ts`

**Current code (line ~21):**
```typescript
if (env.NODE_ENV !== 'development' && is_dev_session_token(token)) {
```

**Change to:**
```typescript
if (env.NODE_ENV === 'production' && is_dev_session_token(token)) {
```

**And similarly for dev passkey check (line ~35 area):**
```typescript
// Current:
if (env.NODE_ENV !== 'development' && is_dev_passkey_id(session.passkey_id)) {
// Change to:
if (env.NODE_ENV === 'production' && is_dev_passkey_id(session.passkey_id)) {
```

**Rationale (Decision D1):** This change narrows the block from "everything except development" to "only production." The `test` environment now allows dev tokens — same as local development. This is the minimal, explicit change that enables E2E test auth without introducing new auth endpoints or bypass mechanisms.

**Security analysis:**
- Production behavior is **unchanged** — dev tokens are still blocked
- `NODE_ENV=test` is only set on the test environment (the implementing agent controls this)
- Dev tokens are a known, fixed set — no new attack surface
- The test environment is on a separate subdomain with its own DB — blast radius is contained

### 5.3 File Change: `server/src/env.ts`

**No schema change needed.** The `NODE_ENV` field already accepts `'test'` as a valid value: `z.enum(['development', 'production', 'test'])`. The `test` value was already in the schema but had no distinct behavior until now.

### 5.4 File Change: `e2e/playwright.config.ts`

**Key changes:**
1. `baseURL` from `BASE_URL` env var
2. `webServer` disabled when `CI=true`
3. ARM64 Chromium executable path support

```typescript
import { defineConfig, devices } from "@playwright/test";

const is_ci = !!process.env.CI;

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: is_ci,
    retries: is_ci ? 2 : 0,
    workers: is_ci ? 1 : undefined,
    reporter: is_ci ? "github" : "html",
    timeout: 30_000,
    use: {
        baseURL: process.env.BASE_URL || "http://localhost:5173",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
            : {}),
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: is_ci
        ? undefined
        : [
              {
                  command: "cd ../server && bun run dev",
                  url: "http://localhost:3001/health",
                  reuseExistingServer: true,
                  timeout: 15_000,
              },
              {
                  command: "cd ../web && bun run dev",
                  url: "http://localhost:5173",
                  reuseExistingServer: true,
                  timeout: 15_000,
              },
          ],
});
```

### 5.5 File: `e2e/tests/helpers.ts` (New — Shared Auth Utilities)

Extract the duplicated auth helpers into a single shared module:

```typescript
// e2e/tests/helpers.ts — Shared test utilities

import type { Page } from "@playwright/test";

export const DEV_SESSION_COOKIE = "dev-session-token";
export const DEV_ADMIN_SESSION_COOKIE = "dev-admin-session-token";

export const API_URL = process.env.API_URL || "http://localhost:3001";

export const AUTH_HEADERS = { Cookie: `session=${DEV_SESSION_COOKIE}` };
export const ADMIN_AUTH_HEADERS = { Cookie: `session=${DEV_ADMIN_SESSION_COOKIE}` };

function cookie_domain(): string {
    if (process.env.BASE_URL) {
        try {
            return new URL(process.env.BASE_URL).hostname;
        } catch {
            return "localhost";
        }
    }
    return "localhost";
}

export async function authenticate(page: Page, admin = false): Promise<void> {
    const token = admin ? DEV_ADMIN_SESSION_COOKIE : DEV_SESSION_COOKIE;
    await page.context().addCookies([
        {
            name: "session",
            value: token,
            domain: cookie_domain(),
            path: "/",
        },
    ]);
}
```

### 5.6 Test File Changes (All 5 Files)

Each test file needs these changes:
1. Import from `./helpers` instead of defining local constants
2. Replace hardcoded `http://localhost:3001` with `API_URL`
3. Replace local `authenticate()` with shared version
4. Replace hardcoded cookie domain `"localhost"` with dynamic domain

**Pattern for each file:**

```typescript
// Before (duplicated in each file):
const DEV_SESSION_COOKIE = "dev-session-token";
const API = "http://localhost:3001";
const AUTH = { Cookie: `session=${DEV_SESSION_COOKIE}` };

// After (imported from helpers):
import { DEV_SESSION_COOKIE, API_URL, AUTH_HEADERS, authenticate } from "./helpers";
```

#### `smoke.test.ts` changes:
- Replace `const API = "http://localhost:3001"` → import `API_URL`
- Replace `const AUTH = { ... }` → import `AUTH_HEADERS`
- Replace all `${API}` → `${API_URL}`
- Replace local auth headers → `AUTH_HEADERS`

#### `api-workflows.test.ts` changes:
- Same pattern as smoke.test.ts
- Replace `const API = "http://localhost:3001"` → import `API_URL`
- Replace `const AUTH = { ... }` → import `AUTH_HEADERS`

#### `ui-workflows.test.ts` changes:
- Remove local `authenticate()` function → import from helpers
- Remove local `DEV_SESSION_COOKIE` constant

#### `agent-execution.test.ts` changes:
- Replace admin auth → import `ADMIN_AUTH_HEADERS`
- Replace `const API = "http://localhost:3001"` → import `API_URL`
- Add CI skip for the entire file:

```typescript
import { test, expect } from "@playwright/test";
import { DEV_ADMIN_SESSION_COOKIE, API_URL, ADMIN_AUTH_HEADERS } from "./helpers";

const is_ci = !!process.env.CI;

test.describe("agent execution: direct task pipeline", () => {
    test.skip(is_ci, "Agent execution tests are skipped in CI — require Docker + Copilot CLI + long timeouts");
    // ... existing tests unchanged
});

test.describe("agent execution: full manager flow", () => {
    test.skip(is_ci, "Agent execution tests are skipped in CI — require Docker + Copilot CLI + long timeouts");
    // ... existing tests unchanged
});
```

#### `ux-redesign-workflow.test.ts` changes:
- Replace admin auth → import from helpers
- Replace `const API = "http://localhost:3001"` → import `API_URL`
- Remove local `authenticate()` function → import from helpers

### 5.7 Phase 4 Done Definition

- `server/src/middleware/auth.ts` allows dev tokens when `NODE_ENV === 'test'`
- `e2e/playwright.config.ts` reads `BASE_URL` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` from env
- All test files use `API_URL` from helpers (no hardcoded localhost)
- Cookie domain is dynamic based on `BASE_URL`
- Agent execution tests skip when `CI=true`
- All tests still pass locally: `cd e2e && bun run test` (with dev servers running)
- Type-check passes: `cd server && bun run --bun tsc --noEmit`

---

## 6. Phase 5: CI E2E Integration

### 6.1 Deliverables

- [ ] E2E tests run as the `e2e` job in `deploy-test.yml`
- [ ] Playwright GitHub reporter produces CI annotations
- [ ] HTML report + screenshots uploaded as artifacts
- [ ] CI fails if E2E tests fail

### 6.2 E2E Job Configuration (Already in deploy-test.yml §4.3)

The `e2e` job in `deploy-test.yml` handles:
1. Installing Playwright + system Chromium
2. Running tests with `BASE_URL=https://test.clanqr.dev`
3. Using `API_URL=http://localhost:3011` for direct API access from the runner
4. Uploading reports as artifacts (always, even on failure)
5. Uploading screenshots (only on failure)

### 6.3 ARM64 Playwright Strategy

**Primary approach:** Use system Chromium on Raspberry Pi OS.

```bash
# Install system chromium (ARM64 build available in Raspberry Pi OS repos)
sudo apt-get install -y chromium-browser

# Set env var for Playwright to use it
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

The playwright config (§5.4) reads this env var and passes it as `launchOptions.executablePath`.

**Fallback if Chromium doesn't work on ARM64:**

```bash
# Option B: Use Firefox instead
sudo apt-get install -y firefox-esr
# Change playwright project from "chromium" to "firefox"
```

**Fallback if neither works:**

```bash
# Option C: Install Playwright's own browsers (may work on newer ARM64)
cd e2e && bun x playwright install --with-deps chromium
```

### 6.4 Headless Mode

The self-hosted Pi runner likely has no display server. Playwright runs headless by default, which is correct for CI. If issues arise:

```bash
# Install virtual framebuffer
sudo apt-get install -y xvfb
# Run tests with xvfb
xvfb-run bun x playwright test
```

### 6.5 Timeout Strategy

| Test Suite | Default Timeout | CI Behavior |
|-----------|----------------|-------------|
| smoke | 30s | Normal (2 retries) |
| api-workflows | 30s | Normal (2 retries) |
| ui-workflows | 30s | Normal (2 retries) |
| ux-redesign | 60s (some tests) | Normal (2 retries) |
| agent-execution | 10 min | **Skipped in CI** |

With the agent execution tests skipped, the remaining ~49 tests should complete in under 5 minutes on the Pi with 1 worker.

### 6.6 Phase 5 Done Definition

- `deploy-test.yml` `e2e` job runs after successful deploy
- E2E tests pass against `https://test.clanqr.dev`
- Failed tests produce screenshots in the artifact
- HTML report available as downloadable artifact
- CI fails (red) if any non-skipped E2E test fails
- Agent execution tests are skipped with a clear reason

---

## 7. Phase 6: Branch Protection & Promotion Flow

### 7.1 Deliverables

- [ ] GitHub branch protection rules for `main`
- [ ] GitHub branch protection rules for `develop`
- [ ] `develop` branch created (if not exists)
- [ ] AGENTS.md updated with new branch strategy

### 7.2 Branch Protection: `main`

```bash
gh api repos/bence-boer/clanqr/branches/main/protection -X PUT \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["sanity-checks", "deploy / deploy", "e2e"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

**Rules:**
- Require PR before merging
- Require status checks: `sanity-checks` (from deploy-production) + `e2e` (from deploy-test, which runs on develop)
- Allow merge without approval (single-developer project)
- No force pushes
- No direct pushes

> **Important:** The `e2e` check comes from the `deploy-test.yml` workflow which runs on `develop` pushes. For PRs from `develop` to `main`, GitHub shows the latest status of the head branch. This means `e2e` will show the result from the last `develop` push. If `develop` E2E is green, the PR to `main` can merge.

### 7.3 Branch Protection: `develop`

```bash
gh api repos/bence-boer/clanqr/branches/develop/protection -X PUT \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["checks"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": true,
  "allow_deletions": false
}
EOF
```

**Rules:**
- Require PR from feature branches
- Require status checks: `checks` (from pr-checks.yml)
- Allow force push with lease (for rebasing feature branches)
- No approval required (single-developer project)

### 7.4 Create `develop` Branch

```bash
cd /home/scoy/Developer/repositories/clanqr
git checkout main
git checkout -b develop
git push origin develop
```

### 7.5 AGENTS.md Update

Update the branching strategy section (§12) to reflect the new model:

```markdown
### Branching Strategy

- `main` — production deployments (push triggers `deploy-production.yml`)
- `develop` — test/staging environment (push triggers `deploy-test.yml` + E2E)
- `feature/*` — feature branches (PR to `develop`, triggers `pr-checks.yml`)
- `bugfix/*` — bugfix branches (PR to `develop`)
- `release/*` — optional release branches (PR to `main`)

**Promotion flow:**
1. Feature branches → PR to `develop` (requires PR checks to pass)
2. `develop` → auto-deploys to `test.clanqr.dev` → E2E tests run
3. `develop` → PR to `main` (requires E2E green on develop)
4. `main` → auto-deploys to `clanqr.dev` (production)
```

### 7.6 Reconciliation: `--no-ff` vs Linear History

Per AGENTS.md §12, merges use `git merge --no-ff`. Branch protection should **not** require linear history (which would force squash/rebase merges). The `--no-ff` convention creates merge commits, which is compatible with the "require PR" rule.

### 7.7 Phase 6 Done Definition

- Cannot push directly to `main` (test by `git push origin main` — should be rejected)
- PR to `main` requires passing status checks
- PR to `develop` requires passing PR checks
- `develop` branch exists and is protected
- AGENTS.md reflects new branch strategy

---

## 8. Failure Mode Analysis

| Failure | Detection | Impact | Mitigation | Recovery |
|---------|-----------|--------|------------|----------|
| **Pi out of RAM** (dual stacks) | `free -h` shows >80% | Both environments crash | `MAX_CONCURRENT_AGENTS=2` on test; monitor with systemd OOM scores | Set `OOMScoreAdjust=100` on test services (killed first) |
| **Chromium not working on ARM64** | E2E job fails with browser launch error | E2E cannot run | Try `firefox-esr` fallback; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Switch to Firefox project in playwright config |
| **Concurrent deploy-test + deploy-production** | Both workflows run simultaneously | No conflict (different dirs, ports, DBs) | Concurrency groups prevent same-env overlap | N/A — safe by design |
| **Test DB migrations drift** | Tests fail with schema errors | False test results | Both envs use same migration files from repo | `test-db-reset.sh` runs fresh every deploy |
| **SSL cert renewal failure** | HTTPS stops after 90 days | Users can't access either environment | `certbot.timer` auto-renews; dry-run test | `sudo certbot renew --force-renewal` |
| **Dev tokens on test env exploited** | Unauthorized access to test data | Test data compromised (not production) | `NODE_ENV=test` only on test; test has no real user data | Rotate seed tokens; test data is ephemeral |
| **Deploy trigger file race** | Two deploys touch the trigger at the same time | Service restarts twice | Concurrency groups prevent this | systemd restart is idempotent |
| **E2E test flake blocks promotion** | E2E red but tests are actually fine | Can't merge to main | 2 retries in CI; re-run `e2e` job independently | Manual workflow_dispatch on deploy-test |
| **Test environment left broken** | E2E fails, test env stays deployed with bad code | Developers can't test | By design — broken test env enables debugging | Fix on `develop`, push triggers redeploy |

---

## 9. Validation Checklist

### Infrastructure
- [ ] `docker exec ralph_test_db pg_isready -U postgres` succeeds
- [ ] `curl -sf http://localhost:54331/rest/v1/` returns PostgREST response on test gateway
- [ ] `curl -sf http://localhost:3011/health` returns `{"status":"ok"}` from test API
- [ ] `curl -sf http://localhost:3012` returns HTML from test web
- [ ] No port conflicts: `ss -tlnp | grep -E '3001|3002|3011|3012|5432|5433|54321|54331'`
- [ ] `free -h` shows <80% RAM usage with both environments running

### CI/CD
- [ ] Push to `develop` triggers `deploy-test.yml`
- [ ] Push to `main` triggers `deploy-production.yml`
- [ ] PR to either branch triggers `pr-checks.yml`
- [ ] `deploy-test.yml` runs E2E tests after deployment
- [ ] CI fails if E2E tests fail
- [ ] Playwright report uploaded as artifact
- [ ] Both workflows can run without interfering

### Networking
- [ ] `curl -sf https://clanqr.dev/health` returns production health
- [ ] `curl -sf https://test.clanqr.dev/health` returns test health
- [ ] `curl -sf http://clanqr.dev` returns 301 redirect to HTTPS
- [ ] SSL certificates valid: `echo | openssl s_client -connect clanqr.dev:443 2>/dev/null | openssl x509 -noout -dates`
- [ ] `sudo certbot renew --dry-run` succeeds

### E2E Tests
- [ ] Playwright config accepts `BASE_URL` from environment
- [ ] Tests authenticate against test environment (dev tokens work with `NODE_ENV=test`)
- [ ] Smoke tests pass against `test.clanqr.dev`
- [ ] API workflow tests pass
- [ ] UI workflow tests pass
- [ ] UX redesign tests pass
- [ ] Agent execution tests are skipped with clear message

### Branch Protection
- [ ] Direct push to `main` is rejected
- [ ] PR to `main` without passing checks cannot merge
- [ ] PR to `develop` triggers `pr-checks.yml`
- [ ] `develop` branch exists and is protected

---

## 10. Rollback & Recovery

### Production Rollback

Same as current: `git reset --hard HEAD~1` + rebuild + restart. DB migrations are NOT rolled back.

### Test Environment Rollback

Two options:
1. **Same as production**: `git reset --hard HEAD~1` in `ralph-test/`
2. **Full reset**: `./scripts/test-db-reset.sh` wipes and reseeds the DB (always safe for test)

### E2E Failure on Test

**Does NOT trigger rollback.** The test environment stays deployed with the failing code. This is intentional — developers need the broken state to debug. CI reports failure, blocking promotion to `main`.

### Promotion Gate Bypass (Emergency)

If E2E is flaky and blocks a critical production deploy:
1. Admin can temporarily disable the `e2e` required status check on `main`
2. Merge the PR to `main`
3. Re-enable the check
4. File a bug to fix the flaky test

This should be rare and always documented.

---

## 11. Appendix: Complete File Inventory

### New Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `docker-compose.test.yml` | 1 | Test environment Docker stack |
| `nginx.test.conf` | 1 | Test PostgREST gateway config (Docker-internal) |
| `scripts/test-db-reset.sh` | 1 | Test DB reset and seed script |
| `.github/workflows/deploy-production.yml` | 3 | Production deployment workflow |
| `.github/workflows/deploy-test.yml` | 3 | Test deployment + E2E workflow |
| `.github/workflows/pr-checks.yml` | 3 | PR validation checks |
| `e2e/tests/helpers.ts` | 4 | Shared E2E test utilities |

### Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `server/src/middleware/auth.ts` | 4 | Allow dev tokens when `NODE_ENV === 'test'` |
| `e2e/playwright.config.ts` | 4 | Configurable `BASE_URL`, ARM64 Chromium, CI webServer disable |
| `e2e/tests/smoke.test.ts` | 4 | Use shared helpers, configurable API URL |
| `e2e/tests/api-workflows.test.ts` | 4 | Use shared helpers, configurable API URL |
| `e2e/tests/ui-workflows.test.ts` | 4 | Use shared helpers, dynamic cookie domain |
| `e2e/tests/agent-execution.test.ts` | 4 | Use shared helpers, skip in CI |
| `e2e/tests/ux-redesign-workflow.test.ts` | 4 | Use shared helpers, configurable API URL |
| `AGENTS.md` | 6 | Updated branch strategy and deploy pipeline docs |

### Files to Delete

| File | Phase | Reason |
|------|-------|--------|
| `.github/workflows/deploy-pi.yml` | 3 | Replaced by `deploy-production.yml` |

### Files Created on Pi (Not in Repo)

| File | Phase | Purpose |
|------|-------|---------|
| `/etc/systemd/system/ralph-api@.service` | 1 | API template unit |
| `/etc/systemd/system/ralph-web@.service` | 1 | Web template unit |
| `/etc/systemd/system/ralph-deploy@.path` | 1 | Deploy trigger watcher |
| `/etc/systemd/system/ralph-deploy@.service` | 1 | Deploy trigger handler |
| `/etc/ralph-api-prod.env` | 1 | Production API env vars |
| `/etc/ralph-api-test.env` | 1 | Test API env vars |
| `/etc/ralph-web-prod.env` | 1 | Production web port |
| `/etc/ralph-web-test.env` | 1 | Test web port |
| `/etc/nginx/sites-available/clanqr.dev` | 2 | Production nginx config |
| `/etc/nginx/sites-available/test.clanqr.dev` | 2 | Test nginx config |

---

## Implementation Notes for the Implementing Agent

### Ordering

Phases 1 and 2 are **Pi infrastructure setup** — they require SSH or runner access to the Pi and cannot be fully tested from a development machine. Phases 3-6 are **code changes** that can be committed and pushed.

**Recommended implementation order:**
1. Phases 3-4-5 first (code changes — can be developed and committed)
2. Phase 6 (branch protection — via GitHub API)
3. Phases 1-2 (Pi infrastructure — requires physical/SSH access)

This order allows code to be ready before infrastructure, enabling a single coordinated "go-live."

### Skills to Invoke

| Skill | When |
|-------|------|
| `hono-backend-architect` | Before editing `auth.ts` — verify middleware pattern compliance |
| `meta-engineer` | Before each phase — run self-review checklist |
| `svelte-engineer` | If any Svelte file changes are needed (unlikely in this plan) |
| `copilot-sdk` | When configuring dual Copilot CLI instances |

### Testing the Auth Change

After modifying `auth.ts`, verify:
```bash
# Start server with NODE_ENV=test
NODE_ENV=test bun run dev

# Test dev token works
curl -sf -H "Cookie: session=dev-session-token" http://localhost:3001/api/projects
# Should return 200 with project list

# Start server with NODE_ENV=production
NODE_ENV=production bun run dev

# Test dev token is blocked
curl -sf -w "%{http_code}" -H "Cookie: session=dev-session-token" http://localhost:3001/api/projects
# Should return 401
```

### Observability Signals

After deployment, these signals indicate health:

| Signal | Where | Expected |
|--------|-------|----------|
| API health | `GET /health` on both ports | `{"status":"ok"}` |
| CI status | GitHub Actions tab | Green for both workflows |
| E2E report | Workflow artifacts | HTML report with pass/skip counts |
| SSL validity | Browser padlock | Valid cert for both domains |
| Resource usage | `free -h` on Pi | <80% RAM |
| systemd status | `systemctl status ralph-api@{prod,test}` | Active (running) |
