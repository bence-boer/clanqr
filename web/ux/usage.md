# Usage (`/usage`)

Analytics dashboard showing agent run statistics, breakdowns, and paginated history.

---

## Page Header

- Heading: "Usage Analytics"

---

## Summary Stats

### State: Loading
- Centered LoadingSpinner: "Loading stats..."

### State: Loaded
Two stat grids:

**Row 1 (3 columns):**

| Card | Icon | Value | Label |
|---|---|---|---|
| Total Runs | `bar_chart` | `summary.total_runs` | "Total Runs" |
| Today | `today` | `summary.today_runs` | "Today" |
| This Week | `date_range` | `summary.week_runs` | "This Week" |

**Row 2 (2 columns):**

| Card | Icon | Value | Label |
|---|---|---|---|
| Completed | `check_circle` | `summary.completed_runs` | "Completed" |
| Failed | `error` | `summary.failed_runs` | "Failed" |

---

## Usage Breakdown

Two-panel grid (single column on mobile). Each panel is a card:

### Breakdown by Type
- Horizontal bar chart
- Rows sorted by count (descending)
- Each row: label (96px) + progress bar (accent fill, proportional) + count
- Empty: "No data yet"

### Breakdown by Model
- Same format as by-type
- Shows each model name and its run count

---

## Run History

Card with header + table.

### Header
- "Recent Runs" heading + count badge
- **Filters (right side):**
  - Type filter select: All types / manager / ralph / chat
  - Status filter select: All statuses / completed / failed / running / stopped / queued

### State: Loading
- Centered LoadingSpinner: "Loading runs..."

### State: Empty
- EmptyState: analytics icon, "No runs found", "Try adjusting your filters."

### State: Has Runs

**Table columns:**

| Column | Content |
|---|---|
| Type | Badge: manager (info) / ralph (warning) / chat (success) |
| Model | Model name (muted, truncated at 140px) or "default" |
| Status | StatusBadge (color-coded) |
| Duration | Formatted: "< 1s", "45s", "2m 30s" (tabular-nums) |
| Tokens | Sum of prompt + completion tokens (locale-formatted) or "-" |
| Date | Relative time: "45s ago", "2m ago", "3h ago", "2 days ago" |

Table rows highlight on hover.

### Pagination
- Below table, bordered top
- Page controls: Previous / Next with page numbers
- Filter changes reset to page 1
