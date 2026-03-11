# Monitoring (`/monitoring`)

Real-time agent process monitoring. Shows all running, completed, and failed agent processes. Refreshes via SSE events and 15s polling.

---

## Page Header

- Heading: "Agent Monitoring"
- "Stop All" button (danger, stop_circle icon) — only shown when `running_count > 0`
  - Disabled while `stopping` is true
  - Text: "Stopping..." while in progress
  - Action: `api.stop_all_agents()` → reloads status

### Stale Banner (conditional)
- "Data may be outdated — unable to reach server"

---

## Stats Row

Three cards in a 3-column grid (single column on mobile):

| Card | Icon | Value | Label |
|---|---|---|---|
| Running | `play_circle` | running agent count | "Running" |
| Completed | `check_circle` | completed agent count | "Completed" |
| Failed | `error` | failed agent count | "Failed" |

---

## States

### Loading
- LoadingSpinner: "Loading agent status..."

### Empty
- EmptyState: smart_toy icon, "No agent processes yet."
- Detail: "Submit a feature to trigger the Manager agent, or approve tasks to trigger Ralph agents."

### Has Agents
- AgentGrid renders below

---

## Agent Grid

Vertical list of agent cards.

### Agent Card (per agent)

**Visual:** Card with colored border — blue border when running, red border when failed.

**Header row:**
- Agent icon: `assignment` (manager) / `build` (ralph)
- Agent type (capitalized: "Manager" / "Ralph")
- Agent ID (monospace, small)
- Status badge: running (info/blue), completed (success/green), failed (danger/red), other (muted)

**Times row:**
- "Started: {time}" with schedule icon
- "Finished: {time}" with flag icon (only shown if finished_at exists)

**Action buttons:**
- "Log" button (secondary, sm, description icon) → opens log panel for this agent
- "Stop" button (danger, sm, stop icon) — only shown when status is `running`
  - Action: `api.stop_agent(task_id)` → reloads status

---

## Log Panel (conditional — shown when a log is selected)

Appears below the agent grid.

**Header:**
- "Log: {id_prefix}..." heading with terminal icon
- "Close" button (secondary, sm, close icon) → hides panel

**Content:**
- CodeBlock: log text, max-height 500px, scrollable

**Data loading:** `api.agent_log(task_id)` → shows log content or "No log output yet." / "Failed to load log."
