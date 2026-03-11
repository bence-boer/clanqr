# Dashboard (`/`)

The main landing page after authentication. Displays project stats, system health, pipeline status, and quick navigation links. Data refreshes via SSE events and 15s polling fallback.

---

## Data Loading

### State: Loading
- Heading: "Dashboard"
- Stale data banner (conditional — see below)
- LoadingSpinner: "Loading..."

### State: Loaded
All sections below render.

### Stale Banner
- Shown when SSE connection is lost and polling has failed
- Yellow/warning banner: "Data may be outdated — unable to reach server"

---

## Stats Row

Three equal-width cards in a 3-column grid (stacks on mobile):

| Card | Icon | Value | Label | Click → |
|---|---|---|---|---|
| Projects | `folder` | `projects.length` | "Projects" | Navigate to [/projects](projects.md) |
| Features | `category` | `feature_count` | "Features" | Navigate to [/projects](projects.md) |
| Pipeline | `account_tree` | State label (Running/Paused/Idle) | "Pipeline · {queue_depth} queued" | Navigate to [/pipeline](pipeline.md) |

Pipeline stat card color varies: blue for running, accent for paused, muted for idle.

---

## System Stats Card

**Header row:** "System Stats" heading + two action buttons:
- Refresh icon button (ghost) → manually reloads system stats
- "Auto-refresh" toggle button (primary when active, secondary when inactive) → toggles 15s polling of system stats

### Alerts (conditional)
Shown above stats if any system alerts exist. Each alert is a colored banner:
- `warning` severity: orange background, warning icon
- `critical` severity: red background, error icon
- Text: alert message

### Stats Grid
Four rows (Temperature row conditional — only if `cpu_temp_celsius !== null`):

| Metric | Progress bar color | Value format |
|---|---|---|
| CPU | accent | `{percent}%` |
| Memory | accent | `{percent}% of {total_gb}GB` |
| Storage | accent (red if >80%) | `{percent}% of {total_gb}GB` |
| Temperature | accent (orange if >60°C) | `{temp}°C` |

Each row: label (90px) + progress bar + value (80px right-aligned).

### State: Unavailable
If `system_stats` is null: "Stats unavailable" muted text.

---

## Pipeline Card

Shown only when `pipeline` data is available.

**Header row:** "Pipeline" heading + "View details →" link → navigates to [/pipeline](pipeline.md)

**Card content (horizontal flex, wraps):**
- State indicator: icon + label (Running/Paused/Idle) with color coding
- Queue info: queue icon + "{n} task(s) queued"
- Action button (rightmost, depends on state):

| Pipeline state | Button |
|---|---|
| `running` | "Pause" (default) → calls `api.pipeline_pause()` then reloads |
| `paused` | "Resume" (primary) → calls `api.pipeline_resume()` then reloads |
| `idle` + queue > 0 | "View Queue" (primary, link) → navigates to [/pipeline](pipeline.md) |
| `idle` + queue = 0 | No button shown |

---

## Quick Actions

Four action cards in a 4-column grid (2 columns on mobile):

| Card | Icon | Label | Click → |
|---|---|---|---|
| New Project | `add` | "New Project" | Navigate to [/projects](projects.md) |
| Open Chat | `chat` | "Open Chat" | Navigate to [/chat](chat.md) |
| View Pipeline | `account_tree` | "View Pipeline" | Navigate to [/pipeline](pipeline.md) |
| Manage Prompts | `tune` | "Manage Prompts" | Navigate to [/prompts](prompts.md) |

Each card: vertical layout, icon (22px accent) + label. Hover: elevated background, accent border.
