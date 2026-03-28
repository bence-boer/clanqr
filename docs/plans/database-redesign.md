# PLAN-PLAN: Complete Database Nuke & Redesign

> **What this document is:** Instructions for a future agent to create the actual implementation plan
> for a complete database nuke and redesign. This is a "plan to create a plan" — it defines scope,
> constraints, required research, deliverables, and acceptance criteria for the planning phase itself.
>
> **What this document is NOT:** The implementation plan. Do not start writing SQL from this document.
> First, create the plan. Then execute the plan.

---

## 1 · Context & Motivation

### Current State

The ralph-agent-workspace database has 17 incremental migrations and accumulates significant
tech debt from rapid iteration. The schema was designed for a CLI-based agent spawning system
(Bun.spawn of copilot/gemini CLI tools) with passkey (WebAuthn) authentication.

**Current tables (15):**

| Domain | Tables |
|--------|--------|
| Auth | `passkeys`, `sessions`, `invite_tokens` |
| Core | `projects`, `features`, `tasks`, `resources` |
| Agent | `agent_runs`, `prompts`, `traits`, `trait_assignments`, `skill_links` |
| Chat | `chat_sessions`, `chat_messages` |
| Artifacts | `task_artifacts` |

**Current enums (10):** `project_status`, `feature_status`, `task_status`, `resource_status`,
`agent_type`, `agent_run_status`, `prompt_role`, `trait_target`, `assignment_scope`, `failure_behavior`

### Target State

- **Nuke everything** — drop all tables, enums, functions, triggers. No backward compatibility. Pre-alpha.
- **Replace passkey auth with GitHub OAuth** — `users` table with `github_id`, `avatar_url`, `username`. Sessions tied to GitHub OAuth tokens.
- **Replace CLI-based agent system with copilot-sdk** — agent tracking redesigned for copilot-sdk sessions, streaming events, hooks, and MCP integrations.
- **Keep the core domain model** (projects → features → tasks) but redesign for copilot-sdk patterns.
- **Design for dual environments** — prod (`clanqr.dev`) and test (`test.clanqr.dev`) with separate databases.
- **Long-term extensibility** — schema should accommodate future features without more migrations for at least 6 months.

---

## 2 · Required Skills

**The planning agent MUST invoke these skills before writing any schema SQL:**

### `supabase-postgres-best-practices`
Use for: schema design patterns, indexing strategy, RLS configuration, constraint design,
type selection (TIMESTAMPTZ vs TIMESTAMP, TEXT vs VARCHAR), UUID generation, JSONB usage patterns,
and PostgREST compatibility requirements.

### `meta-engineer`
Use the following domains and scenarios:
- **foundation/core** — engineering rigor for the schema design process itself
- **foundation/constraints** — identify and document all constraints before designing
- **scenarios/contract-change** — this is a complete contract change (every API consumer breaks)
- **domains/state-and-data** — state machine design for status enums, data integrity invariants
- **domains/invariants** — foreign key invariants, cascade behavior, constraint validation
- **domains/architecture** — table decomposition, normalization decisions, extensibility

### `hono-backend-architect`
Use for: understanding how Hono routes will consume the schema, middleware patterns for auth,
Zod validation integration, and how `@supabase/supabase-js` queries map to table design.

---

## 3 · Required Research (Before Planning)

The planning agent must gather this information before writing the plan:

### 3.1 · Current Schema Deep-Dive

```bash
# Read ALL 17 migration files to understand schema evolution
ls -la supabase/supabase/migrations/

# Read the generated types to understand current column types
cat server/src/database.types.ts

# Read docker-compose.dev.yml to understand local dev setup
cat docker-compose.dev.yml

# Read .env.example for environment configuration
cat .env.example

# Understand how services query the database
grep -rn 'supabase' server/src/services/ --include='*.ts'
grep -rn 'from(' server/src/services/ --include='*.ts'
grep -rn 'supabase' server/src/routes/ --include='*.ts'

# Find all Zod schemas currently in use
grep -rn 'z\.\|zod' server/src/ --include='*.ts'

# Understand the shared types
ls shared/ && cat shared/types.ts 2>/dev/null || true
```

### 3.2 · Copilot SDK Documentation

Read these files from `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/`:

| File | Why |
|------|-----|
| `features/session-persistence.md` | Session ID format, persistence model, resume patterns |
| `features/custom-agents.md` | Agent types, tool restrictions, delegation model |
| `features/streaming-events.md` | Event types, data payloads, what to store for audit |
| `features/hooks.md` | Hook types, lifecycle, data produced |
| `features/mcp.md` | MCP server integration model |
| `features/skills.md` | Skills system, how skills attach to agents |
| `hooks/pre-tool-use.md` | Tool call approval/deny/modify data model |
| `hooks/post-tool-use.md` | Tool result transformation, suppression, redaction |
| `hooks/session-lifecycle.md` | Session start/end hook data |
| `setup/github-oauth.md` | GitHub OAuth flow, user data available |
| `observability/opentelemetry.md` | Telemetry data model, trace/span structure |
| `features/steering-and-queueing.md` | Message delivery modes |

### 3.3 · Server Architecture

```bash
# Entry point — understand route mounting and middleware order
cat server/src/index.ts

# Auth middleware — understand current session validation
cat server/src/middleware/auth_middleware.ts

# Database client — understand Supabase client configuration
cat server/src/db.ts

# All service files — understand business logic and query patterns
ls server/src/services/
# Read each service file to catalog every database query
```

### 3.4 · Frontend Data Consumption

```bash
# API client — understand what the frontend expects from the API
cat web/src/lib/api/client.ts

# Types — understand shared type definitions
cat web/src/lib/types/index.ts

# Auth — understand current passkey flow (being replaced)
cat web/src/lib/auth.ts
```

---

## 4 · Schema Design Requirements

### 4.1 · Global Constraints

These apply to EVERY table in the new schema:

| Constraint | Requirement |
|------------|-------------|
| Primary keys | `UUID` (`gen_random_uuid()`) for all tables |
| Timestamps | `TIMESTAMPTZ` with `DEFAULT NOW()` — never `TIMESTAMP` |
| Text fields | `TEXT` — never `VARCHAR(n)` (PostgREST compatibility + no artificial limits) |
| Naming | `snake_case` for everything (tables, columns, enums, indexes, constraints) |
| Soft deletes | Do NOT use soft deletes. Hard delete with cascades. |
| Nullability | Columns are `NOT NULL` by default. Explicitly allow `NULL` only when semantically meaningful. |
| Encoding | UTF-8 throughout |
| PostgreSQL version | 17 (use PG17 features where beneficial) |

### 4.2 · Users & Authentication (GitHub OAuth)

**Replace the entire passkey/WebAuthn system with GitHub OAuth.**

Design a `users` table that stores:
- `github_id` (BIGINT, UNIQUE) — GitHub's numeric user ID (stable identifier)
- `username` (TEXT) — GitHub login (can change, not used for lookups)
- `display_name` (TEXT) — GitHub display name
- `avatar_url` (TEXT) — GitHub avatar URL
- `email` (TEXT, nullable) — GitHub primary email (may not be public)
- `role` (TEXT or enum) — `admin`, `member` (keep it simple)
- `created_at`, `updated_at` — standard timestamps

Design a `sessions` table:
- Tied to `users` (not passkeys)
- `token` (TEXT, UNIQUE) — HTTPOnly cookie session token (generated server-side, NOT the GitHub OAuth token)
- `github_access_token` (TEXT) — encrypted GitHub OAuth access token for API calls
- `github_refresh_token` (TEXT, nullable) — encrypted refresh token
- `token_expires_at` (TIMESTAMPTZ) — when the GitHub token expires
- `expires_at` (TIMESTAMPTZ) — session expiry
- Consider: should we store GitHub OAuth tokens at all, or use them transiently?

**Remove:** `passkeys`, `invite_tokens` tables entirely.

**Decision for the planning agent:** Evaluate whether invite tokens are still needed for the GitHub OAuth model, or if GitHub org membership can gate access.

### 4.3 · Core Domain Model (Projects → Features → Tasks)

**Keep the hierarchy but clean up the schema:**

#### `projects`
- Keep: `id`, `name`, `description`, `status`, timestamps
- Evaluate: is `project_status` enum still correct? (`Active`, `Archived`, `Planning`)
- Add: `created_by` (FK → users) — who created the project

#### `features`
- Keep: `id`, `project_id`, `title`, `description`, `status`, `auto_approve`, `on_task_failure`, timestamps
- **Remove CLI-specific columns**: `cli`, `execution_cli` — copilot-sdk replaces these
- **Redesign model selection**: `planning_model` and `execution_model` may need rethinking for copilot-sdk (which handles model selection differently)
- Add: `created_by` (FK → users)
- Evaluate: `manager_retry_count`, `last_error`, `task_timeout_minutes` — are these still relevant with copilot-sdk?

#### `tasks`
- Keep: `id`, `feature_id`, `title`, `description`, `status`, `output`, `sort_order`, timestamps
- **Remove**: `agent_log` (replaced by agent_events), `model` (copilot-sdk manages this)
- Keep: `retry_count`, `max_retries` — still useful for pipeline resilience
- Add: `created_by` (FK → users, nullable — manager-created tasks won't have one)

#### `resources`
- Keep as-is but clean up: `id`, `feature_id`, `url`, `title`, `status`, timestamps
- Evaluate: is `resource_status` enum still needed, or can resources just be URLs?

#### `task_artifacts`
- Keep: `id`, `task_id`, `filename`, `size_bytes`, `mime_type`, `created_at`
- Consider: should artifacts link to agent_runs as well? (which run produced this artifact)

### 4.4 · Agent System (Copilot SDK)

**This is the biggest redesign area.** The current `agent_runs` table tracked CLI process spawning.
The new schema must track copilot-sdk sessions, which are fundamentally different.

#### `agent_sessions` (NEW — replaces conceptual "agent process")
The copilot-sdk uses structured session IDs (e.g., `user-{userId}-{taskType}-{timestamp}`).
Sessions persist to disk and can be resumed.

Design to track:
- `id` (UUID, PK) — our internal ID
- `session_id` (TEXT, UNIQUE) — the copilot-sdk structured session ID
- `agent_type` — what kind of agent (manager, ralph, researcher, editor, chat)
- `status` — lifecycle state (pending, running, paused, completed, failed, cancelled)
- `feature_id` (FK, nullable) — for manager agents
- `task_id` (FK, nullable) — for task-executing agents
- `user_id` (FK, nullable) — who initiated
- `model` (TEXT) — model used
- `source` (TEXT) — how session started: "new", "resume"
- Token tracking: `prompt_tokens`, `completion_tokens`, `cache_read_tokens`, `cache_write_tokens`
- `duration_ms` — total session duration
- `summary` (TEXT) — agent-generated summary
- `error` (TEXT, nullable) — error message if failed
- `files_changed` (TEXT[]) — files modified
- `started_at`, `finished_at`, `created_at`

**Decision for the planning agent:** Should we keep the polymorphic FK pattern (manager→feature_id,
ralph→task_id) with a CHECK constraint, or normalize into separate junction tables?

#### `agent_events` (NEW — audit/observability)
Captures streaming events and hook data from copilot-sdk sessions.

The copilot-sdk emits rich events (see `features/streaming-events.md`):
- `assistant.turn_start/end`, `assistant.message`, `assistant.usage`
- `tool.execution_start/complete`
- `session.error`, `session.compaction_complete`
- Hook decisions (pre-tool-use allow/deny, post-tool-use suppress/redact)

Design considerations:
- **Do NOT store every event** — streaming deltas (`*_delta` events) are ephemeral and high-volume
- **DO store**: usage events (tokens/cost), tool executions (audit), errors, compaction events, hook decisions
- JSONB for event-specific payloads (different events have different shapes)
- Partitioning strategy: should events be partitioned by time or by session?

Minimum columns:
- `id` (UUID, PK)
- `agent_session_id` (FK → agent_sessions)
- `event_type` (TEXT) — discriminator
- `event_data` (JSONB) — event-specific payload
- `created_at` (TIMESTAMPTZ)

Index: `(agent_session_id, event_type, created_at)` for querying events by type within a session.

#### `agent_tool_calls` (NEW — tool execution audit)
Tracks every tool call made by agents for audit, debugging, and cost analysis.

- `id` (UUID, PK)
- `agent_session_id` (FK → agent_sessions)
- `tool_call_id` (TEXT) — SDK-assigned tool call ID
- `tool_name` (TEXT) — e.g., "bash", "edit", "grep"
- `tool_type` (TEXT) — "function", "custom", or MCP server name
- `mcp_server_name` (TEXT, nullable) — if tool from MCP server
- `arguments` (JSONB) — tool arguments (consider redaction for sensitive args)
- `result_success` (BOOLEAN)
- `result_summary` (TEXT, nullable) — truncated result
- `error_message` (TEXT, nullable)
- `duration_ms` (INTEGER)
- `permission_decision` (TEXT, nullable) — "allow", "deny", "ask" from pre-tool-use hook
- `was_suppressed` (BOOLEAN, DEFAULT false) — from post-tool-use hook
- `created_at` (TIMESTAMPTZ)

**Decision for the planning agent:** How much tool call detail do we store? Full arguments + results
can be very large. Consider a tiered approach: summary in the main table, full payload in a
separate `agent_tool_call_details` table (or JSONB column with optional population).

### 4.5 · Prompts & Traits System

#### `prompts`
- Keep but redesign for copilot-sdk agent types
- `role` enum needs updating: currently `manager` | `ralph`, should become the full agent type set
- Add: `version` tracking (integer), `is_active` flag for A/B testing prompts
- Consider: should prompts be per-agent-type (global) or per-project/feature?

#### `traits`
- Keep: `id`, `name`, `description`, `content`, `is_global`, timestamps
- `target` enum: expand beyond `manager` | `ralph` to include all copilot-sdk agent types

#### `trait_assignments`
- Keep the hierarchical scope model (project → feature → task)
- Keep `is_excluded` for override/exclusion
- The `scope` + polymorphic FK pattern works well — keep it

#### `skill_links`
- Keep: maps skills to tasks
- Consider: should skills also attach at feature or project level?

### 4.6 · Chat System

#### `chat_sessions`
- Evaluate: with copilot-sdk, are chat sessions just another `agent_session` of type `chat`?
- If so, `chat_sessions` might merge into `agent_sessions` and `chat_messages` becomes a view over `agent_events`
- **Decision for the planning agent:** Keep chat as separate tables (simpler queries, clear separation)
  or unify with agent_sessions (DRY, consistent tracking)?

#### `chat_messages`
- If keeping separate: `id`, `session_id`, `role` (user/assistant/system), `content`, `created_at`
- If unifying: chat messages become events in `agent_events` with `event_type = 'chat.message'`

### 4.7 · New Tables to Consider

#### `mcp_server_configs` (NEW)
Track MCP server integrations:
- `id`, `name`, `server_type` (stdio/http/sse), `command`, `args`, `env`, `url`
- `is_global` — available to all agents, or scoped
- `status` — health tracking

#### `agent_cost_tracking` (NEW, optional)
If token/cost tracking in `agent_sessions` isn't granular enough:
- Per-API-call cost breakdown
- Model multipliers
- Aggregation-friendly structure for dashboards

**Decision for the planning agent:** Is a separate cost table worth the complexity,
or is the token data in `agent_sessions` + `agent_events` sufficient?

---

## 5 · Enum Design

### Enums to Keep (possibly with value changes)
| Enum | Current Values | Proposed Changes |
|------|---------------|-----------------|
| `project_status` | Active, Archived, Planning | Consider lowercase: `active`, `archived`, `planning` |
| `feature_status` | Draft, Submitted, In_Progress, Done | Add `Cancelled`? Keep casing consistent |
| `task_status` | Pending_Approval, Approved, In_Progress, Complete, Skipped, Failed | Evaluate if `Pending_Approval` → `Queued` makes more sense with copilot-sdk |
| `resource_status` | Pending, Fetched, Error | Keep or simplify |
| `failure_behavior` | stop, skip, retry | Keep |

### Enums to Redesign
| Enum | Current | Proposed |
|------|---------|----------|
| `agent_type` | manager, ralph, chat | Expand: `manager`, `ralph`, `researcher`, `editor`, `chat`, `custom` |
| `agent_run_status` | queued, running, completed, failed, stopped | Rename to `agent_session_status`, add: `paused`, `cancelled` |
| `prompt_role` | manager, ralph | Align with new `agent_type` |
| `trait_target` | manager, ralph | Align with new `agent_type` |

### Enums to Remove
| Enum | Reason |
|------|--------|
| `assignment_scope` | Keep if trait_assignments stays; re-evaluate |

### New Enums to Consider
| Enum | Values | Purpose |
|------|--------|---------|
| `user_role` | admin, member | User authorization level |
| `event_type` | (many values from copilot-sdk) | Agent event classification — or use TEXT for flexibility |

**Decision for the planning agent:** For `event_type`, should we use a PostgreSQL enum (strict, requires
migration to add values) or TEXT with a CHECK constraint (flexible, can add values without migration)?
Given this is pre-alpha and event types will evolve, TEXT may be better.

---

## 6 · Foreign Key & Cascade Design

### Cascade Rules

Map out the complete cascade chain. Deleting a project should cleanly remove all dependent data:

```
projects
  └── features (ON DELETE CASCADE)
        ├── tasks (ON DELETE CASCADE)
        │     ├── task_artifacts (ON DELETE CASCADE)
        │     ├── skill_links (ON DELETE CASCADE)
        │     ├── trait_assignments (ON DELETE CASCADE)
        │     └── agent_sessions [task_id] (ON DELETE SET NULL or CASCADE — decide)
        ├── resources (ON DELETE CASCADE)
        ├── trait_assignments (ON DELETE CASCADE)
        └── agent_sessions [feature_id] (ON DELETE SET NULL or CASCADE — decide)

users
  └── sessions (ON DELETE CASCADE)

agent_sessions
  ├── agent_events (ON DELETE CASCADE)
  ├── agent_tool_calls (ON DELETE CASCADE)
  └── (chat_messages if unified) (ON DELETE CASCADE)

traits
  └── trait_assignments (ON DELETE CASCADE)
```

**Decision for the planning agent:** When a feature is deleted, should its `agent_sessions` be
CASCADE deleted (lose all audit data) or SET NULL (keep audit data but orphan it)? Consider that
this is pre-alpha — CASCADE is simpler and audit data isn't critical yet.

---

## 7 · Index Strategy

### Required Indexes

The planning agent must define indexes for these access patterns:

| Access Pattern | Tables | Suggested Index |
|---------------|--------|----------------|
| List features by project + status | features | `(project_id, status)` |
| List tasks by feature + sort order | tasks | `(feature_id, sort_order)` |
| List tasks by status (pipeline queue) | tasks | `(status)` where status IN ('Approved', 'In_Progress') |
| Find running agent sessions | agent_sessions | `(status)` where status = 'running' |
| Agent sessions by feature | agent_sessions | `(feature_id, created_at)` |
| Agent sessions by task | agent_sessions | `(task_id, created_at)` |
| Agent events by session + type | agent_events | `(agent_session_id, event_type, created_at)` |
| Tool calls by session | agent_tool_calls | `(agent_session_id, created_at)` |
| Session lookup by token | sessions | `(token)` UNIQUE |
| User lookup by github_id | users | `(github_id)` UNIQUE |
| Trait assignments by scope | trait_assignments | `(project_id)`, `(feature_id)`, `(task_id)` |

### Partial Indexes

Consider partial indexes for hot paths:
```sql
-- Only running/queued sessions matter for the pipeline
CREATE INDEX idx_agent_sessions_active ON agent_sessions(status, created_at)
  WHERE status IN ('pending', 'running');

-- Only approved tasks are in the queue
CREATE INDEX idx_tasks_queued ON tasks(feature_id, sort_order)
  WHERE status = 'Approved';
```

---

## 8 · Migration Strategy

### 8.1 · Nuclear Migration

Create a single migration file: `YYYYMMDDHHMMSS_nuke_and_rebuild.sql`

Structure:
```sql
-- ============================================================
-- PHASE 1: DROP EVERYTHING
-- ============================================================
-- Drop all tables (CASCADE handles FKs)
-- Drop all custom types/enums
-- Drop all functions and triggers

-- ============================================================
-- PHASE 2: CREATE ENUMS
-- ============================================================
-- All enum types first (tables reference them)

-- ============================================================
-- PHASE 3: CREATE TABLES
-- ============================================================
-- Create in dependency order:
-- 1. users (no FKs)
-- 2. sessions (FK → users)
-- 3. projects (FK → users for created_by)
-- 4. features (FK → projects, users)
-- 5. tasks (FK → features, users)
-- 6. resources (FK → features)
-- 7. task_artifacts (FK → tasks)
-- 8. agent_sessions (FK → features, tasks, users)
-- 9. agent_events (FK → agent_sessions)
-- 10. agent_tool_calls (FK → agent_sessions)
-- 11. prompts (no FKs)
-- 12. traits (no FKs)
-- 13. trait_assignments (FK → traits, projects, features, tasks)
-- 14. skill_links (FK → tasks)
-- 15. chat_sessions / chat_messages (if kept separate)

-- ============================================================
-- PHASE 4: CREATE INDEXES
-- ============================================================
-- All indexes (after tables exist)

-- ============================================================
-- PHASE 5: CREATE FUNCTIONS & TRIGGERS
-- ============================================================
-- update_updated_at() trigger function
-- Apply trigger to all tables with updated_at

-- ============================================================
-- PHASE 6: RLS POLICIES
-- ============================================================
-- Enable RLS on all tables
-- Service-role-only policies (same pattern as current)

-- ============================================================
-- PHASE 7: SEED DATA (dev only)
-- ============================================================
-- Conditional on environment or in a separate seed file
```

### 8.2 · Seed Data

Create `supabase/supabase/seed.sql` (or a separate migration) with:
- 1-2 test users (with fake GitHub IDs)
- 1-2 sample projects with features and tasks
- Sample prompts for each agent type
- Sample traits

### 8.3 · Migration Testing

```bash
# Test against fresh postgres container
docker compose -f docker-compose.dev.yml down -v  # destroy volume
docker compose -f docker-compose.dev.yml up -d db  # start fresh DB
# Apply migration
docker exec ralph_dev_db psql -U postgres -d postgres -f /path/to/migration.sql
# Verify schema
docker exec ralph_dev_db psql -U postgres -d postgres -c "\dt"
docker exec ralph_dev_db psql -U postgres -d postgres -c "\di"  # indexes
```

---

## 9 · Type Generation

### 9.1 · Database Types (`database.types.ts`)

After the migration is applied, generate TypeScript types. Options:

**Option A: Manual generation (current approach)**
- Write `database.types.ts` by hand to match the schema
- Pros: full control, no tooling dependency
- Cons: error-prone, must stay in sync

**Option B: Supabase CLI generation**
- `supabase gen types typescript --local` (if using Supabase CLI)
- Pros: always accurate
- Cons: requires Supabase CLI setup (we use raw Docker, not Supabase CLI)

**Option C: PostgREST introspection + codegen**
- Query PostgREST's OpenAPI spec and generate types
- Pros: works with our Docker setup
- Cons: requires custom tooling

**Decision for the planning agent:** Recommend an approach. Given the Docker-based setup,
Option A (manual with careful verification) or a lightweight script that queries
`information_schema` and generates types is likely best.

### 9.2 · Zod Schemas

For every API-facing type, create a Zod schema:

```
server/src/schemas/
  ├── user.schema.ts
  ├── project.schema.ts
  ├── feature.schema.ts
  ├── task.schema.ts
  ├── agent-session.schema.ts
  └── index.ts (re-exports)
```

Each schema file should export:
- `create_*_schema` — for INSERT validation
- `update_*_schema` — for UPDATE validation (all fields optional except ID)
- `*_response_schema` — for API response shaping

### 9.3 · Shared Types

Types shared between frontend and backend go in `shared/`:
```
shared/
  ├── types/
  │   ├── user.ts
  │   ├── project.ts
  │   ├── feature.ts
  │   ├── task.ts
  │   ├── agent.ts
  │   └── index.ts
  └── enums.ts
```

---

## 10 · Docker Dev Environment

### 10.1 · Updated `docker-compose.dev.yml`

The current setup (postgres:17-alpine + PostgREST + nginx gateway) is solid. Changes needed:

- **No structural changes** — the docker-compose pattern works
- **Update migration application** — the planning agent should create/update `scripts/dev-setup.sh`
  to apply the new migration automatically
- **Volume management** — document how to nuke and rebuild the dev database

### 10.2 · Migration Application Script

Create or update `scripts/apply-migrations.sh`:
```bash
#!/bin/bash
# Apply all migrations in order to the dev database
for f in supabase/supabase/migrations/*.sql; do
  echo "Applying $f..."
  docker exec -i ralph_dev_db psql -U postgres -d postgres < "$f"
done
```

### 10.3 · Dev Reset Script

Create `scripts/dev-reset.sh`:
```bash
#!/bin/bash
# Nuke and rebuild the dev database from scratch
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
sleep 3  # wait for postgres to be ready
./scripts/apply-migrations.sh
echo "Dev database reset complete"
```

---

## 11 · Dual Environment Design

### 11.1 · Architecture

```
Production (clanqr.dev)
  └── Supabase instance (or self-hosted Postgres)
        └── Database: ralph_prod
              └── Schema applied via CI/CD migration step

Test (test.clanqr.dev)
  └── Separate Supabase instance (or separate Docker container on same host)
        └── Database: ralph_test
              └── Same schema, different data

Local Development
  └── Docker (docker-compose.dev.yml)
        └── Database: postgres (default)
              └── Schema applied via scripts/apply-migrations.sh
```

### 11.2 · Environment Configuration

Each environment needs its own:
- `SUPABASE_URL` — pointing to the correct database
- `SUPABASE_KEY` — service_role key for that instance
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — OAuth app credentials (different per environment)
- `SESSION_SECRET` — for cookie signing (different per environment)

### 11.3 · Data Isolation

- **No shared state** between prod and test — completely separate databases
- **Same schema** applied to both — migration files are the source of truth
- **Different seed data** — test env gets sample data, prod starts empty
- **GitHub OAuth apps** — separate OAuth apps for each domain (different callback URLs)

---

## 12 · Validation Criteria

The implementation plan must include these acceptance checks:

### Schema Validation
- [ ] All tables created with correct column types and constraints
- [ ] All enums defined with correct values
- [ ] All foreign keys with correct CASCADE/SET NULL behavior
- [ ] All indexes created (verify with `\di+`)
- [ ] All triggers created and functional (verify `updated_at` auto-updates)
- [ ] RLS enabled on all tables with service-role-only policies

### Cascade Verification
```sql
-- Insert test data across the hierarchy
-- Delete a project and verify all child data is removed:
-- features, tasks, resources, agent_sessions, agent_events,
-- agent_tool_calls, task_artifacts, trait_assignments, skill_links
```

### Type Verification
- [ ] `database.types.ts` generated and compiles (`tsc --noEmit`)
- [ ] Zod schemas match database types
- [ ] Shared types importable from both `server/` and `web/`

### Docker Dev Verification
- [ ] `docker compose -f docker-compose.dev.yml up -d` starts cleanly
- [ ] Migrations apply without errors
- [ ] PostgREST serves the new schema (test with `curl http://127.0.0.1:54321/rest/v1/`)
- [ ] `@supabase/supabase-js` can connect and query all tables

### Query Pattern Verification
```sql
-- Verify common query patterns work efficiently
EXPLAIN ANALYZE SELECT * FROM features WHERE project_id = '...' AND status = 'In_Progress';
EXPLAIN ANALYZE SELECT * FROM tasks WHERE feature_id = '...' ORDER BY sort_order;
EXPLAIN ANALYZE SELECT * FROM agent_sessions WHERE status = 'running';
EXPLAIN ANALYZE SELECT * FROM agent_events WHERE agent_session_id = '...' AND event_type = 'tool.execution_complete';
```

---

## 13 · Deliverables Checklist

The implementation plan produced by the next agent must include:

### SQL Files
- [ ] `supabase/supabase/migrations/YYYYMMDDHHMMSS_nuke_and_rebuild.sql` — the complete migration
- [ ] `supabase/supabase/seed.sql` — development seed data

### TypeScript Files
- [ ] `server/src/database.types.ts` — regenerated from new schema
- [ ] `server/src/schemas/*.ts` — Zod schemas for all API-facing types
- [ ] `shared/types/*.ts` — shared type definitions

### Scripts
- [ ] `scripts/apply-migrations.sh` — apply migrations to dev DB
- [ ] `scripts/dev-reset.sh` — nuke and rebuild dev DB

### Configuration
- [ ] Updated `.env.example` with new environment variables (GitHub OAuth, session secret)
- [ ] Updated `docker-compose.dev.yml` if any changes needed

### Documentation
- [ ] Schema diagram (text-based, in the migration file header)
- [ ] Column-level documentation (SQL COMMENT ON)

---

## 14 · Constraints & Anti-Patterns

### MUST Do
- Use `gen_random_uuid()` for all UUID defaults (PG17 built-in, no extension needed)
- Use `TIMESTAMPTZ` for all timestamps (never `TIMESTAMP`)
- Use `TEXT` for all string columns (never `VARCHAR`)
- Use `JSONB` for flexible/nested data (never `JSON` — JSONB is indexable)
- Include `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` on every table
- Include `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` on tables that are mutated
- Create the `update_updated_at()` trigger function once, apply to all relevant tables
- Name constraints explicitly (don't rely on auto-generated names)
- Name indexes with pattern: `idx_{table}_{column(s)}`

### MUST NOT Do
- Do NOT use `SERIAL` or `BIGSERIAL` — use `UUID` for primary keys
- Do NOT use `VARCHAR(n)` — use `TEXT`
- Do NOT add multi-tenant columns (this is single-tenant per AGENTS.md §19)
- Do NOT enable complex RLS — service-role-only access pattern
- Do NOT create materialized views yet (premature optimization)
- Do NOT store plaintext secrets/tokens — mark columns that need encryption
- Do NOT use `TIMESTAMP` without time zone
- Do NOT add columns "just in case" — YAGNI. Design for known requirements.

### Copilot-SDK Specific
- Session IDs are TEXT, not UUID — they have structured format from the SDK
- Event payloads vary by type — use JSONB, not separate columns per event type
- Tool call arguments can be very large — consider whether to store full args or summaries
- Don't store ephemeral/delta events — only store persistent events worth auditing

---

## 15 · Open Decisions for the Planning Agent

These decisions must be made during planning, with rationale documented:

1. **Chat system: separate tables or unified with agent_sessions?**
   - Separate is simpler for queries; unified is DRY and consistent
   - Recommend: decide based on how different the query patterns are

2. **Agent sessions: polymorphic FKs with CHECK or separate junction tables?**
   - Current pattern (CHECK constraint on conditional FKs) works but is complex
   - Alternative: always have both `feature_id` and `task_id` (nullable), no CHECK

3. **Event storage granularity: which events to store?**
   - Minimum: usage, tool executions, errors, hook decisions
   - Maximum: everything except streaming deltas
   - Recommend: start minimal, add events as needed

4. **Token storage: encrypt GitHub OAuth tokens or store plaintext?**
   - Encryption adds complexity but is security best practice
   - Single-tenant reduces risk, but tokens are still sensitive
   - Recommend: at minimum, document which columns contain sensitive data

5. **Prompt versioning: integer version or separate rows per version?**
   - Integer + single row: simple, current approach
   - Separate rows with `is_active`: supports A/B testing, rollback
   - Recommend: separate rows — more flexible, small overhead

6. **Skill links scope: task-only or project/feature/task?**
   - Current: task-only. But copilot-sdk skills might be project-wide.
   - Recommend: add optional `project_id` and `feature_id` columns

7. **Cost tracking: in agent_sessions or separate table?**
   - In agent_sessions: simpler, tokens already tracked there
   - Separate table: per-API-call granularity, better for dashboards
   - Recommend: agent_sessions for totals, agent_events for per-call detail

---

## 16 · Execution Order for the Planning Agent

1. **Invoke skills** — `supabase-postgres-best-practices`, `meta-engineer`, `hono-backend-architect`
2. **Read all reference material** — migrations, types, services, SDK docs (§3 above)
3. **Resolve open decisions** (§15) — document rationale for each
4. **Design the complete schema** — all tables, columns, types, constraints, indexes
5. **Write the migration SQL** — single file, tested against fresh postgres
6. **Generate TypeScript types** — `database.types.ts`
7. **Create Zod schemas** — for all API-facing types
8. **Update shared types** — in `shared/`
9. **Create/update scripts** — migration application, dev reset
10. **Update configuration** — `.env.example`, docker-compose if needed
11. **Verify** — run the full validation checklist (§12)
12. **Type-check** — `cd server && bun run --bun tsc --noEmit` and `cd web && bun run check`
13. **Commit and push** — follow AGENTS.md §12 commit conventions
