# Project Detail (`/projects/[id]`)

Master-detail layout showing a project's features and their tasks/resources. Refreshes via SSE events and 15s polling. Supports deep-linking to a specific feature via `?feature={id}` query param.

---

## Page Header

- Back link: "← Projects" → navigates to [/projects](../projects.md)
- Project name (h2)
- Project description (muted, conditional)
- "New Feature" / "Cancel" toggle button (primary, add/close icon) → toggles feature form

---

## States

### Loading
- LoadingSpinner: "Loading..."

### Project Not Found
- Error text: "Project not found"

### Loaded
- Two-column grid: feature list (280px) + detail panel (flex 1)
- On mobile (≤768px): single column, toggling between list and detail via `show_mobile_detail`

---

## Feature Form (conditional)

Shown above the content grid when toggled.

**Fields:**
- Text input: "Feature title" (required)
- Textarea: "Description" (4 rows)
- 2×3 selection grid:
  - Planning CLI: select (Copilot CLI / Gemini CLI)
  - Planning Model: select (dynamically loaded from `api.list_models(cli)`)
  - Execution CLI: select (Copilot CLI / Gemini CLI)
  - Execution Model: select (dynamically loaded)
  - On Task Failure: select (Stop / Retry / Skip)
  - Task Timeout (min): number input (1-60, default 10)
- **Resources section:**
  - "Resources" label + "Add URL" button
  - Each resource: URL input + Title input + remove (X) button
  - Dynamic list — add/remove resource fields
- **Form actions:** Cancel (secondary) + "Save Draft" (primary, disabled if title empty or models not loaded)

Submit → `api.create_feature()` → hides form, reloads data.

---

## Feature List (left panel)

**Header:** "Features ({count})" + actions:
- "All" checkbox (select all) — shown when features exist
- "Delete {n}" button (danger, sm) — shown when items selected, confirm dialog
- No features: EmptyState "No features yet."

### Feature Item (per feature)
Button element (full width, clickable). Highlighted when selected.

**Elements:**
- Checkbox (click stops propagation) → toggles selection
- Feature name (bold)
- Status badge with icon:
  - Draft (muted), Submitted (info), In_Progress (warning), Done (success), Failed (danger)
  - Status text has underscores replaced with spaces
- Meta row: task count icon + count, resource count icon + count, CLI badge, execution model badge (conditional)

Click → selects feature, shows detail panel. On mobile: hides list, shows detail.

---

## Feature Detail (right panel)

### State: No Selection
- Centered: touch_app icon (48px) + "Select a feature to view details"

### State: Feature Selected

#### Top Bar
- Back button (ghost, arrow_back icon) — hidden on desktop, visible on mobile → hides detail, shows list

#### Header
- Feature title (h3)
- Agent activity indicator (conditional — shown when agents are running):
  - Spinning `progress_activity` icon + "MANAGER PROCESSING" or "RALPH WORKING" label
  - Gold accent border/background
- **Action buttons** (vary by status):
  - When `Draft` and not editing: "Edit" (secondary) + "Submit" (primary, send icon) + "Delete" (danger, delete icon)
  - When not Draft: only "Delete" (danger)

#### Error Banner
- Shown when `feature.last_error` is set
- Text: error message + retry count if > 0: "(retry {n}/3)"

#### Body: View Mode (not editing)

**Description section:**
- Heading: "Description" with description icon
- Text content (pre-wrap) or "No description"

**Engine & Model section:**
- Heading: "Engine & Model" with smart_toy icon
- Four badges: Plan CLI, Exec CLI, Planning model, Execution model

**Resources section** (see [ResourceList](#resource-list))

**Tasks section** (see [TaskList](#task-list))

#### Body: Edit Mode

Form with:
- Title input (labeled)
- Description textarea (labeled, 4 rows)
- 2×2 selection grid:
  - Planning CLI select
  - Planning Model select (dynamically loaded)
  - Execution CLI select
  - Execution Model select (dynamically loaded)
- Cancel + Save buttons

---

## Resource List

### Existing Resources (shown when resources exist)
- Heading: "Resources" with link icon
- List: each resource shows:
  - External link (accent color, opens in new tab): title or URL, `open_in_new` icon
  - Status badge (with icon mapped from resource status)
  - Remove button (danger, X icon) — only shown when feature status is `Draft`

### Add Resource Form (only shown when feature status is `Draft`)
- Heading: "Add Resource" with add_link icon
- Row: URL input + Title input (180px max) + "Add" button (primary, sm)
- Add → `api.add_resource()` → reloads

---

## Task List

### Header
- "Tasks ({count})" heading
- Actions:
  - Auto-Approve checkbox toggle — toggles `auto_approve` flag on the feature
  - "Approve All" button (secondary, done_all icon) — only shown when any task has status `Pending_Approval`
  - "Add Task" button (secondary, add icon) → opens add form

### Add Task Form (conditional)
- Accent-bordered card
- Text input: "Task description…" (Enter to save, Escape to cancel)
- Save + Cancel buttons

### Empty State
- "No tasks yet." + "Submit the feature to generate tasks via Manager agent."

### Task Item (per task)

Two modes: **view** and **edit**.

#### View Mode

**Header row:**
- Task title (or first 80 chars of description)
- Badges:
  - Model override badge (info, scaled down) — shown if task has custom model
  - Status badge with icon: Pending_Approval (warning), Approved (info), Complete (success), Failed (danger), Running (warning), etc.

**Action buttons** (vary by task status):

| Task status | Available actions |
|---|---|
| `Pending_Approval` | "Approve" (primary, thumb_up) · "Edit" (ghost, edit) · "Delete" (danger, delete) · "Artifacts" (secondary, tune) |
| `Approved` | "Run Ralph" (secondary, play_arrow) · "Edit" (ghost) · "Delete" (danger) · "Artifacts" (secondary) |
| Other statuses | "Artifacts" (secondary, tune) |

**Expandable sections (Accordion):**
- "Detailed prompt" / "Task prompt" — shows `task.description` (pre-wrap, muted)
- "Console log" (conditional — shown if `task.agent_log` exists) — CodeBlock with max-height 300px
- "Result summary" (conditional — shown if `task.output` exists) — shows output text

**Task Files** (shown when status is `Complete` or `Failed`):
- File list with icon (based on MIME type), filename, size, download link
- Download icon appears on hover

**Task Artifacts panel** (toggled by "Artifacts" button):
- **Traits section:** checkboxes for all available ralph traits, checked if assigned to this task
  - Toggle → `api.assign_trait()` / `api.remove_trait_assignment()`
- **Skills section:** checkboxes for all available skills, checked if linked to this task
  - Toggle → `api.link_skill()` / `api.unlink_skill()`

#### Edit Mode
- Accent-bordered card
- Title input (optional, "Task title")
- Description textarea (4 rows)
- Model Override select (loaded from `api.list_models(feature_cli)`) with "Feature default" option
- Save (Enter in title) + Cancel (Escape)

---

## Interactions Summary

| Action | Trigger | Result |
|---|---|---|
| Select feature | Click feature item | Shows detail panel, loads agent status |
| Submit feature | Click "Submit" in detail header | `api.submit_feature()` → toast "Feature submitted!" → reloads |
| Delete feature | Click delete + confirm | `api.delete_feature()` → clears selection → reloads |
| Approve task | Click "Approve" | `api.approve_task()` → reloads |
| Approve all | Click "Approve All" | `api.approve_all_tasks()` → reloads |
| Run Ralph | Click "Run Ralph" | `api.spawn_ralph()` → reloads |
| Add task | Fill description + Save | `api.create_task()` → reloads |
| Delete task | Click delete + confirm | `api.delete_task()` → reloads |
| Add resource | Fill URL + "Add" | `api.add_resource()` → reloads |
| Remove resource | Click X on resource | `api.delete_resource()` → reloads |
| Toggle auto-approve | Click checkbox | `api.update_feature({auto_approve})` → reloads |
