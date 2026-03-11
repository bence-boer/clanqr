# Skills (`/skills`)

Displays Copilot CLI skills discovered on the system. Read-only with expand/collapse detail view.

---

## Page Header

- Heading: "Skills"
- Subtitle: "Copilot CLI skills available on this system (from ~/.copilot/skills/)"
- **Refresh button** (secondary, refresh icon):
  - Text: "Refresh Skills" / "Refreshing…"
  - Disabled while refreshing
  - Action: `api.refresh_skills()` → shows result message, reloads list
- **Refresh result message** (conditional): "Found {n} skill(s)" or error text, styled as accent pill

---

## States

### Loading
- Centered LoadingSpinner: "Loading skills…"

### Error
- ErrorBanner with error message

### Empty
- EmptyState: extension icon, "No skills found.", detail: "Add skill directories to ~/.copilot/skills/"

### Has Skills
Responsive grid: `repeat(auto-fill, minmax(280px, 1fr))` — single column on narrow screens.

---

## Skill Card (per skill)

### Collapsed State (default)
- Clickable header (full width button):
  - Extension icon (20px, accent) + Skill name (bold) + Chevron (`expand_more`)
  - Description text (muted)
  - File path (monospace, low opacity)
- Card: hover shows accent border tint

### Expanded State
- Card spans full grid width (`grid-column: 1 / -1`), accent border
- Chevron changes to `expand_less`
- Divider line
- **Content area:**

**State: Loading content**
- LoadingSpinner: "Loading content…"

**State: Content loaded**
- Main content: `<pre>` block (monospace, 0.8rem, max-height 480px, scrollable, pre-wrap)
- **Extra files** (conditional — shown when `files.length > 0`):
  - Each file: `<details>` element
    - Summary: description icon + filename (accent color, clickable)
    - Content: `<pre>` block (max-height 320px)

---

## Interaction Flow

1. Click collapsed card → loads skill detail via `api.get_skill(name)` → expands card
2. Click expanded card → collapses, clears content
3. Only one skill expanded at a time (clicking another collapses the previous)
4. Refresh button → `api.refresh_skills()` → re-scans filesystem, reloads list
