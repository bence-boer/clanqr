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

## Active Bug Backlog

These bugs have been confirmed by code inspection. Each entry includes the root cause, affected files, and a recommended fix. All fixes must be verified with E2E tests. Do **not** make real model calls in tests — use `gpt-4.1` (free tier) if a model call is unavoidable.

> **Before fixing any bug:** run `cd server && bun run --bun tsc --noEmit` and `cd web && bun run check` to establish the baseline. Your fix must not introduce new errors.

---

### BUG-01 · Feature drafts not editable after saving

**Symptom:** Once a feature is created (saved as Draft), there is no way to edit its title, description, or resources from the detail panel.

**Root cause:** `web/src/routes/projects/[id]/+page.svelte` — the detail panel only shows a Submit button (Draft-only) and a Delete button. No edit button or edit form exists for Draft features. The API supports `PATCH /api/features/:id` and `POST/DELETE /api/features/:id/resources`, so only the UI is missing.

**Fix:**
- Add an Edit button to the detail panel header (only when `status === 'Draft'`).
- Toggle an edit mode that shows inline inputs bound to the feature's title/description.
- For resources: allow adding/removing via the existing `api.add_resource` / `api.delete_resource` calls.
- After saving call `await load_data()` to refresh.

**Similar bug:** The project list page (`web/src/routes/projects/+page.svelte`) also has no inline project edit — only create/delete. The `PATCH /api/projects/:id` endpoint exists but is unused. Fix as part of the same pass.

---

### BUG-02 · "Failed to send message" in chat

**Symptom:** Pressing Send shows "Failed to send message". Analytics shows a new running session with no duration/tokens, confirming the backend receives the request but the client errors immediately.

**Root cause (two-part):**

1. `web/src/lib/api/client.ts` line 177 — `send_chat_message` goes through `api_fetch`, which calls `response.json()` on the response. But `POST /api/chat/sessions/:id/send` returns `Content-Type: text/event-stream`, not JSON. Calling `.json()` throws, triggering the `catch` that sets `error_msg = 'Failed to send message'`.

2. `web/src/routes/chat/+page.svelte` line 107 — After the failed POST, the code tries to open an `EventSource` to `/api/chat/sessions/:id/stream` (a GET endpoint). That route **does not exist** in the backend. The SSE stream is the POST response body itself.

**Fix (recommended approach — split the protocol):**
- **Backend** (`server/src/routes/chat.ts`): Change `POST /sessions/:id/send` to return a plain JSON response `{ run_id: string }` — just insert the user message and create the `agent_runs` record, then return. Add a new `GET /sessions/:id/stream` endpoint that streams the LLM response via SSE (accepts `run_id` as a query param or derives it from session state).
- **Frontend** (`web/src/lib/api/client.ts`): `send_chat_message` returns `{ run_id }` JSON as before. `chat_stream_url` already points to the right GET URL — just make sure the backend now has that route.
- **Frontend** (`web/src/routes/chat/+page.svelte`): The EventSource flow already uses the correct pattern once the backend has the GET stream endpoint.

> Alternatively (simpler but less clean): replace `api_fetch` in `send_chat_message` with a raw `fetch()` that does **not** call `.json()`, then read the POST response body as an SSE stream using a `ReadableStream` reader instead of `EventSource`. Choose whichever approach you implement consistently.

---

### BUG-03 · Base prompts appear empty in the Prompts page

**Symptom:** Opening `/prompts` → "Base Prompts" tab shows empty textareas for manager and ralph prompts.

**Root cause:** `server/src/routes/prompts.ts` line 15 — the list endpoint selects only `id, role, version, updated_at`. The `content` field is **not returned**. In `web/src/routes/prompts/+page.svelte` line 30, `edit_state[role].content` is initialized to `prompt.content` which is `undefined`. The textarea (line 318) renders `undefined` → empty.

Additional impact: `start_edit` (line 306) passes `prompt.content` (undefined) to initialize the edit buffer. `cancel_edit` (line 339) also passes `prompt.content` (undefined) as the revert value.

**Fix:**
- `server/src/routes/prompts.ts`: change `select("id, role, version, updated_at")` to `select("*")`.
- This is safe — there are only a few prompt rows and content is already stored in the DB.

---

### BUG-04 · Traits library overflows horizontally on mobile

**Symptom:** When multiple traits exist on a narrow screen, the traits list scrolls or bleeds outside its container.

**Root cause:** `web/src/routes/prompts/+page.svelte`:
- `.trait-row` (line 1024) uses `flex-wrap: wrap` but has no `max-width: 100%` — it can exceed the container when a long trait name is combined with badges and action buttons.
- `.trait-actions` (line 1109) has `flex-shrink: 0`, so it never shrinks; on narrow viewports it forces the row wider than the screen.
- No `overflow-x: hidden` on the parent `.traits-list`.

**Fix:**
- Add `max-width: 100%; overflow: hidden; box-sizing: border-box;` to `.trait-row`.
- In the `@media (max-width: 768px)` block, stack `.trait-main` and `.trait-actions` vertically: `.trait-row { flex-direction: column; align-items: flex-start; }` and `.trait-actions { align-self: flex-end; }`.

**Similar bug:** The `.form-row` grid in the trait form (`grid-template-columns: 1fr 1fr`) collapses at 768px (already handled), but the `.filter-bar` on the usage page (line 376–383 in `usage/+page.svelte`) is a `display: flex` with no `flex-wrap`, so filter selects may overflow on very narrow screens. Add `flex-wrap: wrap` there.

---

### BUG-05 · Hamburger menu button overlaps the open sidebar on mobile

**Symptom:** On small screens, when the sidebar is open, the hamburger/close button (top-left corner, `z-index: 60`) sits on top of the sidebar's logo area (also top-left, `z-index: 40`), making the top of the nav hard to tap.

**Root cause:** `web/src/routes/+layout.svelte`:
- `.mobile-toggle` is `position: fixed; top: 0.75rem; left: 0.75rem; z-index: 60`.
- `.sidebar` is `position: fixed; top: 0; left: 0; z-index: 40`.
- When the sidebar is open, the toggle button physically covers the top-left of the sidebar.

**Fix:** In the `@media (max-width: 768px)` block, hide the toggle button when the sidebar is open:
```css
.sidebar-open .mobile-toggle {
  left: calc(220px + 0.75rem); /* move button to the right of the open sidebar */
}
```
Or add `transition: left 0.2s ease;` to animate the button sliding right when the sidebar opens. Either way ensure the button remains tappable and doesn't overlap nav links.

---

### BUG-06 · Chat second panel (message area) poorly formatted on mobile

**Symptom:** On mobile the chat messages/input area has incorrect padding, wrong sizing, or is cut off below the fold.

**Root cause:** `web/src/routes/chat/+page.svelte` line 571–574:
```css
@media (max-width: 768px) {
  .chat-page { flex-direction: column; height: auto; }
  .sessions-panel { width: 100%; height: 200px; margin-right: 0; margin-bottom: 0.75rem; }
}
```
- `.chat-page` loses its `height: calc(100vh - 4rem)` → the chat area has no constrained height and becomes `height: auto`.
- `.chat-area` is not targeted in the media query at all — it has no min-height, no explicit height, and no padding adjustments for mobile.
- The fixed `padding-top: 3.5rem` applied to `.content` in `+layout.svelte` must also be accounted for in the chat area height calculation.

**Fix:**
```css
@media (max-width: 768px) {
  .chat-page {
    flex-direction: column;
    height: calc(100dvh - 3.5rem); /* account for layout padding-top */
    min-height: 0;
  }
  .sessions-panel { width: 100%; height: 180px; margin-right: 0; margin-bottom: 0; }
  .chat-area { flex: 1; min-height: 0; }
}
```
Also ensure `.input-area` padding is comfortable for mobile thumb reach (consider `padding-bottom: env(safe-area-inset-bottom, 0.75rem)`).

---

### BUG-07 · Usage analytics page overflows horizontally on mobile

**Symptom:** The usage page scrolls horizontally or has content cut off on narrow screens.

**Root cause:** `web/src/routes/usage/+page.svelte`:
- The `.filters` row (line 376) is `display: flex` with no `flex-wrap` — when both selects are side by side they can overflow a narrow viewport.
- The `.stats-3` / `.stats-2` grids and `.breakdown-section` already collapse to `1fr` at 640px — those are fine.
- The history section header (`.history-header`) collapses correctly. But the `select` elements inside `.filters` may not shrink below their intrinsic width.

**Fix:**
- Add `flex-wrap: wrap;` to `.filters` so selects stack on narrow screens.
- Add `min-width: 0;` to `.select` to allow shrinking.
- Also add a `@media (max-width: 640px)` rule: `.filters { flex-direction: column; }`.

---

### BUG-08 · Statistics cards on dashboard/analytics take too much space on mobile and are not tappable

**Symptom:** The three top stat cards on the dashboard (`/`) each take full width on mobile (too much vertical space) and are static divs — they're not clickable/navigable.

**Root cause:** `web/src/routes/+page.svelte`:
- `.stats` grid (line 226) at `max-width: 768px` collapses to `grid-template-columns: 1fr` (line 469), so each card is full-width — very tall on mobile.
- The stat cards are plain `<div>` elements (not `<a>` or `<button>`), so they provide no tap target.

**Fix:**
- Change the mobile grid to `repeat(3, 1fr)` (same as desktop) with reduced padding at small sizes, or `repeat(2, 1fr)` with the pipeline stat spanning full width: keeps cards compact.
- Make each stat card a navigation link — Projects → `/projects`, Features → `/projects`, Pipeline → `/pipeline`. Use `<a>` instead of `<div>` and add `cursor: pointer` + `hover` styles.

**Similar bug:** The `StatCard` shared component (`web/src/lib/components/StatCard.svelte`) should also accept an optional `href` prop so it can render as a link when navigation is appropriate. The usage page stats (not yet clickable either) could benefit from the same treatment.

---

### BUG-09 · Skills page shows only SKILL.md content, not the full skill folder

**Symptom:** Expanding a skill in `/skills` shows only the content of `SKILL.md` — any supporting files in the skill folder (examples, config, sub-instructions) are not visible.

**Root cause:** `server/src/services/skill_service.ts` line 69–88 — `read_skill()` reads only `SKILL.md` or `skill.md` from the directory. All other files in the folder are ignored.

**Fix:**
- After reading `SKILL.md`, scan the remaining files in the skill directory.
- Concatenate their contents (with filename headers) into the `content` field, or add a new `files: { name: string; content: string }[]` field to `SkillInfo`.
- Update the corresponding type in `web/src/lib/types/index.ts` and the skills page to display the multi-file view (e.g., a tab or accordion per file).
- Skip binary files (check extension: only `.md`, `.txt`, `.yaml`, `.json`, `.ts`, `.js`).

---

### BUG-10 · Model selection in chat is more limited than the CLI

**Symptom:** The model dropdown in `/chat` offers only 6 options, but the Copilot CLI supports 17 models.

**Root cause:** `web/src/routes/chat/+page.svelte` lines 5–12 — the `MODELS` array is hardcoded with 6 entries:
```ts
const MODELS = [
  'claude-sonnet-4.5', 'claude-opus-4.5', 'claude-sonnet-4',
  'gpt-5.1', 'gpt-5-mini', 'gpt-4.1',
];
```

**Fix:**
- Option A (preferred): Add a `GET /api/system/models` backend endpoint that returns the full model list (read from `copilot --list-models` or from a static config in `system_service.ts`). The frontend fetches this on mount.
- Option B (acceptable): Expand the hardcoded list to include all 17 models listed in `AGENTS.md` under the task tool documentation. Group them visually in the `<select>` with `<optgroup>` labels (Claude, GPT).

Full model list: `claude-sonnet-4.6`, `claude-sonnet-4.5`, `claude-haiku-4.5`, `claude-opus-4.6`, `claude-opus-4.6-fast`, `claude-opus-4.5`, `claude-sonnet-4`, `gemini-3-pro-preview`, `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.2`, `gpt-5.1-codex-max`, `gpt-5.1-codex`, `gpt-5.1`, `gpt-5.1-codex-mini`, `gpt-5-mini`, `gpt-4.1`.

---

### Additional similar bugs discovered during investigation

| # | Location | Issue | Fix hint |
|---|----------|--------|----------|
| A | `web/src/routes/projects/+page.svelte` | Project names/descriptions cannot be edited after creation (no Edit UI, only delete) | Add edit inline form; use `api.update_project` |
| B | `web/src/routes/+layout.svelte` mobile | Sidebar logo at top-left is behind the toggle button even when sidebar is closed (button is always at `z-index: 60` over the first nav item on open) | See BUG-05 fix |
| C | `web/src/routes/usage/+page.svelte` | `.history-header` and filter bar have no `min-width: 0` on flex children — can cause subtle overflow on mid-size tablets | Add `min-width: 0` and `flex-wrap: wrap` |
| D | `server/src/services/chat_service.ts` line 107–108 | `is_busy()` is global — a second chat session from a different tab returns HTTP 409 immediately | Track busy state per `session_id`, not globally |
| E | `web/src/routes/chat/+page.svelte` line 43 | When selecting an existing session, `selected_model` is set to `session.model`, but the model select has no effect on subsequent messages (it uses `active_session.model`, not `selected_model`, in the backend call); model change is silently ignored | Either update `active_session.model` via `PATCH /api/chat/sessions/:id` when the user changes the select, or pass `selected_model` as a request body field on send |

---

### BUG-11 · Manager (and Ralph) agent always fails — "Executable not found in $PATH: copilot"

**Symptom:** Submitting any feature immediately produces a `failed` agent run in usage analytics. The feature stays stuck at `In_Progress`. Confirmed DB error: `Executable not found in $PATH: "copilot"`.

**Root cause — three separate issues that must all be fixed together:**

#### 11a · `copilot` binary not on PATH when spawning subprocesses

`copilot` is installed at `~/.local/bin/copilot`, which is in the user's interactive shell PATH but is **not inherited** by the Bun server process when spawned by a process manager, systemd unit, or non-login shell.

`agent_service.ts` and `chat_service.ts` both call `Bun.spawn(["copilot", ...])` with `env: { ...process.env }`. If `process.env.PATH` does not include `~/.local/bin`, Bun cannot locate the binary.

**Fix:** Resolve the copilot binary path at module load time and enrich PATH in every spawn call. Add to the top of `agent_service.ts` and `chat_service.ts`:

```ts
import { join } from "path";
const HOME = process.env.HOME ?? "/home/scoy";
const COPILOT_BIN =
  process.env.COPILOT_BIN ??                        // allow explicit override
  join(HOME, ".local/bin/copilot");                  // default install location

const ENRICHED_PATH = [
  join(HOME, ".local/bin"),
  join(HOME, ".bun/bin"),
  process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
].join(":");
```

Then replace every spawn call's `env` with:
```ts
env: { ...process.env, HOME, PATH: ENRICHED_PATH },
```

And replace `"copilot"` with `COPILOT_BIN` in every `Bun.spawn` args array.

> **Files to update:** `server/src/services/agent_service.ts` (lines 109, 219), `server/src/services/chat_service.ts` (line 40).

#### 11b · Feature stuck at `In_Progress` when manager fails — no retry possible

In `spawn_manager` (`agent_service.ts` line 126), when `exit_code !== 0`, the feature stays at `In_Progress`. The watcher (`watcher_service.ts` line 41) only polls for `status = "Submitted"` features, so the failed feature is never retried and the user has no way to re-submit.

**Fix:** In the failure path of `spawn_manager` (inside the `try` block after `await proc.exited` and in the `catch` block), reset the feature status back to `"Submitted"`:
```ts
if (exit_code !== 0) {
  await supabase.from("features").update({ status: "Submitted" }).eq("id", feature_id);
}
```
Add the same reset in the `catch (error)` block. This allows the watcher to pick it up again on the next poll.

#### 11c · Boot stale recovery doesn't reset stuck `In_Progress` features

`server/src/index.ts` boot sequence (line 72) resets `tasks` from `In_Progress → Approved` after a crash, but does **not** reset `features` from `In_Progress → Submitted`. Any feature that was being processed when the server crashed stays stuck forever.

**Fix:** Add one line to the boot recovery block in `index.ts`:
```ts
await supabase.from("tasks").update({ status: "Approved" }).eq("status", "In_Progress");
// ADD THIS:
await supabase.from("features").update({ status: "Submitted" }).eq("status", "In_Progress");
```

**Also add** to the watcher's retry guard (`watcher_service.ts` line 52): the current check `existing.status === "failed"` is fine for in-memory state, but after a restart the processes map is empty (`!existing` is true) while the feature is `In_Progress` (not `Submitted`), so the fix in 11c is the primary guard.

---

### E2E testing requirements for all bug fixes

- Use Playwright or a simple fetch-based integration test suite.
- **Do not call real models in tests** — mock `chat_service.send_message` or use `gpt-4.1` (marked free) for any test that must exercise a live model path.
- Cover: feature create → edit → submit flow; chat send → receive stream flow; prompts page loads content; traits list fits viewport at 375px width; hamburger opens/closes without overlap; skill detail shows all files; model dropdown shows all 17 entries.
- For BUG-11: mock `Bun.spawn` in tests (or stub the copilot binary with a shell script that writes `tasks.json` and exits 0) — verify that the feature transitions `Draft → Submitted → In_Progress → Submitted` (on failure) and `Draft → Submitted → In_Progress → Done` (on success); verify boot recovery resets `In_Progress` features to `Submitted`.

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

