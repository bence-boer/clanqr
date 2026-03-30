# PLAN-PLAN: shadcn-svelte UI Migration

> **What this document is:** Instructions for a future agent to create the detailed implementation plan
> for migrating Ralph's frontend from custom CSS components to shadcn-svelte with custom theming.
>
> **What this document is NOT:** The implementation plan itself. The next agent reads this, invokes the
> required skills, studies the reference project, and produces the step-by-step migration plan.

---

## 1 · Skills to Invoke (Mandatory, In Order)

The planning agent **must** invoke these skills before writing any plan content:

| Priority | Skill | Purpose |
|----------|-------|---------|
| 1 | `shadcn-svelte` | Primary reference for component APIs, installation, CLI, theming, Tailwind v4 integration |
| 2 | `svelte-engineer` | Svelte 5 component patterns — `$props`, `$state`, `$derived`, `{@render}`, callback props |
| 3 | `svelte-architect` | Layout structure decisions, route organization, state boundaries |
| 4 | `ux-designer` | Design system decisions, user flows, component selection, dark theme contrast |
| 5 | `meta-engineer` | scenarios/ui-flow, domains/visual-design, domains/user-value, domains/workflow-fit |

---

## 2 · Codebase to Study

### 2.1 Current Frontend (Ralph)

**Location:** `web/`

**Package dependencies** (`web/package.json`):
- SvelteKit ^2.50.2, Svelte ^5.49.2, Vite ^7.3.1
- `@simplewebauthn/browser` (passkey auth)
- `hono` (type-safe RPC client)
- `marked` + `dompurify` + `highlight.js` (markdown rendering)
- **No Tailwind, no component library, no CSS framework**

**Route structure** — read every `+page.svelte` and `+layout.svelte`:

```
web/src/routes/
├── +layout.svelte              # Root: auth gating, sidebar, alerts, notifications
├── +page.svelte                # Dashboard: KPIs, pipeline overview, activity feed
├── admin/
│   ├── +layout.svelte          # Admin guard
│   ├── users/+page.svelte      # User management table
│   ├── invites/+page.svelte    # Invite token CRUD
│   ├── maintenance/+page.svelte # Server maintenance actions
│   └── metrics/+page.svelte    # System metrics
├── chat/+page.svelte           # LLM chat interface (SSE streaming)
├── invite/+page.svelte         # Public registration page
├── monitoring/+page.svelte     # System health, resource usage
├── pipeline/+page.svelte       # Task queue, drag-and-drop reorder
├── projects/
│   ├── +page.svelte            # Project list with CRUD
│   └── [id]/+page.svelte       # Project detail: features, tasks, agent runs
├── prompts/+page.svelte        # Prompt editor (markdown)
├── skills/+page.svelte         # Skill browser and linking
└── usage/+page.svelte          # Token usage analytics
```

**Component inventory** — read every component:

Primitives in `web/src/lib/components/`:
```
button/Button.svelte          # 7 variants (default, primary, secondary, danger, ghost, tab, filter)
input/Input.svelte             # Text input with optional label
label/Label.svelte             # Form label
select/Select.svelte           # Native select dropdown
textarea/Textarea.svelte       # Multi-line text input
badge/Badge.svelte             # 6 variants (default, muted, info, warning, success, danger)
icon/Icon.svelte               # Material Symbols icon renderer
pagination/Pagination.svelte   # Page navigation
accordion/Accordion.svelte     # Collapsible sections
checkbox/Checkbox.svelte       # Checkbox input
code-block/CodeBlock.svelte    # Syntax-highlighted code
confirm-modal/ConfirmModal.svelte  # Confirmation dialog
empty-state/EmptyState.svelte  # Empty state placeholder
error-banner/ErrorBanner.svelte    # Error notification banner
loading-spinner/LoadingSpinner.svelte  # Loading indicator
notification-bell/NotificationBell.svelte  # Notifications dropdown
skeleton/Skeleton.svelte       # Loading skeleton
stat-card/StatCard.svelte      # Metric display card
status-badge/StatusBadge.svelte    # Task/process status indicator
tabs/Tabs.svelte               # Tab navigation (keyboard-accessible)
toast/Toast.svelte             # Toast notification system
```

Route-specific components (in route directories):
```
AuthScreen.svelte              # Auth UI (loading/error/setup/login states)
AuthFeedback.svelte            # Auth feedback messages
Sidebar.svelte                 # Main navigation sidebar (220px, collapsible)
SidebarNav.svelte              # Nav links (role-aware)
NotificationBell.svelte        # SSE-based notifications
```

Plus page-specific components: `ProjectCard`, `TaskRow`, `FeatureCard`, etc.

**CSS design system** — read `web/src/lib/styles/global.css`:

```css
:root {
  --bg: #1a1816;                /* Main dark background */
  --bg-surface: #231f1c;       /* Card/elevated surfaces */
  --bg-elevated: #2c2724;      /* Higher elevation surfaces */
  --fg: #e6e1d6;               /* Primary text (warm off-white) */
  --fg-muted: #b0a99b;         /* Secondary text */
  --border: #3d3630;           /* Border/divider */
  --accent: #d4af37;           /* Gold accent (primary action) */
  --accent-dim: rgba(212, 175, 55, 0.15);  /* Accent transparent */
  --danger: #d4605a;           /* Destructive red */
  --success: #5ab87a;          /* Success green */
  --radius: 8px;               /* Border radius */
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --icon-sm: 16px;
  --icon-md: 20px;
  --icon-lg: 32px;
  --icon-xl: 48px;
}
```

**Styling patterns:**
- All scoped `<style>` blocks in Svelte components
- All colors via CSS variables — no hardcoded hex in components
- Spacing via rem units (0.25rem–2.5rem scale)
- Transitions: 0.15s–0.2s ease
- Icons: Material Symbols Rounded (16–48px)
- Responsive: `@media (max-width: 768px)` single breakpoint
- Global status classes: `.badge-active`, `.badge-running`, `.badge-failed`, etc.

**Layout architecture:**
- Sidebar: 220px fixed left, collapsible to 48px (icon-only), persisted to localStorage
- Mobile: sidebar overlays as drawer with backdrop, hamburger toggle
- Content: `margin-left` matches sidebar width, max-width 1200px, padding 2rem (1rem mobile)
- Auth: overlay screen renders instead of sidebar+content when unauthenticated

**API client pattern** — read `web/src/lib/api/client.ts`:
- Hono RPC with `hc<AppType>(BASE_URL)` for full type inference
- All endpoints wrapped with `unwrap()` error handler
- Types inferred from server via `InferResponseType`

**Type system** — read `web/src/lib/types/index.ts`:
- All types derived from Hono RPC response types
- Database enums imported from Supabase generated types
- ~10 major type groups: Projects, Features, Tasks, Users, Pipeline, Chat, etc.

### 2.2 Reference Project (Wello)

**Location:** `/home/scoy/Developer/repositories/wello/web/`

Study these files to understand how shadcn-svelte is configured and customized:

**Configuration:**
- `components.json` — shadcn-svelte config (style: "maia", iconLibrary: "tabler", baseColor: "taupe")
- `vite.config.ts` — `@tailwindcss/vite` plugin setup
- `package.json` — dependency list and versions

**Theme setup:**
- `src/app.css` — `@import 'tailwindcss'`, `@theme` directive, CSS variables, base layer styles

**Utilities:**
- `src/lib/utils.ts` — `cn()` function (clsx + tailwind-merge), utility types

**Component patterns** (read all files in each directory):
- `src/lib/components/ui/button/` — `tailwind-variants` (tv) with enum variants, polymorphic `<button>`/`<a>`
- `src/lib/components/ui/card/` — simple tv wrapper with shadow variants
- `src/lib/components/ui/section/` — complex wrapper with background color mapping, padding enums
- `src/lib/components/ui/sticker/` — badge/label with color variants

**Color system:**
- `src/lib/colors.const.ts` — `AppColor` enum, `resolve_app_bg_class()` utility

**Key patterns to adopt:**
1. `tailwind-variants` (tv) for variant definitions with `base` + `variants` + `defaultVariants`
2. Enum-based variant props (`ButtonVariant`, `CardVariant`) in `.types.ts` files
3. `cn()` for merging Tailwind classes
4. `$props()` destructuring with `$bindable(null)` for ref forwarding
5. `data-slot` attributes for component identification
6. `{@render children?.()}` for content projection
7. `WithElementRef<T>` utility type for typed ref bindings

**Key differences from Ralph:**
- Wello is light theme, Ralph needs dark theme
- Wello is a playful/marketing site, Ralph is a professional developer tool
- Wello uses custom brand colors, Ralph uses a warm dark palette with gold accent
- Ralph needs many more component types (Table, Dialog, Form, Sidebar, etc.)

---

## 3 · Theme Design Requirements

### 3.1 Color Mapping

The plan must define a complete mapping from Ralph's current CSS variables to shadcn's expected variable system. The planning agent should produce a full `app.css` color definition.

**shadcn expected variables** (dark theme values needed):

| shadcn Variable | Ralph Equivalent | Current Value | Notes |
|----------------|-----------------|---------------|-------|
| `--background` | `--bg` | `#1a1816` | Page background |
| `--foreground` | `--fg` | `#e6e1d6` | Primary text |
| `--card` | `--bg-surface` | `#231f1c` | Card backgrounds |
| `--card-foreground` | `--fg` | `#e6e1d6` | Card text |
| `--popover` | `--bg-elevated` | `#2c2724` | Popover/dropdown bg |
| `--popover-foreground` | `--fg` | `#e6e1d6` | Popover text |
| `--primary` | `--accent` | `#d4af37` | Primary actions (gold) |
| `--primary-foreground` | `--bg` | `#1a1816` | Text on primary buttons |
| `--secondary` | `--bg-surface` | `#231f1c` | Secondary actions |
| `--secondary-foreground` | `--fg` | `#e6e1d6` | Text on secondary |
| `--muted` | `--bg-elevated` | `#2c2724` | Muted backgrounds |
| `--muted-foreground` | `--fg-muted` | `#b0a99b` | Muted/secondary text |
| `--accent` | `--bg-elevated` | `#2c2724` | Accent backgrounds |
| `--accent-foreground` | `--fg` | `#e6e1d6` | Accent text |
| `--destructive` | `--danger` | `#d4605a` | Error/destructive |
| `--destructive-foreground` | `--fg` | `#e6e1d6` | Text on destructive |
| `--border` | `--border` | `#3d3630` | Borders |
| `--input` | `--border` | `#3d3630` | Input borders |
| `--ring` | `--accent` | `#d4af37` | Focus ring (gold) |

**Sidebar-specific variables** (for shadcn Sidebar component):

| Variable | Value | Notes |
|----------|-------|-------|
| `--sidebar-background` | `#231f1c` | Sidebar bg |
| `--sidebar-foreground` | `#e6e1d6` | Sidebar text |
| `--sidebar-primary` | `#d4af37` | Active nav item |
| `--sidebar-primary-foreground` | `#1a1816` | Active nav text |
| `--sidebar-accent` | `#2c2724` | Hover state bg |
| `--sidebar-accent-foreground` | `#e6e1d6` | Hover state text |
| `--sidebar-border` | `#3d3630` | Sidebar borders |
| `--sidebar-ring` | `#d4af37` | Sidebar focus |

**Additional custom variables to preserve:**

| Variable | Value | Purpose |
|----------|-------|---------|
| `--success` | `#5ab87a` | Success states, status badges |
| `--warning` | `#d4af37` | Warning states (same as accent) |
| `--accent-dim` | `rgba(212, 175, 55, 0.15)` | Accent transparent for badges |

### 3.2 Typography

- Font: Inter (current) — install `@fontsource-variable/inter`
- Define in `@theme { --font-sans: 'Inter Variable', ... }`
- Base size: 16px, line-height 1.5
- Code font: system monospace stack

### 3.3 Spacing & Radius

- `--radius`: 0.5rem (8px, matches current)
- shadcn uses `--radius` for all components, adjust per-component via Tailwind

### 3.4 Dark Theme as Default

Ralph is dark-themed only. The plan must:
- Set dark mode as the default (no toggle initially)
- Define all variables in `:root` (not nested in `.dark` or `[data-theme="dark"]`)
- Optionally define a `.light` theme for future use, but do not wire up a toggle

---

## 4 · Setup Phase — What the Plan Must Cover

### 4.1 Dependency Installation

```bash
# In web/ directory
bun add tailwindcss@4 @tailwindcss/vite
bun add clsx tailwind-merge tailwind-variants tw-animate-css
bun add @fontsource-variable/inter
bun add -d @tabler/icons-svelte  # or lucide-svelte — the plan should decide
```

### 4.2 Vite Configuration

Update `web/vite.config.ts` to add `@tailwindcss/vite` plugin:
```ts
import tailwindcss from '@tailwindcss/vite';
// Add to plugins array: tailwindcss()
```

### 4.3 shadcn-svelte Initialization

```bash
cd web && bunx shadcn-svelte@latest init
```

The plan should specify the `components.json` configuration:
- Style: decide based on shadcn-svelte skill (likely "default" or "new-york")
- Base color: neutral/warm tone to match Ralph's brown palette
- Icon library: decide between `tabler` and `lucide`
- Aliases: `$lib/components`, `$lib/components/ui`, `$lib/utils`, `$lib/hooks`

### 4.4 app.css Setup

Replace/augment `web/src/app.css` (or `+layout.svelte` styles) with:
```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@fontsource-variable/inter';

@theme {
    --font-sans: 'Inter Variable', sans-serif;
    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
    /* ... color tokens from §3.1 ... */
}

@layer base {
    * { @apply border-border outline-ring/50; }
    body { @apply bg-background text-foreground; }
}
```

### 4.5 Utility Setup

Create `web/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

Plus utility types: `WithoutChildren`, `WithElementRef`, etc.

---

## 5 · Component Installation Phases

The plan must define which shadcn components to install in which order, with customization notes for each.

### Phase 1: Foundation (No Page Changes)

Install base components that other components depend on:

```bash
bunx shadcn-svelte@latest add button card badge separator skeleton
bunx shadcn-svelte@latest add input label textarea select
bunx shadcn-svelte@latest add alert sonner
```

**Customization tasks:**
- Button: define ralph-specific variants (primary=gold, danger, ghost, etc.) using `tailwind-variants`
- Card: simple container with `--card` background
- Badge: map existing 6 variants (default, muted, info, warning, success, danger) plus status variants
- Alert: map to ErrorBanner pattern
- Sonner: replace custom Toast system

### Phase 2: Layout Components

```bash
bunx shadcn-svelte@latest add sidebar sheet scroll-area
bunx shadcn-svelte@latest add tabs
bunx shadcn-svelte@latest add dialog alert-dialog
```

**Customization tasks:**
- Sidebar: migrate from custom Sidebar.svelte + SidebarNav.svelte to shadcn Sidebar with:
  - Logo section at top
  - Navigation links (role-aware via SidebarNav)
  - System stats section
  - Collapse toggle
  - Mobile → Sheet transition at 768px breakpoint
- Dialog: replace ConfirmModal with AlertDialog
- Tabs: migrate from custom Tabs.svelte (ensure keyboard navigation preserved)

### Phase 3: Data Display

```bash
bunx shadcn-svelte@latest add table avatar
bunx shadcn-svelte@latest add dropdown-menu popover tooltip
bunx shadcn-svelte@latest add progress
```

**Customization tasks:**
- Table: for project lists, user management, pipeline queue
- Avatar: for chat messages (user/assistant)
- DropdownMenu: for notification bell dropdown, action menus
- Progress: for resource usage in monitoring
- Tooltip: for icon-only buttons, status explanations

### Phase 4: Form Components

```bash
bunx shadcn-svelte@latest add switch checkbox
bunx shadcn-svelte@latest add form  # Formsnap + Superforms
```

**Customization tasks:**
- Switch: for boolean settings
- Form: structured validation with Zod schemas (matches server-side validation pattern)

### Phase 5: Polish

```bash
bunx shadcn-svelte@latest add breadcrumb command collapsible
```

**Customization tasks:**
- Breadcrumb: for nested routes (projects/[id])
- Command: for keyboard shortcut palette (if desired)
- Collapsible: for accordion sections

---

## 6 · Page Migration Plan

For each page, the plan must specify:
1. **Current structure** — what HTML/CSS patterns exist
2. **Target structure** — which shadcn components replace what
3. **Component extraction** — any page exceeding 300 lines must be decomposed
4. **Data flow** — how props and callbacks are wired
5. **Mobile behavior** — responsive adjustments needed

### 6.1 Root Layout (`+layout.svelte`)

**Current:** Custom sidebar (220px fixed), main content area, auth overlay, notification system, alert banner.

**Target:**
- shadcn `SidebarProvider` + `Sidebar` + `SidebarTrigger` wrapping the layout
- `Sheet` for mobile sidebar (replaces custom overlay/drawer)
- Auth overlay remains custom (passkey-specific) but uses Card, Button, Input from shadcn
- Toast system: replace custom Toast with `Sonner`
- Alert banner: replace with shadcn `Alert` component

**Critical:** The sidebar state (open/collapsed) is persisted to localStorage. The shadcn Sidebar component has its own state management — the plan must reconcile this.

### 6.2 Dashboard (`+page.svelte`)

**Current:** KpiBar (inline metrics), PipelineCard (feature pipeline summary), ActivityFeed (recent events), SystemStatsCard (resource metrics).

**Target:**
- KPI metrics → `Card` grid (3–4 cards in a responsive row)
- Pipeline summary → `Card` with `Badge` for status, `Button` for actions
- Activity feed → `Card` containing a scrollable list with `Avatar` + timestamp
- System stats → `Card` with `Progress` bars for CPU/memory
- All sections use `Skeleton` for loading states

### 6.3 Projects (`projects/+page.svelte` + `[id]/+page.svelte`)

**Current:** Project list with create/edit modals, feature management with status badges, task lists with approval workflow.

**Target:**
- Project list → `Table` with sortable columns, `Badge` for status
- Create/edit project → `Dialog` with `Form` (Input, Textarea, Select)
- Feature list → `Card` per feature with `Badge` status, action `Button`s
- Feature detail → tabbed view using `Tabs` (Overview, Tasks, Agent Runs)
- Task list → `Table` with `StatusBadge`, action `DropdownMenu`
- Task approval → `AlertDialog` confirmation
- File artifacts → `Table` with download `Button`s

**Component extraction:**
- `ProjectTable.svelte` — project list table
- `ProjectDialog.svelte` — create/edit dialog
- `FeatureCard.svelte` — individual feature card
- `FeatureDetail.svelte` — feature detail view with tabs
- `TaskTable.svelte` — task list table

### 6.4 Chat (`chat/+page.svelte`)

**Current:** Session sidebar, message thread with markdown rendering, input area with model selection.

**Target:**
- Session list → `ScrollArea` with session items (or nested sidebar)
- Messages → `Card` per message with `Avatar` (user/assistant)
- Markdown content → keep `marked` + `dompurify` + `highlight.js` (shadcn doesn't replace this)
- Input area → `Textarea` with `Button` (send), `Select` (model picker)
- Loading state → `Skeleton` or typing indicator

**Note:** The chat page has SSE streaming. The plan must preserve the streaming message rendering.

### 6.5 Pipeline (`pipeline/+page.svelte`)

**Current:** Queue visualization with drag-and-drop reordering, status badges, action buttons.

**Target:**
- Queue list → `Table` with draggable rows (keep existing drag-and-drop logic)
- Status → `Badge` variants mapped from pipeline status enums
- Actions → `Button` group (start, stop, reorder)
- Pipeline controls → `Card` header with summary stats

### 6.6 Admin Pages

**Users (`admin/users/+page.svelte`):**
- User table → `Table` with `Avatar`, `Badge` for role, `DropdownMenu` for actions
- Role changes → `AlertDialog` confirmation

**Invites (`admin/invites/+page.svelte`):**
- Invite list → `Table` with `Badge` for status (active, used, expired)
- Create invite → `Dialog` with `Form` (expiry, role selection)

**Maintenance (`admin/maintenance/+page.svelte`):**
- Action buttons → `Card` sections with `Button` and `AlertDialog` for destructive actions

**Metrics (`admin/metrics/+page.svelte`):**
- Charts → `Card` containers (keep existing chart logic)
- Stats → `StatCard` pattern using shadcn `Card`

### 6.7 Auth Screen

**Current:** Overlay with state machine (loading, error, setup, login).

**Target:**
- Centered `Card` on dark background
- Loading state: `Skeleton` or spinner
- Error state: `Alert` (destructive variant)
- Setup state: `Form` with `Input` (display name) + `Button` (Create Passkey)
- Login state: `Button` (Sign in with Passkey)
- All using shadcn Button, Input, Card, Alert

### 6.8 Monitoring

**Current:** System health metrics, resource usage, alert history.

**Target:**
- Resource gauges → `Card` with `Progress` bars
- Alert history → `Table` with `Badge` severity levels
- Stats → `Card` grid similar to dashboard

### 6.9 Prompts

**Current:** Prompt list with markdown editor.

**Target:**
- Prompt list → `Card` list or `Table`
- Editor → `Textarea` (large) with live preview area
- Save → `Button`, status feedback via `Sonner` toast

### 6.10 Skills

**Current:** Skill list with link/unlink actions.

**Target:**
- Skill list → `Card` grid with `Badge` for linked status
- Link/unlink → `Button` with `AlertDialog` confirmation

### 6.11 Usage

**Current:** Usage analytics with summary and breakdown.

**Target:**
- Summary cards → `Card` grid with key metrics
- Breakdown table → `Table` with sortable columns
- Charts → `Card` containers (keep existing chart logic)

### 6.12 Invite (Public)

**Current:** Public page for accepting invite tokens.

**Target:**
- Centered `Card` layout (similar to auth screen)
- Token status → `Alert` for invalid/expired tokens
- Registration form → `Form` with `Input` + `Button`

---

## 7 · Migration Strategy

### 7.1 Parallel CSS Approach

During migration, both old CSS and Tailwind will coexist. The plan must address:

1. **Global CSS reset conflicts** — Tailwind's preflight may conflict with existing global styles
2. **Variable name collisions** — Ralph uses `--border` which shadcn also uses (same name, lucky)
3. **Specificity battles** — Tailwind utility classes vs scoped Svelte styles
4. **Migration order** — which files to convert first to minimize conflict surface

**Recommended approach:**
- Set up Tailwind + shadcn alongside existing CSS (Phase 1)
- Migrate one page at a time, removing its `<style>` block after conversion
- Remove `global.css` old variables only after all pages are migrated
- Keep both systems working simultaneously — no big bang

### 7.2 Component Migration Order

The plan should migrate in dependency order:

1. **Layout** first (root layout, sidebar) — affects all pages
2. **Shared components** next (Button, Badge, Card, etc.) — used everywhere
3. **Simple pages** (admin, skills, prompts) — fewer dependencies, good practice
4. **Complex pages** (dashboard, projects, chat, pipeline) — most work, do last
5. **Cleanup** — remove old component files, old CSS, unused imports

### 7.3 Testing at Each Phase

After each migration phase:
```bash
cd web && bun run check          # Type checking must pass
```
- Visual verification in browser for every migrated page
- Mobile responsive check (resize to <768px)
- Keyboard navigation test for interactive components
- Dark theme contrast verification

---

## 8 · Component Customization Patterns

### 8.1 tailwind-variants Pattern

Every customized component should follow this pattern (from wello):

```ts
// button.types.ts
export enum ButtonVariant {
    DEFAULT = 'default',
    PRIMARY = 'primary',
    SECONDARY = 'secondary',
    DANGER = 'danger',
    GHOST = 'ghost',
}

// button.svelte — <script module>
import { tv } from 'tailwind-variants';
import { ButtonVariant } from './button.types.js';

export const button_variants = tv({
    base: 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ...',
    variants: {
        variant: {
            [ButtonVariant.DEFAULT]: 'bg-primary text-primary-foreground hover:bg-primary/90',
            [ButtonVariant.SECONDARY]: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            [ButtonVariant.DANGER]: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            [ButtonVariant.GHOST]: 'hover:bg-accent hover:text-accent-foreground',
        },
    },
    defaultVariants: { variant: ButtonVariant.DEFAULT },
});
```

### 8.2 Status Badge Mapping

Current status badges use global CSS classes. The plan must map these to shadcn Badge variants:

| Current Class | Status Values | Badge Variant | Colors |
|--------------|---------------|--------------|--------|
| `.badge-active`, `.badge-running`, `.badge-completed` | Success states | `success` | Green bg/text |
| `.badge-submitted`, `.badge-in_progress`, `.badge-queued` | Active states | `warning` | Gold/accent |
| `.badge-failed`, `.badge-stopped` | Error states | `destructive` | Red bg/text |
| `.badge-pending`, `.badge-draft` | Neutral states | `secondary` | Muted bg/text |

### 8.3 Icon Migration

Current: Material Symbols via `Icon.svelte` component with string icon names.
Target: Decide between `@tabler/icons-svelte` or `lucide-svelte`.

The plan must include:
- Complete mapping of current icon names to new icon library equivalents
- Whether to keep Material Symbols for some icons or fully migrate
- Icon sizing conventions (currently 16/20/32/48px → Tailwind size classes)

---

## 9 · Accessibility Requirements

The plan must verify and document:

1. **Color contrast** — all text meets WCAG AA (4.5:1 normal, 3:1 large) against dark backgrounds
   - `#e6e1d6` on `#1a1816` — verify ratio
   - `#b0a99b` on `#1a1816` — verify ratio (muted text)
   - `#d4af37` on `#1a1816` — verify ratio (gold accent)
   - Badge text on badge backgrounds
2. **Focus indicators** — gold ring (`--ring: #d4af37`) visible on dark backgrounds
3. **Keyboard navigation** — all interactive elements reachable via Tab, activated via Enter/Space
4. **Screen readers** — ARIA labels on icon-only buttons, status badges, notification counts
5. **Reduced motion** — respect `prefers-reduced-motion` for animations
6. **Dialog focus trapping** — shadcn handles this, but verify with passkey auth flow

---

## 10 · Animation & Polish Specifications

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Sidebar collapse/expand | Width transition | 200ms | ease-out |
| Mobile sidebar | Slide from left | 200ms | ease-out |
| Dialog open/close | Fade + scale | 150ms | ease-out |
| Toast enter | Slide from bottom | 200ms | ease-out |
| Toast exit | Fade out | 150ms | ease-in |
| Skeleton shimmer | Gradient sweep | 1.5s | linear loop |
| Button hover | Background color | 150ms | ease |
| Badge appear | Fade in | 100ms | ease |
| Card hover (if interactive) | Subtle elevation | 150ms | ease |
| Page transitions | None (SPA mode, instant) | — | — |

---

## 11 · Constraints & Guardrails

The planning agent must encode these constraints into every section:

### Svelte 5 Rules (Non-Negotiable)
- `$props()` — never `export let`
- `$state()` — never `writable()` or stores
- `$derived()` — never `$:` reactive statements
- `{@render children?.()}` — never `<slot>`
- Callback props — never `createEventDispatcher`

### Architecture Rules (from AGENTS.md)
- Page components must stay under 300 lines — decompose into subcomponents
- SSR is disabled (`ssr: false` in `+layout.ts`) — all client-side
- Data fetching via `onMount` + polling — not SvelteKit `load()` functions
- Auth state checked client-side
- `snake_case` for variables/functions, `PascalCase` for types, `kebab-case` for files

### Package Management
- **Bun only** — no npm, yarn, or pnpm commands
- `bun install --frozen-lockfile` in CI
- Minimize new dependencies — justify each addition

### Styling Rules
- CSS custom property names must match exactly (per AGENTS.md §20)
- All colors via variables — no hardcoded hex in components
- Dark theme as default — no theme toggle yet
- Mobile breakpoint at 768px (existing convention)

### No Breaking Changes
- All existing API integrations must continue working
- Auth flow (WebAuthn passkeys) must remain functional
- SSE notifications must keep working
- Chat streaming must not break
- Drag-and-drop in pipeline must be preserved

---

## 12 · Validation Criteria (Definition of Done)

The implementation plan must define these checkpoints at the end:

### Type Safety
```bash
cd web && bun run check  # 0 errors
```

### Visual Verification (Per Page)
- [ ] Dashboard: KPIs render, pipeline card shows data, activity feed scrolls
- [ ] Projects: Table loads, create dialog works, feature detail renders
- [ ] Chat: Messages display with markdown, streaming works, model selection works
- [ ] Pipeline: Queue renders, drag-and-drop works, status badges correct
- [ ] Admin: Users table, invite creation, maintenance actions
- [ ] Auth: All 4 states render correctly (loading, error, setup, login)
- [ ] Monitoring: Health metrics display, charts render
- [ ] Prompts: List renders, editor works
- [ ] Skills: List renders, link/unlink works
- [ ] Usage: Summary and breakdown render
- [ ] Invite: Public page renders, token validation works

### Responsive
- [ ] Every page renders correctly at 768px and below
- [ ] Sidebar collapses to Sheet on mobile
- [ ] No horizontal overflow on any page
- [ ] Touch targets are at least 44px

### Accessibility
- [ ] All interactive elements keyboard-accessible
- [ ] Focus visible on all focusable elements
- [ ] Color contrast passes WCAG AA
- [ ] Screen reader can navigate all pages

### CSS Cleanliness
- [ ] No remaining `<style>` blocks with old custom CSS (all migrated to Tailwind)
- [ ] `global.css` cleaned up — only variables needed for non-UI code remain
- [ ] No CSS specificity conflicts between old and new styles
- [ ] No unused CSS variables

### No Regressions
- [ ] API calls work (check network tab)
- [ ] Auth flow complete (setup + login)
- [ ] SSE notifications arrive
- [ ] Chat streaming renders incrementally
- [ ] Pipeline drag-and-drop functional
- [ ] All toast notifications display
- [ ] Alert banners show when system has critical alerts

---

## 13 · Estimated Scope

| Phase | Components | Pages Affected | Estimated Effort |
|-------|-----------|---------------|-----------------|
| Setup | Tailwind, shadcn init, theme | None yet | Small |
| Foundation components | ~10 components | None yet (just install) | Small |
| Layout migration | Sidebar, Sheet, Alert, Sonner | Root layout | Medium |
| Dashboard | Card, Badge, Progress, Skeleton | Dashboard | Medium |
| Projects | Table, Dialog, Form, Tabs, Badge | Projects (2 pages) | Large |
| Chat | Card, Avatar, Textarea, ScrollArea | Chat | Medium |
| Pipeline | Table, Badge, Button | Pipeline | Medium |
| Admin | Table, Dialog, Badge, DropdownMenu | Admin (4 pages) | Medium |
| Simple pages | Card, Table, various | Monitoring, Prompts, Skills, Usage | Medium |
| Auth + Invite | Card, Alert, Input, Button | Auth, Invite | Small |
| Cleanup | Remove old CSS/components | All | Medium |

**Total:** This is a large migration. The plan should be designed for incremental delivery — each phase should leave the app in a working state.

---

## 14 · Open Questions for the Planning Agent

The planning agent should decide and document answers to these:

1. **Icon library choice:** `@tabler/icons-svelte` (like wello) or `lucide-svelte` (shadcn default)?
   - Tabler has more icons but requires separate install
   - Lucide is the shadcn-svelte default and better integrated
2. **shadcn style:** "default" or "new-york"? (Study the shadcn-svelte skill for differences)
3. **Form validation:** Adopt Formsnap + Superforms (full shadcn Form component) or keep current inline validation?
   - Current forms are simple — may not need the weight of Superforms
4. **Chart library:** Keep existing charts or adopt a Tailwind-compatible charting solution?
5. **Markdown rendering in chat:** Keep `marked` + `highlight.js` or consider a Tailwind-typography-compatible solution?
6. **Base color palette:** Which shadcn base color most closely matches Ralph's warm brown tones? (stone, neutral, zinc, slate?)
7. **Should the plan include a light theme** even if not wired up? (Future-proofing vs scope creep)

---

## 15 · How to Structure the Final Plan

The planning agent should output a plan with this structure:

```markdown
# Implementation Plan: shadcn-svelte UI Migration

## Phase 0: Setup & Configuration
- [ ] Step-by-step commands and file changes

## Phase 1: Foundation Components
- [ ] Install commands
- [ ] Customization for each component
- [ ] Verification steps

## Phase 2: Layout Migration
- [ ] Root layout changes
- [ ] Sidebar migration
- [ ] Mobile responsive
- [ ] Verification steps

## Phase 3-N: Page Migrations (one section per page)
- [ ] Current -> Target mapping
- [ ] Component extraction plan
- [ ] Code snippets for complex patterns
- [ ] Verification steps

## Phase Final: Cleanup
- [ ] Remove old components
- [ ] Remove old CSS
- [ ] Final verification checklist
```

Each step should be atomic and verifiable. The agent executing the plan should be able to follow it mechanically without needing to make design decisions.
