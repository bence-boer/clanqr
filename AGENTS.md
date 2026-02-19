# Ralph Agent Workspace — V2 Implementation Guide

This repository is in active development. A detailed V2 architecture plan exists in `.planning/`.

## ⚠️ Read This Before Writing Any Code

### Use the available skills
Two skills are available and **must be invoked** before working in their domains:
- **`hono-backend-architect`** — invoke before writing any backend code (routes, services, middleware)
- **`svelte-architect`** — invoke before writing any frontend code (pages, components)

### Validate your work actually runs
After implementing anything backend:
```bash
cd server && bun run --bun tsc --noEmit   # must produce no NEW errors
```
After implementing anything frontend:
```bash
cd web && bun run check                   # must produce no NEW errors
```
**Fix all errors you encounter, even pre-existing ones that are in your way.** Two pre-existing errors exist (see below) — you must not leave additional errors behind.

### Pre-existing errors (do NOT ignore, fix if you touch those files)
1. `server/src/routes/auth.ts:172` — Buffer vs string type mismatch in `allowCredentials`
2. `server/src/services/agent_service.ts:328-329` — `getReader` on `number | ReadableStream` (proc.stdout/stderr)

---

## V2 Status: Phase 1 Complete ✅

**All Phase 1 work is done and in the codebase. Do not re-implement it.**

### What Was Built (Phase 1)

#### Database (`supabase/supabase/migrations/`)
All V2 tables are live in the local Supabase instance. Migrations applied:
- `20260219101340_initial_schema.sql` — projects, features, tasks, resources, sessions, passkeys
- `20260219111526_auth_passkeys.sql` — passkey auth
- `20260220000000_v2_prompts_traits_pipeline.sql` — **V2 tables**: prompts, traits, trait_assignments, skill_links, agent_runs, chat_sessions, chat_messages; adds `sort_order`/`retry_count`/`max_retries` to tasks; adds `on_task_failure`/`auto_approve` to features

Verify tables exist: `docker exec supabase_db_supabase psql -U postgres -c "\dt"`

#### Backend (`server/src/`)
Current file tree:
```
server/src/
├── index.ts              ← Boot sequence: stale recovery → prompt sync → watcher start
├── db.ts                 ← Supabase client factory
├── middleware/
│   ├── auth.ts
│   └── supabase.ts       ← AppBindings type, injects supabase into context
├── routes/
│   ├── auth.ts
│   ├── projects.ts
│   ├── features.ts
│   ├── tasks.ts
│   ├── agents.ts         ← spawn/stop endpoints; uses agent_service
│   ├── prompts.ts        ← ✅ NEW: GET/PATCH /api/prompts/:role, POST /api/prompts/sync
│   ├── system.ts         ← ✅ NEW: GET /api/system/stats
│   └── chat.ts           ← ✅ NEW: sessions CRUD + SSE streaming send
└── services/
    ├── agent_service.ts  ← ✅ MODIFIED: now writes to agent_runs table on spawn/finish
    ├── watcher_service.ts
    ├── prompt_service.ts ← ✅ NEW: syncs agents/prompts/*.md → DB, update writes back to file
    ├── system_service.ts ← ✅ NEW: reads /proc/stat, /proc/meminfo, df, thermal
    └── chat_service.ts   ← ✅ NEW: wraps copilot CLI for chat, streams tokens via callback
```

Registered routes in `index.ts`:
```
/api/auth         → auth_routes
/api/projects     → projects_routes
/api/features     → features_routes
/api/tasks        → tasks_routes
/api/agents       → agents_routes
/api/prompts      → prompts_routes      ← NEW
/api/system       → system_routes       ← NEW
/api/chat         → chat_routes         ← NEW
```

Boot sequence (in `index.ts` `boot()` function):
1. Reset stale `agent_runs` (status=running → failed) and `tasks` (In_Progress → Approved)
2. `prompt_service.sync_from_repo()` — upserts agents/prompts/*.md into DB
3. `watcher_service.start()` — polls every 5s for submitted features + approved tasks

#### Frontend (`web/src/`)
```
web/src/lib/components/        ← ✅ NEW directory
├── index.ts                   ← barrel export
├── StatusBadge.svelte         ← reactive badge with icon, handles all known statuses
├── StatCard.svelte            ← stat display card (icon, value, label)
├── EmptyState.svelte          ← empty state with icon + message
├── LoadingSpinner.svelte      ← spin icon with optional label
└── LogViewer.svelte           ← auto-scrolling monospace log panel
```

Usage: `import { StatusBadge, EmptyState, LoadingSpinner, LogViewer, StatCard } from '$lib/components';`

---

## Implementation Todos — What's Left

### Phase 2 — Pipeline & Traits (start here next)

| ID | Title | Depends On | Spec |
|----|-------|------------|------|
| `pipeline-service` | Sequential pipeline service | ✅ all done | `.planning/04-agent-execution-pipeline.md` |
| `traits-crud` | Traits CRUD routes + inheritance resolution | ✅ all done | `.planning/05-prompt-and-traits-system.md` |
| `skill-discovery` | Copilot CLI skill discovery service | ✅ all done | `.planning/02-backend-architecture.md` |
| `prompt-routes` | ✅ DONE (was `prompts_routes` in Phase 1) | — | — |

> **Note:** `prompt-routes` was completed as part of Phase 1 (it's `routes/prompts.ts`). Skip it.

### Phase 3 — Integration (depends on Phase 2)

| ID | Title | Depends On | Spec |
|----|-------|------------|------|
| `pipeline-routes` | Pipeline API routes (queue/pause/resume) | pipeline-service | `.planning/02-backend-architecture.md` |
| `watcher-modify` | Modify watcher (manager-only + auto-approve) | pipeline-service | `.planning/02-backend-architecture.md` |
| `skill-routes` | Skills linking routes | skill-discovery | `.planning/02-backend-architecture.md` |
| `prompt-resolution` | Prompt resolution service (base+traits+skills) | traits-crud, skill-discovery | `.planning/05-prompt-and-traits-system.md` |
| `chat-routes` | ✅ DONE (was `chat_routes` in Phase 1) | — | — |
| `usage-routes` | Usage analytics routes | ✅ agent-runs-persist done | `.planning/06-system-monitoring.md` |
| `sidebar-redesign` | Sidebar navigation redesign | ✅ shared-components done | `.planning/08-sidebar-and-navigation.md` |

> **Note:** `chat-routes` was completed as part of Phase 1. Skip it.

### Phase 4 — Frontend (depends on Phase 3)

| ID | Title | Depends On | Spec |
|----|-------|------------|------|
| `pipeline-page` | Pipeline page (replaces /monitoring) | pipeline-routes | `.planning/03-frontend-architecture.md` |
| `project-detail-enhance` | Project detail: traits, skills, pipeline controls | traits-crud, skill-routes | `.planning/03-frontend-architecture.md` |
| `dashboard-enhance` | Dashboard: system stats + pipeline status | system-stats ✅, shared-components ✅ | `.planning/03-frontend-architecture.md` |
| `prompts-page` | Prompts & Traits management page | traits-crud | `.planning/03-frontend-architecture.md` |
| `skills-page` | Skills browser page | skill-routes | `.planning/03-frontend-architecture.md` |
| `chat-page` | Chat page (two-panel, streaming) | chat-routes ✅ | `.planning/07-direct-chat-interface.md` |
| `usage-page` | Usage analytics page | usage-routes | `.planning/03-frontend-architecture.md` |

---

## Key Conventions

- **Language:** TypeScript throughout, strict mode
- **Backend:** Hono on Bun (port 3001), snake_case, Zod validation, NO `@hono/zod-validator` (not installed) — parse manually with `schema.safeParse(await context.req.json())`
- **Frontend:** SvelteKit + Svelte 5 runes (`$state`, `$derived`, `$effect`) — no stores. Use `$derived` not `const` for reactive values computed from props.
- **DB:** Supabase (local Postgres). Run via Docker — containers named `supabase_db_supabase` etc.
- **Agents:** All spawned via `copilot -p "..." --allow-all-tools`
- **Naming:** snake_case for all TS variables/functions, kebab-case for files
- **No new libraries** unless absolutely necessary. No charting libs (use CSS progress bars).
- **Validation pattern** (backend):
  ```ts
  const schema = z.object({ ... });
  const result = schema.safeParse(await context.req.json());
  if (!result.success) return context.json({ error: result.error.format() }, 400);
  ```

## Project Layout

```
ralph-agent-workspace/
├── server/src/
│   ├── routes/           ← Hono route handlers
│   ├── services/         ← Business logic
│   ├── middleware/        ← auth, supabase injection
│   └── index.ts          ← App entry point, route registration + boot sequence
├── web/src/
│   ├── routes/           ← SvelteKit pages
│   ├── lib/api/client.ts ← API fetch wrapper
│   ├── lib/types/        ← TypeScript interfaces
│   └── lib/components/   ← Shared Svelte components ✅ (StatusBadge, StatCard, EmptyState, LoadingSpinner, LogViewer)
├── agents/
│   ├── prompts/          ← manager.md, ralph.md (source of truth; synced to DB on boot)
│   └── workspace/        ← gitignored, agent working directories
├── supabase/supabase/
│   └── migrations/       ← SQL migrations (all applied)
└── .planning/            ← Architecture docs (not committed)
```

