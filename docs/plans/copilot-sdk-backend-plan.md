# PLAN: Copilot SDK Backend Migration

> **Source:** `copilot-sdk-backend.md` (plan-plan)
> **Status:** Ready for implementation
> **Scope:** Replace CLI-based agent spawning with `@github/copilot-sdk` headless backend

---

## §1 — Problem Statement

The current agent execution layer spawns copilot/gemini CLI processes via shell scripts
(`spawn-manager.sh`, `spawn-ralph.sh`) and manages them through Bun.spawn, filesystem workspaces
(`feature-spec.json → tasks.json → progress.json`), and Docker containers. This architecture is:

- **Fragile:** Process lifecycle managed by PID tracking and in-memory Maps that are lost on restart.
- **Opaque:** No streaming — output is captured into a 1MB buffer and only available after completion.
- **Coupled:** Environment allowlists, Docker container mounts, binary path resolution, and workspace
  directories create a deep dependency chain between `spawn_agent`, `spawn_utils`, `container_service`,
  and `env.ts`.
- **Redundant:** Gemini CLI is being removed entirely; the `cli`/`execution_cli` column infrastructure
  serves two backends but will serve zero after gemini removal.
- **Limited:** No session persistence, no hook-based auditing, no per-user token isolation, no
  sub-agent orchestration.

**Target end state:** A single `@github/copilot-sdk` integration layer that:
1. Connects to a headless Copilot CLI server over TCP (`localhost:4321`)
2. Creates per-user SDK sessions with scoped custom agents (manager, ralph, researcher)
3. Uses hooks for audit logging, permission control, trait injection, and error recovery
4. Streams 40+ event types in real-time to the frontend via SSE
5. Persists sessions across server restarts
6. Eliminates all shell scripts, Docker containers, filesystem workspaces, and gemini references

---

## §2 — Meta-Engineering Analysis

### Scenario: Integration (SDK is an external system boundary)

**What does the other side promise?**
- The SDK communicates with a headless CLI server via JSON-RPC over TCP
- Sessions are isolated by `sessionId`; state persists to `~/.copilot/session-state/`
- 30-minute idle timeout auto-cleans inactive sessions
- Hooks fire at 6 lifecycle points with typed inputs/outputs
- Custom agents scope tools and prompts per agent definition
- Streaming events provide real-time deltas, tool execution, and lifecycle signals

**What happens if it violates that promise?**
- CLI server crash → sessions are lost in-memory; persisted state survives on disk
- SDK TCP connection drop → `client.ping()` health check detects failure; reconnect needed
- Hook throws → `onErrorOccurred` fires; unhandled errors surface as session errors
- Session state corruption → resume fails; fallback to new session creation

**What coupling is being introduced?**
- Runtime dependency on `@github/copilot-sdk` npm package (Bun compatibility unverified)
- Operational dependency on headless CLI server process (systemd service on Pi)
- Auth dependency on GitHub OAuth tokens per user (currently passkey-only; OAuth is new)
- Filesystem dependency on `~/.copilot/session-state/` for persistence

**What is the rollback or disconnection story?**
- SDK integration is behind a new service layer (`sdk_session_service.ts`)
- Old services are deleted, not modified — rollback requires git revert
- Database schema changes (new `sdk_sessions` table, modified `agent_runs`) are forward-only
- CLI server is an independent process — can be stopped without affecting the Hono API

### Invariants That Must Hold

1. **Concurrency:** Active SDK sessions ≤ `SDK_MAX_CONCURRENT_SESSIONS` (env-configured, default 5)
2. **Lifecycle completeness:** Every `createSession` has a matching `disconnect` in a `finally` block
3. **DB consistency:** Every SDK session has a corresponding `agent_runs` record with terminal status
4. **Token isolation:** User A's GitHub token never leaks to User B's session
5. **Audit trail:** Every tool call is logged with session ID, tool name, args, and timestamp
6. **State recovery:** On server restart, in-memory session map is reconciled from DB + SDK `listSessions()`

### State Model

```
Session States: Creating → Active → (Paused) → Completing → Completed | Failed | Cancelled
                                       ↑                          |
                                       └──── Resume ───────────────┘

DB Record States: running → completed | failed | cancelled
                   (set on create)  (set on session end / error / cancel)
```

**Invalid combinations to prevent:**
- DB says `running` but no SDK session exists → reconcile on boot (mark `failed`)
- SDK session exists but no DB record → orphaned session, clean up
- Multiple active sessions for same feature/task → enforce uniqueness before creation

### Failure Classification

| Failure | Type | Handling |
|---------|------|----------|
| CLI server unreachable | Transient | Retry with backoff; health check alerts |
| GitHub token expired | Recoverable | `onErrorOccurred` → prompt re-auth |
| SDK session timeout (30min) | Expected | Auto-cleanup; mark DB record as `failed` |
| Manager output unparseable | Recoverable | Retry with explicit format instructions; Zod validation |
| Server restart mid-session | Crash recovery | Boot reconciliation from DB + `listSessions()` |
| Tool permission denied | Expected | `onPreToolUse` → log and return deny decision |
| Concurrent session limit hit | Backpressure | Queue with callback wake (same pattern as current) |

---

## §3 — Architecture Design

### 3.1 Infrastructure Layer

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Agent Panel  │  │  Chat Panel  │  │  Pipeline Queue  │ │
│  │ (streaming)  │  │  (streaming) │  │  (REST + SSE)    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬──────────┘ │
│         │ SSE              │ SSE              │ REST       │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼────────────┐
│         ▼                  ▼                  ▼            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Hono API (port 3001)                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │  │
│  │  │ Agent    │  │ Chat     │  │ Pipeline           │ │  │
│  │  │ Routes   │  │ Routes   │  │ Routes             │ │  │
│  │  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘ │  │
│  │       │              │                  │            │  │
│  │  ┌────▼──────────────▼──────────────────▼──────────┐ │  │
│  │  │            SDK Session Service                  │ │  │
│  │  │  ┌──────────────────────────────────────────┐   │ │  │
│  │  │  │ client_factory  → CopilotClient per user │   │ │  │
│  │  │  │ session_pool    → concurrency + tracking │   │ │  │
│  │  │  │ hooks           → audit, permissions,    │   │ │  │
│  │  │  │                   enrichment, redaction  │   │ │  │
│  │  │  │ custom_agents   → manager, ralph,        │   │ │  │
│  │  │  │                   researcher definitions │   │ │  │
│  │  │  │ event_mapper    → SDK events → SSE       │   │ │  │
│  │  │  │ output_parser   → Zod-validated results  │   │ │  │
│  │  │  └──────────────────────────────────────────┘   │ │  │
│  │  └─────────────────────┬───────────────────────────┘ │  │
│  └────────────────────────┼─────────────────────────────┘  │
│                           │ TCP (cliUrl: localhost:4321)    │
│  ┌────────────────────────▼────────────────────────────┐   │
│  │       Copilot CLI (headless, port 4321)             │   │
│  │  - systemd: copilot-cli.service (Restart=always)    │   │
│  │  - Session state: ~/.copilot/session-state/         │   │
│  │  - JSON-RPC server (TCP)                            │   │
│  │  - Model API calls via GitHub Copilot               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Supabase PostgreSQL (Docker)              │   │
│  │  - users, sessions, projects, features, tasks       │   │
│  │  - agent_runs (extended with sdk_session_id)        │   │
│  │  - chat_sessions, chat_messages                     │   │
│  │  - audit_events (NEW)                               │   │
│  │  - prompts, traits, skills                          │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Shared CLI with Session Isolation (chosen pattern)

Per SDK scaling docs, the recommended pattern for resource-constrained environments (Raspberry Pi)
is a **shared CLI server** with session isolation via unique session IDs. This avoids spawning
one CLI instance per user (too resource-heavy for Pi).

**Session ID convention:** `{agent_type}-{entity_id}-{timestamp}`
- Manager: `manager-{feature_id}-{Date.now()}`
- Ralph: `ralph-{task_id}-{Date.now()}`
- Chat: `chat-{session_id}-{Date.now()}`
- Researcher: `researcher-{query_hash}-{Date.now()}`

**Access control:** Session IDs are validated server-side — users can only interact with sessions
they own (tracked in `agent_runs` table via `user_id` column).

### 3.3 Service Layer Mapping

| Current Service | Target | Disposition |
|----------------|--------|-------------|
| `agent_service.ts` | `sdk_session_service.ts` | **REPLACE** — SDK client lifecycle, session pool, hook wiring |
| `pipeline_service.ts` | `pipeline_service.ts` | **SIMPLIFY** — queue logic stays, spawn calls become SDK sessions |
| `spawn_agent.ts` | — | **DELETE** — replaced by `session.sendAndWait()` |
| `spawn_utils.ts` | — | **DELETE** — no manual env building needed |
| `container_service.ts` | — | **DELETE** — no Docker agent containers |
| `watcher_service.ts` | `session_watcher_service.ts` | **REPLACE** — monitor SDK session events, not filesystem |
| `agent_concurrency.ts` | `session_pool_service.ts` | **REPLACE** — concurrency via SDK session limits |
| `chat_service.ts` | — | **MERGE** into `sdk_session_service.ts` (chat uses SDK sessions) |
| `prompt_service.ts` | `agent_prompt_service.ts` | **ADAPT** — prompts become SDK custom agent definitions |
| `trait_service.ts` | (keep) | **ADAPT** — traits injected via `onSessionStart`/`onUserPromptSubmitted` hooks |
| `skill_service.ts` | (keep) | **ADAPT** — skills become SDK `skillDirectories` |
| `manager_output.ts` | `output_parser.ts` (in sdk/) | **REPLACE** — Zod-validated parsing of SDK session responses |
| `event_bus.ts` | (keep, extend) | **EXTEND** — add SDK event types to existing pub/sub |

### 3.4 Route Changes

| Current Route | Target Route | Notes |
|---------------|-------------|-------|
| `POST /api/agents/spawn/manager/:feature_id` | `POST /api/agents/plan/:feature_id` | Creates SDK session with manager agent |
| `GET /api/agents/status` | `GET /api/agents/sessions` | Lists active SDK sessions |
| `POST /api/agents/stop/:task_id` | `POST /api/agents/sessions/:id/stop` | Disconnects SDK session |
| `GET /api/agents/log/:task_id` | `GET /api/agents/sessions/:id/events` | Returns SDK session event history |
| `GET /api/agents/queue` | (keep) | Pipeline state (adapted internals) |
| `POST /api/agents/pause/resume/stop-current` | (keep) | Pipeline control (adapted internals) |
| `POST /api/chat/sessions/:id/send` | `POST /api/chat/sessions/:id/messages` | Send via SDK session |
| `GET /api/events/stream` | `GET /api/events/stream` | Extended with SDK event types |
| — | `GET /api/stream/:sessionId` | **NEW** — per-session SSE/event stream |

---

## §4 — SDK Integration Layer Design

### 4.1 Client Factory (`server/src/sdk/client_factory.ts`)

```typescript
// Single shared CopilotClient for the headless CLI server
// Per-user tokens are passed at session creation time
function create_client(): CopilotClient {
  return new CopilotClient({
    cliUrl: env.CLI_URL || "localhost:4321",
  });
}

// Per-user client (when user has GitHub OAuth token)
function create_client_for_user(github_token: string): CopilotClient {
  return new CopilotClient({
    cliUrl: env.CLI_URL || "localhost:4321",
    githubToken: github_token,
    useLoggedInUser: false,
  });
}
```

**Design decision — shared vs per-user client:**
Use a shared CLI server with the environment-level `COPILOT_GITHUB_TOKEN`. Per-user GitHub OAuth
tokens are a future enhancement that requires adding OAuth flow to the auth system (currently
passkey-only). The shared token approach works now and can be upgraded to per-user tokens later
by passing `githubToken` on the CopilotClient.

**Health monitoring:**
```typescript
// Periodic health check (every 30s) in boot sequence
async function monitor_cli_health(client: CopilotClient): Promise<void> {
  const healthy = await client.ping();
  if (!healthy) logger.error('CLI server unreachable', { service: 'sdk' });
}
```

### 4.2 Custom Agent Definitions (`server/src/sdk/custom_agents.ts`)

Three custom agents, each with scoped tools and dedicated system prompt:

| Agent | Tools | Prompt Source | Purpose |
|-------|-------|---------------|---------|
| `manager` | `grep`, `glob`, `view` (read-only) | `agents/prompts/manager.md` | Feature planning → task breakdown |
| `ralph` | `view`, `edit`, `bash`, `grep`, `glob` (full) | `agents/prompts/ralph.md` | Task execution → code changes |
| `researcher` | `grep`, `glob`, `view` (read-only) | New `agents/prompts/researcher.md` | Codebase exploration, architecture questions |

**Agent selection:**
- Manager and Ralph are explicitly selected via `agent` field on `createSession()`
- Researcher has `infer: true` — auto-selected for research questions in chat

**Prompt adaptation:**
- Current prompts reference filesystem I/O (`feature-spec.json`, `tasks.json`, `progress.json`)
- New prompts will instruct agents to return structured output inline (parsed by `output_parser.ts`)
- Trait and skill injection happens via hooks, not template variables

### 4.3 Hooks (`server/src/sdk/hooks.ts`)

Six hooks, each with a single responsibility:

| Hook | Responsibility | Implementation |
|------|---------------|----------------|
| `onSessionStart` | Inject project context, resolved traits, feature/task spec | Query DB for entity, resolve traits via `trait_service`, return `additionalContext` |
| `onUserPromptSubmitted` | Enrich prompt with task-specific traits and skills | Resolve per-message traits, modify prompt with injected sections |
| `onPreToolUse` | Audit logging + permission enforcement | Log to `audit_events` table; enforce tool scope per agent type |
| `onPostToolUse` | Secret redaction + artifact tracking | Regex-scan tool results for secrets; track file modifications |
| `onSessionEnd` | Record completion in DB, extract results, update status | Parse session output, update `agent_runs`, `features`, `tasks` tables |
| `onErrorOccurred` | Log errors, retry transient failures, notify frontend | Classify error; retry if recoverable; emit error event to SSE |

**Permission model (onPreToolUse):**
```
Manager agent:  ALLOW grep, glob, view       DENY edit, bash, create
Ralph agent:    ALLOW grep, glob, view, edit, bash, create
Researcher:     ALLOW grep, glob, view       DENY edit, bash, create
```

**Trait injection strategy (resolved design decision):**
- **Global traits** (project-level, feature-level) → injected at `onSessionStart` as `additionalContext`
- **Task-specific traits** → injected at `onUserPromptSubmitted` with each prompt

### 4.4 Output Parser (`server/src/sdk/output_parser.ts`)

Zod-validated parsing of structured agent output:

**Manager output schema:**
```typescript
const task_schema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(20).max(5000),
});

const manager_output_schema = z.object({
  tasks: z.array(task_schema).min(1).max(50),
});
```

**Ralph output schema:**
```typescript
const ralph_output_schema = z.object({
  status: z.enum(['completed', 'failed', 'partial']),
  summary: z.string().optional(),
  files_changed: z.array(z.string()).optional(),
  error_details: z.string().nullable().optional(),
});
```

**Parsing strategy:**
1. Extract JSON from SDK session response (may be embedded in markdown code blocks)
2. Parse with `JSON.parse()`
3. Validate with Zod schema
4. On failure: retry with explicit format instructions (one retry), then fail with structured error

### 4.5 Event Mapper (`server/src/sdk/event_mapper.ts`)

Maps SDK streaming events to frontend SSE event types:

| SDK Event | Frontend Event | Forwarded Data |
|-----------|---------------|----------------|
| `assistant.message_delta` | `agent_output` | `deltaContent` (text chunk) |
| `assistant.message` | `agent_message` | Full `content` |
| `assistant.turn_start` | `agent_turn_start` | Turn metadata |
| `assistant.turn_end` | `agent_turn_end` | Turn metadata |
| `tool.execution_start` | `tool_start` | `toolName`, `toolArgs` |
| `tool.execution_complete` | `tool_complete` | `toolName`, `toolResult` (truncated) |
| `subagent.started` | `subagent_started` | Agent name, description |
| `subagent.completed` | `subagent_completed` | Agent name, result summary |
| `assistant.usage` | `usage` | Token counts |
| `session.error` | `error` | Error message (sanitized) |
| `session.idle` | `session_idle` | Session ID |

**Filtering:** Only forward key events to SSE. Drop ephemeral deltas if client isn't subscribed
to the specific session (prevents overwhelming the single-stream SSE endpoint).

**Event persistence:** Persist to DB only: `tool.execution_start/complete`, `session.error`,
`assistant.usage`, `assistant.turn_end`. Deltas are ephemeral — not persisted.

### 4.6 Streaming Service (`server/src/services/stream_service.ts`)

Two streaming modes:

1. **Global SSE** (`GET /api/events/stream`) — existing endpoint, extended with SDK event types.
   Broadcasts pipeline status, agent status changes, and feature/task updates to all connected clients.

2. **Per-session SSE** (`GET /api/stream/:sessionId`) — **NEW** endpoint. Streams all SDK events
   for a specific session in real-time. Used by agent panel and chat panel for live output.

```typescript
// Per-session endpoint
app.get("/api/stream/:sessionId", auth_middleware(), async (c) => {
  const session_id = c.req.param("sessionId");
  // Verify user owns this session (via agent_runs table)
  // Subscribe to SDK session events
  // Forward via ReadableStream SSE
});
```

---

## §5 — Agent Execution Flows

### 5.1 Manager Flow (Feature Planning)

```
1. User submits feature (status: Submitted)
2. watcher_service detects Submitted feature (5s poll)
3. watcher_service calls sdk_session_service.plan_feature(feature_id)
4. sdk_session_service:
   a. Check concurrency limit (session_pool_service)
   b. Create CopilotClient (shared or per-user)
   c. Resolve traits + skills for feature
   d. Create SDK session:
      - sessionId: manager-{feature_id}-{timestamp}
      - model: feature.planning_model || "gpt-4.1"
      - customAgents: [manager, ralph, researcher]
      - agent: "manager"
      - hooks: build_hooks(feature_id, "manager")
      - skillDirectories: resolve_skill_dirs(feature_id)
   e. Insert agent_runs record (type: manager, status: running)
   f. Emit pipeline:status event
   g. Send prompt: build_manager_prompt(feature)
   h. Await response: session.sendAndWait()
   i. Parse tasks: output_parser.parse_manager_output(response)
   j. Insert tasks into DB
   k. Update feature status → In_Progress
   l. Disconnect session
   m. Emit feature:update event
5. If auto_approve: approve tasks → kick pipeline
```

### 5.2 Ralph Flow (Task Execution)

```
1. Task approved (status: Approved)
2. pipeline_service.process_next() picks next Approved task (by sort_order)
3. pipeline_service calls sdk_session_service.execute_task(task_id)
4. sdk_session_service:
   a. Check concurrency limit
   b. Create CopilotClient
   c. Resolve traits + skills for task
   d. Create SDK session:
      - sessionId: ralph-{task_id}-{timestamp}
      - model: task.model || feature.execution_model || "gpt-4.1"
      - customAgents: [manager, ralph, researcher]
      - agent: "ralph"
      - hooks: build_hooks(task_id, "ralph")
      - skillDirectories: resolve_skill_dirs(task_id)
   e. Insert agent_runs record (type: ralph, status: running)
   f. Update task status → In_Progress
   g. Emit task:update + pipeline:status events
   h. Send prompt: build_ralph_prompt(task)
   i. Await response: session.sendAndWait()
   j. Parse result: output_parser.parse_ralph_output(response)
   k. Update task result + status in DB
   l. Disconnect session
   m. Emit task:update event
   n. Check if feature complete → update feature status
5. pipeline_service.process_next() → next task (recursive via setTimeout(0))
```

### 5.3 Chat Flow

```
1. User sends message in chat panel
2. POST /api/chat/sessions/:id/messages
3. sdk_session_service.chat_send(session_id, message, model)
4. sdk_session_service:
   a. Check concurrency limit
   b. Create or resume SDK session:
      - Try: client.resumeSession(sdk_session_id)
      - Fallback: client.createSession({ sessionId, model, agent: "researcher" })
   c. Forward events to per-session SSE stream
   d. session.sendAndWait({ prompt: message })
   e. Store assistant response in chat_messages table
   f. Disconnect (or keep alive for multi-turn)
```

---

## §6 — Database Changes

### 6.1 Migration: Extend `agent_runs` Table

```sql
ALTER TABLE agent_runs
  ADD COLUMN sdk_session_id TEXT,
  ADD COLUMN events_persisted INTEGER DEFAULT 0,
  ADD COLUMN tokens_input INTEGER,
  ADD COLUMN tokens_output INTEGER;

-- Remove gemini-specific columns (if they exist)
ALTER TABLE agent_runs DROP COLUMN IF EXISTS cli;
ALTER TABLE agent_runs DROP COLUMN IF EXISTS execution_cli;
```

### 6.2 Migration: Create `audit_events` Table

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sdk_session_id TEXT NOT NULL,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'tool_call', 'permission_denied', 'error', 'session_start', 'session_end'
  tool_name TEXT,
  tool_args JSONB,
  tool_result_summary TEXT,  -- Truncated, never raw output
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_events_session ON audit_events(sdk_session_id);
CREATE INDEX idx_audit_events_run ON audit_events(agent_run_id);
```

### 6.3 Migration: Remove Gemini References

```sql
-- Remove gemini-related columns from features/tasks if they exist
ALTER TABLE features DROP COLUMN IF EXISTS planning_cli;
ALTER TABLE features DROP COLUMN IF EXISTS execution_cli;
ALTER TABLE tasks DROP COLUMN IF EXISTS execution_cli;
```

---

## §7 — Files to Create / Modify / Delete

### CREATE (new files)

| File | Purpose |
|------|---------|
| `server/src/sdk/client_factory.ts` | CopilotClient creation (shared + per-user) |
| `server/src/sdk/custom_agents.ts` | Agent definitions (manager, ralph, researcher) |
| `server/src/sdk/hooks.ts` | All 6 hook implementations |
| `server/src/sdk/event_mapper.ts` | SDK event → frontend event mapping |
| `server/src/sdk/output_parser.ts` | Zod-validated response parsing |
| `server/src/sdk/types.ts` | SDK-related TypeScript interfaces |
| `server/src/services/sdk_session_service.ts` | Session lifecycle, pool, plan/execute/chat |
| `server/src/services/session_pool_service.ts` | Concurrency control for SDK sessions |
| `server/src/services/session_watcher_service.ts` | Monitor SDK sessions, update DB |
| `server/src/services/audit_service.ts` | Hook-based audit logging |
| `server/src/services/stream_service.ts` | Per-session SSE event forwarding |
| `agents/prompts/researcher.md` | Researcher agent system prompt |
| `supabase/supabase/migrations/YYYYMMDDHHMMSS_copilot_sdk_migration.sql` | DB schema changes |

### MODIFY (adapt existing)

| File | Changes |
|------|---------|
| `server/src/routes/agents.ts` | Replace spawn routes with session creation routes |
| `server/src/routes/chat.ts` | Replace direct LLM calls with SDK sessions |
| `server/src/routes/events.ts` | Add per-session streaming, extend event types |
| `server/src/services/pipeline_service.ts` | Use SDK sessions instead of `spawn_agent()` |
| `server/src/services/watcher_service.ts` | Use SDK sessions for manager spawning |
| `server/src/services/prompt_service.ts` | Adapt for SDK custom agent prompt format |
| `server/src/services/trait_service.ts` | Adapt for hook-based injection |
| `server/src/services/skill_service.ts` | Adapt for SDK `skillDirectories` |
| `server/src/services/event_bus.ts` | Add new SDK event types |
| `server/src/index.ts` | Boot: CLI health monitor, remove container/workspace cleanup |
| `server/src/env.ts` | Add `CLI_URL`, `CLI_PORT`; remove `COPILOT_BIN`, `GEMINI_BIN` |
| `server/package.json` | Add `@github/copilot-sdk` dependency |
| `agents/prompts/manager.md` | Remove filesystem I/O references, adapt for SDK format |
| `agents/prompts/ralph.md` | Remove filesystem I/O references, adapt for SDK format |
| `web/src/lib/api/client.ts` | Update API client for new agent routes |
| `web/src/lib/types/index.ts` | Update TypeScript interfaces for new event types |

### DELETE (remove entirely)

| File | Reason |
|------|--------|
| `server/src/services/spawn_agent.ts` | Replaced by SDK sessions |
| `server/src/services/spawn_utils.ts` | No manual env building needed |
| `server/src/services/container_service.ts` | No Docker agent containers |
| `server/src/services/chat_service.ts` | Merged into `sdk_session_service` |
| `server/src/services/manager_output.ts` | Replaced by `sdk/output_parser.ts` |
| `agents/scripts/spawn-manager.sh` | Replaced by SDK sessions |
| `agents/scripts/spawn-ralph.sh` | Replaced by SDK sessions |

---

## §8 — Environment & Configuration

### Remove

```
COPILOT_BIN          # No longer resolving CLI binary path
GEMINI_BIN           # Gemini removed entirely
WORKSPACE_DIR        # No filesystem workspaces
```

### Add

```
CLI_URL=localhost:4321              # Headless CLI server address
CLI_PORT=4321                       # CLI server port (for health checks)
SDK_SESSION_TIMEOUT_MS=1800000      # 30min idle timeout (matches CLI default)
SDK_MAX_CONCURRENT_SESSIONS=5       # Concurrent session limit
SDK_TELEMETRY_ENDPOINT=             # Optional OTLP endpoint
```

### Keep (adapted)

```
MAX_CONCURRENT_AGENTS=3             # Maps to SDK session concurrency (rename to SDK_MAX_CONCURRENT_SESSIONS)
COPILOT_GITHUB_TOKEN                # Used as environment token for shared CLI server
```

### Zod Schema Update

```typescript
const env_schema = z.object({
  // ... existing fields ...
  CLI_URL: z.string().default('localhost:4321'),
  CLI_PORT: z.coerce.number().default(4321),
  SDK_SESSION_TIMEOUT_MS: z.coerce.number().default(1_800_000),
  SDK_MAX_CONCURRENT_SESSIONS: z.coerce.number().default(5),
  SDK_TELEMETRY_ENDPOINT: z.string().optional(),
});
```

---

## §9 — Downstream Impact Search

The implementing agent **MUST** search for and address ALL references to the old system.
Run each of these searches and address every result:

```bash
# CLI spawn references (core removal target)
grep -rn 'Bun.spawn\|spawn_agent\|spawn_manager\|spawn_ralph\|COPILOT_BIN\|GEMINI_BIN' server/src/

# Gemini references (complete removal)
grep -rn 'gemini' server/src/ agents/

# Container references (complete removal)
grep -rn 'container_service\|Dockerfile.agent\|docker.*agent\|ralph-agent-base' server/src/ .github/

# Workspace filesystem references (complete removal)
grep -rn 'feature-spec\.json\|tasks\.json\|progress\.json\|workspace_dir\|WORKSPACE_DIR' server/src/ agents/

# CLI column/enum references
grep -rn "cli.*copilot\|cli.*gemini\|execution_cli\|planning_cli" server/src/

# Direct LLM API calls (to be replaced)
grep -rn 'ANTHROPIC_API_KEY\|OPENAI_API_KEY\|GEMINI_API_KEY\|openai\|anthropic\|@google' server/src/

# Frontend agent-related code (needs updating)
grep -rn 'spawn_manager\|spawn_ralph\|agent.*logs\|pipeline.*status' web/src/

# Import references to deleted services
grep -rn "from.*spawn_agent\|from.*spawn_utils\|from.*container_service\|from.*chat_service\|from.*manager_output" server/src/
```

---

## §10 — Resolved Design Decisions

These were open questions in the plan-plan (§12). All are now resolved:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Session-per-request vs session-per-feature | **One session per agent run** (create → send → get result → disconnect) | Matches current atomic execution model. Simpler lifecycle. No need for multi-turn within a single agent run. |
| 2 | Chat migration | **SDK sessions for chat** | Consistency with agent execution. Gets hooks/streaming for free. Enables researcher agent for chat. |
| 3 | Trait injection point | **Global traits at `onSessionStart`; task-specific traits at `onUserPromptSubmitted`** | Global context is stable per session. Task-specific traits may vary if session is reused (chat). |
| 4 | Event persistence | **Persist key events only** (tool calls, errors, completions, usage). Deltas are ephemeral. | Balance between auditability and storage. Deltas can be 100x the volume of key events. |
| 5 | Session cleanup | **30min SDK idle timeout + daily DB cleanup of records > 7 days** | Matches SDK default. DB cleanup mirrors existing `cleanup_old_workspaces(7)` pattern. |
| 6 | CLI server sharing | **Single shared CLI server** with environment-level token | Pi has limited RAM. Per-user CLI instances are too resource-heavy. Per-user tokens are a future enhancement via OAuth. |
| 7 | MCP server integration | **Defer to Phase 2** — start with built-in tools only | Reduces scope. MCP adds complexity (subprocess management, timeout handling). Built-in tools cover current needs. |

---

## §11 — Systemd Service Configuration

### Headless CLI Server

```ini
# /etc/systemd/system/copilot-cli.service
[Unit]
Description=Copilot CLI Headless Server
After=network.target

[Service]
Type=simple
ExecStart=/home/scoy/.local/bin/copilot --headless --port 4321
Environment=COPILOT_GITHUB_TOKEN=<token>
Restart=always
RestartSec=5
User=scoy
WorkingDirectory=/home/scoy

[Install]
WantedBy=multi-user.target
```

### Deploy Pipeline Update

The existing `.github/workflows/deploy-pi.yml` must be updated to:
1. Restart `copilot-cli.service` if the copilot binary is updated
2. Remove Docker image build steps for `ralph-agent-base`
3. Remove container cleanup steps

---

## §12 — Testing Strategy

### Unit Tests

| Test | What it Validates |
|------|------------------|
| `sdk/output_parser.test.ts` | Manager task parsing, Ralph result parsing, malformed input handling |
| `sdk/hooks.test.ts` | Permission decisions per agent type, trait injection, secret redaction |
| `sdk/event_mapper.test.ts` | SDK event → frontend event mapping, filtering, truncation |
| `sdk/client_factory.test.ts` | Client creation with/without token, health check |
| `services/session_pool_service.test.ts` | Concurrency limits, queue behavior, callback wake |
| `services/sdk_session_service.test.ts` | Plan/execute/chat flows with mock CopilotClient |

### Integration Tests

| Test | What it Validates |
|------|------------------|
| CLI health check | `client.ping()` returns truthy against running CLI server |
| Session lifecycle | Create → send → receive → disconnect (against real CLI) |
| Session persistence | Create → disconnect → resume (against real CLI with disk state) |
| Custom agent selection | Manager agent gets read-only tools; Ralph gets full tools |
| Streaming events | `session.on()` receives expected event types |

### E2E Test Updates

| Existing Test | Required Changes |
|---------------|-----------------|
| `agent-execution.test.ts` | Update for SDK-based agent spawning, new API routes |
| `chat.test.ts` | Update for SDK-based chat, new streaming format |

### Manual Verification Checklist

- [ ] Feature planning: submit feature → manager plans → tasks created
- [ ] Task execution: approve task → ralph executes → task completes
- [ ] Real-time streaming: agent output appears in UI as it happens
- [ ] Chat: send message → researcher responds → response stored
- [ ] Error recovery: kill CLI server → verify health check alerts → restart → verify recovery
- [ ] Concurrency: submit 6 tasks → verify only 5 run concurrently, 6th queues
- [ ] Pipeline workflow: submit → plan → approve → execute → complete (full E2E)

---

## §13 — Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| SDK incompatible with Bun | Blocks entire migration | Medium | **Test in Phase 1.** If incompatible: (a) try `bun --bun` flag for Node compat, (b) run server on Node.js instead of Bun, (c) use SDK's Go variant with sidecar. |
| CLI binary not available for ARM64 | Blocks production deploy | Low-Medium | **Verify in Phase 1.** Fallback: run CLI on x86 server, connect via TCP. Or use Rosetta/QEMU emulation. |
| SDK session memory leak | Server crashes under load | Low | Aggressive session cleanup (30min timeout). Monitor via `client.listSessions()` count. Alert if count exceeds 2x max concurrent. |
| Token expiration mid-session | Session fails silently | Medium | `onErrorOccurred` hook detects auth errors. Return structured error to frontend. User re-authenticates. |
| Streaming event volume overwhelms frontend | UI freezes | Medium | Event mapper filters to key events only. Debounce deltas (100ms). Frontend discards events for non-visible sessions. |
| Manager output unparseable | Tasks not created | Medium | Zod validation with structured error. One retry with explicit format instructions. Fallback: mark feature as failed with parse error details. |
| Server restart loses active sessions | In-progress work lost | High (by design) | Boot reconciliation: mark `running` agent_runs as `failed`. SDK sessions persist on disk — can be resumed. Reset In_Progress tasks to Approved for re-execution. |

---

## §14 — Bun Compatibility Investigation

The `@github/copilot-sdk` is a Node.js package. Before any implementation:

1. `bun add @github/copilot-sdk` — does it install?
2. `import { CopilotClient } from "@github/copilot-sdk"` — does it resolve?
3. `new CopilotClient({ cliUrl: "localhost:4321" })` — does TCP connection work from Bun?
4. `session.on(event => ...)` — does streaming work?
5. Run existing server tests after adding the dependency — any breakage?

**If Bun is incompatible:**
- Option A: Use `bun --bun` Node.js compatibility mode
- Option B: Switch server runtime to Node.js (significant change)
- Option C: Use SDK's Go variant as a sidecar process
- Option D: Implement JSON-RPC protocol directly (high effort, last resort)

---

## §15 — ARM64 (Raspberry Pi) Verification

1. Check if `copilot` binary is available for `linux/arm64`
2. Test `copilot --headless --port 4321` on Pi
3. Measure memory footprint of idle headless CLI server
4. Measure memory footprint under load (5 concurrent sessions)
5. Verify session state persistence on Pi filesystem
6. Test TCP connection from Bun server to headless CLI on same host

---

## §16 — Execution Order (Phases)

### Phase 1: Research & Validation (blocking)

**Goal:** Verify SDK works on Bun + ARM64 before investing in migration.

1. Install `@github/copilot-sdk` in server workspace
2. Verify Bun compatibility (import, TCP connection, streaming)
3. Verify `copilot --headless` on ARM64 Pi (if access available)
4. Write a minimal proof-of-concept: create session → send prompt → get response
5. Measure memory footprint

**Exit criteria:** SDK imports, connects, and streams responses in Bun on the target platform.

### Phase 2: Core SDK Layer

**Goal:** Build the integration layer without touching existing services.

1. Create `server/src/sdk/types.ts` — interfaces for SDK integration
2. Create `server/src/sdk/client_factory.ts` — client creation + health monitoring
3. Create `server/src/sdk/custom_agents.ts` — agent definitions loaded from prompts
4. Create `server/src/sdk/hooks.ts` — all 6 hook implementations
5. Create `server/src/sdk/output_parser.ts` — Zod-validated response parsing
6. Create `server/src/sdk/event_mapper.ts` — event type mapping
7. Write unit tests for each module

**Exit criteria:** All SDK modules pass unit tests with mock CopilotClient.

### Phase 3: Service Migration

**Goal:** Replace services one by one, testing each transition.

1. Create `server/src/services/session_pool_service.ts` — concurrency control
2. Create `server/src/services/sdk_session_service.ts` — main service (plan, execute, chat)
3. Create `server/src/services/audit_service.ts` — hook-based logging
4. Create `server/src/services/stream_service.ts` — per-session SSE
5. Adapt `pipeline_service.ts` — use SDK sessions instead of `spawn_agent()`
6. Adapt `watcher_service.ts` → `session_watcher_service.ts`
7. Adapt `prompt_service.ts` → `agent_prompt_service.ts`
8. Adapt `trait_service.ts` — hook-based injection
9. Adapt `skill_service.ts` — `skillDirectories` integration

**Exit criteria:** Pipeline workflow works end-to-end with SDK sessions.

### Phase 4: Route Migration

**Goal:** Update API routes to use new services.

1. Update `routes/agents.ts` — new session-based endpoints
2. Update `routes/chat.ts` — SDK-based chat
3. Update `routes/events.ts` — extended event types + per-session streaming
4. Update `env.ts` — new env vars, remove old ones
5. Update `index.ts` — boot sequence (CLI health, remove container/workspace)

**Exit criteria:** All API routes work with new services. Old routes removed.

### Phase 5: Database Migration

**Goal:** Schema changes for SDK integration.

1. Create migration file: extend `agent_runs`, create `audit_events`, remove gemini columns
2. Test migration against local Supabase container
3. Verify migration in deploy pipeline

**Exit criteria:** Migration applies cleanly. Schema matches new service expectations.

### Phase 6: Cleanup & Deletion

**Goal:** Remove all dead code and references.

1. Delete: `spawn_agent.ts`, `spawn_utils.ts`, `container_service.ts`, `chat_service.ts`, `manager_output.ts`
2. Delete: `agents/scripts/spawn-manager.sh`, `agents/scripts/spawn-ralph.sh`
3. Run downstream impact search (§9) — fix all remaining references
4. Remove gemini references from entire codebase
5. Update frontend API client and types
6. Remove `Dockerfile.agent` if it exists

**Exit criteria:** `grep -rn 'gemini\|spawn_agent\|container_service\|COPILOT_BIN\|GEMINI_BIN' server/src/` returns zero results.

### Phase 7: Testing & Verification

**Goal:** Comprehensive validation before merge.

1. Type check: `cd server && bun run --bun tsc --noEmit` (0 errors)
2. Type check: `cd web && bun run check` (0 errors)
3. Unit tests: `cd server && bun test` (all pass)
4. E2E tests: update and run `bun run test:e2e`
5. Manual verification against live deployment
6. CI pipeline green

**Exit criteria:** All checks pass. Pipeline workflow verified end-to-end.

---

## §17 — Security Considerations

### Token Handling
- `COPILOT_GITHUB_TOKEN` is a server-level secret — never exposed to frontend
- Per-user GitHub OAuth tokens (future) stored in DB, passed only to CopilotClient
- `onPostToolUse` hook scans tool results for secret patterns and redacts them
- Build explicit env allowlist for any subprocess the CLI spawns (same pattern as current `build_agent_env()`)

### Tool Permissions
- Manager and Researcher agents are read-only (no `edit`, `bash`, `create`)
- Ralph agent has full tool access — monitored via `onPreToolUse` audit logging
- All tool calls logged to `audit_events` table with session ID, tool name, and truncated args

### Network Security
- CLI server binds to localhost only (not exposed externally)
- TCP connection between Hono API and CLI is local — no TLS needed
- Existing auth middleware (`auth_middleware`) protects all API routes
- Session ownership verified by checking `agent_runs.user_id` (or feature/task ownership)

### Prompt Injection Defense
- User-supplied content in agent prompts delimited with `<user_input>` tags
- Agent output validated with Zod before DB insertion
- `onUserPromptSubmitted` hook can filter or sanitize user prompts

---

## §18 — Observability

### Health Signals
- CLI server health: `client.ping()` every 30s → log + alert on failure
- Active session count: `client.listSessions().length` → metric
- Session duration: `agent_runs.started_at` → `agent_runs.finished_at` → histogram
- Token usage: `assistant.usage` events → `agent_runs.tokens_input/tokens_output`

### Logging
- Session lifecycle: `logger.info('SDK session created/completed/failed', { session_id, agent_type, feature_id/task_id })`
- Tool calls: `logger.debug('Tool call', { session_id, tool_name })` (via audit hook)
- Errors: `logger.error('SDK session error', { session_id, error, recoverable })`

### OpenTelemetry (optional, Phase 2)
```typescript
const client = new CopilotClient({
  cliUrl: env.CLI_URL,
  telemetry: env.SDK_TELEMETRY_ENDPOINT
    ? { otlpEndpoint: env.SDK_TELEMETRY_ENDPOINT }
    : undefined,
});
```

---

## §19 — Skills for the Implementing Agent

The implementing agent **MUST** invoke and follow these skills throughout execution:

| Skill | When to Use | Why |
|-------|------------|-----|
| `copilot-sdk` | **Every phase.** Read all docs in the routing table, especially `getting-started`, `backend-services`, `custom-agents`, `hooks/*`, `streaming-events`, `session-persistence`, `scaling`. | Primary integration reference. SDK API surface, patterns, and gotchas. |
| `meta-engineer` | **Before each phase.** Foundation: `core`, `constraints`. Scenario: `integration`. Domains: `architecture`, `dependencies`, `error-handling`, `reliability`, `state-and-data`, `observability`, `security`. | Engineering rigor framework. Ensures invariants, failure handling, and state model are correct at every step. |
| `hono-backend-architect` | **Phases 2-4.** When creating/modifying routes, middleware, services, and Zod schemas. | Hono patterns: middleware factories, `AppBindings`, Zod validation, error boundaries, `snake_case` naming. |
| `agent-instructor` | **Phase 2.** When writing/adapting custom agent prompts (`manager.md`, `ralph.md`, `researcher.md`). | Prompt engineering: objective clarity, context completeness, constraint specification, output format. |
| `supabase-postgres-best-practices` | **Phase 5.** When writing migrations and modifying DB queries. | Postgres patterns: index design, migration safety, query optimization. |

### Skill Usage Protocol

For each phase, the implementing agent should:

1. **Before starting:** Read the relevant meta-engineer foundation and scenario files
2. **During implementation:** Follow hono-backend-architect patterns for all backend code
3. **When writing prompts:** Apply agent-instructor framework for prompt quality
4. **When touching DB:** Consult supabase-postgres-best-practices
5. **For any SDK question:** Read the specific copilot-sdk reference doc (don't guess API surface)
6. **Before marking done:** Run meta-engineer self-review checklist

---

## §20 — Validation Criteria (Definition of Done)

### Must-Have (Phase 7 gate)

- [ ] `@github/copilot-sdk` installed and imports successfully in Bun
- [ ] Headless CLI server starts on port 4321 and responds to `client.ping()`
- [ ] CopilotClient connects to headless CLI over TCP from Bun runtime
- [ ] Manager custom agent produces valid task breakdowns (Zod-validated)
- [ ] Ralph custom agent executes tasks and reports results (Zod-validated)
- [ ] All 6 hooks fire correctly with expected behavior
- [ ] Streaming events forwarded to frontend via SSE
- [ ] Concurrent session limits enforced (queuing works)
- [ ] All `agent_runs` tracked in database with `sdk_session_id`, tokens, duration
- [ ] Audit trail recorded for all tool calls in `audit_events` table
- [ ] Error recovery: CLI restart → sessions resume or re-create cleanly
- [ ] ALL gemini references removed from codebase
- [ ] ALL CLI spawn references (`Bun.spawn`, `spawn_agent`, shell scripts) removed
- [ ] ALL Docker agent container references removed
- [ ] Type checking passes: `cd server && bun run --bun tsc --noEmit` (0 errors)
- [ ] Type checking passes: `cd web && bun run check` (0 errors)
- [ ] Unit tests pass: `cd server && bun test`
- [ ] E2E tests updated and passing
- [ ] Pipeline workflow (submit → plan → approve → execute → complete) works end-to-end
- [ ] Chat works via SDK sessions
- [ ] Lint passes: `bun run lint`
- [ ] CI pipeline green after push

### Nice-to-Have (can defer)

- [ ] Per-user GitHub OAuth token integration
- [ ] MCP server integration (filesystem, GitHub)
- [ ] OpenTelemetry tracing
- [ ] Session persistence across server restarts (resume vs re-create)
- [ ] Researcher agent accessible via chat
