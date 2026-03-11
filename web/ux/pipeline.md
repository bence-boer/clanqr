# Pipeline (`/pipeline`)

Real-time view of the task execution pipeline — current task, queue, and history. Refreshes via SSE events and 15s polling.

---

## Page Header

- Heading: "Pipeline"
- Subtitle: "Execution queue and task history"

### Stale Banner (conditional)
- "Data may be outdated — unable to reach server"

---

## States

### Loading
- LoadingSpinner: "Loading pipeline..."

### Loaded
All sections below render.

---

## Pipeline Status Bar

Horizontal bar with state indicator and action buttons.

**Left side:**
- State icon: `play_circle` (running) / `pause_circle` (paused) / `radio_button_unchecked` (idle)
- State label: "Running" (green) / "Paused" (accent) / "Idle" (muted)
- Queue badge (conditional): "{n} queued" (shown when queue_depth > 0)

**Right side (action buttons vary by state):**

| State | Buttons |
|---|---|
| `running` | "Pause" (secondary, pause icon) · "Stop Task" (danger, stop icon) |
| `paused` | "Resume" (primary, play_arrow icon) |
| `idle` | "Start Pipeline" (primary, play_arrow icon) |

All buttons disabled while `action_busy` is true.
Error text shown inline on right if `action_error` is set.

**Visual borders:** green border when running, accent border when paused.

**Actions:**
- Pause → `api.pipeline_pause()` → reloads status
- Resume → `api.pipeline_resume()` → reloads status
- Stop Task → confirm dialog "Stop the currently running task?" → `api.pipeline_stop_current()` → reloads

---

## Currently Executing Section

### State: Task Running (`pipeline.current_task` exists)

Card showing the active task:

**Breadcrumb (conditional):** Project name → Feature title (both as links to [/projects/[id]](projects/[id].md) with `?feature=` param)

**Task info:**
- Task title (or first 80 chars of description)
- Full description (if title is set, shown separately)
- Meta: spinning sync icon + "Running for {duration}" (computed from `updated_at`)

**Action buttons:**
- "View Log" / "Hide Log" (secondary, terminal icon) → toggles log panel
- "Stop" (danger, stop icon, disabled while `action_busy`)

**Log panel (conditional — toggled):**
- Toolbar: "Live Output" label + Refresh icon button
- CodeBlock: log text content
- Refresh → `api.pipeline_log()` → updates log

### State: No Task Running
- EmptyState: hourglass_empty icon, "No task is currently running"

---

## Tabs

Two-tab switch:
- "Queue" (default active)
- "History"

---

## Queue Tab

### Header
- "Queue" title with queue icon
- Count badge: "{n}" (shown when queue > 0)

### State: Empty
- EmptyState: done_all icon, "No tasks waiting in queue"

### State: Has Tasks
Vertical list of queued tasks (status `Approved`), numbered starting from 1.

Each queue item:
- Queue number (bold, muted)
- Breadcrumb: Project name / Feature title (as links to [/projects/[id]](projects/[id].md))
- Task title (or first 80 chars of description)
- Full description (if title is set)
- StatusBadge showing task status

---

## History Tab

### Header Row
- "Run History" title with history icon
- Count badge: total number of runs
- **Status filter** select: All statuses / Completed / Failed / Running / Stopped

### State: Empty
- EmptyState: receipt_long icon, "No runs yet"

### State: Has History
Vertical list of run history items.

### History Item (per run)

**Main row:**
- Status icon (color-coded: green=success, red=danger, orange=warning, gray=muted)
- Breadcrumb (conditional): Project / Feature links
- Run title (from task title, or "Task · {id}" / "Feature · {id}" / "Chat · {id}")
- Meta: date + duration (formatted: "< 1s", "45s", "2m 30s")
- Summary text (conditional)
- Error text (conditional, danger color)

**Footer row:**
- Status badge (success/danger/muted/info)
- "View Console" / "Hide Console" button (ghost, terminal icon) — only shown if `run.log` exists

**Expanded log (conditional):**
- CodeBlock showing `run.log`, max-height 200px

### Pagination
- Page controls: Previous / Next with page numbers
- Driven by `history_page`, `history_total_pages`
- Filter or page change → reloads history data
