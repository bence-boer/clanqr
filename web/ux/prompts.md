# Prompts & Traits (`/prompts`)

Manages base agent prompts and the traits library. Two-tab layout.

---

## Page Header

- Heading: "Prompts & Traits" (with tune icon)
- **Context-dependent action button (right side):**
  - When "Base Prompts" tab active: "Sync from Repo" button (secondary, sync icon) — spins while syncing
  - When "Traits Library" tab active: "New Trait" button (primary, add icon) → opens trait creation form

---

## Tabs

| Tab | Icon | Label | Badge |
|---|---|---|---|
| Base Prompts | `description` | "Base Prompts" | — |
| Traits Library | `psychology` | "Traits Library" | Count badge showing `traits.length` (when > 0) |

---

## Tab 1: Base Prompts

### State: Loading
- LoadingSpinner: "Loading prompts…"

### State: Error
- ErrorBanner with error message

### State: Empty
- EmptyState: description icon, "No prompts found.", detail: 'Click "Sync from Repo" to load prompts from the agents/prompts/ directory.'

### State: Has Prompts
Two-column grid (single column on mobile).

### Prompt Card (per prompt — typically "manager" and "ralph")

**Header:**
- Role icon: `assignment` (manager) / `build` (ralph)
- Title: "Manager Prompt" / "Ralph Prompt"
- Meta: "v{version} · Updated {date}"
- "Edit" button (secondary, sm) — hidden while editing

**Content area:**
- Textarea: monospace font, 18 rows
  - Read-only in view mode (muted text, regular border)
  - Editable in edit mode (full color text, accent border + glow)

**Edit actions (conditional — shown while editing):**
- "Save" / "Saving…" button (primary, save icon, spins while saving)
- "Cancel" button (secondary, disabled while saving)

Card has accent border while editing.

**Save → `api.update_prompt(role, content)` → exits edit mode, reloads.**

**Sync from Repo → `api.sync_prompts()` → success toast, reloads prompts, resets edit states.**

---

## Tab 2: Traits Library

### Filter Bar
- Three filter buttons: "All" / "Manager" / "Ralph" (filter variant, active highlighting)
- Count text (right-aligned): "{n} trait(s)"

### Trait Form (conditional — shown when creating or editing)

Accent-bordered card:

**Header:** "New Trait" / "Edit Trait" (with icon) + Close button (ghost, X icon)

**Fields:**
- Row: Name input (required) + Target select (Ralph / Manager)
- Description input (optional)
- Content textarea (6 rows, required) — "The prompt text injected by this trait…"
- Global trait toggle switch (custom CSS toggle button with thumb animation)
  - Label: "Global trait" + hint "(applied to all tasks automatically)"

**Error display:** inline error with error icon (conditional)

**Actions:** "Create Trait" / "Update Trait" button (primary, save icon) + "Cancel" button (secondary)

**Validation:** Name and Content are required; shows error inline if missing.

### State: Empty
- EmptyState: psychology icon, "No traits yet." / "No {target} traits."
- Detail: "Create a trait to extend agent behaviour on specific tasks."

### State: Has Traits
Vertical list of trait rows.

### Trait Row (per trait)

**Left side (main info):**
- Name (monospace, bold)
- Badges: target (manager=info, ralph=warning) + "global" badge (success, conditional)
- Description (truncated at 80 chars)
- Content preview (monospace, low opacity, truncated at 120 chars, ellipsis)

**Right side (actions):**
- **Default state:** "Edit" button (secondary, sm, edit icon) + Delete button (danger, sm, delete icon)
- **Delete confirmation state:** "Delete?" text (danger) + "Yes" / "No" buttons
  - Yes → `api.delete_trait()` → reloads
  - No → cancels confirmation

**Edit → opens form pre-filled with trait data, `editing_id` set.**
