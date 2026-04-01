# PLAN-PLAN: Copilot SDK Backend Migration

> **What this document is:** Instructions for a future agent to create the detailed implementation plan
> for migrating Ralph's backend from CLI-based agent spawning to the @github/copilot-sdk.
>
> **What this document is NOT:** The implementation plan itself. Do not start coding from this document.

---

## §1 — Objective

**Problem:** The current agent system spawns copilot/gemini CLI processes via shell scripts (`agents/scripts/spawn-manager.sh`, `agents/scripts/spawn-ralph.sh`). This is fragile, has no streaming, no session persistence, no hooks for auditing/permissions, and ties the system to filesystem-based I/O (feature-spec.json → tasks.json, task-spec.json → progress.json). Gemini CLI is being removed entirely.

**Target:** Replace the entire agent execution layer with `@github/copilot-sdk`, which provides:
- Headless CLI server (persistent process, TCP connection)
- Session management (create, resume, persist, delete)
- Custom agents with scoped tools and prompts (manager, ralph, researcher)
- Hooks for permissions, auditing, error handling, prompt enrichment
- 40+ streaming event types for real-time UI updates
- MCP server integration for external tools
- Skills (reusable prompt modules) loaded from directories
- OpenTelemetry observability
- Per-user GitHub OAuth token integration (token from auth system → SDK)

**Gemini CLI:** Remove ALL gemini references. The `cli` and `execution_cli` columns, GEMINI_BIN env var, gemini spawn logic — all gone.

---

## §2 — Required Skills

The implementing agent **MUST** invoke and follow these skills:

| Skill | Why |
|-------|-----|
| `copilot-sdk` | **PRIMARY.** Read the ENTIRE routing table. Every doc in `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/` is relevant. |
| `meta-engineer` | Foundation: core, constraints. Scenarios: integration (SDK is external system), new-feature (new capabilities). Domains: architecture, reliability, error-handling, state-and-data, observability, dependencies. |
| `hono-backend-architect` | For Hono route patterns, middleware injection, service architecture, Zod validation. |
| `agent-instructor` | For writing custom agent prompts (manager, ralph, researcher). Dense, execution-ready instructions. |

---

## §3 — Required Research Before Planning

The implementing agent must read and understand ALL of these before writing any plan:

### Copilot SDK Documentation (read in this order)
1. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/getting-started.md` — Core patterns
2. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/setup/backend-services.md` — Headless CLI, cliUrl pattern
3. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/setup/github-oauth.md` — Per-user token integration
4. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/setup/scaling.md` — Session isolation, concurrency, multi-tenancy
5. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/features/custom-agents.md` — Agent definitions, tool scoping, sub-agent events
6. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/features/hooks.md` — All 6 hook types with examples
7. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/hooks/pre-tool-use.md` — Permission control
8. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/hooks/post-tool-use.md` — Result transformation
9. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/hooks/user-prompt-submitted.md` — Prompt enrichment
10. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/hooks/session-lifecycle.md` — Start/end hooks
11. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/hooks/error-handling.md` — Error recovery
12. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/features/streaming-events.md` — All 40+ event types
13. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/features/mcp.md` — MCP server integration
14. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/features/skills.md` — Skill directories
15. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/features/session-persistence.md` — Resume across restarts
16. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/features/steering-and-queueing.md` — Message delivery
17. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/observability/opentelemetry.md` — Telemetry
18. `/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/auth/index.md` — Auth method priority

### Current Codebase (understand before replacing)
- `server/src/services/agent_service.ts` — Current spawn logic, process tracking
- `server/src/services/pipeline_service.ts` — Task queue orchestration
- `server/src/services/spawn_agent.ts` — CLI execution, output parsing
- `server/src/services/spawn_utils.ts` — Environment building, path resolution
- `server/src/services/watcher_service.ts` — Feature completion monitoring
- `server/src/services/agent_concurrency.ts` — Max concurrent agents (3), callback wake
- `server/src/services/container_service.ts` — Docker agent containers
- `server/src/services/chat_service.ts` — Direct LLM API calls for chat
- `server/src/services/prompt_service.ts` — Prompt resolution with trait/skill injection
- `server/src/services/trait_service.ts` — Trait inheritance (global→project→feature→task)
- `server/src/services/skill_service.ts` — Filesystem skill discovery
- `server/src/routes/agents.ts` — Agent spawn/status/stop API routes
- `server/src/routes/chat.ts` — Chat session/message routes
- `server/src/routes/events.ts` — SSE event stream
- `agents/prompts/manager.md` — Manager agent system prompt
- `agents/prompts/ralph.md` — Ralph agent system prompt
- `agents/scripts/spawn-manager.sh` — Manager spawn script
- `agents/scripts/spawn-ralph.sh` — Ralph spawn script

---

## §4 — Architecture: Current → Target Mapping

### Infrastructure Layer

| Current | Target |
|---------|--------|
| copilot CLI binary at COPILOT_BIN | Headless CLI server: `copilot --headless --port 4321` |
| gemini CLI binary at GEMINI_BIN | **REMOVED** |
| Shell scripts (spawn-manager.sh, spawn-ralph.sh) | **REMOVED** — SDK creates sessions directly |
| Docker agent containers (Dockerfile.agent) | **REMOVED** — SDK manages execution |
| Filesystem workspaces (feature-spec.json, tasks.json, progress.json) | SDK session state at `~/.copilot/session-state/` |
| Environment allowlist via build_agent_env() | SDK handles its own env; explicit config via CopilotClient options |

### Service Layer Migration

| Current Service | Target | Notes |
|----------------|--------|-------|
| `agent_service.ts` | `sdk_session_service.ts` | Creates CopilotClient per user, manages sessions, custom agents |
| `pipeline_service.ts` | `pipeline_service.ts` (simplified) | Queue logic stays, but spawning uses SDK sessions instead of CLI |
| `spawn_agent.ts` | **DELETE** | Replaced by SDK session.sendAndWait() |
| `spawn_utils.ts` | **DELETE** | No more manual env building |
| `container_service.ts` | **DELETE** | No more Docker agent containers |
| `watcher_service.ts` | `session_watcher_service.ts` | Monitor SDK session events instead of polling filesystem |
| `agent_concurrency.ts` | `session_pool_service.ts` | Concurrency via SDK session limits |
| `chat_service.ts` | **MERGE** into sdk_session_service | Chat uses SDK sessions too |
| `prompt_service.ts` | `agent_prompt_service.ts` | Prompts become SDK custom agent definitions + skill directories |
| `trait_service.ts` | Keep, adapt | Traits injected via onSessionStart / onUserPromptSubmitted hooks |
| `skill_service.ts` | Keep, adapt | Skills become SDK skillDirectories |

### Route Changes

| Current Route | Target | Notes |
|---------------|--------|-------|
| `POST /api/agents/spawn-manager` | `POST /api/agents/plan` | Creates SDK session with manager custom agent |
| `POST /api/agents/spawn-ralph` | `POST /api/agents/execute` | Creates SDK session with ralph custom agent |
| `GET /api/agents/status` | `GET /api/agents/sessions` | Lists active SDK sessions |
| `POST /api/agents/stop/:id` | `POST /api/agents/sessions/:id/stop` | Disconnects SDK session |
| `GET /api/agents/logs/:id` | `GET /api/agents/sessions/:id/events` | Streams SDK session events |
| `POST /api/chat/sessions` | `POST /api/chat/sessions` | Creates SDK session for chat |
| `POST /api/chat/sessions/:id/messages` | `POST /api/chat/sessions/:id/messages` | Sends via SDK session |
| `GET /api/events` (SSE) | `GET /api/stream/:sessionId` (SSE/WS) | Per-session event streaming from SDK |

---

## §5 — Copilot SDK Integration Design

### 5.1 Headless CLI Server

```bash
# systemd service: copilot-cli.service
copilot --headless --port 4321
# Env: COPILOT_GITHUB_TOKEN for server-level auth (if needed)
# Per-user auth via githubToken on CopilotClient
```

- Must run as persistent service on Pi (ARM64)
- Health monitoring: periodic `client.getStatus()` checks
- Auto-restart on failure (systemd Restart=always)
- Separate instances for prod (port 4321) and test (port 4322)
- Session state volume: `~/.copilot/session-state/` (persistent storage)

### 5.2 Per-User Client Creation

```typescript
// From GitHub OAuth — user's token stored in DB
function create_client_for_user(github_token: string): CopilotClient {
  return new CopilotClient({
    cliUrl: process.env.CLI_URL || "localhost:4321",
    githubToken: github_token,
    useLoggedInUser: false,
  });
}
```

### 5.3 Custom Agent Definitions

```typescript
const CUSTOM_AGENTS = [
  {
    name: "manager",
    displayName: "Feature Planner",
    description: "Analyzes feature requirements and breaks them into ordered, dependency-aware coding tasks",
    tools: ["grep", "glob", "view"],  // READ-ONLY
    prompt: MANAGER_PROMPT,  // Loaded from agents/prompts/manager.md
    infer: false,  // Explicitly selected, not auto-inferred
  },
  {
    name: "ralph",
    displayName: "Task Executor",
    description: "Executes individual coding tasks — writes code, runs tests, verifies results",
    tools: ["view", "edit", "bash", "grep", "glob"],  // WRITE ACCESS
    prompt: RALPH_PROMPT,  // Loaded from agents/prompts/ralph.md
    infer: false,
  },
  {
    name: "researcher",
    displayName: "Code Researcher",
    description: "Explores codebases, finds patterns, answers architectural questions",
    tools: ["grep", "glob", "view"],  // READ-ONLY
    prompt: RESEARCHER_PROMPT,
    infer: true,  // Can be auto-selected for research questions
  },
];
```

### 5.4 Hooks Design

```typescript
const hooks = {
  onSessionStart: async (input, invocation) => {
    // Inject project context, resolved traits, feature/task spec
    const context = await resolve_session_context(invocation.sessionId);
    return { additionalContext: context };
  },
  
  onUserPromptSubmitted: async (input, invocation) => {
    // Enrich prompt with traits and skills
    const traits = await trait_service.resolve_for_session(invocation.sessionId);
    const enriched = inject_traits(input.prompt, traits);
    return { modifiedPrompt: enriched };
  },
  
  onPreToolUse: async (input, invocation) => {
    // Audit logging + permission control
    await audit_service.log_tool_call(invocation.sessionId, input.toolName, input.toolArgs);
    // Manager: read-only tools only
    // Ralph: full access
    return { permissionDecision: "allow" };
  },
  
  onPostToolUse: async (input, invocation) => {
    // Secret redaction, artifact tracking
    const redacted = redact_secrets(input.toolResult);
    if (redacted !== input.toolResult) return { modifiedResult: redacted };
    return null;
  },
  
  onSessionEnd: async (input, invocation) => {
    // Record completion in DB, extract results, update feature/task status
    await finalize_session(invocation.sessionId, input);
  },
  
  onErrorOccurred: async (input) => {
    // Log errors, retry transient failures, notify user
    if (input.recoverable) return { errorHandling: "retry", retryCount: 3 };
    return { userNotification: friendly_error(input.error) };
  },
};
```

### 5.5 Streaming Event Forwarding

```typescript
// Per-session SSE/WebSocket endpoint
app.get("/api/stream/:sessionId", async (c) => {
  const session = session_pool.get(c.req.param("sessionId"));
  // Forward SDK events to client via SSE
  session.on((event) => {
    switch (event.type) {
      case "assistant.message_delta":
        sse.send({ type: "agent_output", data: event.data.deltaContent });
        break;
      case "tool.execution_start":
        sse.send({ type: "tool_start", data: { tool: event.data.toolName } });
        break;
      case "tool.execution_complete":
        sse.send({ type: "tool_complete", data: event.data });
        break;
      case "subagent.started":
        sse.send({ type: "agent_started", data: event.data });
        break;
      case "assistant.usage":
        sse.send({ type: "usage", data: event.data });
        break;
      case "session.error":
        sse.send({ type: "error", data: event.data });
        break;
    }
  });
});
```

### 5.6 Manager Agent Flow (SDK-based)

```typescript
async function plan_feature(feature_id: string, user_token: string) {
  const feature = await db.get_feature(feature_id);
  const client = create_client_for_user(user_token);
  
  const session = await client.createSession({
    sessionId: `manager-${feature_id}-${Date.now()}`,
    model: feature.planning_model || "gpt-4.1",
    streaming: true,
    customAgents: CUSTOM_AGENTS,
    agent: "manager",  // Pre-select manager
    hooks: build_hooks(feature_id, "manager"),
    skillDirectories: resolve_skill_dirs(feature_id),
  });
  
  // Track in DB
  await db.create_agent_session({ feature_id, session_id: session.sessionId, type: "manager" });
  
  // Send feature spec as prompt
  const response = await session.sendAndWait({
    prompt: build_manager_prompt(feature),
  });
  
  // Parse tasks from response
  const tasks = parse_tasks_from_response(response);
  await db.create_tasks(feature_id, tasks);
  await db.update_feature_status(feature_id, "In_Progress");
  
  await session.disconnect();
}
```

### 5.7 Ralph Agent Flow (SDK-based)

```typescript
async function execute_task(task_id: string, user_token: string) {
  const task = await db.get_task_with_feature(task_id);
  const client = create_client_for_user(user_token);
  
  const session = await client.createSession({
    sessionId: `ralph-${task_id}-${Date.now()}`,
    model: task.model || task.feature.execution_model || "gpt-4.1",
    streaming: true,
    customAgents: CUSTOM_AGENTS,
    agent: "ralph",  // Pre-select ralph
    hooks: build_hooks(task_id, "ralph"),
    skillDirectories: resolve_skill_dirs(task_id),
  });
  
  await db.update_task_status(task_id, "In_Progress");
  await db.create_agent_session({ task_id, session_id: session.sessionId, type: "ralph" });
  
  const response = await session.sendAndWait({
    prompt: build_ralph_prompt(task),
  });
  
  const result = parse_ralph_result(response);
  await db.update_task_result(task_id, result);
  
  await session.disconnect();
}
```

---

## §6 — Files to Create / Modify / Delete

### CREATE (new files)
- `server/src/services/sdk_session_service.ts` — CopilotClient lifecycle, session pool
- `server/src/services/session_pool_service.ts` — Concurrency control for SDK sessions
- `server/src/services/session_watcher_service.ts` — Monitor session events, update DB
- `server/src/services/agent_prompt_service.ts` — Load and resolve prompts for SDK agents
- `server/src/services/audit_service.ts` — Hook-based audit logging
- `server/src/services/stream_service.ts` — Forward SDK events to SSE/WebSocket
- `server/src/sdk/client_factory.ts` — Per-user CopilotClient creation
- `server/src/sdk/custom_agents.ts` — Agent definitions (manager, ralph, researcher)
- `server/src/sdk/hooks.ts` — Hook implementations (permissions, audit, enrichment, redaction)
- `server/src/sdk/event_mapper.ts` — SDK event → frontend event mapping
- `server/src/sdk/output_parser.ts` — Parse structured output from SDK sessions (tasks, progress)

### MODIFY (adapt existing)
- `server/src/routes/agents.ts` — Replace spawn routes with session creation routes
- `server/src/routes/chat.ts` — Replace direct LLM calls with SDK sessions
- `server/src/routes/events.ts` — Replace current SSE with per-session streaming
- `server/src/services/pipeline_service.ts` — Use SDK sessions instead of CLI spawning
- `server/src/services/trait_service.ts` — Adapt for hook-based injection
- `server/src/services/skill_service.ts` — Adapt for SDK skillDirectories
- `server/src/index.ts` — Boot sequence: start CLI health monitor, remove container/workspace cleanup
- `server/src/env.ts` — Add CLI_URL, CLI_PORT; remove COPILOT_BIN, GEMINI_BIN
- `server/package.json` — Add `@github/copilot-sdk` dependency
- `agents/prompts/manager.md` — Adapt prompt for SDK custom agent format
- `agents/prompts/ralph.md` — Adapt prompt for SDK custom agent format

### DELETE (remove entirely)
- `server/src/services/spawn_agent.ts`
- `server/src/services/spawn_utils.ts`
- `server/src/services/container_service.ts`
- `server/src/services/chat_service.ts` (merged into sdk_session_service)
- `server/src/services/manager_output.ts` (replaced by output_parser.ts)
- `agents/scripts/spawn-manager.sh`
- `agents/scripts/spawn-ralph.sh`
- `server/Dockerfile.agent`
- Any gemini-related files or references

---

## §7 — Environment & Configuration Changes

### Remove
```
COPILOT_BIN=/home/scoy/.local/bin/copilot
GEMINI_BIN=/home/scoy/.local/bin/gemini
WORKSPACE_DIR=/workspace
```

### Add
```
CLI_URL=localhost:4321              # Headless CLI server address
CLI_PORT=4321                       # CLI server port (for health checks)
SDK_SESSION_TIMEOUT_MS=1800000      # 30min idle timeout
SDK_MAX_CONCURRENT_SESSIONS=5       # Concurrent session limit
SDK_TELEMETRY_ENDPOINT=             # Optional OTLP endpoint
```

### Keep (adapted)
```
MAX_CONCURRENT_AGENTS=3             # Maps to SDK session concurrency
```

---

## §8 — Downstream Impact Search

The implementing agent MUST search for and address ALL references to the old system:

```bash
# Find all CLI spawn references
grep -rn 'Bun.spawn\|spawn_agent\|spawn_manager\|spawn_ralph\|COPILOT_BIN\|GEMINI_BIN' server/src/
grep -rn 'gemini' server/src/ agents/

# Find all container references
grep -rn 'container_service\|Dockerfile.agent\|docker.*agent\|ralph-agent-base' server/src/ .github/

# Find all workspace filesystem references
grep -rn 'feature-spec\.json\|tasks\.json\|progress\.json\|workspace_dir\|WORKSPACE_DIR' server/src/ agents/

# Find all CLI column/enum references
grep -rn "cli.*copilot\|cli.*gemini\|execution_cli\|planning_cli" server/src/

# Find all direct LLM API calls (chat_service)
grep -rn 'ANTHROPIC_API_KEY\|OPENAI_API_KEY\|GEMINI_API_KEY\|openai\|anthropic\|@google' server/src/

# Find frontend agent-related code
grep -rn 'spawn_manager\|spawn_ralph\|agent.*logs\|pipeline.*status' web/src/
```

---

## §9 — Testing Strategy

### Unit Tests
- SDK session creation with mock CopilotClient
- Hook execution (permissions, audit, enrichment)
- Output parsing (tasks from manager, progress from ralph)
- Session pool concurrency limits
- Event mapping (SDK events → frontend events)

### Integration Tests
- Headless CLI server health check
- Session lifecycle (create → send → receive → disconnect)
- Session persistence (create → disconnect → resume)
- Custom agent selection and tool scoping
- Streaming event forwarding via SSE

### E2E Tests (update existing)
- `agent-execution.test.ts` — Adapt for SDK-based agent spawning
- `ux-redesign-workflow.test.ts` — Adapt for new agent routes
- `chat.test.ts` — Adapt for SDK-based chat

### Manual Verification
- Feature planning flow: submit feature → manager plans → tasks created
- Task execution flow: approve task → ralph executes → task completes
- Real-time streaming: agent output appears in UI as it happens
- Error recovery: kill CLI server → verify recovery
- Session resume: restart server → verify sessions resume

---

## §10 — Bun Compatibility Notes

The SDK is `@github/copilot-sdk` (Node.js package). Verify:
- Does it install with `bun install`?
- Does it work with Bun's Node.js compatibility layer?
- If not, document workarounds (e.g., Node.js polyfills, Bun-specific flags)
- Test SDK TCP connection from Bun runtime to headless CLI server

---

## §11 — Copilot CLI on ARM64 (Raspberry Pi)

The production server is a Raspberry Pi (ARM64). Verify:
- copilot CLI binary available for linux/arm64
- `copilot --headless --port 4321` runs on ARM64
- Performance acceptable for headless CLI server
- Memory footprint acceptable (Pi has limited RAM)

---

## §12 — Open Design Decisions

The implementing agent must resolve these:

1. **Session-per-request vs session-per-feature**: Should a manager get one session for the entire planning phase, or a new session per message? (Recommendation: one session per agent run — create, send, get result, disconnect)

2. **Chat migration**: Should chat sessions use the same CopilotClient pattern, or is direct LLM API access better for simple chat? (Recommendation: SDK sessions for consistency and to get hooks/streaming for free)

3. **Trait injection point**: Should traits be injected at session creation (additionalContext in onSessionStart) or per-message (onUserPromptSubmitted)? (Recommendation: session start for global traits, per-message for task-specific traits)

4. **Event persistence**: Should SDK streaming events be persisted to the DB for replay, or are they ephemeral? (Recommendation: persist key events only — tool calls, errors, completions — not every delta)

5. **Session cleanup**: How aggressively should old sessions be cleaned up? (Recommendation: 30min idle timeout from SDK + daily cleanup of DB records older than 7 days)

6. **CLI server sharing**: Single CLI server for all users (shared) or one per user? (Recommendation: shared, with per-user githubToken on each CopilotClient — per SDK scaling docs)

7. **MCP server integration**: Which MCP servers to include? (Recommendation: start with filesystem only, add GitHub MCP later)

---

## §13 — Validation Criteria (Definition of Done)

- [ ] `@github/copilot-sdk` installed and imports successfully in Bun
- [ ] Headless CLI server starts on port 4321 and responds to health checks
- [ ] CopilotClient connects to headless CLI over TCP
- [ ] Per-user GitHub OAuth tokens create working SDK sessions
- [ ] Manager custom agent produces valid task breakdowns
- [ ] Ralph custom agent executes tasks and reports results
- [ ] All 6 hooks fire correctly with expected behavior
- [ ] Streaming events forwarded to frontend via SSE
- [ ] Session persistence works across server restarts
- [ ] Concurrent session limits enforced
- [ ] All agent_runs tracked in database with tokens/duration/model
- [ ] Audit trail recorded for all tool calls
- [ ] Secret redaction working in post-tool hook
- [ ] Error recovery and retry logic functional
- [ ] ALL gemini references removed from codebase
- [ ] ALL CLI spawn references removed
- [ ] ALL Docker agent container references removed
- [ ] Type checking passes: `cd server && bun run --bun tsc --noEmit`
- [ ] Unit tests pass for new services
- [ ] E2E tests updated and passing
- [ ] Pipeline workflow (submit → plan → approve → execute → complete) works end-to-end
- [ ] Chat works via SDK sessions

---

## §14 — Execution Order

1. **Research phase**: Read all SDK docs listed in §3, understand current services in §3
2. **Infrastructure**: Set up headless CLI server, verify connectivity, test on ARM64
3. **Core SDK layer**: Implement client_factory, custom_agents, hooks, output_parser
4. **Service migration**: Replace services one by one per §4 mapping
5. **Route migration**: Update API routes per §4 mapping
6. **Streaming**: Implement event forwarding
7. **Cleanup**: Delete old files per §6, remove all gemini/CLI references per §8
8. **Testing**: Unit tests, integration tests, E2E updates
9. **Verification**: Full pipeline workflow, chat, streaming, error recovery
10. **Type check and lint**: Zero errors before commit

---

## §15 — Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SDK incompatible with Bun | Blocks entire migration | Test early in research phase; fallback: use Node.js for server |
| CLI binary not available for ARM64 | Blocks production deploy | Verify in infrastructure phase; fallback: x86 emulation or move to x86 server |
| SDK session memory leak | Server crashes under load | Implement aggressive session cleanup, monitor memory in production |
| Token expiration mid-session | Session fails silently | Implement token refresh in error hook, re-auth flow |
| Streaming event volume overwhelms frontend | UI freezes | Filter events, debounce deltas, only forward key events |
| Manager output unparseable | Tasks not created | Validate with Zod, retry with explicit format instructions, fallback to manual parsing |

---

## §16 — Reference Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Agent Panel  │  │  Chat Panel  │  │  Pipeline    │ │
│  │ (streaming)  │  │  (streaming) │  │  (queue)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │ SSE/WS          │ SSE/WS          │ REST    │
└─────────┼─────────────────┼─────────────────┼─────────┘
          │                 │                 │
┌─────────┼─────────────────┼─────────────────┼─────────┐
│         ▼                 ▼                 ▼         │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Hono API (port 3001)               │  │
│  │  ┌──────────┐ ┌────────────┐ ┌───────────────┐ │  │
│  │  │ Agent    │ │ Chat       │ │ Pipeline      │ │  │
│  │  │ Routes   │ │ Routes     │ │ Routes        │ │  │
│  │  └────┬─────┘ └─────┬──────┘ └───────┬───────┘ │  │
│  │       │              │                │         │  │
│  │  ┌────▼──────────────▼────────────────▼───────┐ │  │
│  │  │         SDK Session Service                │ │  │
│  │  │  - create_client_for_user(github_token)    │ │  │
│  │  │  - session pool + concurrency control      │ │  │
│  │  │  - hooks (audit, permissions, enrichment)  │ │  │
│  │  │  - event forwarding to SSE/WS              │ │  │
│  │  └────────────────────┬───────────────────────┘ │  │
│  └───────────────────────┼─────────────────────────┘  │
│                          │ TCP (cliUrl)                │
│  ┌───────────────────────▼───────────────────────┐    │
│  │     Copilot CLI (headless, port 4321)         │    │
│  │  - Session management                         │    │
│  │  - Tool execution                             │    │
│  │  - Model API calls (via GitHub Copilot)       │    │
│  └───────────────────────┬───────────────────────┘    │
│                          │                            │
│  ┌───────────────────────▼───────────────────────┐    │
│  │           Supabase PostgreSQL                  │    │
│  │  - Users, sessions, projects, features, tasks  │    │
│  │  - Agent sessions, runs, events (audit)        │    │
│  │  - Prompts, traits, skills                     │    │
│  └────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```
