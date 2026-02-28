# AGENTS.md — Best Practices for AI Agents

> This file is the authoritative reference for any AI agent working in this repository.
> Read this **before starting any task**. It exists to prevent recurring mistakes
> that have caused major failures, wasted hours of compute, and required human intervention.

---

## Meta: How to Maintain This File

**Add to this file** when a problem meets ALL of these criteria:
1. It caused a significant failure (broken deployment, data loss, hours of wasted agent loops)
2. It required human intervention or a smarter model to diagnose and fix
3. A short, general principle could have prevented it entirely
4. Something already in this file is not up to date

**Do NOT add:**
- Minor command syntax quirks ("use `--flag` not `-f`")
- One-off bugs or temporary workarounds
- Anything already enforced by linters, type checkers, or CI

**Format:** Each entry should be a concise, actionable principle — not a story.
Write rules that a less capable agent can follow mechanically.

---

## 1 · Explore Before You Act

**Every task begins with understanding, not implementation.**

Before writing any code, answer these questions:
1. What does the current code actually do? (Read it. Don't assume from file names.)
2. What is the full path from code → build → deploy → running system?
3. What database state exists? (Check tables, columns, migrations — not just migration files.)
4. Are there other places in the codebase that do the same thing? (Search globally.)

```bash
# Understand the stack
cat .github/workflows/deploy-pi.yml          # How code gets deployed
cat server/src/index.ts                       # Server entry point
ls supabase/supabase/migrations/              # What migrations exist

# Check actual database state (not just migration files)
docker exec supabase_db_supabase psql -U postgres -d postgres -c "\dt"
docker exec supabase_db_supabase psql -U postgres -d postgres -c "\d table_name"
docker exec supabase_db_supabase psql -U postgres -d postgres -c \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"

# Find ALL occurrences of a pattern (don't fix one and miss three others)
grep -rn 'Bun.spawn.*copilot' server/src/
grep -rn 'btn-danger' web/src/
```

---

## 2 · A Task Is Not Done Until It's Deployed and Verified

**Writing code is maybe 30% of the work. The rest is validation.**

The mandatory completion checklist:

```bash
# 1. Type-check both projects (MUST be 0 errors)
cd server && bun run --bun tsc --noEmit
cd ../web && bun run check

# 2. Commit — follow format in § 12: "[verb] [feature/action] [context]", <50 chars
# Only commit after E2E verification. Amend or --fixup+squash if fixing a prior commit.
git add -A && git commit -m "[message]"

# 3. Push
git push

# 4. Wait for CI to pass (poll until completed)
gh run list --limit 1 --json status,conclusion
# If failed:
gh run view --log-failed

# 5. Verify the live deployment
curl -sf https://agents.benceboer.com/health
# Test your specific change against the live URL
```

**You are ONLY done when CI is green AND you have confirmed your change works on the live deployment.**

If you cannot test end-to-end (e.g., authenticated endpoints), explicitly state what you verified and what remains untestable, rather than claiming completion.

---

## 3 · Understand the Deploy Pipeline

This project deploys to a Raspberry Pi via GitHub Actions self-hosted runner.

```
Push to main
  → GitHub Actions: .github/workflows/deploy-pi.yml
    → git fetch + reset --hard (OVERWRITES local changes)
    → bun install (server + web)
    → Apply pending database migrations (via docker exec psql)
    → bun build (web)
    → touch .deploy-trigger
      → systemd watches this file → restarts ralph-api + ralph-web services
```

**Critical implications:**
- `git reset --hard` means any change not in the pushed commit is **destroyed**
- Database migrations run via `docker exec supabase_db_supabase psql` — not via Supabase CLI
- The server restarts on every deploy, which means **all in-memory state is lost**
- File ownership can change to root after `git reset` — if you see permission errors, that's likely why

**How to query the database directly:**
```bash
docker exec supabase_db_supabase psql -U postgres -d postgres -c "YOUR SQL HERE"
```
Note: Multi-statement `-c` strings can behave unpredictably. Run one statement at a time for safety.

---

## 4 · Database Migrations Must Be Verified at Every Layer

A migration is only real if it exists in ALL of:
1. A `.sql` file in `supabase/supabase/migrations/`
2. The `supabase_migrations.schema_migrations` table (so the pipeline doesn't skip it)
3. The actual database schema (the columns/tables/indexes actually exist)

```bash
# Check what migrations the DB thinks have been applied
docker exec supabase_db_supabase psql -U postgres -d postgres -c \
  "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version"

# Check what the actual schema looks like
docker exec supabase_db_supabase psql -U postgres -d postgres -c "\d passkeys"

# Compare against migration files on disk
ls -la supabase/supabase/migrations/
```

**If you create a new migration:** Test it locally before pushing by running it against the container manually. Don't assume the pipeline will handle it — verify.

**Migration file naming:** `YYYYMMDDHHMMSS_description.sql` (e.g., `20260221160000_features_model.sql`).

---

## 5 · Search Globally Before Fixing Locally

When you find a bug, **search the entire codebase for the same pattern** before fixing just one instance.

```bash
# BAD: Found `Bun.spawn(["copilot"` in pipeline_service.ts, fixed it, moved on.
# GOOD: Search for ALL spawn calls first.
grep -rn 'Bun.spawn' server/src/

# BAD: Fixed `.btn-danger { color: var(--fg) }` in one file.
# GOOD: Find every `.btn-danger` definition across all pages.
grep -rn 'btn-danger' web/src/routes/

# BAD: Added COPILOT_BIN to one service.
# GOOD: Check every service that shells out to external binaries.
grep -rn 'copilot\|COPILOT_BIN\|spawn\|exec' server/src/services/
```
s
---

## 6 · Server State Is Ephemeral — Design for Restarts

The server process restarts on every deployment. Any in-memory state (Maps, Sets, running child processes) is **lost**.

**Rules for stateful services:**
- On startup, reconcile in-memory state with the database
- Don't rely on in-memory maps as the source of truth for "is this process running?"
- Before spawning a process, check the DB for existing running/completed entries
- Mark processes as failed in the DB when they exit unexpectedly

**Example of what goes wrong:** The watcher service polled for features with status "Submitted" every 5 seconds. After restart, its in-memory process map was empty, so it re-spawned managers for features that already had running (or completed) managers. This caused dozens of duplicate agent runs.

**The fix pattern:**
```ts
// Before spawning, check if already handled
const existing = await db.from("agent_runs")
  .select("id")
  .eq("feature_id", feature.id)
  .eq("agent_type", "manager")
  .in("status", ["running", "completed"])
  .limit(1);

if (existing.data?.length) return; // Already handled
```

---

## 7 · Project Conventions

| Layer | Stack | Key Rules |
|-------|-------|-----------|
| **Backend** | Hono on Bun (port 3001) | TypeScript strict, `snake_case`, Zod validation via `schema.safeParse(await c.req.json())` |
| **Frontend** | SvelteKit + Svelte 5 | Runes only (`$state`, `$derived`, `$effect`). No stores. No `export let`. No `$:`. |
| **Database** | Supabase (Postgres via Docker) | Accessed via `@supabase/supabase-js`. Local container: `supabase_db_supabase`. |
| **Styling** | CSS custom properties | Dark theme. CSS variables defined in layout. `@media (max-width: 768px)` for mobile. |
| **Dependencies** | Bun | `bun install --frozen-lockfile`. Do NOT add new libraries without explicit approval. |

**Svelte 5 critical rules** (agents repeatedly violate these):
- Use `$props()` not `export let`
- Use `$state()` not `writable()`
- Use `$derived()` not `$:` reactive statements
- Use `{@render children?.()}` not `<slot>`
- Use callback props not `createEventDispatcher`

**Naming:**
- Files: `kebab-case.const.ts`, `kebab-case.interface.ts`, `ComponentName.svelte`
- Variables/functions: `snake_case`
- Types/interfaces: `PascalCase`

---

## 8 · Skills and How to Use Them

Before making changes to backend or frontend code, invoke the relevant skill:
- **`hono-backend-architect`** — for any Hono route, middleware, or service change
- **`svelte-architect`** — for any Svelte component or page change
- **`supabase-postgres-best-practices`** — for any database schema or query changes

These skills contain detailed patterns, anti-patterns, and conventions specific to this project's stack. Reading them prevents the most common mistakes.

---

## 9 · Testing and Verification

**Type checking (mandatory before every push):**
```bash
cd server && bun run --bun tsc --noEmit   # Backend — must be 0 errors
cd web && bun run check                   # Frontend — must be 0 errors (warnings OK)
```

**Live deployment verification:**
```bash
# Health check (unauthenticated)
curl -sf https://agents.benceboer.com/health

# Check response codes for authenticated endpoints (expect 401)
curl -sf -w '%{http_code}' https://agents.benceboer.com/api/pipeline/status

# Check public endpoints
curl -sf "https://agents.benceboer.com/api/auth/invite/status?token=test"
```

**The app uses passkey authentication.** You cannot authenticate via curl. For testing authenticated flows:
- Verify the API returns 401 (auth middleware is working)
- Verify public endpoints return correct data
- For UI verification, describe what the user should check in a browser

**CI monitoring:**
```bash
gh run list --limit 1 --json status,conclusion    # Poll for completion
gh run view --log-failed                           # Investigate failures
```

---

## 10 · Common Pitfalls (Learned from Real Failures)

### "I committed but forgot to push"
The deploy pipeline only triggers on pushes to `main`. Your local commit means nothing until it's pushed.

### "The migration file exists but the table doesn't"
Migration files are just text. They must be applied to the database. Check `schema_migrations` to see what's actually been applied. If the pipeline migration step didn't exist (it was added recently), your migration may be sitting there unapplied.

### "I fixed the service but agents still fail"
After code changes deploy, the server restarts. But if agent processes were already spawned, those processes are orphaned. Check `agent_runs` in the DB for stale `running` entries and consider marking them as `failed`.

### "Tests pass but the page is blank"
TypeScript compilation succeeding does not mean the feature works. `tsc` catches type errors, not logic errors, missing routes, unregistered middleware, or CSS layout issues. Always verify in the browser or via API calls.

### "I added a column but the API still returns null"
Supabase PostgREST silently returns `null` for columns that don't exist in a `.select()` call. If you see `null` where you expect data, check whether the column actually exists in the database, not just in your migration file.

### "The server won't start after deploy"
Check `journalctl -u ralph-api -n 50` on the Pi. Common causes: syntax error in new code, missing import, port already in use from a previous instance that didn't shut down cleanly.

### CSS "I fixed mobile overflow but it persists"
You must address ALL sources of overflow, not just one. A `flex-shrink: 0` child in a nested flex container will overflow regardless of what you do to its parent. Use browser DevTools (or read the CSS carefully) to identify every rigid-width element in the overflow chain. Add `overflow-x: hidden` to the page container as a safety net but fix the actual cause.

---

## 11 · Architecture Quick Reference

```
ralph-agent-workspace/
├── server/                    # Hono API (Bun, port 3001)
│   └── src/
│       ├── index.ts           # Entry point, route mounting
│       ├── routes/            # Hono route modules (auth, admin, features, etc.)
│       ├── services/          # Business logic (agent_service, pipeline_service, watcher_service)
│       ├── middleware/         # auth_middleware, admin_middleware
│       └── db.ts              # Supabase client factory
├── web/                       # SvelteKit frontend (port 3002)
│   └── src/
│       ├── routes/            # SvelteKit pages (+page.svelte, +layout.svelte)
│       └── lib/
│           ├── api/client.ts  # API client (all fetch calls to backend)
│           ├── types/index.ts # Shared TypeScript interfaces
│           ├── auth.ts        # Passkey auth (WebAuthn)
│           └── components/    # Shared UI components
├── supabase/supabase/
│   └── migrations/            # SQL migration files (applied by CI pipeline)
├── agents/
│   ├── prompts/               # Manager and ralph agent system prompts
│   ├── scripts/               # Spawn scripts
│   └── workspace/             # Agent working directories (progress.json, tasks.json)
└── .github/workflows/
    └── deploy-pi.yml          # CI/CD pipeline (self-hosted Pi runner)
```

**Request flow:** Browser → SvelteKit (3002) → Hono API (3001) → Supabase Postgres (5432 via Docker)

**Agent flow:** Feature submitted → watcher_service polls → spawns manager → manager writes tasks.json → pipeline_service queues tasks → spawns ralph agents → ralph writes progress.json

---

## 12 · Git Hygiene

### Branching Strategy

- Branch names use `kebab-case`
- All branches except `main` are prefixed with `release/`, `feature/`, or `bugfix/`
- Merge with `git merge --no-ff` (never fast-forward)
- Rebase branch onto target before merging

```bash
git rebase main
git checkout main && git merge --no-ff feature/my-feature
git push --force-with-lease origin main   # NEVER --force without --lease
```

### Commit Message Format

- Template: `[verb] [feature/action] [context]`
- Imperative present tense: "fix", "add", "implement", "refactor"
- Single line, under 50 chars, no trailing period
- Examples:
  - `Add system health diagnostics to dashboard`
  - `Fix hamburger menu overlapping navigation`
  - `Update API security with DB sanity checks`

### Commit Strategy

- Only commit after E2E verification — the repository must be in a faultless state
- Keep commits atomic: one logical change per commit (backend + frontend + migration together if needed)
- If a recent commit on the current branch was flawed, amend it or use `--fixup` + interactive rebase to squash the fix — do not leave broken commits in history

```bash
# Amend (for iterative fixes to the last commit)
git add -A && git commit --amend --no-edit

# Fixup + squash (for fixing an older commit)
git add -A && git commit --fixup=<sha>
git rebase -i --autosquash <sha>^
```

---

## 19 · Known Architectural Decisions

### Single-Tenant Design
This system is single-tenant by design. There is one workspace, one set of projects, and one pipeline queue.
All authenticated users share the same data. **Do not add multi-tenant isolation** — it would require
restructuring the entire data model, pipeline, and agent spawning system. If multi-tenancy is needed,
it should be a ground-up redesign, not a bolt-on.

### RLS Policies
Supabase Row-Level Security (RLS) is **not enabled** on most tables. The server uses the service-role key,
bypassing RLS. This is acceptable in a single-tenant system where the API layer enforces access control
via `auth_middleware` and `admin_middleware`. **If RLS is ever needed**, add policies incrementally per table
and test each one against the API — PostgREST behavior changes silently when RLS is enabled.

### SSR Disabled
SvelteKit runs in SPA mode (`ssr: false` in `+layout.ts`). All pages load client-side. This means:
- No server-side rendering, no SEO (acceptable for an internal tool)
- Auth state is checked client-side via `onMount` — a brief flash is possible on protected pages
- Data fetching is done via `onMount` + polling, not SvelteKit `load()` functions
- **Do not enable SSR** without first solving auth token forwarding to the Hono API

---

## 20 · Stabilization Lessons Learned

These rules were extracted from a comprehensive stabilization audit. They encode patterns
that caused real failures in this codebase.

### Concurrency & Process Management
- Every `increment_agent_count()` must have a matching `decrement_agent_count()` in a `finally` block. A leaked counter permanently reduces concurrency.
- `cancel()` functions must decrement counts. The happy path is not the only path — aborts, timeouts, and user cancels must all clean up.
- Manager agents must respect the same concurrency limits as task agents. A manager that bypasses `can_spawn_agent()` can deadlock the pipeline.
- Use `setTimeout(0)` for recursive-like loops (e.g., `process_next()`). Actual recursion on a queue risks stack overflow on long runs.
- When `can_spawn_agent()` returns false, retry with a short delay — don't silently drop the task. Register an `on_agent_freed` callback to wake the pipeline immediately.

### Data Integrity
- Supabase mutations (`.insert()`, `.update()`, `.delete()`) can fail silently — always check `.error` on the result.
- Use optimistic locking for state transitions: `.update({status: "Complete"}).eq("status", "In_Progress")` prevents double-completion.
- Never trust in-memory Sets/Maps as the source of truth after restart. The DB is the only durable state.
- Wrap polling reconciliation with key-based identity: `Object.assign(existing, incoming)` instead of replacing arrays wholesale, to avoid UI flicker and lost scroll position.

### Environment & Security
- Never spread `...process.env` into `Bun.spawn`. Build an explicit env allowlist via a `build_agent_env()` function.
- Validate all env vars via a Zod schema in `env.ts` at startup. If `parseInt()` returns NaN, you won't notice until production.
- SSRF validation must block: `127.x`, `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `::1`, `fc00::/7`, decimal IPs, `file://` schemes.
- X-Forwarded-For: use the **rightmost** entry (last trusted proxy), not the leftmost (client-spoofable).

### Frontend Patterns
- CSS custom properties must match exactly: `--fg-muted` (not `--text-muted`), `--bg-surface` (not `--surface`). A wrong name silently renders nothing.
- Error toasts should auto-dismiss at 10s (not 5s) — users need time to read error details.
- Every page over 300 lines must be decomposed into subcomponents. The `projects/[id]/+page.svelte` hit 918 lines before being split into FeatureList, FeatureDetail, TaskList.
- Polling pages must reconcile by key, not replace arrays. Use `Object.assign(existing_item, new_item)` to preserve object identity.
- Auth challenge stores must be keyed per-challenge (`auth:${challenge}`), not a single key — concurrent login attempts will clobber each other.

### Prompts
- Delimit all user-supplied content in agent prompts with `<user_input>` tags to reduce prompt injection surface.
- Validate agent output with Zod before DB insertion. `JSON.parse()` alone is not enough — structural validation catches malformed but parseable output.

