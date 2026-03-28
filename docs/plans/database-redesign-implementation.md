# Database Nuke & Redesign — Implementation Plan

> **Objective:** Drop all 15 existing tables, 10 enums, functions, and triggers. Rebuild a clean
> schema designed for GitHub OAuth auth and copilot-sdk agent sessions, replacing the passkey/WebAuthn
> + CLI spawn model. Single migration, zero backward compatibility (pre-alpha).

---

## Approach

1. Write a single nuclear migration: `YYYYMMDDHHMMSS_nuke_and_rebuild.sql`
2. Generate TypeScript types (`database.types.ts`) from the new schema
3. Create Zod validation schemas for all API-facing types
4. Update shared types (`shared/types/`)
5. Create/update dev scripts (apply-migrations, dev-reset)
6. Update `.env.example` with new env vars (GitHub OAuth, session secret)
7. Verify: migration applies cleanly, cascades work, types compile, indexes exist

**What this plan does NOT cover** (out of scope):
- Server route/service code changes (those come after schema lands)
- Frontend UI changes
- Copilot-sdk integration code
- CI/CD pipeline changes (the existing migration step handles new migrations automatically)

---

## Open Decisions — Resolved

### 1. Chat system: separate tables or unified with agent_sessions?
**Decision: Unified.** Chat sessions become `agent_sessions` with `agent_type = 'chat'`. Chat messages
become `agent_events` with `event_type = 'chat.message'`. Rationale: copilot-sdk treats chat as just
another agent session type. Unifying is DRY, keeps one audit trail, and simplifies token/cost tracking.
Trade-off: chat queries need a `WHERE agent_type = 'chat'` filter, but that's a trivial indexed predicate.

### 2. Agent sessions: polymorphic FKs with CHECK or separate junction tables?
**Decision: Both nullable, no CHECK.** Keep `feature_id` and `task_id` as nullable FKs on
`agent_sessions`. A manager sets `feature_id`; a task agent sets both `feature_id` and `task_id`;
a chat agent sets neither. No CHECK constraint — the application layer enforces semantics.
Rationale: simpler schema, easier queries, CHECK constraints add complexity without preventing
application-level bugs.

### 3. Event storage granularity: which events to store?
**Decision: Start minimal.** Store only:
- `assistant.message` (final, not deltas)
- `assistant.usage` (tokens, cost, model)
- `tool.execution_complete` (audit trail)
- `session.error` (debugging)
- `session.shutdown` (lifecycle + aggregate metrics)
- `session.compaction_complete` (context management)
- `permission.requested` (compliance)
- `chat.message` (unified chat messages)
- Hook decisions (pre/post tool use allow/deny/suppress)

Skip: all `*_delta` events, `tool.execution_partial_result`, `session.idle`, `assistant.intent`.

### 4. Token storage: encrypt GitHub OAuth tokens or store plaintext?
**Decision: Mark as sensitive, encrypt at application layer.** Columns `github_access_token` and
`github_refresh_token` in `sessions` get SQL `COMMENT ON` marking them as sensitive. Encryption
happens in the Hono service layer (encrypt before INSERT, decrypt after SELECT). The schema stores
TEXT — encryption is a server concern, not a DB concern. Rationale: single-tenant reduces risk,
application-level encryption is portable and testable.

### 5. Prompt versioning: integer version or separate rows per version?
**Decision: Separate rows with `is_active` flag.** Each prompt version is a new row. `is_active`
boolean (only one active per `agent_type`) enables A/B testing, rollback, and audit history.
Add a partial unique index: `UNIQUE (agent_type) WHERE is_active = true`.

### 6. Skill links scope: task-only or project/feature/task?
**Decision: Add `project_id` and `feature_id` columns.** Skill links can now attach at any scope.
All three FK columns are nullable — exactly one should be set (enforced by application, not CHECK).
Rationale: copilot-sdk skills may be project-wide or feature-wide, not just task-specific.

### 7. Cost tracking: in agent_sessions or separate table?
**Decision: Totals in `agent_sessions`, per-call detail in `agent_events`.** The `agent_sessions`
table stores aggregate token counts (`prompt_tokens`, `completion_tokens`, `cache_read_tokens`,
`cache_write_tokens`). Per-API-call breakdown lives in `agent_events` with `event_type = 'assistant.usage'`
and JSONB payload. No separate cost table. Rationale: sufficient granularity without extra joins;
dashboard queries aggregate from `agent_sessions` for speed.

### 8. Event type column: enum or TEXT?
**Decision: TEXT.** Event types will evolve as copilot-sdk adds features. TEXT avoids migrations
for every new event type. Application-level Zod validation ensures only known types are inserted.

### 9. Agent sessions cascade on feature/task delete?
**Decision: CASCADE.** Pre-alpha — audit data isn't critical yet. Deleting a feature deletes all
its agent sessions, events, and tool calls. Simpler than orphaned records. Revisit when audit
retention matters.

### 10. Invite tokens in GitHub OAuth model?
**Decision: Remove.** GitHub org membership or an allowlist in the `users` table gates access.
No invite token flow needed. If access control is needed later, add an `allowed_github_ids` table
or check org membership at OAuth callback time.

---

## Schema Overview (16 tables)

```
users                          # GitHub OAuth users
sessions                       # User sessions (HTTPOnly cookie)
projects                       # Project containers
features                       # Feature specs within projects
tasks                          # Tasks within features
resources                      # URLs attached to features
task_artifacts                  # Files produced by task execution
agent_sessions                  # Copilot-sdk agent sessions (replaces agent_runs + chat_sessions)
agent_events                    # Audit events from agent sessions (replaces chat_messages)
agent_tool_calls                # Tool execution audit trail
prompts                         # System prompt templates (versioned)
traits                          # Behavior customization snippets
trait_assignments               # Hierarchical trait scoping
skill_links                     # Skill-to-scope links
mcp_server_configs              # MCP server integration configs
```

### Cascade Chain
```
projects
  └── features (CASCADE)
        ├── tasks (CASCADE)
        │     ├── task_artifacts (CASCADE)
        │     ├── skill_links (CASCADE)
        │     ├── trait_assignments (CASCADE)
        │     └── agent_sessions [task_id] (CASCADE)
        ├── resources (CASCADE)
        ├── skill_links (CASCADE)
        ├── trait_assignments (CASCADE)
        └── agent_sessions [feature_id] (CASCADE)

users
  └── sessions (CASCADE)

agent_sessions
  ├── agent_events (CASCADE)
  └── agent_tool_calls (CASCADE)

traits
  └── trait_assignments (CASCADE)
```

---

## Enum Design (8 enums)

| Enum | Values | Notes |
|------|--------|-------|
| `user_role` | `admin`, `member` | Lowercase, simple |
| `project_status` | `active`, `archived`, `planning` | Lowercase (was PascalCase) |
| `feature_status` | `draft`, `submitted`, `in_progress`, `done`, `cancelled` | Lowercase, added `cancelled` |
| `task_status` | `queued`, `approved`, `in_progress`, `complete`, `failed`, `skipped` | `queued` replaces `Pending_Approval` |
| `agent_type` | `manager`, `ralph`, `researcher`, `editor`, `chat`, `custom` | Expanded for copilot-sdk |
| `agent_session_status` | `pending`, `running`, `paused`, `completed`, `failed`, `cancelled` | Added `paused`, `cancelled` |
| `failure_behavior` | `stop`, `skip`, `retry` | Unchanged |
| `resource_status` | `pending`, `fetched`, `error` | Lowercase |

**Removed enums:** `agent_run_status` (replaced by `agent_session_status`), `prompt_role` (replaced
by `agent_type`), `trait_target` (replaced by `agent_type`), `assignment_scope` (keep as-is for
trait_assignments).

**Kept:** `assignment_scope` (`project`, `feature`, `task`) — still needed for trait_assignments.

---

## Todos

### Phase 1: Schema Design & Migration SQL
- **`write-migration-sql`** — Write the complete nuclear migration SQL file
- **`write-seed-data`** — Write development seed data (test users, sample projects)

### Phase 2: TypeScript Type Generation
- **`generate-db-types`** — Generate `server/src/database.types.ts` from new schema
- **`create-zod-schemas`** — Create Zod validation schemas in `server/src/schemas/`
- **`update-shared-types`** — Update `shared/types/` with new type definitions and enums

### Phase 3: Scripts & Configuration
- **`update-dev-scripts`** — Update `scripts/dev-db-reset.sh` and create `scripts/apply-migrations.sh`
- **`update-env-example`** — Update `.env.example` with GitHub OAuth + session secret vars

### Phase 4: Verification
- **`verify-migration`** — Apply migration to dev DB, verify schema, test cascades
- **`verify-types`** — Run `tsc --noEmit` on server and `bun run check` on web

---

## Skill Usage Instructions

> These instructions are for the executing agent (or subagents) to follow when implementing each todo.

### For ALL schema/SQL work (`write-migration-sql`, `write-seed-data`):
```
Invoke skill: supabase-postgres-best-practices
Context: Complete database schema design for a pre-alpha project using PostgreSQL 17,
Supabase (via Docker, not hosted), service-role-only access (no complex RLS).
Ask about: UUID generation (gen_random_uuid), TIMESTAMPTZ usage, TEXT vs VARCHAR,
JSONB patterns, index strategy, constraint naming, trigger patterns (update_updated_at),
partial indexes, cascade design, and PostgREST compatibility.

Invoke skill: meta-engineer
Domains: foundation/constraints, scenarios/contract-change, domains/state-and-data,
domains/invariants, domains/architecture
Context: Nuclear migration dropping 15 tables and 10 enums, rebuilding 16 tables and
9 enums. Every API consumer breaks. State machines for: feature_status, task_status,
agent_session_status. Foreign key invariants across the full cascade chain. Normalization
decisions for agent_sessions (polymorphic FKs vs junction tables — decision: nullable FKs).
```

### For Zod schemas and route-facing types (`create-zod-schemas`):
```
Invoke skill: hono-backend-architect
Context: Hono on Bun, TypeScript strict mode, Zod validation via schema.safeParse().
Routes in server/src/routes/ validate request bodies with Zod before DB operations.
Existing pattern: inline z.object() in route files. New pattern: centralized schemas
in server/src/schemas/ with create_*, update_*, *_response exports.
Ask about: Zod-to-OpenAPI integration, middleware validation patterns, error response
shapes, and how @supabase/supabase-js queries map to schema design.
```

### For shared types (`update-shared-types`):
```
No special skill needed. Follow existing pattern in shared/types/:
- status.ts for all status union types
- index.ts for re-exports
- Match enum values exactly to PostgreSQL enum definitions
- Ensure both server/ and web/ can import from shared/
```

---

## Detailed Todo Specifications

### `write-migration-sql`
**File:** `supabase/supabase/migrations/20260328100000_nuke_and_rebuild.sql`

**Structure (in this exact order):**

**Phase 1 — DROP EVERYTHING:**
- Drop all 15 existing tables with CASCADE
- Drop all 10 existing enums (IF EXISTS)
- Drop all functions (`update_updated_at_column` etc.)
- Drop all triggers

**Phase 2 — CREATE ENUMS (9):**
- `user_role`, `project_status`, `feature_status`, `task_status`, `agent_type`,
  `agent_session_status`, `failure_behavior`, `resource_status`, `assignment_scope`

**Phase 3 — CREATE TABLES (15, in dependency order):**

1. **`users`** — No FKs
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `github_id BIGINT NOT NULL UNIQUE`
   - `username TEXT NOT NULL`
   - `display_name TEXT`
   - `avatar_url TEXT`
   - `email TEXT` (nullable — may not be public)
   - `role user_role NOT NULL DEFAULT 'member'`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

2. **`sessions`** — FK → users
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `token TEXT NOT NULL UNIQUE`
   - `github_access_token TEXT` (nullable — SENSITIVE, encrypt at app layer)
   - `github_refresh_token TEXT` (nullable — SENSITIVE, encrypt at app layer)
   - `token_expires_at TIMESTAMPTZ` (GitHub token expiry)
   - `expires_at TIMESTAMPTZ NOT NULL`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

3. **`projects`** — FK → users
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `name TEXT NOT NULL`
   - `description TEXT`
   - `status project_status NOT NULL DEFAULT 'active'`
   - `created_by UUID REFERENCES users(id) ON DELETE SET NULL`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

4. **`features`** — FK → projects, users
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
   - `title TEXT NOT NULL`
   - `description TEXT`
   - `status feature_status NOT NULL DEFAULT 'draft'`
   - `auto_approve BOOLEAN NOT NULL DEFAULT false`
   - `on_task_failure failure_behavior NOT NULL DEFAULT 'stop'`
   - `task_timeout_minutes INTEGER NOT NULL DEFAULT 30`
   - `manager_retry_count INTEGER NOT NULL DEFAULT 0`
   - `last_error TEXT`
   - `created_by UUID REFERENCES users(id) ON DELETE SET NULL`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - **Removed:** `cli`, `execution_cli`, `planning_model`, `execution_model` (copilot-sdk manages these)

5. **`tasks`** — FK → features, users
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE`
   - `title TEXT`
   - `description TEXT NOT NULL`
   - `status task_status NOT NULL DEFAULT 'queued'`
   - `sort_order INTEGER NOT NULL DEFAULT 0`
   - `output TEXT`
   - `retry_count INTEGER NOT NULL DEFAULT 0`
   - `max_retries INTEGER NOT NULL DEFAULT 3`
   - `created_by UUID REFERENCES users(id) ON DELETE SET NULL`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - **Removed:** `agent_log` (replaced by agent_events), `model` (copilot-sdk manages)

6. **`resources`** — FK → features
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE`
   - `url TEXT NOT NULL`
   - `title TEXT`
   - `status resource_status NOT NULL DEFAULT 'pending'`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

7. **`task_artifacts`** — FK → tasks, agent_sessions
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
   - `agent_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL`
   - `filename TEXT NOT NULL`
   - `mime_type TEXT`
   - `size_bytes BIGINT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

8. **`agent_sessions`** — FK → features, tasks, users
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `session_id TEXT UNIQUE` (copilot-sdk structured ID, e.g. `user-alice-task-123-1706932800000`)
   - `agent_type agent_type NOT NULL`
   - `status agent_session_status NOT NULL DEFAULT 'pending'`
   - `feature_id UUID REFERENCES features(id) ON DELETE CASCADE`
   - `task_id UUID REFERENCES tasks(id) ON DELETE CASCADE`
   - `user_id UUID REFERENCES users(id) ON DELETE SET NULL`
   - `model TEXT`
   - `source TEXT NOT NULL DEFAULT 'new'` (how session started: new, resume)
   - `prompt_tokens INTEGER NOT NULL DEFAULT 0`
   - `completion_tokens INTEGER NOT NULL DEFAULT 0`
   - `cache_read_tokens INTEGER NOT NULL DEFAULT 0`
   - `cache_write_tokens INTEGER NOT NULL DEFAULT 0`
   - `duration_ms INTEGER`
   - `summary TEXT`
   - `error TEXT`
   - `files_changed TEXT[]`
   - `started_at TIMESTAMPTZ`
   - `finished_at TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - **Note:** `task_artifacts` references this table — create `agent_sessions` before `task_artifacts`,
     or add the FK constraint after both tables exist via ALTER TABLE.

9. **`agent_events`** — FK → agent_sessions
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `agent_session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE`
   - `event_type TEXT NOT NULL`
   - `event_data JSONB NOT NULL DEFAULT '{}'::jsonb`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

10. **`agent_tool_calls`** — FK → agent_sessions
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `agent_session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE`
    - `tool_call_id TEXT` (SDK-assigned)
    - `tool_name TEXT NOT NULL`
    - `tool_type TEXT` (function, custom, mcp)
    - `mcp_server_name TEXT`
    - `arguments JSONB`
    - `result_success BOOLEAN`
    - `result_summary TEXT`
    - `error_message TEXT`
    - `duration_ms INTEGER`
    - `permission_decision TEXT` (allow, deny, ask)
    - `was_suppressed BOOLEAN NOT NULL DEFAULT false`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

11. **`prompts`** — No FKs
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `agent_type agent_type NOT NULL`
    - `content TEXT NOT NULL`
    - `version INTEGER NOT NULL DEFAULT 1`
    - `is_active BOOLEAN NOT NULL DEFAULT true`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - Partial unique index: `UNIQUE (agent_type) WHERE is_active = true`

12. **`traits`** — No FKs
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `name TEXT NOT NULL`
    - `description TEXT`
    - `content TEXT NOT NULL`
    - `target agent_type NOT NULL`
    - `is_global BOOLEAN NOT NULL DEFAULT false`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

13. **`trait_assignments`** — FK → traits, projects, features, tasks
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `trait_id UUID NOT NULL REFERENCES traits(id) ON DELETE CASCADE`
    - `scope assignment_scope NOT NULL`
    - `project_id UUID REFERENCES projects(id) ON DELETE CASCADE`
    - `feature_id UUID REFERENCES features(id) ON DELETE CASCADE`
    - `task_id UUID REFERENCES tasks(id) ON DELETE CASCADE`
    - `is_excluded BOOLEAN NOT NULL DEFAULT false`
    - `assigned_by UUID REFERENCES users(id) ON DELETE SET NULL`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

14. **`skill_links`** — FK → projects, features, tasks
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `skill_name TEXT NOT NULL`
    - `project_id UUID REFERENCES projects(id) ON DELETE CASCADE`
    - `feature_id UUID REFERENCES features(id) ON DELETE CASCADE`
    - `task_id UUID REFERENCES tasks(id) ON DELETE CASCADE`
    - `assigned_by UUID REFERENCES users(id) ON DELETE SET NULL`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

15. **`mcp_server_configs`** — No FKs
    - `id UUID PK DEFAULT gen_random_uuid()`
    - `name TEXT NOT NULL UNIQUE`
    - `server_type TEXT NOT NULL` (stdio, http, sse)
    - `command TEXT`
    - `args TEXT[]`
    - `env JSONB`
    - `url TEXT`
    - `is_global BOOLEAN NOT NULL DEFAULT true`
    - `status TEXT NOT NULL DEFAULT 'active'`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Phase 4 — CREATE INDEXES:**
- `idx_sessions_token` on `sessions(token)` — UNIQUE (already from constraint)
- `idx_sessions_user_id` on `sessions(user_id)`
- `idx_users_github_id` on `users(github_id)` — UNIQUE (already from constraint)
- `idx_features_project_status` on `features(project_id, status)`
- `idx_tasks_feature_sort` on `tasks(feature_id, sort_order)`
- `idx_tasks_queued` PARTIAL on `tasks(feature_id, sort_order) WHERE status = 'approved'`
- `idx_tasks_status` on `tasks(status)`
- `idx_agent_sessions_active` PARTIAL on `agent_sessions(status, created_at) WHERE status IN ('pending', 'running')`
- `idx_agent_sessions_feature` on `agent_sessions(feature_id, created_at)`
- `idx_agent_sessions_task` on `agent_sessions(task_id, created_at)`
- `idx_agent_sessions_type` on `agent_sessions(agent_type)`
- `idx_agent_events_session_type` on `agent_events(agent_session_id, event_type, created_at)`
- `idx_agent_tool_calls_session` on `agent_tool_calls(agent_session_id, created_at)`
- `idx_trait_assignments_project` on `trait_assignments(project_id)`
- `idx_trait_assignments_feature` on `trait_assignments(feature_id)`
- `idx_trait_assignments_task` on `trait_assignments(task_id)`
- `idx_prompts_active` PARTIAL UNIQUE on `prompts(agent_type) WHERE is_active = true`
- `idx_skill_links_project` on `skill_links(project_id)`
- `idx_skill_links_feature` on `skill_links(feature_id)`
- `idx_skill_links_task` on `skill_links(task_id)`
- `idx_resources_feature` on `resources(feature_id)`

**Phase 5 — FUNCTIONS & TRIGGERS:**
- `update_updated_at()` trigger function
- Apply to: `users`, `projects`, `features`, `tasks`, `resources`, `agent_sessions`, `prompts`, `traits`, `mcp_server_configs`

**Phase 6 — RLS POLICIES:**
- Enable RLS on all tables
- Add `service_role` bypass policy on each table (same pattern as current)

**Phase 7 — SQL COMMENTs:**
- Comment on `sessions.github_access_token`: 'SENSITIVE: Encrypt at application layer'
- Comment on `sessions.github_refresh_token`: 'SENSITIVE: Encrypt at application layer'
- Schema diagram in file header comment

### `write-seed-data`
**File:** `supabase/supabase/seed.sql`

Contents:
- 2 test users (fake GitHub IDs: 1000001, 1000002) — one admin, one member
- 2 dev sessions with long-lived tokens (`dev-session-token`, `dev-admin-session-token` expiring 2099)
- 1 sample project with 2 features, each with 2-3 tasks
- Sample prompts for `manager` and `ralph` agent types
- 2-3 sample traits (one global, one project-scoped)

### `generate-db-types`
**File:** `server/src/database.types.ts`

**Method:** Use `scripts/gen-types.sh` (existing script) after migration is applied to running dev DB.
If the dev DB is not running, manually write the types to match the schema exactly.

The file must export:
- `Database` interface with `public.Tables` containing Row/Insert/Update types for all 15 tables
- `public.Enums` containing all 9 enum types

### `create-zod-schemas`
**Directory:** `server/src/schemas/`

Create these files:
- `user.schema.ts` — `create_user_schema`, `update_user_schema`
- `project.schema.ts` — `create_project_schema`, `update_project_schema`
- `feature.schema.ts` — `create_feature_schema`, `update_feature_schema`
- `task.schema.ts` — `create_task_schema`, `update_task_schema`
- `agent-session.schema.ts` — `create_agent_session_schema`, `update_agent_session_schema`
- `agent-event.schema.ts` — `create_agent_event_schema`
- `prompt.schema.ts` — `create_prompt_schema`, `update_prompt_schema`
- `trait.schema.ts` — `create_trait_schema`, `assign_trait_schema`
- `chat.schema.ts` — `send_message_schema` (for the unified chat-via-agent-events pattern)
- `mcp-server.schema.ts` — `create_mcp_server_schema`, `update_mcp_server_schema`
- `index.ts` — Re-exports all schemas

**Important:** Existing inline Zod schemas in route files (`features.ts`, `tasks.ts`, `traits.ts`,
`projects.ts`, `prompts.ts`, `chat.ts`, `admin.ts`, `skills.ts`) should be noted but NOT moved
or deleted in this phase. The new `schemas/` directory provides the canonical schemas; route files
will be migrated to use them in a subsequent server-code-changes task.

### `update-shared-types`
**Directory:** `shared/types/`

Update these files:
- `status.ts` — All status union types matching new enums (lowercase values)
- `index.ts` — Re-exports, add new types for `AgentSession`, `AgentEvent`, `AgentToolCall`, `McpServerConfig`
- Add `user.ts` — `User`, `UserRole` types
- Add `agent.ts` — `AgentSession`, `AgentEvent`, `AgentToolCall`, `AgentType`, `AgentSessionStatus`

Remove references to: `AgentRun`, `AgentRunStatus`, `AgentRunType`, `ChatSession`, `ChatMessage`,
`InviteToken`, passkey-related types.

### `update-dev-scripts`
**Files:**
- Update `scripts/dev-db-reset.sh` — ensure it handles the nuclear migration (drops + rebuilds)
- Create `scripts/apply-migrations.sh` — generic migration applier for dev DB

The existing `dev-db-reset.sh` already drops the `public` schema and re-applies all migrations,
so it should work as-is. Verify the seed data integration path.

### `update-env-example`
**File:** `.env.example`

Add:
- `GITHUB_CLIENT_ID=` — GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET=` — GitHub OAuth app secret
- `SESSION_SECRET=` — Secret for signing session cookies
- `ENCRYPTION_KEY=` — Key for encrypting sensitive DB columns (GitHub tokens)

Remove:
- `RP_ID=localhost` — WebAuthn relying party ID (no longer needed)
- `RP_ORIGIN=http://localhost:5173` — WebAuthn origin (no longer needed)

Keep:
- `SUPABASE_URL`, `SUPABASE_KEY`, `FRONTEND_URL`, `PORT`, `NODE_ENV`

### `verify-migration`
Apply migration to dev DB and verify:
1. `docker exec ralph_dev_db psql -U postgres -d postgres -c "\dt"` — all 15 tables exist
2. `docker exec ralph_dev_db psql -U postgres -d postgres -c "\di"` — all indexes exist
3. `docker exec ralph_dev_db psql -U postgres -d postgres -c "\dT+"` — all enums exist
4. Insert test data across hierarchy, delete a project, verify full cascade cleanup
5. Verify `updated_at` trigger fires on UPDATE
6. Verify partial indexes with `EXPLAIN ANALYZE` on hot-path queries
7. Verify seed data applies cleanly after migration

### `verify-types`
1. `cd server && bun run --bun tsc --noEmit` — 0 errors
2. `cd web && bun run check` — 0 errors (warnings OK)
3. Verify shared types importable from both `server/` and `web/`

---

## Definition of Done

All of these must be true:

- [ ] Nuclear migration file exists at `supabase/supabase/migrations/20260328100000_nuke_and_rebuild.sql`
- [ ] Migration applies cleanly to a fresh PostgreSQL 17 database (no errors)
- [ ] All 15 tables created with correct column types, constraints, and NOT NULL defaults
- [ ] All 9 enums defined with correct lowercase values
- [ ] All foreign keys have correct CASCADE/SET NULL behavior
- [ ] All indexes created (including partial indexes for hot paths)
- [ ] `update_updated_at()` trigger function exists and is applied to all mutable tables
- [ ] RLS enabled on all tables with service-role-only bypass policies
- [ ] Sensitive columns have SQL COMMENTs documenting encryption requirements
- [ ] Schema diagram in migration file header comment
- [ ] Seed data file exists at `supabase/supabase/seed.sql` and applies cleanly after migration
- [ ] `server/src/database.types.ts` generated and matches schema exactly
- [ ] Zod schemas exist in `server/src/schemas/` for all API-facing types
- [ ] Shared types updated in `shared/types/` with new enums and entity types
- [ ] `.env.example` updated with GitHub OAuth vars, WebAuthn vars removed
- [ ] Dev scripts work: `scripts/dev-db-reset.sh` drops and rebuilds successfully
- [ ] `cd server && bun run --bun tsc --noEmit` passes with 0 errors
- [ ] `cd web && bun run check` passes with 0 errors (warnings OK)
- [ ] Cascade verification: delete project → all children removed (features, tasks, resources, agent_sessions, events, tool_calls, artifacts, trait_assignments, skill_links)
- [ ] Cascade verification: delete user → all sessions removed, `created_by` set to NULL
- [ ] Changes committed following AGENTS.md §12 conventions and pushed to branch

---

## E2E Verification Checklist

```bash
# 1. Reset dev DB with new migration
./scripts/dev-db-reset.sh

# 2. Verify all tables exist
docker exec ralph_dev_db psql -U postgres -d postgres -c "\dt public.*"
# Expected: 15 tables

# 3. Verify all enums exist
docker exec ralph_dev_db psql -U postgres -d postgres -c \
  "SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') ORDER BY typname"
# Expected: 9 enums

# 4. Verify all indexes exist
docker exec ralph_dev_db psql -U postgres -d postgres -c "\di public.*"
# Expected: 20+ indexes (including PK indexes)

# 5. Verify cascade chain
docker exec ralph_dev_db psql -U postgres -d postgres <<'SQL'
-- Insert test hierarchy
INSERT INTO users (id, github_id, username, role) VALUES ('00000000-0000-0000-0000-000000000099', 99999, 'test-cascade', 'admin');
INSERT INTO projects (id, name, created_by) VALUES ('00000000-0000-0000-0000-000000000001', 'Cascade Test', '00000000-0000-0000-0000-000000000099');
INSERT INTO features (id, project_id, title, description) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'F1', 'Feature 1');
INSERT INTO tasks (id, feature_id, description) VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Task 1');
INSERT INTO agent_sessions (id, agent_type, feature_id, task_id) VALUES ('00000000-0000-0000-0000-000000000004', 'ralph', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');
INSERT INTO agent_events (id, agent_session_id, event_type) VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 'test.event');
INSERT INTO agent_tool_calls (id, agent_session_id, tool_name) VALUES ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 'bash');

-- Delete project → everything should cascade
DELETE FROM projects WHERE id = '00000000-0000-0000-0000-000000000001';

-- Verify all children are gone
SELECT 'features' AS tbl, count(*) FROM features WHERE id = '00000000-0000-0000-0000-000000000002'
UNION ALL SELECT 'tasks', count(*) FROM tasks WHERE id = '00000000-0000-0000-0000-000000000003'
UNION ALL SELECT 'agent_sessions', count(*) FROM agent_sessions WHERE id = '00000000-0000-0000-0000-000000000004'
UNION ALL SELECT 'agent_events', count(*) FROM agent_events WHERE id = '00000000-0000-0000-0000-000000000005'
UNION ALL SELECT 'agent_tool_calls', count(*) FROM agent_tool_calls WHERE id = '00000000-0000-0000-0000-000000000006';
-- Expected: all counts = 0

-- Cleanup
DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000099';
SQL

# 6. Verify updated_at trigger
docker exec ralph_dev_db psql -U postgres -d postgres <<'SQL'
INSERT INTO users (id, github_id, username, role) VALUES ('00000000-0000-0000-0000-000000000088', 88888, 'trigger-test', 'member');
SELECT updated_at FROM users WHERE id = '00000000-0000-0000-0000-000000000088';
-- Wait a moment
SELECT pg_sleep(0.1);
UPDATE users SET display_name = 'Updated' WHERE id = '00000000-0000-0000-0000-000000000088';
SELECT updated_at FROM users WHERE id = '00000000-0000-0000-0000-000000000088';
-- Expected: updated_at changed
DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000088';
SQL

# 7. Verify seed data
docker exec ralph_dev_db psql -U postgres -d postgres -c "SELECT id, username, role FROM users"
docker exec ralph_dev_db psql -U postgres -d postgres -c "SELECT id, name, status FROM projects"
# Expected: seed users and projects present

# 8. Verify hot-path query plans
docker exec ralph_dev_db psql -U postgres -d postgres <<'SQL'
EXPLAIN ANALYZE SELECT * FROM features WHERE project_id = '00000000-0000-0000-0000-000000000001' AND status = 'in_progress';
EXPLAIN ANALYZE SELECT * FROM tasks WHERE feature_id = '00000000-0000-0000-0000-000000000002' ORDER BY sort_order;
EXPLAIN ANALYZE SELECT * FROM agent_sessions WHERE status = 'running';
SQL
# Expected: index scans (not seq scans) for non-empty tables

# 9. Type-check both projects
cd server && bun run --bun tsc --noEmit
cd ../web && bun run check
# Expected: 0 errors

# 10. Verify Supabase client connectivity (if PostgREST is running)
curl -sf http://127.0.0.1:54321/rest/v1/users -H "apikey: $(grep SUPABASE_KEY .env.local | cut -d= -f2)" -H "Authorization: Bearer $(grep SUPABASE_KEY .env.local | cut -d= -f2)"
# Expected: JSON array (empty or seed data)
```

---

## Dependency Graph

```
write-migration-sql
  └── write-seed-data (depends on migration existing)
  └── generate-db-types (depends on migration applied to DB)
        └── create-zod-schemas (depends on DB types)
        └── update-shared-types (depends on knowing final schema)
  └── update-dev-scripts (can run in parallel with types)
  └── update-env-example (can run in parallel with types)

verify-migration (depends on migration + seed + scripts)
verify-types (depends on DB types + Zod schemas + shared types)
```

## Notes

- The `task_artifacts` table references both `tasks` (CASCADE) and `agent_sessions` (SET NULL).
  Since `agent_sessions` is created in the same migration, use forward declaration or ALTER TABLE
  to add the FK after both tables exist.
- Enum values are ALL lowercase now. The server code and frontend types must be updated to match
  in a follow-up task (out of scope for this plan).
- The `prompts` table partial unique index (`UNIQUE (agent_type) WHERE is_active = true`) ensures
  only one active prompt per agent type. Deactivating a prompt before activating another is the
  application's responsibility.
- MCP server configs (`mcp_server_configs`) is a new table with no existing counterpart. It stores
  MCP server connection details for the copilot-sdk integration.
