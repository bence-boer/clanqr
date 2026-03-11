# UX Improvement Plan

> A comprehensive, actionable improvement plan for Ralph Agent Workspace.
> Organized by priority and impact. Each item is self-contained and implementable independently unless noted.

---

## Table of Contents

1. [Information Architecture & Navigation](#1-information-architecture--navigation)
2. [Dashboard Redesign](#2-dashboard-redesign)
3. [Projects & Features](#3-projects--features)
4. [Pipeline](#4-pipeline)
5. [Chat](#5-chat)
6. [Monitoring](#6-monitoring)
7. [Prompts & Traits](#7-prompts--traits)
8. [Skills](#8-skills)
9. [Usage Analytics](#9-usage-analytics)
10. [Admin](#10-admin)
11. [Auth & Invite Flow](#11-auth--invite-flow)
12. [Design System & Cross-Cutting](#12-design-system--cross-cutting)
13. [New Capabilities](#13-new-capabilities)
14. [Resilience, Real-Time Sync & Accessibility](#14-resilience-real-time-sync--accessibility)
15. [Design Foundations & Interaction Quality](#15-design-foundations--interaction-quality)

---

## 1. Information Architecture & Navigation

### 1.1 Simplify sidebar grouping

**Current:** Four groups (Workspace, AI, Configure, Settings) with 9–10 links.
**Problem:** "Configure" and "AI" feel overlapping. Prompts & Traits configure AI behavior — grouping them under a separate section is misleading. Skills are also AI-related. Users think "I want to work with my AI agents" and must scan two sections.

**Change:**
```
Workspace        →  keep as-is
  Dashboard
  Projects
  Pipeline
  Monitoring

Intelligence     →  merge AI + Configure
  Chat
  Prompts & Traits
  Skills

Insights         →  new group
  Usage

Settings         →  keep (admin only)
  Admin
```

**Rationale:** Three cognitive buckets: *work*, *AI configuration*, *data/admin*. Reduces group count from 4 → 3 (or 4 with Settings). "Intelligence" signals that chat, prompts, traits, and skills are all part of the same concern: shaping agent behavior.

### 1.2 Add global breadcrumb bar

**Current:** Only project detail and pipeline current-task show breadcrumbs. Most pages have no location context beyond the sidebar active state.
**Problem:** When drilling into a project → feature → task, the user's position in the hierarchy is only clear from the sidebar highlight (which just says "Projects").

**Change:** Add a thin breadcrumb strip below the page header on every nested page:
- `/projects/[id]` → `Projects / {project name}`
- `/projects/[id]?feature={fid}` → `Projects / {project name} / {feature title}`
- `/pipeline` (with task expanded) → `Pipeline / {task title}`

Use `<nav aria-label="breadcrumb">` with `<ol>` for accessibility. Each segment is a clickable link. The last segment is plain text (current page).

### 1.3 Persist sidebar collapse preference

**Current:** Sidebar is always 220px on desktop. No collapse option.
**Problem:** Power users on smaller screens (13" laptops) lose content width.

**Change:** Add a collapse toggle (chevron icon) at the bottom of the sidebar. Collapsed state shows icons only (48px width). Persist preference in `localStorage`. Animate transition with CSS `width` + `overflow: hidden`.

### 1.4 Add keyboard shortcut layer

**Current:** Only chat has keyboard shortcuts (Enter/Shift+Enter). No global shortcuts.

**Change:** Add a global shortcut system:
- `Ctrl+K` / `Cmd+K` → Command palette (search for pages, projects, features, actions)
- `Ctrl+/` → Show keyboard shortcut help overlay
- `G then D` → Go to Dashboard
- `G then P` → Go to Projects
- `G then C` → Go to Chat
- `N` → New (context-dependent: new project on /projects, new feature on /projects/[id], new chat on /chat)

Implement with a lightweight event listener on `document`. Show hint in sidebar footer: "⌘K to search".

---

## 2. Dashboard Redesign

### 2.1 Replace stat cards with an activity feed

**Current:** Dashboard shows 3 static stat cards (projects count, features count, pipeline state), system stats, and 4 quick-action cards. The quick actions are low-value after the first visit — experienced users already know where things are.
**Problem:** The dashboard doesn't answer the user's real question: *"What happened since I last looked? What needs my attention?"*

**Change:** Restructure dashboard into two sections:

**Top row (glanceable KPIs):**
- Pipeline status pill (Running/Paused/Idle) — clickable → /pipeline
- Tasks awaiting approval count — clickable → first project with pending tasks
- Active agents count — clickable → /monitoring
- System health indicator (green/yellow/red dot) — clickable → expands system stats inline

**Main area — Activity Feed:**
A reverse-chronological feed of significant events:
- "Feature '{title}' completed all tasks" (success)
- "Task '{title}' failed: {error summary}" (danger, with Retry link)
- "Manager generated {n} tasks for '{feature}'" (info)
- "Pipeline paused by user" (warning)
- "{user} registered via invite" (muted, admin only)

Each item: icon + timestamp (relative) + message + action link. Data source: combine `agent_runs` recent history + feature status changes. API endpoint: new `GET /api/activity/feed?limit=20`.

**Rationale:** Dashboards should be *reactive*, not *static*. An activity feed gives the "inbox zero" feeling — the user processes events, clicks into problems, and returns to a calm dashboard.

### 2.2 Remove Quick Actions section

**Current:** 4 cards (New Project, Open Chat, View Pipeline, Manage Prompts).
**Problem:** These are just links that duplicate the sidebar. They add visual weight without value to returning users.

**Change:** Remove entirely. The command palette (§1.4) and sidebar provide faster access. If needed, show contextual quick actions in the activity feed (e.g., "No projects yet — Create your first project").

### 2.3 Make system stats collapsible

**Current:** System stats card is always visible, taking significant vertical space.
**Problem:** CPU/Memory/Storage stats are secondary information. Most visits don't need them.

**Change:** Collapse system stats into the KPI row's health indicator. Clicking the health dot expands an inline panel with CPU, Memory, Storage, Temperature bars. Auto-collapse after 10s of no interaction. Persist expand preference in `localStorage`.

### 2.4 Show "needs attention" badge in sidebar

**Current:** Sidebar nav items have no badges or counts.

**Change:** Add count badges next to nav items when action is needed:
- **Projects**: Count of features with `Pending_Approval` tasks
- **Pipeline**: Show "Paused" indicator if pipeline is paused
- **Monitoring**: Count of failed agents (last 1h)
- **Admin**: Count of active invites (admin only)

Data source: piggyback on the SSE `snapshot` event which already carries pipeline state. Add `pending_approval_count` and `failed_agent_count` to the snapshot payload.

---

## 3. Projects & Features

### 3.1 Add search and filter to project list

**Current:** Flat card grid, no search or filtering. Only bulk select + delete.
**Problem:** Scales poorly beyond 6–8 projects. Can't find a project by name.

**Change:**
- Add a search input above the grid. Filter client-side by project name/description (case-insensitive substring match).
- Add filter pills: `All` | `Active` | `Archived` | `Planning`. These match project `status` values.
- Show result count: "Showing 3 of 12 projects"

### 3.2 Show feature summary on project cards

**Current:** Project cards show name, description, status badge, and edit/delete actions. No indication of what's inside.
**Problem:** User must click into every project to see feature count or progress.

**Change:** Add to each project card:
- Feature count: "{n} features"
- Mini progress indicator: "{completed}/{total} done" as a small progress bar or fraction
- Last activity timestamp: "Updated 2h ago"

Data source: `api.list_features(project_id)` already returns all features — aggregate on the client, or add `feature_count` + `completed_count` to the project list API response for efficiency.

### 3.3 Redesign feature creation form

**Current:** Dense 2-column grid with 6 technical fields (Planning CLI, Planning Model, Execution CLI, Execution Model, On Task Failure, Task Timeout). Resources section below.
**Problem:** Overwhelming for new users. "Planning CLI" vs "Execution CLI" requires domain knowledge. The form front-loads configuration that most users accept as defaults.

**Change:** Split into two stages:

**Stage 1 — Essentials (always visible):**
- Title (required)
- Description (textarea, optional but encouraged with placeholder guidance)
- Resources section (add URLs for reference material)

**Stage 2 — Advanced Settings (collapsed by default, expandable):**
- Label: "Advanced Settings" with chevron toggle
- Planning: CLI + Model (side by side)
- Execution: CLI + Model (side by side)
- On Task Failure: radio group with short descriptions ("Stop — halt feature on first failure", "Retry — retry failed task", "Skip — continue to next task")
- Task Timeout: slider or input with unit label "minutes" and range hint "(1–60)"

Add help text/tooltips:
- Planning: "The AI model that breaks your feature into tasks"
- Execution: "The AI model that implements each task"
- Show "(Recommended)" next to default model selections

**Rationale:** Progressive disclosure. Most users just need title + description. Power users expand advanced settings. Defaults should be sensible (copilot CLI, recommended model, stop on failure, 10min timeout).

### 3.4 Improve feature detail — information hierarchy

**Current:** Feature detail shows: title → agent status → description → engine/model badges → resources → tasks. All sections have equal visual weight.
**Problem:** The most important information (tasks and their status) is buried at the bottom. Users open feature detail primarily to manage tasks.

**Change:** Reorder and restructure:

1. **Header bar:** Title + Status badge + Agent activity indicator + Action buttons (Edit, Submit, Delete)
2. **Error banner** (if `last_error`, with retry count)
3. **Tasks section** (moved up — this is the primary content)
   - Show task counts by status: "3 pending · 2 approved · 1 running"
   - Approve All + Add Task buttons in section header
   - Auto-approve toggle
4. **Collapsible "Details" section:**
   - Description
   - Engine & Model configuration (as a compact row, not badges)
   - Resources
5. **Collapsible "Artifacts" section:**
   - Trait and skill assignments (currently per-task, but could also show feature-level)

**Key change:** Tasks move from bottom to immediately below the header. Description and config become collapsible "Details" since they're set-once-and-forget information.

### 3.5 Add pending approval badges to feature list

**Current:** Feature list sidebar shows status badge (Draft/Submitted/In_Progress/Done) but no indication of pending approvals.
**Problem:** User must click each feature to discover which ones have tasks waiting for approval.

**Change:** Add a small orange count badge next to features that have `Pending_Approval` tasks:
```
  Feature A  [In_Progress]  ③
  Feature B  [Done]
  Feature C  [Submitted]    ⑤
```

The badge uses the `warning` variant. Count from `feature.tasks.filter(t => t.status === 'Pending_Approval').length`.

### 3.6 Streamline task approval flow

**Current:** Each pending task has an individual "Approve" button. "Approve All" is available but placed in the task list header. "Run Ralph" is a separate action after approval.
**Problem:** The two-step flow (Approve → Run Ralph) adds friction. For most features, the user wants to approve and run all tasks.

**Change:**
- Add **"Approve & Run All"** button that combines approval + queueing for execution in a single action.
- Keep individual "Approve" for selective approval workflows.
- When auto-approve is ON, show a banner: "Tasks are auto-approved. New tasks will run automatically." and hide individual Approve buttons.
- After individual approval, flash a toast: "Task approved. It will run when the pipeline reaches it." (explains what happens next)

### 3.7 Add task status timeline / progress bar to feature detail

**Current:** Tasks are listed with individual status badges but there's no aggregate progress view.
**Problem:** Can't quickly tell "how far along is this feature?"

**Change:** Add a horizontal progress bar below the feature header:
```
[████████░░░░░░░░░░] 4/9 tasks complete
```
Segments colored by status:
- Green (Complete), Red (Failed), Blue (In_Progress), Yellow (Pending_Approval), Gray (Approved/Skipped)

Shows fraction: "{completed}/{total} tasks complete". If all done: "✓ All tasks complete".

### 3.8 Show task failure reason inline

**Current:** Failed tasks show a console log in an accordion, but the actual error isn't surfaced at a glance.
**Problem:** User must expand the accordion to understand what failed.

**Change:** For failed tasks, show a 1-line error summary directly on the task card (below the status badge). Truncate to ~120 chars with "Show more" link that expands the accordion.

### 3.9 Improve resource status visibility

**Current:** Resources show status badges (Pending/Fetched/Error) but no explanation of what these mean.
**Problem:** Users don't understand resource processing. "Pending" could mean "uploading", "queued for fetch", etc.

**Change:**
- Pending → "Fetching…" with a subtle spinner
- Fetched → "Ready" with a green checkmark
- Error → "Failed to fetch" with a red X and the error reason on hover (tooltip)

### 3.10 Enable feature duplication

**Current:** No way to duplicate a feature.
**Problem:** When creating similar features (e.g., same model/CLI config but different task), user must re-enter all settings.

**Change:** Add "Duplicate" action to feature cards. Creates a new Draft feature with the same title (suffixed " (copy)"), description, CLI/model settings, and resources. Tasks are NOT copied (they'll be generated fresh).

### 3.11 Allow resource management beyond Draft status

**Current:** Resources can only be added/removed when feature status is `Draft`.
**Problem:** Users sometimes realize mid-execution that they need to add reference material.

**Change:** Allow adding resources in any status. Only restrict *removal* to `Draft` (since running tasks may depend on fetched resources). When adding a resource to a non-Draft feature, show a note: "This resource will be available for future tasks."

### 3.12 Mobile master-detail transition

**Current:** Desktop shows two columns (feature list + detail). Mobile hides list and shows detail, or vice versa, with no animation.
**Problem:** The abrupt show/hide feels jarring. Users may not realize they can go "back".

**Change:**
- Add a slide transition: list slides left, detail slides in from right.
- Show a clear "← Back to features" button at the top of the detail panel on mobile.
- Animate with CSS `transform: translateX()` + `transition: transform 200ms ease`.

### 3.13 Add confirmation before feature submission

**Current:** Clicking "Submit" on a feature immediately triggers AI processing with no confirmation. This is a high-anxiety, irreversible action — the feature enters the pipeline and tasks are generated.
**Problem:** One accidental click triggers pipeline work. Users see "AI is analyzing your request…" but don't know: how long it takes, whether they can cancel, or what happens on failure.

**Change:**
- Replace one-click submit with a confirmation step (use ConfirmModal from §12.1):
  - Title: "Submit for AI Processing"
  - Body: "This will send '{feature title}' to the AI pipeline for task generation. This cannot be undone."
  - Confirm: "Submit" (primary)
- After submission, show a richer toast: "Feature submitted. The AI will generate tasks — this typically takes 1–3 minutes. You'll see tasks appear below."
- Add a progress hint in the feature detail header when status is "Submitted": "AI is analyzing… (started {Xm ago})"

### 3.14 Preserve form input across errors

**Current:** When feature creation fails (API error), the error toast appears but the form's behavior depends on where the error occurs. Chat input is cleared before send, losing the user's message on failure.
**Problem:** Users lose their typed content after transient errors and must re-enter everything.

**Change:**
- Feature form: On API error, keep the form open with all fields populated. Show inline error above the submit button (not just a toast).
- Task inline edit: On save failure, keep edit mode active with the user's changes intact.
- Chat input: Do NOT clear the input until the server acknowledges the message. Store a copy of the sent message and restore it on error.

---

## 4. Pipeline

### 4.1 Live-updating current task duration

**Current:** Duration shows "Running for Xm Ys" but doesn't update in real-time (only on SSE event or manual refresh).
**Problem:** The timer appears frozen, making users unsure if the task is still running.

**Change:** Use `setInterval(1000)` to update the duration display every second while a task is running. Clear the interval when the task completes or the component unmounts. Base the calculation on `started_at` (not `updated_at`).

### 4.2 Auto-refreshing pipeline log

**Current:** Log panel requires manual "Refresh" clicks.
**Problem:** Users watching a running task must repeatedly click Refresh.

**Change:** When log panel is open and task is running, auto-refresh log every 3 seconds. Show a subtle "Live" indicator (green dot) next to the log header. Stop polling when task completes. Add "Auto-refresh" toggle if users want to pause updates.

### 4.3 Add "Copy log" button

**Current:** Log content in CodeBlock has no copy mechanism.
**Problem:** Users debugging failures need to share or search logs.

**Change:** Add a "Copy" icon button in the top-right corner of every CodeBlock. Uses `navigator.clipboard.writeText()`. Shows "Copied!" confirmation for 2s. Apply this globally to all CodeBlock instances (Pipeline, Monitoring, Task consoles).

### 4.4 Queue reordering

**Current:** Queue is read-only. Tasks execute in order of approval.
**Problem:** Users may want to prioritize urgent tasks.

**Change:** Add drag-and-drop reordering to the queue list. Each item gets a grip handle (⠿). On drop, call a new `PATCH /api/pipeline/reorder` endpoint with the new ordered list of task IDs. Show a subtle move animation. Requires a `queue_position` column or similar backend support.

### 4.5 Remove task from queue

**Current:** No way to remove a task from the queue without deleting it entirely.

**Change:** Add a "Remove from queue" (×) button on each queue item. This changes the task status back to `Approved` (removing it from the pipeline queue) without deleting it. Confirm with: "Remove '{task title}' from queue? It will remain approved and can be re-queued."

### 4.6 Improve history item information density

**Current:** History items show status icon, breadcrumb, title, duration, and an expandable log.
**Problem:** Token usage and model info not shown — must go to Usage page.

**Change:** Add to each history item:
- Model badge (small, muted)
- Token count: "{prompt_tokens + completion_tokens} tokens"
- Error summary (1-line, for failed runs)
- "Retry" button for failed runs (re-queues the task)

### 4.7 Show pipeline throughput stats

**Current:** No aggregate pipeline performance data on the pipeline page.

**Change:** Add a thin stats bar below the pipeline status bar:
- "Completed today: {n}" | "Avg duration: {Xm Ys}" | "Queue ETA: ~{Xm}"
- Queue ETA calculated from: (queue_depth × avg_duration_last_10_runs)

---

## 5. Chat

### 5.1 Render markdown in messages

**Current:** Messages display as plain text with `white-space: pre-wrap`.
**Problem:** AI responses often contain markdown: code blocks, headers, bold, lists. These render as raw text, making responses hard to read.

**Change:** Render assistant messages through a lightweight markdown renderer. Use a library like `marked` + `DOMPurify` (or `svelte-markdown`). Apply syntax highlighting to code blocks with a dark-theme-compatible highlighter (e.g., `highlight.js` with a dark theme).

User messages remain plain text (they rarely contain markdown).

### 5.2 Add copy button to messages

**Current:** No way to copy a message without manual text selection.
**Problem:** Users frequently want to copy code snippets or full responses.

**Change:** Add a "Copy" icon button that appears on hover for each message (both user and assistant). Position: top-right corner of the message bubble. For code blocks within markdown: add a per-block copy button.

### 5.3 Session title editing

**Current:** Sessions display auto-generated titles ("Chat {date}") or server-assigned titles. No edit capability.
**Problem:** Hard to find previous conversations. "Chat Mar 11" doesn't tell you what was discussed.

**Change:** Make session titles editable:
- Double-click title in session list → inline edit
- Or click a pencil icon on the chat header → edit mode
- Save on Enter / blur. Cancel on Escape.
- API: `PATCH /api/chat/sessions/{id}` with `{ title }` (already exists).

### 5.4 Show model recommendation and descriptions

**Current:** Model selector is a flat `<select>` with optgroups (Claude, Gemini, GPT) but no guidance on which to choose.
**Problem:** Users without AI model knowledge don't know the tradeoffs.

**Change:**
- Mark the default model with "(Recommended)" suffix
- Add a subtle description line below the model selector: "Claude Sonnet 4.5 — Fast and capable for most tasks"
- Group by capability tier within each provider if many options exist
- Consider a small "?" icon next to the selector that opens a tooltip table of models with speed/capability/cost indicators

### 5.5 Add "scroll to bottom" button

**Current:** Chat auto-scrolls on new messages, but if the user scrolls up to read history, there's no way to jump back to the bottom.

**Change:** Show a floating "↓" button at the bottom-right of the message thread when the user has scrolled up more than 200px from the bottom. Clicking scrolls to bottom with a smooth animation. Hide the button when at bottom.

### 5.6 Show session context in list

**Current:** Session list shows title and timestamp only.
**Problem:** Can't distinguish sessions without clicking into each.

**Change:** Add to each session list item:
- Message count badge (small, muted)
- Last message preview: first ~60 chars of the last assistant message, truncated with ellipsis
- Model indicator: small icon or abbreviation (e.g., "S4.5" for Sonnet 4.5)

### 5.7 Empty state with starter prompts

**Current:** Empty chat shows "No messages yet. Say something!"
**Problem:** Doesn't guide the user on what they can do.

**Change:** Show 3–4 clickable starter prompt cards:
- "Explain how the agent pipeline works"
- "Help me write a feature description"
- "Review the latest failed task"
- "Suggest improvements for my project"

Clicking a card sends that text as the first message. Cards disappear once the first message is sent.

---

## 6. Monitoring

### 6.1 Add agent filtering and sorting

**Current:** Flat list of all agents, sorted by recency.
**Problem:** When many agents run, finding a specific one is tedious.

**Change:**
- Add filter pills: `All` | `Running` | `Completed` | `Failed`
- Add sort dropdown: "Newest first" | "Oldest first" | "Longest running"
- Add search input: filter by agent ID substring or feature/task name

### 6.2 Show elapsed duration on running agents

**Current:** Agent cards show start time but not elapsed duration.
**Problem:** Can't tell at a glance how long an agent has been running.

**Change:** For running agents, show a live-updating duration counter: "Running for 2m 34s". Update every second via `setInterval`. Show a visual escalation: muted text for <5m, warning color for 5-15m, danger color for >15m.

### 6.3 Add live log tailing

**Current:** Logs load on-demand when clicking "Log" button. No live updates.
**Problem:** Users monitoring a running agent must repeatedly re-click to see new output.

**Change:** When viewing a running agent's log, auto-refresh every 3s. Show a "Live" indicator (pulsing green dot). Auto-scroll to bottom on new content. Stop when agent completes.

### 6.4 Link agents to their source features/tasks

**Current:** Agent cards show agent type and ID, but don't directly link to the related feature or task.
**Problem:** Can't navigate from a monitoring card to the project/feature/task it relates to.

**Change:** Add a clickable breadcrumb to each agent card:
- Manager: "Project / Feature" (links to `/projects/{pid}?feature={fid}`)
- Ralph: "Project / Feature / Task" (links to same, with task highlighted)
- Chat: "Chat Session" (links to `/chat` with session selected)

Data source: `agent_runs` already has `feature_id` and `task_id` — resolve project context server-side or include in agent status API.

### 6.5 Improve empty state

**Current:** "No agent processes yet" with generic hint.

**Change:** Show a more helpful empty state:
- If pipeline is idle: "Pipeline is idle. Submit a feature to start agent processing."
- If pipeline is running but no agents: "Pipeline is running. Agents will appear here when tasks are picked up."
- Link to relevant page: "Go to Projects →" or "Go to Pipeline →"

---

## 7. Prompts & Traits

### 7.1 Add sync confirmation

**Current:** "Sync from Repo" immediately overwrites all prompts without confirmation.
**Problem:** Users may have unsaved edits that get destroyed.

**Change:** Before syncing, show a confirmation: "This will overwrite local prompts with the repository versions. Any unsaved changes will be lost. Continue?" Only proceed on confirmation.

### 7.2 Show diff on sync

**Current:** Sync replaces content silently. User doesn't know what changed.

**Change:** After sync completes, show a toast or inline banner: "Synced. Manager prompt updated (v{old} → v{new}). Ralph prompt unchanged." If both changed, show both. This gives the user confidence about what happened.

### 7.3 Add prompt version history

**Current:** Prompts show version number but no history.
**Problem:** If a sync or edit breaks agent behavior, there's no way to revert.

**Change:** Store prompt versions server-side (add `prompt_versions` table or use the existing version field). Show a "History" button that opens a panel with previous versions and a "Restore" action. Low-priority but high-value for prompt engineering workflows.

### 7.4 Improve trait creation form

**Current:** Trait form has Name, Target select, Description, Content textarea, and Global toggle.
**Problem:** "Content" is a raw textarea with no guidance on what to write.

**Change:**
- Add placeholder text in Content: "Write instructions that will be injected into the agent's system prompt. Be specific and actionable."
- Add a character count indicator below the textarea
- Show a preview section: "This trait will be included in {target} agent prompts{is_global ? ' for all features' : ' when assigned'}."

### 7.5 Show trait assignment count

**Current:** Trait list shows name, target, description, and content preview. No indication of how widely used a trait is.
**Problem:** Users don't know which traits are actively used.

**Change:** Add an assignment count badge to each trait row: "Used in {n} tasks" or "Global" badge. Helps users identify orphaned traits for cleanup.

### 7.6 Add trait categories or tags

**Current:** Flat list of traits with only a target (manager/ralph) filter.
**Problem:** As traits grow, finding the right one becomes harder.

**Change:** Add an optional `category` field to traits (e.g., "coding-style", "security", "output-format"). Show category as a badge on the trait row. Add category filter pills above the list.

---

## 8. Skills

### 8.1 Add search/filter

**Current:** Flat grid of skill cards, no search.
**Problem:** With many skills, finding a specific one requires visual scanning.

**Change:** Add a search input above the grid. Filter by skill name and description (case-insensitive substring). Show result count: "Showing {n} of {total} skills".

### 8.2 Show skill usage context

**Current:** Skills show name, description, file path, and expandable content. No indication of where they're used.
**Problem:** Users don't know which tasks link to which skills.

**Change:** Add to each skill card (collapsed view): "Linked to {n} tasks" count. On expand, show the list of tasks that use this skill with clickable links.

Data source: `api.list_skills()` combined with `skill_links` table query — may need a new API endpoint `GET /api/skills/{name}/usage`.

### 8.3 Inline skill linking from task detail

**Current:** Skill linking is buried in the TaskArtifacts panel, which requires clicking "Artifacts" on a task item.
**Problem:** Low discoverability. Users may not know skills can be linked to tasks.

**Change:** When viewing a task in feature detail, show a "Skills" section alongside the task content (not hidden behind an Artifacts button). Display linked skills as removable chips. Add a "+ Add skill" button that opens a dropdown of available skills.

---

## 9. Usage Analytics

### 9.1 Add date range filter

**Current:** Summary shows all-time, today, and this-week stats. No custom date range.
**Problem:** Can't analyze specific time periods (e.g., "what happened last Friday?").

**Change:** Add a date range picker above the summary stats. Presets: "Today", "Last 7 days", "Last 30 days", "Custom range". Selecting a range re-fetches summary, breakdown, and history with date bounds.

API change: Add `from` and `to` query params to `GET /api/usage/summary`, `GET /api/usage/breakdown`, and `GET /api/usage/history`.

### 9.2 Add table sorting

**Current:** Run history table is sorted by date (newest first). No column sorting.
**Problem:** Can't find longest-running or most token-expensive runs.

**Change:** Make column headers clickable for sorting:
- Duration (ascending/descending)
- Tokens (ascending/descending)
- Date (ascending/descending)
- Show sort indicator (▲/▼) on active column

Implement client-side for the current page of results.

### 9.3 Add success rate display

**Current:** Shows raw counts (Completed, Failed) but no ratio.
**Problem:** Hard to assess system reliability at a glance.

**Change:** Add a success rate percentage to the summary: "Success Rate: 87%" with a color indicator (green >90%, yellow 70-90%, red <70%). Calculate: `completed_runs / (completed_runs + failed_runs) * 100`.

### 9.4 Add cost/token visualization

**Current:** Token counts shown per-run in the history table. No aggregate view.

**Change:** Add a "Token Usage" section to the breakdown panel:
- Total tokens (prompt + completion) for the period
- Breakdown by model (horizontal bar chart, same pattern as existing breakdown)
- Average tokens per run

### 9.5 Make history rows expandable

**Current:** History rows show summary info but no detail. Must go to other pages for context.

**Change:** Make each row expandable (click to expand). Expanded view shows:
- Full model name
- Prompt tokens / Completion tokens (separated)
- Full duration
- Error message (if failed)
- Link to source: "View feature →" or "View task →"

---

## 10. Admin

### 10.1 Improve delete confirmation dialogs

**Current:** Delete uses `confirm('Are you sure?')` with no context.
**Problem:** Browser `confirm()` is ugly, non-customizable, and doesn't show what's being deleted.

**Change:** Replace all `confirm()` calls with a custom confirmation modal component:
```
┌──────────────────────────────────┐
│  ⚠️ Delete User                  │
│                                  │
│  Are you sure you want to delete │
│  "Alice Smith"? This will:       │
│  • Revoke all active sessions    │
│  • Remove their passkey          │
│                                  │
│  This action cannot be undone.   │
│                                  │
│     [Cancel]  [Delete User]      │
└──────────────────────────────────┘
```
Apply this pattern everywhere: user delete, project delete, feature delete, task delete, session delete, invite revoke. The modal component accepts: title, message, confirm label, danger flag.

### 10.2 Add user activity info

**Current:** User table shows name, role, registration date, session count.
**Problem:** No indication of recent activity. Can't tell if a user is active.

**Change:** Add "Last active" column showing relative time of most recent session. Highlight inactive users (>30 days) with a muted row. This helps admins identify stale accounts.

### 10.3 Improve invite URL copy experience

**Current:** Invite success shows URL in a code block with a Copy Link button. The warning "This link will not be shown again" is below.
**Problem:** The warning should be more prominent. Auto-copy would reduce friction.

**Change:**
- Auto-copy the URL to clipboard on generation (with a "Copied to clipboard" toast)
- Make the warning text more prominent: red text, bold, icon
- Add a "Send via..." option placeholder (for future email/Slack integration)
- Keep the manual Copy button as fallback

### 10.4 Add bulk invite management

**Current:** Individual revoke buttons per invite. No bulk actions.

**Change:** Add "Revoke All Expired" button to clean up old invites. Add "Clear All" for full cleanup (with confirmation). Show invite count in tab badge: "Invite Links (3 active)".

---

## 11. Auth & Invite Flow

### 11.1 Improve WebAuthn loading feedback

**Current:** Auth buttons show "Creating..." / "Authenticating..." text while waiting for WebAuthn.
**Problem:** WebAuthn can take 2–5 seconds (biometric prompt, USB key, etc.). Users may think it's stuck.

**Change:**
- Show a step indicator: "Waiting for your passkey..." with a pulsing animation
- Add a timeout message after 10s: "Taking longer than expected? Make sure your device is ready."
- On mobile: add hint "Use your fingerprint or face to continue"

### 11.3 Differentiate auth error types

**Current:** `AuthScreen.svelte` shows a single error state: "Could not reach the API server. Is it running?" with a Retry button for ALL failure types.
**Problem:** Network errors, WebAuthn failures, unsupported browsers, and invalid passkeys all show the same message. Users can't diagnose or recover.

**Change:** Differentiate error messages by cause:
- Network error → "Could not reach the server. Check your connection and try again."
- WebAuthn not supported → "Your browser doesn't support passkeys. Try Chrome, Safari, or Edge."
- WebAuthn cancelled → "Authentication cancelled. Click below to try again."
- Invalid passkey → "Passkey not recognized. If you've lost access, contact an admin."
- Server error → "Something went wrong on our end. Please try again in a moment."

Each error state should show a contextually relevant icon and recovery action.

### 11.2 Improve invite registration page

**Current:** Valid invite shows a minimal form: display name + Create Passkey button.
**Problem:** No context about what they're signing up for.

**Change:**
- Add a welcome message: "You've been invited to Ralph Agent Workspace"
- Show the inviter's name (if available from `created_by_passkey_id`)
- Show role assignment: "You'll be registered as a {role}"
- Show invite expiry: "This invite expires in {time remaining}" (with countdown if <1h)

---

## 12. Design System & Cross-Cutting

### 12.1 Replace browser `confirm()` with custom modal

**Current:** 11+ places use `window.confirm()` for destructive actions.
**Problem:** Browser `confirm()` is ugly, inconsistent across browsers, non-customizable, and breaks the app's visual language.

**Change:** Create a `ConfirmModal.svelte` component:
```typescript
interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirm_label?: string  // default: "Confirm"
  cancel_label?: string   // default: "Cancel"
  variant?: 'danger' | 'warning' | 'default'
  onconfirm: () => void
  oncancel: () => void
}
```
Use `<dialog>` element for accessibility (native focus trap, Escape to close). Apply everywhere destructive actions exist.

### 12.2 Standardize loading states

**Current:** Most pages show a full-page `LoadingSpinner` during initial load.
**Problem:** Full-page spinners feel slow and provide no content preview.

**Change:** Introduce skeleton loading states for key pages:
- **Project cards:** Ghost card shapes with pulsing animation
- **Feature list:** Ghost list items with pulsing bars
- **Table rows:** Ghost rows matching table structure
- **Stat cards:** Ghost stat layout

Implement a `Skeleton.svelte` component with variants: `card`, `list-item`, `table-row`, `stat`. Use CSS `@keyframes shimmer` for the pulsing effect. Keep `LoadingSpinner` for smaller inline operations (button actions, log fetches).

### 12.3 Standardize empty states with context-aware CTAs

**Current:** Empty states show icon + message + optional detail. Some have action buttons, some don't.
**Problem:** Inconsistent. Some empty states are dead ends (no action).

**Change:** Every empty state must include:
1. Relevant icon
2. Title (what's empty)
3. Description (why it matters)
4. Primary CTA (what to do about it)

Examples:
- No projects → "Create your first project" button
- No features → "Add a feature to get started" button
- No chat sessions → "Start a conversation" button
- No agents running → "Submit a feature to begin" link
- No traits → "Create your first trait" button

### 12.4 Add toast for clipboard operations

**Current:** Some clipboard operations show feedback, some don't. No error handling if clipboard API is unavailable.

**Change:** Create a `copy_to_clipboard(text: string, label?: string)` utility:
```typescript
async function copy_to_clipboard(text: string, label = 'Content') {
  try {
    await navigator.clipboard.writeText(text)
    toast_store.success(`${label} copied to clipboard`)
  } catch {
    toast_store.error('Failed to copy — try selecting and copying manually')
  }
}
```
Use everywhere: invite URLs, log content, chat messages, task descriptions.

### 12.5 Improve error toast messages

**Current:** Error toasts show "Failed to {action}" with no detail.
**Problem:** Users don't know why something failed or what to do.

**Change:** Include actionable context in error messages:
- "Failed to approve task: Pipeline is paused. Resume the pipeline first."
- "Failed to load projects: Connection error. Check your network and try again."
- "Failed to create feature: Title is required."

Where possible, include a "Retry" action in the toast (button within the toast component).

### 12.6 Consistent icon sizing

**Current:** Icons use 12px, 14px, 16px, 18px, 24px, 48px across different components.

**Change:** Standardize to 3 sizes:
- `--icon-sm`: 16px (inline text, badges, metadata)
- `--icon-md`: 20px (buttons, cards, form labels)
- `--icon-lg`: 32px (empty states, page headers, auth screen)
- `--icon-xl`: 48px (error page, onboarding only)

Update all icon references to use these CSS variables.

### 12.7 Add transition animations

**Current:** Most state changes are instantaneous (no animation).
**Problem:** Abrupt changes feel jarring, especially on mobile.

**Change:** Add subtle transitions:
- Tab switches: Fade crossfade (150ms)
- Accordion open/close: Slide + fade (200ms)
- Modal open: Fade + scale from 95% (200ms)
- List item removal: Slide up + fade (200ms)
- Page navigation: Minimal fade (100ms)

Use Svelte's built-in `transition:` and `animate:` directives. Keep all durations under 250ms to feel snappy, not sluggish.

---

## 13. New Capabilities

### 13.1 Activity feed API

**Why:** Powers the dashboard redesign (§2.1) and could drive future notification features.

**API:** `GET /api/activity/feed?limit=20&before={cursor}`
**Returns:** Array of activity events with type, message, timestamp, and optional links.
**Source:** Aggregate from `agent_runs` (status changes), `features` (status changes), `pipeline` (state changes), `passkeys` (registrations).

### 13.2 Global search (command palette)

**Why:** Power users need fast navigation. Searching across projects, features, tasks, and chat sessions is essential as data grows.

**Implementation:**
- Client-side fuzzy search for navigation (page names, project names, feature titles)
- Server-side search API for content: `GET /api/search?q=query` searching across projects, features, tasks, chat messages
- Results grouped by type with keyboard navigation
- Open with `Ctrl+K` / `Cmd+K`

### 13.3 Notification system

**Why:** Currently, users must poll pages to discover events (task failures, pipeline completion, pending approvals). This is the biggest usability gap for a tool designed around async AI processing.

**Implementation:**
- Leverage existing SSE stream to push notifications to the client
- Show notification bell icon in sidebar header with unread count
- Notification types:
  - Task failed (danger)
  - Feature completed (success)
  - Tasks pending approval (warning)
  - Pipeline paused/stopped (info)
- Click notification → navigate to relevant page
- Mark as read on click or "Mark all read"

### 13.4 Confirmation modal component (reusable)

**Why:** Powers §10.1 and §12.1. Replaces all `window.confirm()` usage across the app.

**Component:** `ConfirmModal.svelte` using native `<dialog>` element with:
- Focus trap (native)
- Escape to cancel (native)
- Click backdrop to cancel
- Keyboard: Enter to confirm, Escape to cancel
- Danger variant (red confirm button)
- Loading state on confirm button (for async operations)

---

## 14. Resilience, Real-Time Sync & Accessibility

> These items were identified during code validation and address edge cases, concurrency issues, and accessibility gaps not covered in the feature-oriented sections above.

### 14.1 Preserve partial chat responses on streaming failure

**Current:** When SSE streaming fails mid-response, the partial `streaming_content` is discarded and the user's message is removed from history.
**Problem:** If 50% of a useful response was received before the connection dropped, the user loses all of it.

**Change:**
- On streaming error, keep the partial response in the thread with a visual marker: "(response interrupted)" appended in muted text.
- Show an inline "Retry" button below the partial message to re-send the same user message.
- Never silently discard content the user has already seen.

### 14.2 Guard action handlers against stale state

**Current:** Click handlers for "Edit", "Submit", "Approve", "Run Ralph" don't re-validate the feature/task status before executing. If an SSE event changed the status between render and click, the action may fail or produce unexpected results.
**Problem:** Race condition between SSE-driven state updates and user clicks.

**Change:** In every action handler that depends on status:
```typescript
async function approve_task(task_id: string) {
  const task = feature.tasks.find(t => t.id === task_id);
  if (task?.status !== 'Pending_Approval') {
    toast_store.warning('Task status has changed. Please refresh.');
    return;
  }
  // proceed with API call
}
```
Apply this pattern to: submit_feature (requires Draft), approve_task (requires Pending_Approval), spawn_ralph (requires Approved), edit actions (requires Draft or Pending_Approval).

### 14.3 SSE reconnection state reconciliation

**Current:** When SSE reconnects after a disconnect, only future events arrive. Events that fired during the disconnect window are lost. The stale-data banner appears after 60s, but state is silently stale before that.
**Problem:** Feature status, task counts, and pipeline state can be wrong for up to 60s after a brief disconnect.

**Change:**
- On SSE reconnect, immediately trigger a full data refresh (call the page's `load_data()` or equivalent).
- Reduce stale-data threshold from 60s to 30s.
- Add a `last_event_at` timestamp visible in dev mode for debugging.
- When the SSE `snapshot` event arrives after reconnect, reconcile all page-local state.

### 14.4 Optimistic UI updates with rollback

**Current:** All mutations wait for the server response before updating the UI. This creates 1–3s of latency where the user sees no feedback.
**Problem:** The app feels sluggish, especially for quick actions like approve/delete.

**Change:** Implement optimistic updates for high-frequency actions:
- **Task approval:** Immediately show task as "Approved", rollback on error.
- **Task deletion:** Immediately remove from list, rollback on error.
- **Feature submission:** Immediately show as "Submitted", rollback on error.
- **Pipeline pause/resume:** Immediately update status bar, rollback on error.

Pattern:
```typescript
// 1. Save old state
const previous = structuredClone(item);
// 2. Optimistic update
item.status = 'Approved';
// 3. API call
try { await api.approve_task(id); }
catch { Object.assign(item, previous); toast_store.error('Failed'); }
```

### 14.5 Debounce pipeline action buttons

**Current:** Pipeline status bar buttons (Pause/Resume/Stop) can be clicked multiple times before the SSE event confirms the state change.
**Problem:** Double-clicking sends duplicate API requests.

**Change:** After a pipeline action button is clicked:
1. Immediately disable the button (set `action_busy = true`)
2. Show a spinner on the button
3. Re-enable only after the SSE event confirms the new state, or after a 5s timeout

### 14.6 Auto-refresh failure backoff for pipeline logs

**Current (planned in §4.2):** Auto-refresh log every 3s when the log panel is open.
**Problem (gap):** If the log endpoint fails repeatedly, the user gets spammed with error toasts.

**Change:** When §4.2 (auto-refresh log) is implemented, add exponential backoff:
- First failure: retry in 3s (normal interval)
- Second consecutive failure: retry in 6s
- Third: retry in 12s
- After 5 consecutive failures: stop auto-refresh, show "Auto-refresh paused due to errors. Click to retry." inline message. No toast spam.

### 14.7 Concurrent form editing protection

**Current:** If a user is editing a feature or task and an SSE event updates that same entity, the form state becomes stale. The user's save will overwrite changes they didn't see.
**Problem:** Lost updates in a collaborative or real-time environment.

**Change:**
- When an SSE update arrives for an entity currently being edited, show a non-blocking banner above the form: "This {feature/task} was updated. [Discard my changes] [Keep editing]"
- "Discard" reloads the entity and exits edit mode.
- "Keep editing" dismisses the banner but shows a warning icon on the Save button.
- On save, include the `updated_at` timestamp for optimistic locking server-side.

### 14.8 Accessibility — ARIA labels on icon-only buttons

**Current:** Many buttons use only a Material icon with no text label or `aria-label`. Screen readers announce nothing useful.
**Problem:** The app is unusable for screen reader users on icon-only buttons (Send, Stop, Refresh, Delete, pipeline controls, etc.).

**Change:** Audit and fix every icon-only button:
- Add `aria-label` to all icon-only `<Button>` elements: `aria-label="Send message"`, `aria-label="Stop generation"`, `aria-label="Refresh log"`, etc.
- Add `aria-label` to status indicators: spinning icons, status badges in monitoring
- Add `role="status"` and `aria-live="polite"` to real-time updating elements (agent status, pipeline state, streaming indicator)
- Ensure all Badge components include text content (they already do, but verify everywhere)

### 14.9 Accessibility — Focus management for modals and drawers

**Current:** No focus trap in any overlay. Mobile sidebar has no focus management. Log panels don't receive focus.
**Problem:** Keyboard-only users can tab behind modals, losing context. Focus doesn't return to the trigger after closing an overlay.

**Change:** When §13.4 (ConfirmModal) is implemented, ensure:
- Focus moves to the modal on open
- Focus returns to the trigger element on close
- Tab cycles within the modal (focus trap via `<dialog>` native behavior)
- Apply the same pattern to: mobile sidebar overlay, log panels, expanded skill cards

### 14.10 Project archival filtering

**Current:** Backend supports project `status` field (Active/Archived/Planning) but the frontend shows all projects with no way to filter by status. The status badge is displayed but not actionable.
**Problem:** As projects accumulate, archived ones clutter the list.

**Change:**
- Add status filter to project list (§3.1 already adds search — combine with status filter pills: `All` | `Active` | `Archived`)
- Add "Archive" action to project cards (currently only edit/delete exist)
- Archived projects shown with reduced opacity or in a separate collapsed section
- Default view: Active projects only

### 14.11 Expose trait inheritance resolution UI

**Current:** Backend has `GET /api/traits/resolve/:task_id` and `GET /api/traits/resolve/feature/:id` endpoints that walk the trait inheritance chain (task → feature → project → global). The frontend never calls these.
**Problem:** Users assign traits at various scopes but can't see which traits actually apply to a given task after inheritance resolution.

**Change:** In the TaskArtifacts panel (or the restructured Artifacts section from §3.4):
- Add an "Effective Traits" tab/section that calls `api.resolve_task_traits(task_id)`
- Show each resolved trait with its source: "From project", "From feature", "Global", "Direct"
- If a trait is excluded at this scope, show it as struck-through with "Excluded" label
- This makes the inheritance system transparent and debuggable

### 14.12 Expose admin metrics dashboard

**Current:** Backend has `GET /api/admin/metrics` returning latency stats, error counts, and request counts per route. The frontend never calls this endpoint.
**Problem:** Admins have no visibility into API performance or error rates.

**Change:** Add a "System Metrics" section to the Admin page (new tab alongside Users and Invite Links):
- Show top-10 slowest endpoints (p95 latency)
- Show error rate by endpoint
- Show request volume (last 24h)
- Auto-refresh every 30s

### 14.13 Expose workspace cleanup action

**Current:** Backend has `POST /api/admin/cleanup-workspaces` for manual cleanup of orphaned agent workspaces. Only runs automatically on server boot.
**Problem:** No way for admins to trigger cleanup without restarting the server.

**Change:** Add a "Maintenance" section to the Admin page:
- "Clean Up Workspaces" button that triggers the cleanup endpoint
- Show result: "Cleaned {n} orphaned workspaces"
- Add workspace stats: count of active/orphaned workspaces if available

### 14.14 Eliminate redundant project+features API call

**Current:** Project detail page (`/projects/[id]`) makes two parallel API calls: `api.get_project(id)` (which returns `features` via join) AND `api.list_features(id)`. The features data is fetched twice.
**Problem:** Unnecessary network request, wasted bandwidth, slower page load.

**Change:** Use the features data from `get_project()` response directly. Remove the separate `list_features()` call. If the project response shape changes, add an `?include=features` query param to make it explicit.

### 14.15 Chat mobile responsiveness

**Current:** Chat page has limited mobile media queries. The session sidebar and chat area don't properly stack on narrow screens.
**Problem:** On mobile, the layout may overflow or become unusable.

**Change:**
- On mobile (≤768px), show session list as a collapsible header (like monitoring stats) or a bottom sheet
- When a session is selected, show only the chat area with a "← Sessions" back button (same pattern as project detail master-detail)
- Ensure chat input has proper `safe-area-inset-bottom` padding for iOS notch devices
- Textarea should resize to avoid being covered by the mobile keyboard

---

## 15. Design Foundations & Interaction Quality

> These items address primitive-level violations found by auditing against UX design principles (Fitts's Law, WCAG, Gestalt, Peak-End Rule, Tesler's Law). They are foundational — many higher-level improvements depend on these being fixed first.

### 15.1 Add `:focus-visible` styles to all interactive elements

**Current:** `Button.svelte` has no `:focus-visible` pseudo-class styles. `Input.svelte`, `Textarea.svelte`, and `Select.svelte` all use `outline: none` with only a subtle `border-color` change as replacement.
**Problem:** Keyboard users cannot see which element has focus. The border-only change is insufficient for low-vision users. This violates WCAG 2.4.7 (Focus Visible).

**Change:**
- Add to all button variants in `Button.svelte`:
```css
.base-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
```
- Replace `outline: none` in Input, Textarea, Select with:
```css
outline: none;
&:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.25);
}
```
- Also fix `PromptList.svelte` `.prompt-textarea` which removes outline without replacement.

### 15.2 Increase icon button minimum size to 44×44px

**Current:** `.size-icon` in `Button.svelte` sets `padding: 0.35rem` and `min-width: 0`, resulting in ~28×28px buttons. This is below the WCAG 2.5.8 target size recommendation (44×44px).
**Problem:** Icon-only buttons (Send, Stop, Refresh, Delete, Edit, pipeline controls) are too small to tap reliably on touch devices. Adjacent icon buttons are nearly impossible to distinguish by touch.

**Change:**
- Update `.size-icon` in `Button.svelte`:
```css
.size-icon {
    padding: 0.5rem;
    min-width: 2.75rem;   /* 44px */
    min-height: 2.75rem;  /* 44px */
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
```
- Ensure minimum 8px gap between adjacent icon buttons (`.task-actions`, pipeline controls, chat input buttons).
- Affected components: `TaskItem.svelte` (5 adjacent action buttons), `ChatInput.svelte`, `SessionList.svelte`, `CurrentTask.svelte`, `SystemStatsCard.svelte`, `TraitForm.svelte`.

### 15.3 Add `prefers-reduced-motion` media query

**Current:** Zero usage of `@media (prefers-reduced-motion: reduce)` anywhere in the codebase. Animations include: `.icon.spin` (1s infinite rotation), `toast-in` (slide + fade), button transitions, and potential accordion animations.
**Problem:** Users with vestibular disorders experience continuous spinning loaders and slide animations. WCAG 2.3.3 (Animation from Interactions) requires motion to be disableable.

**Change:** Add to `global.css`:
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```
Also add this query specifically to the `.icon.spin` rule and `Toast.svelte` `toast-in` keyframes. When §12.7 transition animations are added, they must also respect this query.

### 15.4 Use semantic HTML landmarks

**Current:** Sidebar uses `<div class="sidebar">` (should be `<nav>`). Feature list uses `<div class="features-panel">` (should be `<section>`). No `<aside>`, `<article>`, or proper heading hierarchy for screen reader landmark navigation.
**Problem:** Screen reader users have no landmarks to jump between sections. The entire page reads as a flat sequence of divs.

**Change:**
- `Sidebar.svelte`: Wrap in `<nav aria-label="Main navigation">`
- `+layout.svelte`: Wrap content area in `<main>`  (already exists, verify proper scoping)
- `FeatureList.svelte`: Wrap in `<section aria-label="Features">`
- `FeatureDetail.svelte`: Wrap in `<section aria-label="Feature detail">`
- `TaskList.svelte`: Wrap in `<section aria-label="Tasks">`
- Pipeline tabs: Wrap each tab panel in `<section aria-label="{tab name}">`
- Ensure heading hierarchy: `<h1>` for page title, `<h2>` for section headers, `<h3>` for item headers. Currently heading levels are inconsistent.

### 15.5 Fix color contrast for muted text and badges

**Current:** `--fg-muted` (#9e978a) on `--bg-surface` (#231f1c) yields ~4.2:1 contrast — borderline WCAG AA, fails AAA. Badge variants (`.badge-draft`, `.badge-submitted`) use semi-transparent backgrounds with `--fg-muted` text, resulting in even lower contrast. `--danger` (#c9544a) and `--success` (#4a9e6e) are also borderline at ~4.1–4.2:1.
**Problem:** Low-vision users struggle to read muted text, table headers, and badge labels.

**Change:**
- Increase `--fg-muted` lightness: `#9e978a` → `#b0a99b` (targets ~5.5:1 on dark backgrounds)
- Increase badge text contrast: Use `--fg` (not `--fg-muted`) for badge label text
- Adjust `--danger` to `#d4605a` and `--success` to `#5ab87a` for ≥4.5:1 contrast
- Add a grayscale test to the design system: all states and badges must be distinguishable in grayscale (not color-dependent)

### 15.6 Add text overflow handling for dynamic content

**Current:** Project names (`ProjectCard.svelte h3`), feature titles, and task descriptions have no `text-overflow`, `max-width`, or truncation constraints. A 200-character project name breaks layout. Long feature titles push action buttons off-screen on mobile.
**Problem:** Any user-provided text can break the layout since there are no length guards.

**Change:** Add to all user-generated text containers:
```css
.truncate-single {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}

.truncate-multi {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;  /* or 3 */
    -webkit-box-orient: vertical;
}
```
Apply `.truncate-single` to: project card titles, feature list titles, task titles, session titles, breadcrumb segments.
Apply `.truncate-multi` to: project descriptions, feature descriptions, task descriptions in list view.
Always show full text on hover (via `title` attribute) and in detail views.

### 15.7 Preserve scroll position across navigation

**Current:** No scroll position stored or restored on any page. Selecting a feature in the project detail page, navigating away and back, or performing inline deletions — all reset scroll to top.
**Problem:** After any navigation or action, users must re-find their place in long lists. This is especially painful with 10+ features or tasks.

**Change:**
- Store scroll position per-route in a reactive Map keyed by URL path.
- On route leave: save `window.scrollY`.
- On route enter: restore saved position (or scroll to top if no saved position).
- For inline list actions (delete, edit), preserve scroll position by not re-rendering the full list — use keyed `{#each}` blocks (already done) and avoid `window.scrollTo(0, 0)`.
- For master-detail (project page): when selecting/deselecting features, preserve the feature list's scroll offset.

### 15.8 Fix toast container width on small viewports

**Current:** `Toast.svelte` `.toast-container` has `max-width: 400px` (fixed). On a 320px viewport, toasts overflow the screen.
**Problem:** Toast notifications are cut off or require horizontal scrolling on small mobile devices.

**Change:**
```css
.toast-container {
    max-width: min(400px, calc(100vw - 2rem));
}
```
Also ensure toast text wraps properly and action buttons within toasts stack vertically on narrow widths.

### 15.9 Add form labels to all inputs

**Current:** Several inputs use placeholder-only without `<label>` elements. TaskItem.svelte edit inputs (title and description) use placeholder text as the only identifier. ResourceList.svelte URL/title inputs lack labels.
**Problem:** Placeholders disappear on focus, leaving no label. Screen readers may not announce the field's purpose. WCAG 1.3.1 (Info and Relationships) requires programmatic label association.

**Change:**
- TaskItem.svelte edit mode: Add visually-hidden `<label>` elements (or use `aria-label`) for the title and description inputs.
- ResourceList.svelte: Add `<label>` for URL and Title fields (can be compact/inline).
- Ensure all `Input` component usages pass a `label` prop. If visual labels would clutter the UI, use `aria-label` instead.
- Fix ID generation in Input.svelte: Replace `Math.random()` with a stable ID generator (e.g., incrementing counter or `crypto.randomUUID()`).

### 15.10 Add pagination or virtualization for large lists

**Current:** FeatureList, TaskList, chat message history, and admin user table render ALL items at once with `{#each}` blocks. No pagination, lazy loading, or virtual scrolling.
**Problem:** With 100+ features or tasks, the page becomes sluggish. DOM node count grows linearly with data volume.

**Change:**
- For feature lists (10+ items expected): Add client-side pagination with "Show more" button (load 20, then 20 more) or virtual scrolling.
- For task lists (potentially 50+ per feature): Same pagination pattern.
- For chat messages: Load last 50 messages initially, add "Load earlier messages" button at top.
- For admin tables: Add server-side pagination (API already supports `page` and `per_page` params).
- Minimum viable approach: Add `{#each items.slice(0, visible_count)}` with a "Show all ({total})" toggle.

### 15.11 Separate destructive actions from high-frequency actions

**Current:** In `TaskItem.svelte`, the Delete button (variant="danger") is directly adjacent to the Edit button (variant="ghost") and the Artifacts button. Five action buttons are in a single row with no visual separation.
**Problem:** Accidental deletion is easy, especially on touch devices where the small icon buttons (28px) are hard to distinguish.

**Change:**
- Separate task actions into two groups with a visual divider:
  - **Primary actions** (left): Approve, Run Ralph
  - **Secondary actions** (right, separated by spacer or divider): Edit, Artifacts, Delete
- Add `margin-left: auto` to push Delete to the far right
- Delete should always be the last (rightmost) action, never adjacent to the most-used action
- Apply the same pattern to: project card actions, feature detail actions, session list delete

### 15.12 Design peak moments — flow completion experiences

**Current:** After creating a project → silent redirect to project list. After feature completion → status badge changes to "Done" with no celebration. After successful pipeline run → history item appears silently.
**Problem:** Peak-End Rule: users judge experiences by peak intensity and the final moment. Every major flow ends with a whimper, not a resolution.

**Change:**
- **Project creation success:** Toast with "Project created! Add your first feature to get started." + auto-navigate to new project detail page.
- **Feature completion (all tasks done):** Show a brief success banner in the feature detail: "✓ All tasks complete!" with confetti-subtle animation (a green flash or checkmark animation, not actual confetti). The banner auto-dismisses after 5s.
- **Pipeline task completion:** If the user is on the pipeline page, flash the completed task row green briefly before it moves to history.
- **First-ever project creation:** Show a slightly richer toast: "Welcome! You've created your first project. Add features and let the AI get to work."

### 15.13 Single primary action per view audit

**Current:** Some views have multiple competing primary-styled buttons. For example, the feature detail page may show "Submit" (primary) alongside "Approve All" (primary) simultaneously.
**Problem:** UX rule: exactly one primary action per view. Multiple primary buttons dilute visual hierarchy and create decision paralysis.

**Change:** Audit every page and ensure exactly one `variant="primary"` button is visible at any time:
- **Feature detail:** Primary = status-dependent action (Submit when Draft, Approve All when has pending tasks). Other actions = secondary/ghost.
- **Pipeline:** Primary = Pause/Resume (the most common action). Stop = danger variant, not primary.
- **Chat:** Primary = Send button. Model selector and new session = secondary.
- **Admin:** Primary = Create Invite Link. User actions = ghost/danger.
- **Project list:** Primary = New Project. Other actions = secondary.

---

## Priority Matrix

> Items from §14 and §15 integrated into the priority matrix below.

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| **P0 — Do first** | 15.1 Focus-visible styles on all elements | High | Small |
| **P0** | 15.2 Icon button min size 44×44px | High | Small |
| **P0** | 15.5 Fix color contrast (muted text, badges) | High | Small |
| **P0** | 12.1 Custom confirm modal | High | Small |
| **P0** | 5.1 Markdown rendering in chat | High | Small |
| **P0** | 4.1 Live task duration | High | Tiny |
| **P0** | 3.4 Feature detail hierarchy (tasks first) | High | Medium |
| **P0** | 14.8 ARIA labels on icon-only buttons | High | Small |
| **P0** | 14.2 Guard action handlers against stale state | High | Small |
| **P0** | 15.3 prefers-reduced-motion media query | High | Tiny |
| **P0** | 15.9 Form labels on all inputs | High | Small |
| **P0** | 15.11 Separate destructive from high-frequency actions | High | Small |
| **P0** | 15.13 Single primary action per view | High | Small |
| **P1 — High value** | 2.1 Dashboard activity feed | High | Medium |
| **P1** | 13.3 Notification system | High | Medium |
| **P1** | 3.3 Progressive disclosure feature form | High | Medium |
| **P1** | 3.13 Confirmation before feature submission | High | Small |
| **P1** | 3.14 Preserve form input across errors | High | Small |
| **P1** | 14.3 SSE reconnection state reconciliation | High | Small |
| **P1** | 14.1 Preserve partial chat responses | Medium | Small |
| **P1** | 14.4 Optimistic UI updates with rollback | Medium | Medium |
| **P1** | 14.5 Debounce pipeline action buttons | Medium | Tiny |
| **P1** | 3.5 Pending approval badges | Medium | Small |
| **P1** | 3.6 Streamline approval flow | Medium | Small |
| **P1** | 5.2 Copy button on messages | Medium | Small |
| **P1** | 4.3 Copy log button (global CodeBlock) | Medium | Tiny |
| **P1** | 6.4 Agent → feature/task links | Medium | Small |
| **P1** | 14.14 Eliminate redundant project+features API call | Medium | Tiny |
| **P1** | 15.4 Semantic HTML landmarks | Medium | Small |
| **P1** | 15.6 Text overflow handling | Medium | Small |
| **P1** | 15.7 Scroll position preservation | Medium | Medium |
| **P1** | 15.12 Peak moment flow completion | Medium | Small |
| **P1** | 11.3 Auth error type differentiation | Medium | Small |
| **P2 — Polish** | 1.1 Sidebar grouping | Medium | Small |
| **P2** | 1.4 Keyboard shortcuts | Medium | Medium |
| **P2** | 3.1 Project search/filter | Medium | Small |
| **P2** | 3.7 Task progress bar | Medium | Small |
| **P2** | 5.3 Session title editing | Medium | Small |
| **P2** | 5.5 Scroll to bottom button | Low | Tiny |
| **P2** | 5.7 Starter prompts | Low | Small |
| **P2** | 6.1 Agent filtering | Medium | Small |
| **P2** | 6.2 Agent elapsed duration | Medium | Tiny |
| **P2** | 7.1 Sync confirmation | Medium | Tiny |
| **P2** | 8.1 Skill search | Low | Small |
| **P2** | 9.1 Date range filter | Medium | Medium |
| **P2** | 9.2 Table sorting | Medium | Small |
| **P2** | 10.1 Rich delete confirmations | Medium | Small |
| **P2** | 12.2 Skeleton loading | Medium | Medium |
| **P2** | 12.3 Context-aware empty states | Low | Small |
| **P2** | 12.7 Transition animations | Low | Medium |
| **P2** | 14.7 Concurrent form editing protection | Medium | Medium |
| **P2** | 14.9 Focus management for modals/drawers | Medium | Small |
| **P2** | 14.10 Project archival filtering | Medium | Small |
| **P2** | 14.11 Trait inheritance resolution UI | Medium | Medium |
| **P2** | 14.15 Chat mobile responsiveness | Medium | Small |
| **P2** | 15.8 Toast width on small viewports | Low | Tiny |
| **P2** | 15.10 Large list pagination/virtualization | Medium | Medium |
| **P3 — Future** | 1.2 Global breadcrumbs | Low | Small |
| **P3** | 1.3 Collapsible sidebar | Low | Medium |
| **P3** | 2.4 Sidebar badges | Medium | Medium |
| **P3** | 3.2 Project card summaries | Low | Small |
| **P3** | 3.8 Inline task failure reason | Low | Tiny |
| **P3** | 3.9 Resource status clarity | Low | Tiny |
| **P3** | 3.10 Feature duplication | Low | Small |
| **P3** | 3.11 Resource mgmt beyond Draft | Low | Small |
| **P3** | 3.12 Mobile slide transition | Low | Small |
| **P3** | 4.2 Auto-refresh log | Medium | Small |
| **P3** | 4.4 Queue reordering | Medium | Large |
| **P3** | 4.5 Remove from queue | Low | Small |
| **P3** | 4.6 History item detail | Low | Small |
| **P3** | 4.7 Pipeline throughput stats | Low | Medium |
| **P3** | 5.4 Model recommendations | Low | Small |
| **P3** | 5.6 Session list context | Low | Small |
| **P3** | 6.3 Live log tailing | Medium | Medium |
| **P3** | 6.5 Context-aware monitoring empty state | Low | Tiny |
| **P3** | 7.2 Diff on sync | Low | Medium |
| **P3** | 7.3 Prompt version history | Low | Large |
| **P3** | 7.4 Trait form help text | Low | Tiny |
| **P3** | 7.5 Trait assignment count | Low | Small |
| **P3** | 7.6 Trait categories | Low | Medium |
| **P3** | 8.2 Skill usage context | Low | Medium |
| **P3** | 8.3 Inline skill linking | Low | Medium |
| **P3** | 9.3 Success rate display | Low | Tiny |
| **P3** | 9.4 Token visualization | Low | Medium |
| **P3** | 9.5 Expandable history rows | Low | Small |
| **P3** | 10.2 User last active | Low | Small |
| **P3** | 10.3 Auto-copy invite URL | Low | Tiny |
| **P3** | 10.4 Bulk invite management | Low | Small |
| **P3** | 11.1 WebAuthn loading UX | Low | Small |
| **P3** | 11.2 Invite page context | Low | Small |
| **P3** | 12.4 Clipboard utility | Low | Tiny |
| **P3** | 12.5 Error toast detail | Low | Small |
| **P3** | 12.6 Icon size standards | Low | Medium |
| **P3** | 13.1 Activity feed API | Medium | Medium |
| **P3** | 13.2 Global search | Medium | Large |
| **P3** | 14.6 Auto-refresh failure backoff | Low | Tiny |
| **P3** | 14.12 Admin metrics dashboard | Low | Medium |
| **P3** | 14.13 Workspace cleanup action | Low | Tiny |
