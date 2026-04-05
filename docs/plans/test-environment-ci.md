# PLAN-PLAN: Test Environment & Dual CI/CD Pipeline

> **What is this?** Instructions for a future agent that will create the *actual* implementation plan for setting up a dual-environment CI/CD pipeline with E2E test integration. Read this document in full before producing any implementation plan or writing any code.

---

## Table of Contents

1. [Objective](#1-objective)
2. [Current State](#2-current-state)
3. [Target State](#3-target-state)
4. [Planning Scope & Phases](#4-planning-scope--phases)
5. [GitHub Actions Workflows](#5-github-actions-workflows)
6. [Infrastructure Setup](#6-infrastructure-setup)
7. [E2E Test Integration](#7-e2e-test-integration)
8. [Environment Variables Matrix](#8-environment-variables-matrix)
9. [Docker Compose & Database Strategy](#9-docker-compose--database-strategy)
10. [Nginx & SSL Configuration](#10-nginx--ssl-configuration)
11. [Branch Strategy & Protection Rules](#11-branch-strategy--protection-rules)
12. [Rollback Strategy](#12-rollback-strategy)
13. [Validation Criteria](#13-validation-criteria)
14. [Skills & Tools the Planning Agent Must Use](#14-skills--tools-the-planning-agent-must-use)
15. [Key Constraints & Risks](#15-key-constraints--risks)
16. [Reference Files](#16-reference-files)
17. [Appendix: Current Architecture Snapshot](#17-appendix-current-architecture-snapshot)

---

## 1. Objective

Create a dual-environment deployment pipeline on a single Raspberry Pi:

| Environment | Domain | Trigger | Purpose |
|-------------|--------|---------|---------|
| **Production** | `clanqr.dev` | Push to `main` | Live user-facing system |
| **Test** | `test.clanqr.dev` | Push to `develop` | Staging + automated E2E verification |

After the test environment deploys, Playwright E2E tests run against `test.clanqr.dev`. CI fails if E2E tests fail. Feature branches trigger checks only (no deploy).

---

## 2. Current State

### 2.1 CI/CD Pipeline

**Single workflow:** `.github/workflows/deploy-pi.yml`
- **Trigger:** push to `main` OR `workflow_dispatch`
- **Runner:** self-hosted on Raspberry Pi (`runs-on: [self-hosted, pi]`)
- **Job 1 — `sanity-checks`:** git fetch + reset → bun install (server + web) → tsc --noEmit → svelte-check → bun test
- **Job 2 — `deploy`** (depends on sanity-checks): write `.env` → build Docker agent image → apply DB migrations via `docker exec supabase_db_supabase psql` → `bun build` web → `touch .deploy-trigger` (systemd restart) → health check with retry loop → rollback on failure

**Critical pipeline details:**
- `git reset --hard FETCH_HEAD` overwrites local state — any uncommitted change is destroyed
- The CI runner is containerized, so health checks use `docker run --rm --network host curlimages/curl` to reach host ports
- Environment file written to `/etc/ralph-api.env` (via `/tmp` staging + `sudo cp`)
- Rollback is `git reset --hard HEAD~1` + reinstall + rebuild + restart; DB migrations are NOT rolled back

### 2.2 Services

| Service | Systemd Unit | Port | Description |
|---------|-------------|------|-------------|
| Backend API | `ralph-api` | 3001 | Hono on Bun |
| Frontend Web | `ralph-web` | 3002 | SvelteKit |
| Supabase DB | Docker container `supabase_db_supabase` | 5432 (internal) | Postgres |
| Supabase PostgREST | Docker (via Supabase) | 54321 (gateway) | REST API for @supabase/supabase-js |

### 2.3 Authentication

- **Production:** WebAuthn passkeys — no username/password, no OAuth
- **Development:** Dev session tokens (`dev-session-token`, `dev-admin-session-token`) — blocked in non-development `NODE_ENV`
- Auth middleware reads `session` cookie → queries `sessions` table joined to `passkeys` for role
- Dev tokens validated via whitelist in `server/src/utils/dev_sessions.ts`

### 2.4 E2E Tests (existing, not in CI)

- **Framework:** Playwright v1.52.0 (chromium only)
- **Config:** `e2e/playwright.config.ts`
- **Base URL:** `http://localhost:5173` (hardcoded)
- **Auth approach:** Cookie injection with dev tokens (`dev-session-token`, `dev-admin-session-token`)
- **Web server config:** Auto-starts `bun run dev` for server (port 3001) and web (port 5173) unless `CI=true`
- **CI settings already in config:** `forbidOnly: !!process.env.CI`, `retries: CI ? 2 : 0`, `workers: CI ? 1 : undefined`, `reporter: CI ? "github" : "html"`

**Test suites (5 files, ~77+ tests):**

| Suite | File | Tests | Key Dependencies |
|-------|------|-------|-----------------|
| Smoke | `smoke.test.ts` | 7 | Health endpoint, auth flow, basic CRUD |
| API Workflows | `api-workflows.test.ts` | 14+ | Full API lifecycle, SSRF, rate limiting |
| UI Workflows | `ui-workflows.test.ts` | 12+ | Page rendering, navigation, CSS variables |
| Agent Execution | `agent-execution.test.ts` | 14 | Docker daemon, Copilot CLI, `gpt-4.1` model, 10min timeout |
| UX Redesign | `ux-redesign-workflow.test.ts` | 30+ | Activity feed, chat, admin metrics |

**Auth in tests:** All tests use cookie injection — `context.addCookies()` for page tests, `Cookie` header for API tests. Constants hardcoded per file (no shared fixture).

### 2.5 Environment Variables (from `server/src/env.ts` Zod schema)

```
SUPABASE_URL    — z.string().url().default('http://127.0.0.1:54321')
SUPABASE_KEY    — z.string().min(1) [required]
RP_ID           — z.string().default('localhost')
RP_ORIGIN       — z.string().default('http://localhost:5173')
FRONTEND_URL    — z.string().default('http://localhost:5173')
PORT            — z.coerce.number().default(3001)
NODE_ENV        — z.enum(['development','production','test']).default('production')
COPILOT_BIN     — z.string().optional()
GEMINI_BIN      — z.string().optional()
WORKSPACE_DIR   — z.string().optional()
LOG_LEVEL       — z.enum(['debug','info','warn','error']).default('info')
MAX_CONCURRENT_AGENTS — z.coerce.number().int().min(1).default(3)
HOME            — z.string().default(process.env.HOME ?? '/tmp')
PATH            — z.string().default(...)
```

### 2.6 Docker Compose (development)

`docker-compose.dev.yml` runs:
1. **`ralph_dev_db`** — Postgres 17 Alpine on port 54322
2. **`ralph_dev_rest`** — PostgREST v12.2.8 (internal port 3000)
3. **`ralph_dev_gateway`** — Nginx on port 54321, routes `/rest/v1/*` → PostgREST

Uses volume `ralph_dev_pgdata` for persistence.

### 2.7 Database Migrations

17 migration files in `supabase/supabase/migrations/` (from `20260219101340` to `20260311000000`). Applied via `docker exec -i <container> psql` with transaction wrapping and version tracking in `supabase_migrations.schema_migrations`.

---

## 3. Target State

### 3.1 Architecture Overview

```
                    ┌──────────────────────────────────────────┐
                    │          Raspberry Pi (ARM64)             │
                    │                                          │
  clanqr.dev ──────▶│  Nginx ─┬─▶ ralph-web-prod  :3002       │
                    │         └─▶ ralph-api-prod  :3001       │
                    │              └─▶ supabase_db_prod :5432  │
                    │                                          │
  test.clanqr.dev ─▶│  Nginx ─┬─▶ ralph-web-test  :3012       │
                    │         └─▶ ralph-api-test  :3011       │
                    │              └─▶ ralph_test_db    :5433  │
                    │                                          │
                    │  copilot-cli-prod :4321                  │
                    │  copilot-cli-test :4322                  │
                    └──────────────────────────────────────────┘
```

### 3.2 Workflow Summary

```
feature/* branch ──PR──▶ develop ──push──▶ test.clanqr.dev ──E2E pass──▶ PR──▶ main ──push──▶ clanqr.dev
     │                       │                                                      │
     └─ pr-checks.yml        └─ deploy-test.yml                                    └─ deploy-production.yml
        (type-check,            (deploy + E2E)                                         (deploy + health check)
         lint, unit test)
```

---

## 4. Planning Scope & Phases

The implementation plan the next agent creates MUST be organized into these phases. Each phase should have clear deliverables and a "done" definition.

### Phase 1: Infrastructure — Dual Database & Services

**Deliverables:**
- `docker-compose.test.yml` for test Supabase stack (DB + PostgREST + gateway)
- Port allocation scheme documented and verified conflict-free
- systemd service files (or a plan to create them on the Pi): `ralph-api-prod`, `ralph-api-test`, `ralph-web-prod`, `ralph-web-test`
- Separate `.env` files for each environment
- Test that both DB instances can run simultaneously on the Pi without resource exhaustion

**Questions the plan must answer:**
- How does the test DB get initialized on first run? (migration + seed)
- How are the systemd services templated? (Consider systemd template units: `ralph-api@{prod,test}.service`)
- Where do the `.env` files live? (`/etc/ralph-api-prod.env`, `/etc/ralph-api-test.env`?)
- How does the deploy pipeline know which working directory to use? (Same repo checkout, or separate clones?)
- Does test need its own separate git clone, or can both share one checkout?

### Phase 2: Nginx & SSL

**Deliverables:**
- Nginx virtual host config for both domains
- Let's Encrypt certificates via certbot for `clanqr.dev` and `test.clanqr.dev`
- Auto-renewal cron/systemd timer
- Both domains resolve and serve correct environments

**Questions the plan must answer:**
- Is nginx already running on the Pi? What's its current config?
- Do both domains already have DNS A records pointing to the Pi?
- Should we use a single nginx config file or separate ones per domain?
- How do we handle the transition from `agents.benceboer.com` to `clanqr.dev`?

### Phase 3: GitHub Actions Workflows

**Deliverables:**
- `deploy-production.yml` (replace `deploy-pi.yml`)
- `deploy-test.yml` (new)
- `pr-checks.yml` (new)
- GitHub Actions environments configured with scoped secrets
- Self-hosted runner can handle both workflows (no race conditions)

**Questions the plan must answer:**
- Can two workflows run simultaneously on one self-hosted runner? (Default: no — jobs queue. This may be acceptable.)
- How to prevent `deploy-test` and `deploy-production` from interfering with each other during concurrent pushes?
- Should the workflows use GitHub Actions environments for secret scoping?
- How to handle the `APP_DIR` variable — same directory or separate directories per environment?
- The current workflow uses `git fetch + reset --hard` which is destructive. For dual environments, each MUST have its own checkout directory.

### Phase 4: E2E Test Adaptation

**Deliverables:**
- `playwright.config.ts` updated to use `BASE_URL` env var (not hardcoded `localhost:5173`)
- Auth strategy for test environment (dev tokens won't work with `NODE_ENV=test`)
- Test user seeding script for the test environment
- All 5 test suites pass against `test.clanqr.dev`
- Playwright CI reporter configured

**Questions the plan must answer:**
- What `NODE_ENV` does the test environment use? If `test` or `production`, dev session tokens are blocked. Need a new auth strategy.
- Options for test auth: (a) set `NODE_ENV=development` on test env (risky), (b) create real passkey test accounts via API, (c) add a test-only auth bypass controlled by a secret, (d) create a dedicated test session seeding step before E2E runs
- How to handle `agent-execution.test.ts` which requires Docker daemon and Copilot CLI? Skip in CI initially?
- Should we extract shared auth helpers into a fixture file to reduce duplication?
- How to handle API base URL in tests? Currently hardcoded to `http://localhost:3001`.

### Phase 5: CI E2E Integration

**Deliverables:**
- E2E tests run as a step in `deploy-test.yml` after successful deployment
- Playwright GitHub reporter produces CI annotations
- HTML report + failure screenshots uploaded as artifacts
- CI fails if E2E tests fail
- Green CI required for PR merge to `main`

**Questions the plan must answer:**
- How does Playwright run on ARM64 Raspberry Pi? Does the chromium binary work? (May need `--browser firefox` or cross-compiled chromium)
- Does the self-hosted runner have a display server for headed tests? (Probably need `xvfb-run` or headless-only)
- How to install Playwright browsers on the Pi? (`npx playwright install --with-deps chromium`)
- What's the timeout strategy? Agent execution tests take 10+ minutes.
- Should E2E be a separate job (can re-run independently) or a step in the deploy job?

### Phase 6: Branch Protection & Promotion Flow

**Deliverables:**
- GitHub branch protection rules for `main` and `develop`
- `main`: require PR, require passing status checks (type-check, lint, tests, E2E on test env)
- `develop`: require PR from feature branches
- Documentation of the promotion workflow

---

## 5. GitHub Actions Workflows

### 5.1 `deploy-production.yml` (replaces `deploy-pi.yml`)

```yaml
name: Deploy Production
on:
  push:
    branches: ['main']
  workflow_dispatch:

# CRITICAL: concurrency group prevents overlapping deploys
concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  sanity-checks:
    runs-on: [self-hosted, pi]
    env:
      APP_DIR: /home/scoy/Developer/repositories/clanqr  # or dedicated prod checkout
      BUN_INSTALL: /home/scoy/.bun
    steps:
      # Same as current: git fetch main + reset --hard
      # bun install (server + web)
      # tsc --noEmit (server)
      # bun run check (web)
      # bun test (server)

  deploy:
    needs: sanity-checks
    runs-on: [self-hosted, pi]
    environment: production  # GitHub Actions environment for secret scoping
    env:
      APP_DIR: # ...
      ENV_FILE: /etc/ralph-api-prod.env
    steps:
      # Write production .env (port 3001, prod SUPABASE_URL, prod RP_ID=clanqr.dev, etc.)
      # Build Docker agent image
      # Apply migrations to production DB (supabase_db_supabase or renamed prod container)
      # bun build web (PUBLIC_API_URL=)
      # touch .deploy-trigger-prod (separate trigger file per env)
      # Health check against localhost:3001 and localhost:3002
      # Rollback on failure
```

**Planning agent must decide:**
- Whether to use the same `APP_DIR` or a dedicated production checkout directory
- Whether to rename the deploy trigger file per environment
- Whether to rename the systemd services (current `ralph-api` → `ralph-api-prod`)
- How to handle the transition — rename existing services or create new ones alongside?

### 5.2 `deploy-test.yml` (new)

```yaml
name: Deploy Test
on:
  push:
    branches: ['develop']
  workflow_dispatch:

concurrency:
  group: deploy-test
  cancel-in-progress: false  # Don't cancel mid-deploy

jobs:
  sanity-checks:
    runs-on: [self-hosted, pi]
    env:
      APP_DIR: /home/scoy/Developer/repositories/ralph-test  # SEPARATE checkout!
      BUN_INSTALL: /home/scoy/.bun
    steps:
      # git fetch develop + reset --hard
      # bun install (server + web)
      # tsc --noEmit, svelte-check, bun test

  deploy:
    needs: sanity-checks
    runs-on: [self-hosted, pi]
    environment: test
    env:
      APP_DIR: /home/scoy/Developer/repositories/ralph-test
      ENV_FILE: /etc/ralph-api-test.env
    steps:
      # Write test .env (port 3011, test SUPABASE_URL, RP_ID=test.clanqr.dev, etc.)
      # Build Docker agent image (shared or separate?)
      # Apply migrations to test DB (ralph_test_db container)
      # bun build web (for test env)
      # touch .deploy-trigger-test
      # Health check against localhost:3011 and localhost:3012
      # Rollback on failure

  e2e:
    needs: deploy
    runs-on: [self-hosted, pi]
    steps:
      # Install Playwright if needed
      # cd e2e && BASE_URL=https://test.clanqr.dev bun run test
      # Upload HTML report as artifact
      # Upload screenshots as artifact
```

**Planning agent must decide:**
- Separate checkout directory for test (strongly recommended — `git reset --hard` is destructive)
- How the test checkout is initialized (clone on first run, then fetch+reset)
- Whether E2E is a separate job (recommended for re-run capability) or a step in deploy
- How to seed the test database before E2E runs (run `dev-db-reset.sh` adapted for test container?)

### 5.3 `pr-checks.yml` (new)

```yaml
name: PR Checks
on:
  pull_request:
    branches: ['develop', 'main']

concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true  # OK to cancel PR checks on new push

jobs:
  checks:
    runs-on: [self-hosted, pi]
    steps:
      # Checkout PR code (standard actions/checkout — NOT git reset --hard)
      # bun install
      # tsc --noEmit (server)
      # bun run check (web)
      # bun test (server)
      # NO deployment
```

**Planning agent must decide:**
- Whether `pr-checks.yml` can use `actions/checkout` (if the self-hosted runner supports it) or must use the same manual git fetch approach
- Whether to add eslint to PR checks
- Working directory strategy (can use a temporary directory since no deploy)

---

## 6. Infrastructure Setup

### 6.1 Port Allocation

| Service | Production | Test | Development (local) |
|---------|-----------|------|-------------------|
| API (Hono) | 3001 | 3011 | 3001 |
| Web (SvelteKit) | 3002 | 3012 | 5173 |
| Supabase Gateway | 54321 | 54331 | 54321 |
| Postgres (internal) | 5432 (in container) | 5433 (host-mapped) | 54322 |
| Copilot CLI | 4321 | 4322 | — |

### 6.2 Dual Supabase/Postgres

**Production DB:** Keep existing `supabase_db_supabase` container (already has production data). Renaming it is optional but may reduce confusion.

**Test DB:** New Docker container `ralph_test_db` with its own PostgREST and gateway. Create a `docker-compose.test.yml`:

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: ralph_test_db
    ports:
      - "5433:5432"  # Different host port
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: <generated>
    volumes:
      - ralph_test_pgdata:/var/lib/postgresql/data

  rest:
    image: postgrest/postgrest:v12.2.8
    container_name: ralph_test_rest
    expose:
      - "3000"
    environment:
      PGRST_DB_URI: postgres://postgres:<password>@db:5432/postgres
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: postgres
      PGRST_JWT_SECRET: <test-jwt-secret>

  gateway:
    image: nginx:alpine
    container_name: ralph_test_gateway
    ports:
      - "54331:80"  # Different host port
    volumes:
      - ./nginx.test.conf:/etc/nginx/conf.d/default.conf:ro
```

**Planning agent must decide:**
- Whether to reuse `nginx.dev.conf` (identical routing) or create a separate `nginx.test.conf`
- How to generate and store the test DB password and JWT secret
- Whether the test DB should auto-start on Pi boot (systemd unit for docker compose)
- Resource implications of running two Postgres instances on a Raspberry Pi

### 6.3 Dual Backend Services

Each environment needs its own systemd service. Consider **template units** for DRYness:

```ini
# /etc/systemd/system/ralph-api@.service
[Unit]
Description=Ralph API (%i)
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/scoy/Developer/repositories/ralph-%i
EnvironmentFile=/etc/ralph-api-%i.env
ExecStart=/home/scoy/.bun/bin/bun run src/index.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable with `systemctl enable ralph-api@prod ralph-api@test`.

**Planning agent must address:**
- Current `.deploy-trigger` mechanism — how does systemd watch this file? (Likely a path unit.) Need separate trigger files per environment.
- Working directory for test: `/home/scoy/Developer/repositories/ralph-test` (separate git clone)
- Working directory for prod: existing `/home/scoy/Developer/repositories/clanqr` (or renamed to `ralph-prod`)
- Web build output location per environment
- How `FRONTEND_URL` and `RP_ORIGIN` differ per environment

### 6.4 Dual Copilot CLI

Each environment needs its own headless CLI server instance:

| Service | Port | Purpose |
|---------|------|---------|
| `copilot-cli-prod` | 4321 | Agent spawning for production |
| `copilot-cli-test` | 4322 | Agent spawning for test |

**Planning agent must consult the `copilot-sdk` skill** for:
- How to run multiple headless CLI instances on different ports
- Configuration and authentication per instance
- Whether both instances can share the same GitHub auth token

---

## 7. E2E Test Integration

### 7.1 Configuration Changes

**`e2e/playwright.config.ts` must be updated:**

```typescript
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    // ...
  },
  webServer: process.env.CI ? undefined : [
    // Only auto-start dev servers when running locally
    { command: "cd ../server && bun run dev", url: "http://localhost:3001/health", ... },
    { command: "cd ../web && bun run dev", url: "http://localhost:5173", ... },
  ],
});
```

Key changes:
- `baseURL` from env var (not hardcoded)
- `webServer` disabled in CI (tests run against already-deployed test env)
- API URL also needs to be configurable (currently hardcoded as `const API = "http://localhost:3001"` in test files)

### 7.2 Auth Strategy for Test Environment

**This is the single hardest problem in this plan.** Current tests use dev session tokens which are blocked when `NODE_ENV !== 'development'`.

**Options (the planning agent must evaluate and choose):**

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| A | Set `NODE_ENV=development` on test env | Zero code changes | Enables ALL dev bypasses — unsafe |
| B | Set `NODE_ENV=test` and whitelist test tokens in `test` mode | Targeted, controlled | Requires env.ts and auth middleware changes |
| C | Seed real passkey records + sessions in test DB | Most realistic | Complex setup/teardown, fragile |
| D | Add a `TEST_AUTH_SECRET` env var that bypasses auth when set | Simple, explicit | New auth surface area |
| E | Create test sessions via a CI-only API endpoint | Clean separation | New endpoint to secure |

**Recommended approach for the plan:** Option B — allow dev session tokens when `NODE_ENV === 'test'`. This is the minimal change that keeps the test environment distinct from production while allowing existing E2E tests to work unchanged.

The implementation would be:
```typescript
// server/src/middleware/auth.ts — line ~21
if (env.NODE_ENV === 'production' && is_dev_session_token(token)) {
  // Block dev tokens ONLY in production (currently blocks in non-development)
```

**The planning agent must also address:**
- The test DB needs seed data (passkeys + sessions with dev tokens) — adapt `scripts/dev-db-reset.sh`
- Create a `scripts/test-db-seed.sh` that runs before E2E tests
- Consider whether test DB is wiped between runs or persistent

### 7.3 API Base URL in Tests

All test files hardcode `const API = "http://localhost:3001"`. This must be extracted:

```typescript
const API = process.env.API_URL || "http://localhost:3001";
```

Or in CI, since tests hit the deployed env via the browser, API calls from tests should go through the deployed URL:
```typescript
const API = process.env.API_URL || "http://localhost:3001";
// CI: API_URL=https://test.clanqr.dev/api (proxied through nginx)
// Or: API_URL=http://localhost:3011 (direct, if runner can reach host ports)
```

### 7.4 Agent Execution Tests

`agent-execution.test.ts` requires:
- Docker daemon access (builds and runs agent containers)
- Copilot CLI binary
- GPT-4.1 model access
- 10-minute timeouts

**Planning agent must decide:**
- Whether to skip agent execution tests in CI initially (tag with `@slow` or separate project)
- Whether the test environment's Copilot CLI instance is available during E2E runs
- Resource implications of running agent containers during E2E on the Pi

### 7.5 Reporting

```yaml
- name: Run E2E tests
  env:
    BASE_URL: https://test.clanqr.dev
    API_URL: http://localhost:3011  # Direct access from runner
    CI: true
  run: |
    cd $APP_DIR/e2e
    npx playwright test --reporter=github,html
  continue-on-error: false  # CI MUST fail on E2E failure

- name: Upload Playwright report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: ${{ env.APP_DIR }}/e2e/playwright-report/
    retention-days: 14

- name: Upload test screenshots
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: test-screenshots
    path: ${{ env.APP_DIR }}/e2e/test-results/
    retention-days: 7
```

---

## 8. Environment Variables Matrix

The planning agent must produce a complete env var specification per environment.

| Variable | Production (`/etc/ralph-api-prod.env`) | Test (`/etc/ralph-api-test.env`) |
|----------|---------------------------------------|--------------------------------|
| `PORT` | `3001` | `3011` |
| `NODE_ENV` | `production` | `test` |
| `SUPABASE_URL` | `http://172.17.0.1:54321` | `http://172.17.0.1:54331` |
| `SUPABASE_KEY` | `<prod-service-role-key>` | `<test-service-role-key>` |
| `RP_ID` | `clanqr.dev` | `test.clanqr.dev` |
| `RP_ORIGIN` | `https://clanqr.dev` | `https://test.clanqr.dev` |
| `FRONTEND_URL` | `https://clanqr.dev` | `https://test.clanqr.dev` |
| `COPILOT_BIN` | `/home/scoy/.local/bin/copilot` | `/home/scoy/.local/bin/copilot` |
| `LOG_LEVEL` | `info` | `debug` |
| `MAX_CONCURRENT_AGENTS` | `3` | `2` (lower for resource sharing) |
| `WORKSPACE_DIR` | (default) | (separate test workspace) |

**GitHub Actions secrets must be environment-scoped:**

| Secret | Environment |
|--------|------------|
| `SUPABASE_KEY` | `production` |
| `SUPABASE_KEY` | `test` |
| `RP_ID` | `production` |
| `RP_ID` | `test` |
| `RP_ORIGIN` | `production` |
| `RP_ORIGIN` | `test` |
| `FRONTEND_URL` | `production` |
| `FRONTEND_URL` | `test` |

**Planning agent must decide:**
- Whether to use GitHub Actions environments (recommended) or prefixed secret names (`PROD_SUPABASE_KEY` vs `TEST_SUPABASE_KEY`)
- How to generate the test Supabase JWT/service-role key
- Whether `COPILOT_BIN` and `GEMINI_BIN` differ per environment

---

## 9. Docker Compose & Database Strategy

### 9.1 Files

| File | Purpose | Used By |
|------|---------|---------|
| `docker-compose.dev.yml` | Local development stack | Developers |
| `docker-compose.test.yml` | Test environment DB stack | CI pipeline (`deploy-test.yml`) |
| (none — existing Supabase Docker) | Production DB | CI pipeline (`deploy-production.yml`) |

### 9.2 Migration Strategy

Both environments apply the same migration files from `supabase/supabase/migrations/`. The deploy pipeline already handles this:

```bash
for f in supabase/supabase/migrations/*.sql; do
  version=$(basename "$f" | cut -d_ -f1)
  # Check if already applied, apply if not
done
```

**For test:** Replace `supabase_db_supabase` with `ralph_test_db` in the migration command.

**Planning agent must decide:**
- Whether the test DB should be wiped before each E2E run (clean state) or persist across runs
- If wiped: use `scripts/dev-db-reset.sh` adapted for test container → `scripts/test-db-reset.sh`
- If persistent: only apply new migrations (same as production)
- Recommendation: **persistent with optional wipe** — add a `--reset` flag to the E2E CI step

### 9.3 Seed Data

The test environment needs predictable data for E2E tests:
- Test passkey accounts (dev-passkey, dev-admin) — same as dev seed
- Test sessions with known tokens
- Optionally: a test project

Create `scripts/test-db-seed.sh` adapted from `scripts/dev-db-reset.sh`, targeting `ralph_test_db`.

---

## 10. Nginx & SSL Configuration

### 10.1 Nginx Virtual Hosts

```nginx
# /etc/nginx/sites-available/clanqr.dev
server {
    listen 443 ssl;
    server_name clanqr.dev;

    ssl_certificate /etc/letsencrypt/live/clanqr.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clanqr.dev/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3001;
        # proxy headers...
    }

    location / {
        proxy_pass http://localhost:3002;
        # proxy headers...
    }
}

# /etc/nginx/sites-available/test.clanqr.dev
server {
    listen 443 ssl;
    server_name test.clanqr.dev;

    ssl_certificate /etc/letsencrypt/live/test.clanqr.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test.clanqr.dev/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3011;
        # proxy headers...
    }

    location / {
        proxy_pass http://localhost:3012;
        # proxy headers...
    }
}
```

### 10.2 SSL Setup

```bash
# Both domains must have DNS A records pointing to the Pi's public IP
certbot certonly --nginx -d clanqr.dev
certbot certonly --nginx -d test.clanqr.dev
# Auto-renewal via systemd timer (certbot installs this by default)
```

**Planning agent must verify:**
- DNS records for both domains exist
- Current nginx config on the Pi (may already handle `agents.benceboer.com`)
- Whether to use wildcard cert (`*.clanqr.dev`) or individual certs
- HTTP → HTTPS redirect for both domains

---

## 11. Branch Strategy & Protection Rules

### 11.1 Branch Model

```
main (production)
├── develop (test/staging)
│   ├── feature/foo → PR into develop
│   ├── feature/bar → PR into develop
│   └── bugfix/fix-thing → PR into develop
└── release/v1.0 → PR into main (optional)
```

### 11.2 GitHub Branch Protection

**`main`:**
- Require pull request before merging
- Require status checks to pass: `sanity-checks` (from `deploy-production.yml`)
- Require conversation resolution
- Require linear history (no merge commits) — OR — require `--no-ff` merge (per AGENTS.md §12)
- No force pushes

**`develop`:**
- Require pull request from feature branches
- Require status checks to pass: `checks` (from `pr-checks.yml`)
- Allow force push with lease (for rebasing)

**Planning agent must reconcile:** AGENTS.md §12 says "Merge with `git merge --no-ff`" (no fast-forward, creates merge commits). This conflicts with "require linear history". The plan must specify which to use and update AGENTS.md if needed.

---

## 12. Rollback Strategy

| Environment | Mechanism | DB Rollback? |
|-------------|-----------|-------------|
| Production | `git reset --hard HEAD~1` + rebuild + restart | No (manual) |
| Test | Same as production | Optional: can wipe and reseed |

**E2E failure on test:** Does NOT trigger rollback. The test environment stays deployed with the failing code so developers can debug. CI reports failure.

**Promotion gate:** E2E must be green on `develop` before a PR to `main` can merge (enforced by branch protection requiring the `deploy-test` / `e2e` check).

---

## 13. Validation Criteria

The implementation plan must include a validation checklist. The implementation is DONE only when ALL of these pass:

### Infrastructure
- [ ] Both Postgres containers run simultaneously on the Pi
- [ ] Both PostgREST gateways respond on their respective ports
- [ ] Both backend services start and respond to `/health`
- [ ] Both frontend builds serve correctly
- [ ] No port conflicts between environments
- [ ] Pi stays under 80% memory usage with both environments running

### CI/CD
- [ ] Push to `develop` triggers `deploy-test.yml`
- [ ] Push to `main` triggers `deploy-production.yml`
- [ ] PR to either branch triggers `pr-checks.yml`
- [ ] `deploy-test.yml` runs E2E tests after deployment
- [ ] CI fails if E2E tests fail
- [ ] Playwright report uploaded as artifact
- [ ] Both workflows can run without interfering with each other

### Networking
- [ ] `https://clanqr.dev` serves production frontend
- [ ] `https://clanqr.dev/api/health` returns `{ status: "ok" }` from production API
- [ ] `https://test.clanqr.dev` serves test frontend
- [ ] `https://test.clanqr.dev/api/health` returns `{ status: "ok" }` from test API
- [ ] SSL certificates valid and auto-renewing
- [ ] HTTP redirects to HTTPS on both domains

### E2E Tests
- [ ] Playwright config accepts `BASE_URL` from environment
- [ ] Tests authenticate successfully against the test environment
- [ ] Smoke tests pass against `test.clanqr.dev`
- [ ] API workflow tests pass
- [ ] UI workflow tests pass
- [ ] Agent execution tests either pass or are explicitly skipped with justification

### Branch Protection
- [ ] Cannot push directly to `main`
- [ ] Cannot merge PR to `main` without passing checks
- [ ] PR checks run on PRs to `develop` and `main`

---

## 14. Skills & Tools the Planning Agent Must Use

### Required Skills

| Skill | When to Invoke | Purpose |
|-------|---------------|---------|
| `meta-engineer` | Before starting the plan | Scenarios: `release` (deployment/ops). Domains: `reliability`, `observability`, `completeness`. Ensures the plan covers failure modes, monitoring, and all edge cases. |
| `hono-backend-architect` | When planning backend configuration changes | Understand middleware stack, env validation, service initialization patterns per environment. |
| `copilot-sdk` | When planning headless CLI server setup | Configure dual CLI instances on different ports with proper auth. |

### Required Repository Investigation

Before writing the plan, the agent MUST run these commands to gather current Pi state:

```bash
# Current systemd services
ssh pi 'systemctl list-units ralph-*'
ssh pi 'cat /etc/systemd/system/ralph-api.service'
ssh pi 'cat /etc/systemd/system/ralph-web.service'

# Current nginx config
ssh pi 'cat /etc/nginx/sites-enabled/*'
ssh pi 'nginx -T 2>/dev/null | head -100'

# Current Docker state
ssh pi 'docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"'
ssh pi 'docker compose ls'

# Current resource usage
ssh pi 'free -h && df -h && nproc'

# Current deploy trigger mechanism
ssh pi 'cat /etc/systemd/system/ralph-*.path 2>/dev/null'
ssh pi 'systemctl list-units --type=path ralph-*'

# DNS verification
dig clanqr.dev +short
dig test.clanqr.dev +short
```

If SSH access is not available, the agent must document these as prerequisites and make reasonable assumptions based on AGENTS.md.

### Tools

- **Copilot CLI** — for any implementation questions
- **GitHub MCP** — for setting up environments, secrets, and branch protection rules
- **Bash** — for all verification commands

---

## 15. Key Constraints & Risks

### Hard Constraints

| Constraint | Implication |
|------------|-------------|
| Single Raspberry Pi (ARM64) | Both environments share CPU, RAM, disk. Resource exhaustion is a real risk. |
| Self-hosted runner | Not ephemeral — state persists. Workflows must not leave dirty state. |
| ARM64 architecture | Some Docker images may not have ARM builds. Playwright chromium may need special handling. |
| `git reset --hard` in pipeline | Each environment MUST have its own git checkout directory. |
| Passkey auth (WebAuthn) | Cannot be automated in E2E without dev tokens or a test bypass. |
| Same IP for both domains | Nginx must route by `Host` header (SNI for SSL). |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pi runs out of RAM with dual environments | Medium | Both environments crash | Set `MAX_CONCURRENT_AGENTS=2` on test, monitor with `free -h` |
| Playwright chromium doesn't work on ARM64 | Medium | E2E cannot run | Use Firefox, or install chromium via `apt` and set `executablePath` |
| Concurrent deploys interfere | Low (concurrency groups) | Corrupted deploy | Use concurrency groups in workflows, separate checkout dirs |
| Test DB migrations drift from production | Low | False test results | Both use same migration files, same apply mechanism |
| SSL certificate renewal fails | Low | HTTPS stops working | Certbot auto-renewal + monitoring alert |
| Dev tokens on test env create security hole | Medium | Test env exploitable | Use `NODE_ENV=test` with targeted token allowlist, not `development` |

---

## 16. Reference Files

The planning agent must read these files before producing the plan:

| File | Why |
|------|-----|
| `.github/workflows/deploy-pi.yml` | Current CI/CD — the baseline to evolve |
| `e2e/playwright.config.ts` | Current E2E configuration |
| `e2e/tests/*.test.ts` | All 5 test suites — understand auth patterns, hardcoded URLs |
| `server/src/env.ts` | Env var schema — what the backend expects |
| `server/src/middleware/auth.ts` | Auth logic — specifically dev token blocking |
| `server/src/utils/dev_sessions.ts` | Dev token whitelist |
| `server/src/index.ts` | Route mounting, middleware stack, CORS config |
| `docker-compose.dev.yml` | Template for test Docker compose |
| `nginx.dev.conf` | Template for test nginx gateway config |
| `scripts/dev-db-reset.sh` | Template for test DB seeding |
| `AGENTS.md` | Project conventions, deploy pipeline docs, git hygiene rules |
| `server/src/db.ts` | Supabase client creation (singleton, service-role key) |

---

## 17. Appendix: Current Architecture Snapshot

### 17.1 Server Entry Point (`server/src/index.ts`) — Middleware Stack

Applied in order to all routes:
1. `hono_logger()` — request logging
2. `secureHeaders()` — security headers
3. `request_id_middleware()` — 8-char UUID per request
4. `metrics_middleware()` — HTTP metrics collection
5. CORS — origin whitelist from `FRONTEND_URL`, credentials enabled
6. Body size limit — 1MB max
7. Global rate limit — 500/min (dev) or 100/min (prod)
8. `supabase_middleware()` — injects DB client

Auth middleware applied to `/api/*` routes (except public auth endpoints).

### 17.2 Env Var Validation (`server/src/env.ts`)

Uses Zod schema with defaults. Critical for dual environments: `PORT`, `SUPABASE_URL`, `SUPABASE_KEY`, `RP_ID`, `RP_ORIGIN`, `FRONTEND_URL`, `NODE_ENV` must all differ between production and test.

### 17.3 Auth Middleware (`server/src/middleware/auth.ts`)

```
Request → Extract session cookie → Block dev tokens if NODE_ENV !== 'development'
  → Query sessions table (join passkeys for role) → Verify not expired
  → Block dev passkey IDs if NODE_ENV !== 'development' → Set context (passkey_id, role)
```

The `NODE_ENV !== 'development'` check is the key blocker for E2E auth on the test environment.

### 17.4 Migration Files

17 migrations from `20260219101340` to `20260311000000`, covering:
- Initial schema, auth/passkeys, prompts/traits/pipeline, admin/roles/invites, features model, tech debt fixes, CLI columns, agent run progress, workflow mitigations, integrity constraints, pipeline reliability, stabilization, model columns, task output, artifacts, execution CLI, agent runs fix

### 17.5 E2E Auth Pattern (repeated in all test files)

```typescript
const DEV_SESSION_COOKIE = "dev-session-token";
const AUTH = { Cookie: `session=${DEV_SESSION_COOKIE}` };

async function authenticate(page: Page) {
  await page.context().addCookies([{
    name: "session",
    value: DEV_SESSION_COOKIE,
    domain: "localhost",
    path: "/",
  }]);
}
```

For the test environment, the `domain` in `addCookies` must change to `test.clanqr.dev`.

---

*This document was auto-generated as planning instructions. The next agent should use this to produce a phased, actionable implementation plan with specific file changes, commands, and verification steps.*
