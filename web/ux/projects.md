# Projects (`/projects`)

Lists all projects as a card grid. Supports CRUD operations, inline editing, multi-select, and batch delete.

---

## Page Header

- Heading: "Projects"
- **Actions (right side, flex-wrap):**
  - "Select all" checkbox + label (only shown when projects exist) → toggles all project checkboxes
  - "Delete {n}" button (danger, delete icon) — only shown when `selected_ids.size > 0`, confirm dialog on click
  - "New Project" / "Cancel" toggle button (primary, add/close icon) → toggles `show_create`

---

## Create Form (conditional — shown when `show_create` is true)

Card with vertical form:
- Text input: "Project name" (required)
- Textarea: "Description (optional)" (2 rows)
- Button: "Create Project" / "Creating..." (primary, disabled while saving or if name empty)

Submit → calls `api.create_project()` → resets form, hides form, reloads project list.

---

## Project List

### State: Loading
- LoadingSpinner: "Loading projects..."

### State: Empty
- EmptyState: folder icon, "No projects yet", "Create one to get started."

### State: Has Projects
Grid layout: `repeat(auto-fill, minmax(280px, 1fr))` — single column on mobile.

### Project Card (per project)

Two modes: **view** and **edit** (inline).

#### View Mode
Entire card is a link → navigates to [/projects/[id]](projects/[id].md).

**Elements:**
- Header row:
  - Checkbox (click stops propagation) → toggles selection
  - Project name (h3)
  - Status badge: `Active` (success) / `Archived` (muted)
- Description text (or "No description")
- Footer row:
  - Calendar icon + creation date
  - Edit button (secondary, sm, edit icon) → enters edit mode (stops link navigation)
  - Delete button (danger, sm, delete icon) → confirm dialog → `api.delete_project()` → reloads list

Card has accent border on hover. Selected cards have persistent accent border.

#### Edit Mode (inline)
Card transforms into a form:
- Text input: project name (pre-filled)
- Textarea: description (pre-filled, 2 rows)
- Footer: Cancel button (secondary) + Save button (primary, disabled while saving or name empty)

Save → `api.update_project()` → exits edit mode, reloads list.

---

## Batch Operations

- **Select all:** Header checkbox toggles all project selections
- **Multi-delete:** When items selected, "Delete {n}" button appears → confirm dialog: "Delete {n} project(s) and all their features?" → parallel `api.delete_project()` calls → clears selection, reloads
- **Single delete:** Per-card delete button → confirm: "Delete this project and all its features?" → `api.delete_project()` → reloads
