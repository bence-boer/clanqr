# Ralph Agent Workspace

Multi-agent orchestration platform for managing AI coding agents. Features a
project/feature pipeline, prompt management, usage tracking, and a real-time
monitoring dashboard.

Built with Bun, Hono, SvelteKit (Svelte 5), and Supabase (Postgres).


## Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- [Docker](https://docs.docker.com/engine/install/) with the Compose plugin (`docker compose`)


## Quick Start

From a fresh clone, one command sets up everything:

```bash
./scripts/dev-setup.sh
```

This will:
1. Install server, web, and E2E dependencies
2. Install Playwright browsers (Chromium)
3. Install the pre-commit git hook
4. Create `.env.local` files with valid local-dev credentials
5. Start the Docker database stack (Postgres + PostgREST + nginx gateway)
6. Apply all migrations and insert seed data

Then start developing:

```bash
bun run dev
```

This runs the API server (port 3001, with `--watch` hot reload) and the SvelteKit
dev server (port 5173, with Vite HMR) concurrently. Open http://localhost:5173.

### Dev session tokens

The seed data includes long-lived sessions for local testing:

| Token | Role | Usage |
|-------|------|-------|
| `dev-session-token` | user | `Cookie: session=dev-session-token` |
| `dev-admin-session-token` | admin | `Cookie: session=dev-admin-session-token` |

Example:
```bash
curl -H "Cookie: session=dev-session-token" http://localhost:3001/api/projects
```


## Scripts

All scripts are defined in the root `package.json` and can be run with `bun run <name>`:

| Script | Description |
|--------|-------------|
| `dev` | Start server + web with hot reload |
| `dev:server` | Start server only |
| `dev:web` | Start web only |
| `dev:db` | Start the Docker database stack |
| `dev:db:stop` | Stop the Docker database stack |
| `dev:db:reset` | Drop, re-migrate, and re-seed the local database |
| `dev:setup` | Full one-time setup (see Quick Start) |
| `check` | Type-check server and web |
| `check:server` | Type-check server only |
| `check:web` | Type-check web only |
| `test` | Run unit tests (Bun test runner) |
| `test:e2e` | Run E2E tests (Playwright, headless) |
| `test:e2e:headed` | Run E2E tests with a visible browser |
| `test:e2e:ui` | Open Playwright UI mode |
| `prepare` | Install git hooks |


## Testing

### Unit tests

29 tests across 4 files, using Bun's built-in test runner with an in-memory
mock Supabase client. No external services required.

```bash
bun run test
```

### E2E tests

7 Playwright tests covering health, authentication, and CRUD flows. These run
against the live local stack, so the dev servers and database must be running.

```bash
bun run dev          # in one terminal
bun run test:e2e     # in another
```

Playwright auto-starts the servers if they are not already running (via the
`webServer` config), but the Docker database must be up first.

### Pre-commit hook

On every commit, the hook runs:
1. Server type-check (`tsc --noEmit`)
2. Web type-check (`svelte-check`)
3. Unit tests

E2E tests are excluded from the hook because they require the full stack. Run
them manually before pushing.


## Architecture

```
ralph-agent-workspace/
  server/                   Hono API (Bun, port 3001)
    src/
      index.ts              Entry point, middleware + route mounting
      db.ts                 Supabase client factory
      middleware/            auth, admin, supabase context
      routes/               Route modules (auth, projects, features, ...)
      services/             Business logic (agents, pipeline, watcher, ...)
      test-utils.ts         Mock Supabase client for unit tests
      test-app.ts           Test Hono app builder
  web/                      SvelteKit frontend (Vite, port 5173)
    src/
      routes/               SvelteKit pages
      lib/
        api/client.ts       Fetch-based API client
        types/index.ts      Shared TypeScript interfaces
        auth.ts             WebAuthn / passkey auth
        components/         Shared UI components
  e2e/                      Playwright E2E tests
    tests/smoke.test.ts     Smoke + authenticated flow tests
  supabase/supabase/
    migrations/             SQL migration files (applied by CI + dev-db-reset.sh)
  agents/                   Agent prompts and spawn scripts
  scripts/
    dev-setup.sh            One-time local dev bootstrap
    dev-db-reset.sh         Reset local database
    pre-commit              Git pre-commit hook
  .github/workflows/
    deploy-pi.yml           CI/CD: sanity checks then deploy to Raspberry Pi
```

### Request flow

```
Browser --> SvelteKit (5173) --> Hono API (3001) --> Supabase Postgres (Docker)
```

### Local database stack

The local dev stack uses Docker Compose to replicate the Supabase architecture:

```
@supabase/supabase-js  -->  nginx gateway (:54321)  -->  PostgREST (:3000)  -->  Postgres (:54322)
                             (strips /rest/v1/ prefix)
```

The `@supabase/supabase-js` client appends `/rest/v1/` to all requests. The
nginx gateway strips this prefix before forwarding to PostgREST, matching how
Supabase's Kong gateway works in production.


## Deployment

Production deploys to a Raspberry Pi via a GitHub Actions self-hosted runner.

```
Push to main
  --> sanity-checks job:  type-check server, type-check web, unit tests
  --> deploy job:         apply migrations, build web, restart services
```

The deploy uses `git reset --hard` on the Pi, so any local change not in the
pushed commit is destroyed. Database migrations are applied via `docker exec`
against the production Supabase Postgres container.

See [.github/workflows/deploy-pi.yml](.github/workflows/deploy-pi.yml) for
the full pipeline.


## Conventions

| Area | Rule |
|------|------|
| Runtime | Bun (not Node) |
| Server | Hono, TypeScript strict, `snake_case` identifiers |
| Frontend | SvelteKit, Svelte 5 runes (`$state`, `$derived`, `$effect`), no stores |
| Database | Supabase (Postgres), `@supabase/supabase-js` |
| Styling | CSS custom properties, dark theme, responsive at 768px |
| Files | `kebab-case.ts`, `PascalCase.svelte` |
| Commits | `[verb] [subject] [context]`, imperative, under 50 chars |
| Dependencies | Do not add without approval |


## Troubleshooting

### Bun does not load .env.local

Bun loads `.env.local` from the current working directory, not the project root.
The server runs from `server/`, so it needs `server/.env.local`.
`dev-setup.sh` handles this automatically. If you edit `.env.local`, copy it:

```bash
cp .env.local server/.env.local
```

### PostgREST returns 401 or JWT errors

The `SUPABASE_KEY` in `.env.local` must be a JWT signed with the
`PGRST_JWT_SECRET` in `docker-compose.dev.yml`. The `.env.example` contains a
pre-signed token. If you change the JWT secret, regenerate the key.

### Docker DNS issues

If `docker compose up` hangs on image pulls, your DNS may be misconfigured.
Add public resolvers:

```bash
# /etc/docker/daemon.json
{ "dns": ["1.1.1.1", "8.8.8.8"] }
```

Then restart: `sudo systemctl restart docker`

### svelte-check fails with "SyntaxError: Unexpected string"

This happens when an old Node.js installation intercepts the SvelteKit shim
instead of Bun. Use the `--bun` flag:

```bash
bun run --bun check   # forces Bun runtime for subprocesses
```

The CI pipeline and pre-commit hook already use this flag.
