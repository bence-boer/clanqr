# Implementation Plan: shadcn-svelte UI Migration

> **Purpose:** Step-by-step plan for migrating Ralph's frontend from custom CSS components to
> shadcn-svelte with Tailwind CSS v4, custom dark theming, and the Wello component pattern.
>
> **Audience:** An implementing agent that will execute each phase mechanically without design decisions.
>
> **Prerequisites:** Skills loaded — `shadcn-svelte`, `svelte-engineer`, `svelte-architect`,
> `ux-designer`, `meta-engineer` (ui-flow scenario + visual-design, user-value, workflow-fit domains).

---

## Architecture Decisions

These decisions are final. The implementing agent must not revisit them.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Icon library** | `lucide-svelte` → `@lucide/svelte` | shadcn-svelte default; tighter integration; fewer wiring issues |
| **shadcn style** | `default` | Ralph is a professional dev tool, not a playful marketing site like Wello |
| **Base color** | `stone` | Closest match to Ralph's warm brown tones; `neutral` is too cool |
| **Form validation** | Keep current inline validation | Forms are simple. Superforms/Formsnap add weight without clear benefit. Revisit if forms grow complex. |
| **Markdown rendering** | Keep `marked` + `dompurify` + `highlight.js` | shadcn has no markdown equivalent; these are battle-tested |
| **Chart library** | None needed | Ralph uses stat cards, not charts. No chart components exist today. |
| **Light theme** | No | Dark-only. All CSS variables defined in `:root`. No `.dark` selector, no `mode-watcher`. |
| **CSS variable format** | oklch | Future-proof, wide gamut, consistent with shadcn defaults |
| **Font loading** | `@fontsource-variable/inter` | Replace Google Fonts CDN with local package for reliability and performance |
| **Sidebar collapsible mode** | `icon` | Matches current behavior: 220px → 48px icon-only, not offcanvas |
| **Sidebar variant** | `sidebar` (default) | Standard fixed sidebar, not floating or inset |
| **Component naming** | `snake_case` functions, `PascalCase` types, `kebab-case` files | Matches AGENTS.md conventions |
| **tv() pattern** | Follow Wello's enum-backed `tailwind-variants` pattern | Enums for variants, `SCREAMING_SNAKE` members, kebab-case values |

---

## Accessibility Verification (Pre-Validated)

All color combinations pass WCAG AA (4.5:1 for normal text, 3:1 for large text):

| Combination | Ratio | AA | AAA |
|-------------|-------|-----|-----|
| `--fg` (#e6e1d6) on `--background` (#1a1816) | 13.58:1 | ✅ | ✅ |
| `--muted-foreground` (#b0a99b) on `--background` | 7.58:1 | ✅ | ✅ |
| `--primary` (#d4af37) on `--background` | 8.42:1 | ✅ | ✅ |
| `--destructive` (#d4605a) on `--background` | 4.74:1 | ✅ | Large only |
| `--success` (#5ab87a) on `--background` | 7.23:1 | ✅ | ✅ |
| `--fg` on `--card` (#231f1c) | 12.54:1 | ✅ | ✅ |
| `--muted-foreground` on `--card` | 7.00:1 | ✅ | ✅ |
| `--primary` on `--card` | 7.78:1 | ✅ | ✅ |
| `--primary-foreground` (#1a1816) on `--primary` (#d4af37) | 8.42:1 | ✅ | ✅ |

> **Note:** `--destructive` on `--background` is 4.74:1 — passes AA normal text but not AAA.
> Destructive elements always appear on `--card` or `--muted` surfaces where the ratio is higher,
> or as large text (buttons), so this is acceptable.

---

## Phase 0: Setup & Configuration

### 0.1 Install Tailwind CSS v4 and Dependencies

```bash
cd web
bun add tailwindcss@4 @tailwindcss/vite
bun add clsx tailwind-merge tailwind-variants tw-animate-css
bun add @fontsource-variable/inter
bun add @lucide/svelte
bun add bits-ui
bun add svelte-sonner
```

**Verification:** `bun install` exits 0. Check `node_modules/@tailwindcss/vite` exists.

### 0.2 Update Vite Configuration

Edit `web/vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()]
});
```

**Verification:** `bun run dev` starts without errors. Tailwind processes CSS.

### 0.3 Initialize shadcn-svelte

```bash
cd web
bunx shadcn-svelte@latest init \
    --base-color stone \
    --css src/app.css \
    --lib-alias '$lib' \
    --components-alias '$lib/components' \
    --utils-alias '$lib/utils' \
    --hooks-alias '$lib/hooks' \
    --ui-alias '$lib/components/ui'
```

This creates `components.json` and scaffolds the base files.

**Expected `components.json`:**
```json
{
    "$schema": "https://shadcn-svelte.com/schema.json",
    "tailwind": {
        "css": "src/app.css",
        "baseColor": "stone"
    },
    "aliases": {
        "components": "$lib/components",
        "utils": "$lib/utils",
        "ui": "$lib/components/ui",
        "hooks": "$lib/hooks",
        "lib": "$lib"
    },
    "typescript": true,
    "registry": "https://shadcn-svelte.com/registry"
}
```

**Verification:** `components.json` exists at `web/components.json`. `web/src/lib/utils.ts` is created with `cn()`.

### 0.4 Create the Global CSS Theme

Replace the generated `web/src/app.css` with Ralph's dark theme. This is the single source of truth for the design system.

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@fontsource-variable/inter';

/* ── Ralph Dark Theme ── */
:root {
    --radius: 0.5rem;

    /* Core surfaces */
    --background: oklch(0.211 0.005 67.5);
    --foreground: oklch(0.911 0.016 86.4);

    /* Card / elevated surfaces */
    --card: oklch(0.243 0.008 59.2);
    --card-foreground: oklch(0.911 0.016 86.4);

    /* Popover / dropdown */
    --popover: oklch(0.277 0.009 53.0);
    --popover-foreground: oklch(0.911 0.016 86.4);

    /* Primary action (gold accent) */
    --primary: oklch(0.767 0.139 91.1);
    --primary-foreground: oklch(0.211 0.005 67.5);

    /* Secondary */
    --secondary: oklch(0.277 0.009 53.0);
    --secondary-foreground: oklch(0.911 0.016 86.4);

    /* Muted */
    --muted: oklch(0.277 0.009 53.0);
    --muted-foreground: oklch(0.737 0.021 84.6);

    /* Accent (hover/focus backgrounds) */
    --accent: oklch(0.277 0.009 53.0);
    --accent-foreground: oklch(0.911 0.016 86.4);

    /* Destructive (error/danger) */
    --destructive: oklch(0.631 0.148 25.2);

    /* Borders and inputs */
    --border: oklch(0.338 0.014 62.9);
    --input: oklch(0.338 0.014 62.9);
    --ring: oklch(0.767 0.139 91.1);

    /* Chart colors */
    --chart-1: oklch(0.767 0.139 91.1);
    --chart-2: oklch(0.709 0.128 152.9);
    --chart-3: oklch(0.631 0.148 25.2);
    --chart-4: oklch(0.737 0.021 84.6);
    --chart-5: oklch(0.338 0.014 62.9);

    /* Sidebar-specific */
    --sidebar: oklch(0.243 0.008 59.2);
    --sidebar-foreground: oklch(0.911 0.016 86.4);
    --sidebar-primary: oklch(0.767 0.139 91.1);
    --sidebar-primary-foreground: oklch(0.211 0.005 67.5);
    --sidebar-accent: oklch(0.277 0.009 53.0);
    --sidebar-accent-foreground: oklch(0.911 0.016 86.4);
    --sidebar-border: oklch(0.338 0.014 62.9);
    --sidebar-ring: oklch(0.767 0.139 91.1);

    /* ── Custom Ralph tokens (not part of shadcn) ── */
    --success: oklch(0.709 0.128 152.9);
    --success-foreground: oklch(0.211 0.005 67.5);
    --warning: oklch(0.767 0.139 91.1);
    --warning-foreground: oklch(0.211 0.005 67.5);
    --accent-dim: oklch(0.767 0.139 91.1 / 15%);
}

/* ── Register custom colors with Tailwind ── */
@theme inline {
    --font-sans: 'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;

    --color-success: var(--success);
    --color-success-foreground: var(--success-foreground);
    --color-warning: var(--warning);
    --color-warning-foreground: var(--warning-foreground);
    --color-accent-dim: var(--accent-dim);

    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
}

/* ── Base styles ── */
@layer base {
    * {
        @apply border-border outline-ring/50;
    }
    body {
        @apply bg-background text-foreground font-sans;
    }
}

/* ── Custom data-state variants for bits-ui ── */
@custom-variant data-open {
    &:where([data-state="open"]),
    &:where([data-open]:not([data-open="false"])) {
        @slot;
    }
}

@custom-variant data-closed {
    &:where([data-state="closed"]),
    &:where([data-closed]:not([data-closed="false"])) {
        @slot;
    }
}

@custom-variant data-checked {
    &:where([data-state="checked"]),
    &:where([data-checked]:not([data-checked="false"])) {
        @slot;
    }
}

@custom-variant data-unchecked {
    &:where([data-state="unchecked"]),
    &:where([data-unchecked]:not([data-unchecked="false"])) {
        @slot;
    }
}

@custom-variant data-selected {
    &:where([data-selected]) {
        @slot;
    }
}

@custom-variant data-disabled {
    &:where([data-disabled="true"]),
    &:where([data-disabled]:not([data-disabled="false"])) {
        @slot;
    }
}

@custom-variant data-active {
    &:where([data-state="active"]),
    &:where([data-active]:not([data-active="false"])) {
        @slot;
    }
}

@custom-variant data-horizontal {
    &:where([data-orientation="horizontal"]) {
        @slot;
    }
}

@custom-variant data-vertical {
    &:where([data-orientation="vertical"]) {
        @slot;
    }
}

/* ── Utility: hide scrollbar ── */
@utility no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
    &::-webkit-scrollbar {
        display: none;
    }
}

/* ── Accessibility ── */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

### 0.5 Create Utility Module

The `shadcn-svelte init` command creates `web/src/lib/utils.ts`. Verify it contains at minimum:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, E extends HTMLElement = HTMLElement> = T & {
    ref?: E | null;
};
```

If the init command created a simpler version, augment it with the type utilities.

### 0.6 Update `app.html`

Edit `web/src/app.html` to:
1. Remove the Google Fonts CDN links (Inter is now loaded via `@fontsource-variable/inter`).
2. Keep the Material Symbols Rounded link — it's needed during the migration transition until
   all icons are replaced with Lucide. Remove it in Phase 6 (Cleanup).

```html
<!doctype html>
<html lang="en" class="dark">
    <head>
        <meta charset="utf-8" />
        <!-- TEMPORARY: Material Symbols during migration. Remove in Phase 6. -->
        <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        %sveltekit.head%
    </head>
    <body data-sveltekit-preload-data="hover">
        <div style="display: contents">%sveltekit.body%</div>
    </body>
</html>
```

> **Note:** `class="dark"` is added to `<html>` even though we define everything in `:root`.
> This ensures any third-party component checking for `.dark` works correctly. It has no
> effect on our own theme since we don't use the `.dark` selector.

### 0.7 Import Global CSS in Root Layout

Edit `web/src/routes/+layout.svelte` to import the new CSS file. Add this import at the top
of the `<script>` block (it will coexist with the existing `global.css` import during migration):

```svelte
<script lang="ts">
    import '../app.css';
    // existing imports...
</script>
```

### 0.8 Phase 0 Verification

```bash
cd web && bun run check          # Must pass with 0 errors
cd web && bun run dev             # Must start, pages must render
```

Visually verify:
- Dashboard page renders with existing styles intact
- No flash of unstyled content
- Sidebar still works
- Background color unchanged (warm dark)

---

## Phase 1: Foundation Components

Install shadcn-svelte components that form the foundation. Do NOT modify any pages yet.

### 1.1 Install Base Components

```bash
cd web
bunx shadcn-svelte@latest add button -y
bunx shadcn-svelte@latest add card -y
bunx shadcn-svelte@latest add badge -y
bunx shadcn-svelte@latest add separator -y
bunx shadcn-svelte@latest add skeleton -y
bunx shadcn-svelte@latest add input -y
bunx shadcn-svelte@latest add label -y
bunx shadcn-svelte@latest add textarea -y
bunx shadcn-svelte@latest add select -y
bunx shadcn-svelte@latest add alert -y
bunx shadcn-svelte@latest add sonner -y
bunx shadcn-svelte@latest add spinner -y
```

**Verification:** Each command creates files in `web/src/lib/components/ui/<component>/`.

### 1.2 Install Layout Components

```bash
cd web
bunx shadcn-svelte@latest add sidebar -y
bunx shadcn-svelte@latest add sheet -y
bunx shadcn-svelte@latest add scroll-area -y
bunx shadcn-svelte@latest add tabs -y
bunx shadcn-svelte@latest add dialog -y
bunx shadcn-svelte@latest add alert-dialog -y
bunx shadcn-svelte@latest add collapsible -y
```

### 1.3 Install Data Display Components

```bash
cd web
bunx shadcn-svelte@latest add table -y
bunx shadcn-svelte@latest add avatar -y
bunx shadcn-svelte@latest add dropdown-menu -y
bunx shadcn-svelte@latest add popover -y
bunx shadcn-svelte@latest add tooltip -y
bunx shadcn-svelte@latest add progress -y
bunx shadcn-svelte@latest add switch -y
bunx shadcn-svelte@latest add checkbox -y
bunx shadcn-svelte@latest add breadcrumb -y
bunx shadcn-svelte@latest add pagination -y
bunx shadcn-svelte@latest add empty -y
```

### 1.4 Customize Button Variants

The shadcn Button ships with: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`.

Ralph needs these **additional/modified** variants. Edit `web/src/lib/components/ui/button/button.svelte`
to add Ralph-specific variants:

**Add to the `variants.variant` object in `buttonVariants`:**

```ts
// In the tv() call, under variants.variant, ADD:
primary: 'bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90',
danger: 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20',
```

**Variant mapping from old to new:**

| Old Ralph Variant | New shadcn Variant | Notes |
|---|---|---|
| `default` | `outline` | Border + elevated bg |
| `primary` | `primary` (custom) | Gold accent button |
| `secondary` | `secondary` | Same concept |
| `danger` | `danger` (custom) | Transparent red, not filled red |
| `ghost` | `ghost` | Identical concept |
| `tab` | Remove | Replaced by shadcn `Tabs` component |
| `filter` | `outline` with `rounded-full` | Pill-shaped filter buttons |

### 1.5 Customize Badge Variants

Edit `web/src/lib/components/ui/badge/badge.svelte` to add Ralph's status variants.

**Add to the `variants.variant` object in `badgeVariants`:**

```ts
// ADD these variants:
success: 'border-transparent bg-success/15 text-success',
warning: 'border-transparent bg-accent-dim text-primary',
info: 'border-transparent bg-[oklch(0.5_0.15_250/15%)] text-[oklch(0.7_0.12_250)]',
muted: 'border-transparent bg-muted text-muted-foreground',
```

### 1.6 Configure Sonner (Toast Replacement)

The Sonner component replaces Ralph's custom `Toast.svelte`. Since we're dark-mode only,
edit `web/src/lib/components/ui/sonner/sonner.svelte`:

- Remove the `mode-watcher` import if present.
- Hardcode `theme="dark"` on the `<Sonner>` component.
- Style overrides in the `style` prop to use Ralph's token colors.

```svelte
<Sonner
    theme="dark"
    class="toaster group"
    style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
    {...restProps}
>
    <!-- icon snippets... -->
</Sonner>
```

### 1.7 Phase 1 Verification

```bash
cd web && bun run check          # Must pass with 0 errors
```

Create a temporary test page (`web/src/routes/test-ui/+page.svelte`) that renders one of each
new component to verify theming. Verify:
- Button variants render with correct colors
- Badge variants show correct status colors
- Card has `--card` background (warm dark surface)
- Input fields have visible borders on dark background
- Skeleton shows animated shimmer
- Alert renders with destructive variant

Delete the test page after verification.

---

## Phase 2: Layout Migration

This phase rewires the root layout and sidebar. **All pages will be affected.**

### 2.1 Create AppSidebar Component

Create `web/src/lib/components/app-sidebar.svelte`. This replaces the existing
`web/src/routes/Sidebar.svelte` + `web/src/routes/SidebarNav.svelte`.

**Structure:**
```svelte
<script lang="ts">
    import * as Sidebar from '$lib/components/ui/sidebar/index.js';
    import { page } from '$app/stores';
    import { auth_store } from '$lib/auth.js';
    // Import Lucide icons for each nav item
    import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
    import FolderIcon from '@lucide/svelte/icons/folder';
    import MessageSquareIcon from '@lucide/svelte/icons/message-square';
    import ListTodoIcon from '@lucide/svelte/icons/list-todo';
    import ActivityIcon from '@lucide/svelte/icons/activity';
    import FileTextIcon from '@lucide/svelte/icons/file-text';
    import BookOpenIcon from '@lucide/svelte/icons/book-open';
    import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
    import ShieldIcon from '@lucide/svelte/icons/shield';
    import type { Component } from 'svelte';

    interface NavItem {
        title: string;
        url: string;
        icon: Component;
        admin_only?: boolean;
    }

    const main_items: NavItem[] = [
        { title: 'Dashboard', url: '/', icon: LayoutDashboardIcon },
        { title: 'Projects', url: '/projects', icon: FolderIcon },
        { title: 'Chat', url: '/chat', icon: MessageSquareIcon },
        { title: 'Pipeline', url: '/pipeline', icon: ListTodoIcon },
        { title: 'Monitoring', url: '/monitoring', icon: ActivityIcon },
    ];

    const secondary_items: NavItem[] = [
        { title: 'Prompts', url: '/prompts', icon: FileTextIcon },
        { title: 'Skills', url: '/skills', icon: BookOpenIcon },
        { title: 'Usage', url: '/usage', icon: BarChart3Icon },
    ];

    const admin_items: NavItem[] = [
        { title: 'Admin', url: '/admin', icon: ShieldIcon, admin_only: true },
    ];

    let { system_stats }: { system_stats?: unknown } = $props();

    const current_path = $derived($page.url.pathname);
    const is_admin = $derived(auth_store.role === 'admin');

    function is_active(url: string): boolean {
        if (url === '/') return current_path === '/';
        return current_path.startsWith(url);
    }
</script>

<Sidebar.Root collapsible="icon">
    <Sidebar.Header>
        <Sidebar.Menu>
            <Sidebar.MenuItem>
                <Sidebar.MenuButton class="font-semibold text-primary">
                    <span class="text-lg">🤖</span>
                    <span>Ralph</span>
                </Sidebar.MenuButton>
            </Sidebar.MenuItem>
        </Sidebar.Menu>
    </Sidebar.Header>

    <Sidebar.Content>
        <Sidebar.Group>
            <Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
                <Sidebar.Menu>
                    {#each main_items as item (item.title)}
                        <Sidebar.MenuItem>
                            <Sidebar.MenuButton
                                isActive={is_active(item.url)}
                                tooltip={item.title}
                            >
                                {#snippet child({ props })}
                                    <a href={item.url} {...props}>
                                        <item.icon />
                                        <span>{item.title}</span>
                                    </a>
                                {/snippet}
                            </Sidebar.MenuButton>
                        </Sidebar.MenuItem>
                    {/each}
                </Sidebar.Menu>
            </Sidebar.GroupContent>
        </Sidebar.Group>

        <Sidebar.Group>
            <Sidebar.GroupLabel>Resources</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
                <Sidebar.Menu>
                    {#each secondary_items as item (item.title)}
                        <Sidebar.MenuItem>
                            <Sidebar.MenuButton
                                isActive={is_active(item.url)}
                                tooltip={item.title}
                            >
                                {#snippet child({ props })}
                                    <a href={item.url} {...props}>
                                        <item.icon />
                                        <span>{item.title}</span>
                                    </a>
                                {/snippet}
                            </Sidebar.MenuButton>
                        </Sidebar.MenuItem>
                    {/each}
                </Sidebar.Menu>
            </Sidebar.GroupContent>
        </Sidebar.Group>

        {#if is_admin}
            <Sidebar.Group>
                <Sidebar.GroupLabel>System</Sidebar.GroupLabel>
                <Sidebar.GroupContent>
                    <Sidebar.Menu>
                        {#each admin_items as item (item.title)}
                            <Sidebar.MenuItem>
                                <Sidebar.MenuButton
                                    isActive={is_active(item.url)}
                                    tooltip={item.title}
                                >
                                    {#snippet child({ props })}
                                        <a href={item.url} {...props}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    {/snippet}
                                </Sidebar.MenuButton>
                            </Sidebar.MenuItem>
                        {/each}
                    </Sidebar.Menu>
                </Sidebar.GroupContent>
            </Sidebar.Group>
        {/if}
    </Sidebar.Content>

    <Sidebar.Footer>
        <!-- System stats summary when expanded, hidden when collapsed -->
    </Sidebar.Footer>
</Sidebar.Root>
```

**Key differences from old Sidebar:**
- No manual width management (shadcn handles via CSS variables)
- No manual localStorage persistence (shadcn `Sidebar.Provider` manages via cookies)
- Mobile Sheet behavior is built-in (no custom overlay/drawer)
- `collapsible="icon"` gives the 48px icon-only mode
- `isActive` prop highlights current route
- `tooltip` prop shows label on hover in collapsed state

### 2.2 Rewrite Root Layout

Rewrite `web/src/routes/+layout.svelte` to use the shadcn Sidebar.Provider pattern:

**New structure:**
```svelte
<script lang="ts">
    import '../app.css';
    import '$lib/styles/hljs-dark.css';
    import * as Sidebar from '$lib/components/ui/sidebar/index.js';
    import { Toaster } from '$lib/components/ui/sonner/index.js';
    import AppSidebar from '$lib/components/app-sidebar.svelte';
    import NotificationBell from '$lib/components/notification-bell/NotificationBell.svelte';
    import AuthScreen from './AuthScreen.svelte';
    import { auth_store } from '$lib/auth.js';
    import { toast_store } from '$lib/stores/toast.js';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { create_notification_stream } from './notification-stream.js';
    import { use_event_stream } from '$lib/api/event-stream.js';
    import { api } from '$lib/api/client.js';
    import { Alert } from '$lib/components/ui/alert/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';

    let { children } = $props();

    let system_stats = $state(null);
    let critical_alerts = $state<Array<{ message: string }>>([]);
    let auth_check_done = $state(false);

    const current_path = $derived($page.url.pathname);

    // ... existing auth check, system stats loading, event stream logic ...
    // (preserve all existing onMount, $effect, and API logic unchanged)
</script>

{#if !auth_check_done || !auth_store.authenticated}
    <AuthScreen />
{:else}
    <Sidebar.Provider>
        <AppSidebar {system_stats} />
        <Sidebar.Inset>
            {#if critical_alerts.length > 0}
                <div class="px-4 pt-4">
                    {#each critical_alerts as alert}
                        <Alert variant="destructive">
                            <CircleAlertIcon class="size-4" />
                            {alert.message}
                        </Alert>
                    {/each}
                </div>
            {/if}

            <header class="flex h-12 items-center gap-2 border-b border-border px-4">
                <Sidebar.Trigger />
                <div class="ml-auto">
                    <NotificationBell />
                </div>
            </header>

            <main class="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                <div class="mx-auto max-w-[1200px]">
                    {@render children?.()}
                </div>
            </main>
        </Sidebar.Inset>
    </Sidebar.Provider>
    <Toaster />
{/if}
```

**Critical preservation points:**
- All `onMount` logic for auth check, system stats, alerts must be preserved exactly.
- The `use_event_stream()` setup must remain.
- `create_notification_stream()` must remain.
- The `toast_store` integration transitions to Sonner: replace `toast_store.add(...)` calls
  with `toast.success(...)`, `toast.error(...)`, `toast.info(...)` from `svelte-sonner`.

**What changes:**
- Remove the `<style>` block entirely (all styling via Tailwind classes)
- Remove old `Sidebar` + `SidebarNav` component imports
- Remove manual sidebar state management (open/collapsed/localStorage)
- Remove the mobile overlay/backdrop markup
- Remove the `.app`, `.content`, `.mobile-toggle`, `.sidebar-overlay` CSS classes

**What stays:**
- All auth logic
- All API calls
- All event stream subscriptions
- All system stats/alerts loading
- The `NotificationBell` component (migrated later in Phase 3)

### 2.3 Toast Migration

Create a migration utility to bridge from the old toast store to Sonner.

Search the codebase for all `toast_store` usages:
```bash
grep -rn 'toast_store' web/src/
```

For each call site, replace:
- `toast_store.add({ type: 'success', message: '...' })` → `toast.success('...')`
- `toast_store.add({ type: 'error', message: '...' })` → `toast.error('...')`
- `toast_store.add({ type: 'info', message: '...' })` → `toast.info('...')`
- `toast_store.add({ type: 'warning', message: '...' })` → `toast.warning('...')`

Import `toast` from `svelte-sonner` at each call site.

After all call sites are migrated:
- Delete `web/src/lib/stores/toast.ts` (or equivalent toast store)
- Delete `web/src/lib/components/toast/Toast.svelte`
- Remove `<Toast />` from the layout (replaced by `<Toaster />`)

### 2.4 Remove Old Sidebar Files

After verifying the new sidebar works:
- Delete `web/src/routes/Sidebar.svelte`
- Delete `web/src/routes/SidebarNav.svelte`

### 2.5 Phase 2 Verification

```bash
cd web && bun run check          # Must pass with 0 errors
```

Visually verify:
- Sidebar renders with correct navigation items
- Sidebar collapses to icon-only mode (48px) via trigger button
- Mobile (<768px): sidebar becomes a Sheet overlay
- Keyboard shortcut `Cmd+B` / `Ctrl+B` toggles sidebar
- All navigation links work and highlight correctly
- `NotificationBell` dropdown functions
- Toast notifications display via Sonner
- Auth screen renders when logged out
- Critical alert banner appears when system alerts exist
- No horizontal overflow on any viewport width

---

## Phase 3: Simple Pages

Migrate pages with the least complexity first. Each page migration follows the same pattern:
1. Replace component imports (old primitives → shadcn)
2. Replace HTML structure with shadcn components
3. Replace `<style>` block with Tailwind classes
4. Verify type-checking passes
5. Visually verify the page

### 3.1 Admin Layout (`admin/+layout.svelte`)

**Current:** 100 lines. Tab navigation for admin sub-pages.

**Target:**
- Replace custom Tabs with shadcn `Tabs` component
- Replace auth guard logic (keep as-is, it's just a redirect)

```svelte
<script lang="ts">
    import * as Tabs from '$lib/components/ui/tabs/index.js';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    // ... auth guard logic preserved ...

    const current_tab = $derived(
        $page.route.id?.replace('/admin/', '').split('/')[0] ?? 'users'
    );
</script>

<div class="space-y-6">
    <h1 class="text-2xl font-semibold">Admin</h1>
    <Tabs.Root value={current_tab} onValueChange={(v) => goto(`/admin/${v}`)}>
        <Tabs.List>
            <Tabs.Trigger value="users">Users</Tabs.Trigger>
            <Tabs.Trigger value="metrics">Metrics</Tabs.Trigger>
            <Tabs.Trigger value="maintenance">Maintenance</Tabs.Trigger>
        </Tabs.List>
    </Tabs.Root>
    {@render children?.()}
</div>
```

### 3.2 Admin Users (`admin/users/+page.svelte` + `UserTable.svelte`)

**Current:** 67 lines (page) + 179 lines (UserTable) + 57 lines (UserActions).

**Target:**
- `UserTable` → shadcn `Table` with `Avatar`, `Badge` for roles, `DropdownMenu` for actions
- `UserActions` → inline `DropdownMenu` with role toggle + delete
- Role changes → `AlertDialog` confirmation

**Component mapping:**
```
Old UserTable row → Table.Row with:
    - Avatar (first letter of name)
    - Table.Cell for name, email, role (Badge), created date
    - DropdownMenu for actions (toggle role, delete)
Old UserActions → DropdownMenu.Item entries
```

### 3.3 Admin Maintenance (`admin/maintenance/+page.svelte`)

**Current:** 54 lines. Simple action buttons.

**Target:**
- Wrap in `Card` with `Card.Header`, `Card.Content`
- Buttons → shadcn `Button` (destructive variant for cleanup)
- Confirmation → `AlertDialog`

### 3.4 Admin Metrics (`admin/metrics/+page.svelte`)

**Current:** 165 lines. Stat cards + route metrics table.

**Target:**
- Stat cards → `Card` grid with key metrics
- Route table → shadcn `Table` with sortable columns
- Error highlighting → `Badge` variant="destructive"
- Loading → `Skeleton` components

### 3.5 Skills (`skills/+page.svelte`)

**Current:** 193 lines. Skill cards in a grid.

**Target:**
- Search bar → shadcn `Input` with search icon
- Skill cards → `Card` with `Badge` for linked status
- Refresh button → shadcn `Button`
- Empty state → shadcn `Empty` component
- Loading → `Skeleton` grid
- Expanded skill detail → `Collapsible` or `Dialog`

**Component extraction:**
- Keep `SkillCard.svelte` as a route component, but rewrite internals to use `Card` + `Badge`
- Keep `SkillsHeader.svelte` but rewrite with `Input` + `Button`

### 3.6 Prompts (`prompts/+page.svelte`)

**Current:** 220 lines. Prompt list with editor, tabs for prompts/traits.

**Target:**
- Tab switcher → shadcn `Tabs`
- Prompt list → `Card` list with select state
- Prompt editor → shadcn `Textarea` (large, monospace)
- Sync button → `Button` with `AlertDialog` confirmation
- Status messages → Sonner toast

### 3.7 Usage (`usage/+page.svelte`)

**Current:** 142 lines. Summary cards, breakdown, run history.

**Target:**
- Summary panel → `Card` grid with key metrics
- Breakdown → `Card` with `Table`
- Run history → `Table` with `Badge` for status, `Pagination`
- Filters → shadcn `Select` + `Button` group
- Date range → `Button` group (today, 7d, 30d, all)

### 3.8 Monitoring (`monitoring/+page.svelte`)

**Current:** 175 lines. Agent grid, stats, log panel.

**Target:**
- Stats row → `Card` grid (3 cards: running, completed, failed)
- Agent grid → `Card` per agent with `Badge` status
- Log panel → `Card` with `ScrollArea` and monospace text
- Filters → shadcn `Select` components
- Stop All button → `Button` variant="destructive" + `AlertDialog`
- Empty state → shadcn `Empty`

### 3.9 Phase 3 Verification

After each page:
```bash
cd web && bun run check
```

After all simple pages:
- Visually verify every admin page
- Verify skills page: search, expand, refresh
- Verify prompts page: tab switch, edit, sync
- Verify usage page: filters, pagination, date range
- Verify monitoring page: stats, agent grid, logs
- Verify all mobile at <768px

---

## Phase 4: Complex Pages

### 4.1 Dashboard (`+page.svelte`)

**Current:** 147 lines. KpiBar, PipelineCard, ActivityFeed, SystemStatsCard.

**Target architecture:**
```
Dashboard (+page.svelte) — thin orchestrator
├── KpiBar.svelte → Card grid (3-4 Cards in responsive row)
│   Each card: Card.Root > Card.Header (icon + label) > Card.Content (value)
├── PipelineCard.svelte → Card with Badge status + Button actions
│   Pipeline state: Badge variant mapped from status enum
│   Pause/Resume: Button (primary or outline)
├── ActivityFeed.svelte → Card with ScrollArea
│   Each event: flex row with Avatar + timestamp + description
│   Empty: Empty component
└── SystemStatsCard.svelte → Card with Progress bars
    CPU/Memory: Progress component with percentage label
    Disk: Progress with color variant based on threshold
```

**Component extraction (route-level, in `web/src/routes/`):**
Keep existing component files but rewrite internals. No need to promote to `$lib/components`
since they're only used on the dashboard.

**Data flow preserved:** All `$state`, `$derived`, API calls, event stream handlers unchanged.

### 4.2 Projects List (`projects/+page.svelte`)

**Current:** 220 lines. Project cards grid, create form, bulk actions.

**Target:**
- Project grid → responsive grid of `Card` components
- Search bar → `Input` with icon prefix
- Filter buttons → `Button` group with `variant="outline"` and `rounded-full`
- Create button → `Button` variant="primary"
- Create form → `Dialog` with `Input` + `Textarea` + `Button`
- Bulk selection → shadcn `Checkbox` + selection bar
- Delete confirmation → `AlertDialog`
- Empty state → `Empty` component

**Component extraction:**
- `ProjectCard.svelte` → rewrite with `Card`, `Badge`, `DropdownMenu` for actions
- `ProjectCreateForm.svelte` → rewrite as a `Dialog` with form fields
- `ProjectSearchBar.svelte` → rewrite with `Input` + `Button` group

### 4.3 Project Detail (`projects/[id]/+page.svelte`)

**Current:** 195 lines. Two-column layout with feature list + detail panel.

**Target:**
- Left panel: `ScrollArea` with feature list items
- Right panel: Feature detail with `Tabs` (Overview, Tasks, Agent Runs)
- Feature form → `Dialog` with form fields
- Task table → shadcn `Table` with `Badge`, `DropdownMenu` actions
- Status badges → `Badge` with variant mapping (see Appendix D)
- Mobile: Single-column with back navigation

**Component extraction:**
- `FeatureList.svelte` → keep, rewrite with `Card` items in `ScrollArea`
- `FeatureDetail.svelte` → keep, rewrite with `Tabs` + content panels
- `FeatureForm.svelte` → keep, rewrite as `Dialog` form
- `TaskTable.svelte` → new, extract from FeatureDetail

### 4.4 Chat (`chat/+page.svelte`)

**Current:** 202 lines. Session sidebar, message thread, input area.

**Critical constraint:** SSE streaming must be preserved exactly. Do not modify the streaming
logic, `read_sse_stream()`, or `cancel_chat_stream()`.

**Target:**
- Session sidebar → `ScrollArea` with session items styled as buttons
- Message thread → `ScrollArea` with message bubbles
  - User messages: aligned right, `bg-primary/10` background
  - Assistant messages: aligned left, `bg-card` background
  - Each message: `Avatar` (user icon or bot icon) + content area
  - Markdown rendering: keep `marked` + `dompurify` + `highlight.js` exactly as-is
  - Streaming indicator: `Spinner` component
- Input area → `Textarea` + `Button` (send) + `Select` (model picker)
  - Auto-resize textarea (keep existing logic)
  - `Ctrl+Enter` to send (keep existing keybinding)
- Mobile: Toggle session sidebar visibility

**What must NOT change:**
- SSE streaming logic
- Session persistence to sessionStorage
- Message accumulation during streaming
- Model selection state

### 4.5 Pipeline (`pipeline/+page.svelte`)

**Current:** 216 lines. Tab view with queue, history, stats.

**Target:**
- Tabs → shadcn `Tabs` (Queue, History, Stats, Logs)
- Queue tab:
  - Current task → `Card` with `Badge` status + `Button` actions
  - Task queue → `Table` with drag-and-drop rows (preserve existing drag logic)
  - Reorder/remove → `Button` icon variants
- History tab:
  - History table → `Table` with `Badge` status + `Pagination`
  - Status filter → `Select`
- Stats tab:
  - Pipeline stats → `Card` grid with key metrics
- Logs tab:
  - Log viewer → `Card` with `ScrollArea` + monospace text

**Critical constraint:** Drag-and-drop reordering must be preserved. The shadcn `Table` component
is just styled HTML — existing drag handlers attach to native DOM events and will continue to work.

### 4.6 Phase 4 Verification

```bash
cd web && bun run check
```

Per-page visual verification:

**Dashboard:**
- [ ] KPI cards render with correct values
- [ ] Pipeline card shows status badge and action buttons
- [ ] Activity feed scrolls and shows recent events
- [ ] System stats show progress bars

**Projects:**
- [ ] Project grid renders with cards
- [ ] Search filters projects in real-time
- [ ] Create dialog opens and submits
- [ ] Bulk selection and delete works
- [ ] Project detail: feature list + detail panel
- [ ] Feature form: create/edit works
- [ ] Task table: status badges correct

**Chat:**
- [ ] Session list renders and is selectable
- [ ] Messages display with markdown formatting
- [ ] Code blocks highlight correctly
- [ ] Streaming works: characters appear incrementally
- [ ] Model selector works
- [ ] Send via Ctrl+Enter works
- [ ] Cancel streaming works

**Pipeline:**
- [ ] Tab switching works
- [ ] Queue renders with current task
- [ ] Drag-and-drop reorder works
- [ ] History table paginates
- [ ] Status filter works
- [ ] Pause/Resume buttons work

---

## Phase 5: Auth & Error Pages

### 5.1 Auth Screen (`AuthScreen.svelte`)

**Current:** 140 lines. State machine with loading/error/setup/login states.

**Target:**
- Container → centered `Card` on dark background
- Loading state → `Skeleton` with `Spinner`
- Error state → `Alert` variant="destructive"
- Setup state → `Card` with `Input` (display name) + `Button` (Create Passkey)
- Login state → `Card` with `Button` (Sign in with Passkey)

**Critical constraint:** WebAuthn passkey flow must not be modified. Only the visual
wrapper changes. The `@simplewebauthn/browser` calls remain identical.

### 5.2 Auth Feedback (`AuthFeedback.svelte`)

**Current:** 71 lines. Error/loading state display.

**Target:** Merge into `AuthScreen.svelte` or convert to use `Alert` + `Spinner`.

### 5.3 Error Page (`+error.svelte`)

**Current:** 86 lines. Error boundary page.

**Target:**
- Container → centered `Card`
- Error code → large heading
- Message → `Card.Description`
- Back button → `Button` with href

### 5.4 Phase 5 Verification

Visually verify:
- [ ] Auth screen: all 4 states render correctly
- [ ] Error page: renders with correct styling
- [ ] Passkey creation flow works end-to-end
- [ ] Passkey login flow works end-to-end

---

## Phase 6: Cleanup

### 6.1 Remove Old Primitive Components

After all pages are migrated, delete the old component library:

```bash
# Old primitives replaced by shadcn
rm -rf web/src/lib/components/primitives/button/
rm -rf web/src/lib/components/primitives/badge/
rm -rf web/src/lib/components/primitives/icon/
rm -rf web/src/lib/components/primitives/input/
rm -rf web/src/lib/components/primitives/label/
rm -rf web/src/lib/components/primitives/select/
rm -rf web/src/lib/components/primitives/textarea/

# Old compound components replaced by shadcn
rm -rf web/src/lib/components/accordion/
rm -rf web/src/lib/components/checkbox/
rm -rf web/src/lib/components/confirm-modal/
rm -rf web/src/lib/components/empty-state/
rm -rf web/src/lib/components/error-banner/
rm -rf web/src/lib/components/loading-spinner/
rm -rf web/src/lib/components/skeleton/
rm -rf web/src/lib/components/tabs/
rm -rf web/src/lib/components/toast/
rm -rf web/src/lib/components/pagination/

# Old layout components
rm web/src/routes/Sidebar.svelte
rm web/src/routes/SidebarNav.svelte

# Toast store (replaced by Sonner)
rm web/src/lib/stores/toast.ts  # or wherever the toast store lives
```

**Before deleting:** Run `grep -rn 'from.*primitives\|from.*accordion\|from.*confirm-modal\|from.*empty-state\|from.*error-banner\|from.*loading-spinner\|from.*skeleton\|from.*tabs/Tabs\|from.*toast/Toast\|from.*pagination/Pagination' web/src/` to verify no remaining imports.

### 6.2 Remove Old Global CSS

Delete or gut `web/src/lib/styles/global.css`:

- Remove all CSS variable definitions (now in `app.css`)
- Remove all component classes (`.badge-*`, `.btn-*`, `.section`, `.data-table`, etc.)
- Remove utility classes that have Tailwind equivalents (`.truncate-*`, `.muted-text`, etc.)
- **Keep** only what is genuinely needed:
  - `.icon` class for any remaining Material Symbols usage (should be zero)
  - `@keyframes spin` if any component still uses it (Lucide has its own animation)
  - The `hljs-dark.css` import stays separate

After cleanup, if `global.css` is empty, delete it and remove its import from the layout.

### 6.3 Remove Material Symbols

After all icons have been migrated to Lucide:
1. Remove the Material Symbols `<link>` tag from `web/src/app.html`
2. Delete the `Icon.svelte` primitive component
3. Search for any remaining Material Symbols references:
   ```bash
   grep -rn 'material-symbols\|MaterialSymbol\|Icon.*type=' web/src/
   ```

### 6.4 Remove `<style>` Blocks

Search for any remaining `<style>` blocks in Svelte components:
```bash
grep -rn '<style>' web/src/routes/ web/src/lib/components/
```

Every remaining `<style>` block should be converted to Tailwind classes. The only acceptable
exceptions are:
- Third-party CSS overrides (highlight.js)
- CSS that genuinely cannot be expressed in Tailwind (rare)

### 6.5 Remove Google Fonts CDN

Verify `app.html` no longer references `fonts.googleapis.com` for Inter (already done in 0.6).
The Material Symbols link was also removed in 6.3.

### 6.6 Clean Up Barrel Exports

If `web/src/lib/components/index.ts` exists as a barrel file re-exporting old components,
update it to only export components that still exist. Or remove it if pages import directly
from component directories.

### 6.7 Phase 6 Verification

```bash
cd web && bun run check          # Must pass with 0 errors
```

Full regression verification:
- [ ] Every page listed in Phase 4 verification still works
- [ ] No console errors in browser DevTools
- [ ] No 404s for fonts, icons, or CSS
- [ ] Bundle size check: `bun run build` completes and output size is reasonable
- [ ] Mobile responsive check on every page at 768px breakpoint
- [ ] Keyboard navigation: Tab through all interactive elements on every page
- [ ] Focus rings visible (gold outline) on all focusable elements

---

## Appendix A: Complete Component Mapping

| Old Ralph Component | shadcn-svelte Replacement | Notes |
|---|---|---|
| `primitives/button/Button.svelte` | `ui/button` | Add `primary` + `danger` variants |
| `primitives/badge/Badge.svelte` | `ui/badge` | Add `success`, `warning`, `info`, `muted` variants |
| `primitives/icon/Icon.svelte` | `@lucide/svelte` direct imports | One icon per import |
| `primitives/input/Input.svelte` | `ui/input` | Direct replacement |
| `primitives/label/Label.svelte` | `ui/label` | Direct replacement |
| `primitives/select/Select.svelte` | `ui/select` | shadcn Select is richer (popup menu) |
| `primitives/textarea/Textarea.svelte` | `ui/textarea` | Direct replacement |
| `accordion/Accordion.svelte` | `ui/collapsible` or `ui/accordion` | Depends on usage context |
| `checkbox/Checkbox.svelte` | `ui/checkbox` | Direct replacement |
| `code-block/CodeBlock.svelte` | Custom (keep + restyle) | No shadcn equivalent; apply Tailwind classes |
| `confirm-modal/ConfirmModal.svelte` | `ui/alert-dialog` | Direct replacement |
| `empty-state/EmptyState.svelte` | `ui/empty` | Direct replacement |
| `error-banner/ErrorBanner.svelte` | `ui/alert` | Map variants: error→destructive, warning→default, info→default |
| `loading-spinner/LoadingSpinner.svelte` | `ui/spinner` | Direct replacement |
| `notification-bell/NotificationBell.svelte` | Custom (keep + restyle) | Uses `ui/popover` + `ui/button` + `ui/badge` |
| `skeleton/Skeleton.svelte` | `ui/skeleton` | Direct replacement |
| `stat-card/StatCard.svelte` | `ui/card` | Rebuild using Card + Tailwind |
| `status-badge/StatusBadge.svelte` | `ui/badge` | See Appendix D for variant mapping |
| `tabs/Tabs.svelte` | `ui/tabs` | Direct replacement |
| `toast/Toast.svelte` | `ui/sonner` | Replaced by Sonner toast system |
| `pagination/Pagination.svelte` | `ui/pagination` | Direct replacement |

---

## Appendix B: Icon Mapping (Material Symbols → Lucide)

| Material Symbol | Lucide Icon | Import Path |
|---|---|---|
| `dashboard` | `LayoutDashboard` | `@lucide/svelte/icons/layout-dashboard` |
| `folder` | `Folder` | `@lucide/svelte/icons/folder` |
| `chat` | `MessageSquare` | `@lucide/svelte/icons/message-square` |
| `assignment` | `ListTodo` | `@lucide/svelte/icons/list-todo` |
| `monitoring` | `Activity` | `@lucide/svelte/icons/activity` |
| `description` | `FileText` | `@lucide/svelte/icons/file-text` |
| `auto_stories` | `BookOpen` | `@lucide/svelte/icons/book-open` |
| `bar_chart` | `BarChart3` | `@lucide/svelte/icons/bar-chart-3` |
| `admin_panel_settings` | `Shield` | `@lucide/svelte/icons/shield` |
| `check_circle` | `CircleCheck` | `@lucide/svelte/icons/circle-check` |
| `error` | `CircleAlert` | `@lucide/svelte/icons/circle-alert` |
| `warning` | `TriangleAlert` | `@lucide/svelte/icons/triangle-alert` |
| `info` | `Info` | `@lucide/svelte/icons/info` |
| `close` | `X` | `@lucide/svelte/icons/x` |
| `menu` | `Menu` | `@lucide/svelte/icons/menu` |
| `search` | `Search` | `@lucide/svelte/icons/search` |
| `add` | `Plus` | `@lucide/svelte/icons/plus` |
| `delete` | `Trash2` | `@lucide/svelte/icons/trash-2` |
| `edit` | `Pencil` | `@lucide/svelte/icons/pencil` |
| `content_copy` | `Copy` | `@lucide/svelte/icons/copy` |
| `refresh` | `RefreshCw` | `@lucide/svelte/icons/refresh-cw` |
| `expand_more` | `ChevronDown` | `@lucide/svelte/icons/chevron-down` |
| `expand_less` | `ChevronUp` | `@lucide/svelte/icons/chevron-up` |
| `chevron_right` | `ChevronRight` | `@lucide/svelte/icons/chevron-right` |
| `chevron_left` | `ChevronLeft` | `@lucide/svelte/icons/chevron-left` |
| `more_vert` | `MoreVertical` | `@lucide/svelte/icons/more-vertical` |
| `more_horiz` | `MoreHorizontal` | `@lucide/svelte/icons/more-horizontal` |
| `settings` | `Settings` | `@lucide/svelte/icons/settings` |
| `logout` | `LogOut` | `@lucide/svelte/icons/log-out` |
| `person` | `User` | `@lucide/svelte/icons/user` |
| `group` | `Users` | `@lucide/svelte/icons/users` |
| `notifications` | `Bell` | `@lucide/svelte/icons/bell` |
| `inbox` | `Inbox` | `@lucide/svelte/icons/inbox` |
| `play_arrow` | `Play` | `@lucide/svelte/icons/play` |
| `pause` | `Pause` | `@lucide/svelte/icons/pause` |
| `stop` | `Square` | `@lucide/svelte/icons/square` |
| `drag_indicator` | `GripVertical` | `@lucide/svelte/icons/grip-vertical` |
| `progress_activity` | `Loader2` (with animate-spin) | `@lucide/svelte/icons/loader-2` |
| `link` | `Link` | `@lucide/svelte/icons/link` |
| `link_off` | `Unlink` | `@lucide/svelte/icons/unlink` |
| `visibility` | `Eye` | `@lucide/svelte/icons/eye` |
| `visibility_off` | `EyeOff` | `@lucide/svelte/icons/eye-off` |
| `download` | `Download` | `@lucide/svelte/icons/download` |
| `upload` | `Upload` | `@lucide/svelte/icons/upload` |
| `smart_toy` | `Bot` | `@lucide/svelte/icons/bot` |
| `psychology` | `Brain` | `@lucide/svelte/icons/brain` |
| `token` | `Coins` | `@lucide/svelte/icons/coins` |
| `speed` | `Gauge` | `@lucide/svelte/icons/gauge` |
| `memory` | `Cpu` | `@lucide/svelte/icons/cpu` |
| `storage` | `HardDrive` | `@lucide/svelte/icons/hard-drive` |
| `schedule` | `Clock` | `@lucide/svelte/icons/clock` |
| `calendar_today` | `Calendar` | `@lucide/svelte/icons/calendar` |
| `archive` | `Archive` | `@lucide/svelte/icons/archive` |
| `unarchive` | `ArchiveRestore` | `@lucide/svelte/icons/archive-restore` |
| `send` | `Send` | `@lucide/svelte/icons/send` |
| `code` | `Code` | `@lucide/svelte/icons/code` |
| `terminal` | `Terminal` | `@lucide/svelte/icons/terminal` |
| `sync` | `RefreshCw` | `@lucide/svelte/icons/refresh-cw` |
| `check` | `Check` | `@lucide/svelte/icons/check` |
| `done_all` | `CheckCheck` | `@lucide/svelte/icons/check-check` |
| `cancel` | `XCircle` | `@lucide/svelte/icons/x-circle` |
| `filter_list` | `Filter` | `@lucide/svelte/icons/filter` |
| `sort` | `ArrowUpDown` | `@lucide/svelte/icons/arrow-up-down` |
| `open_in_new` | `ExternalLink` | `@lucide/svelte/icons/external-link` |

**Icon sizing convention:**
- Old: `--icon-sm: 16px`, `--icon-md: 20px`, `--icon-lg: 32px`, `--icon-xl: 48px`
- New: `class="size-4"` (16px), `class="size-5"` (20px), `class="size-8"` (32px), `class="size-12"` (48px)

---

## Appendix C: CSS Variable Reference

### shadcn Token → Ralph Hex → oklch

| Token | Purpose | Hex | oklch |
|---|---|---|---|
| `--background` | Page background | `#1a1816` | `oklch(0.211 0.005 67.5)` |
| `--foreground` | Primary text | `#e6e1d6` | `oklch(0.911 0.016 86.4)` |
| `--card` | Card background | `#231f1c` | `oklch(0.243 0.008 59.2)` |
| `--card-foreground` | Card text | `#e6e1d6` | `oklch(0.911 0.016 86.4)` |
| `--popover` | Popover background | `#2c2724` | `oklch(0.277 0.009 53.0)` |
| `--popover-foreground` | Popover text | `#e6e1d6` | `oklch(0.911 0.016 86.4)` |
| `--primary` | Gold accent | `#d4af37` | `oklch(0.767 0.139 91.1)` |
| `--primary-foreground` | Text on gold | `#1a1816` | `oklch(0.211 0.005 67.5)` |
| `--secondary` | Secondary surface | `#2c2724` | `oklch(0.277 0.009 53.0)` |
| `--secondary-foreground` | Secondary text | `#e6e1d6` | `oklch(0.911 0.016 86.4)` |
| `--muted` | Muted surface | `#2c2724` | `oklch(0.277 0.009 53.0)` |
| `--muted-foreground` | Muted text | `#b0a99b` | `oklch(0.737 0.021 84.6)` |
| `--accent` | Accent surface | `#2c2724` | `oklch(0.277 0.009 53.0)` |
| `--accent-foreground` | Accent text | `#e6e1d6` | `oklch(0.911 0.016 86.4)` |
| `--destructive` | Error/danger | `#d4605a` | `oklch(0.631 0.148 25.2)` |
| `--border` | Borders | `#3d3630` | `oklch(0.338 0.014 62.9)` |
| `--input` | Input borders | `#3d3630` | `oklch(0.338 0.014 62.9)` |
| `--ring` | Focus ring | `#d4af37` | `oklch(0.767 0.139 91.1)` |
| `--success` | Success green | `#5ab87a` | `oklch(0.709 0.128 152.9)` |
| `--warning` | Warning (=accent) | `#d4af37` | `oklch(0.767 0.139 91.1)` |
| `--accent-dim` | Accent transparent | `rgba(212,175,55,0.15)` | `oklch(0.767 0.139 91.1 / 15%)` |

### Sidebar Tokens

| Token | Purpose | Maps to |
|---|---|---|
| `--sidebar` | Sidebar background | Same as `--card` |
| `--sidebar-foreground` | Sidebar text | Same as `--foreground` |
| `--sidebar-primary` | Active nav item | Same as `--primary` (gold) |
| `--sidebar-primary-foreground` | Active nav text | Same as `--primary-foreground` |
| `--sidebar-accent` | Hover state | Same as `--accent` |
| `--sidebar-accent-foreground` | Hover text | Same as `--accent-foreground` |
| `--sidebar-border` | Sidebar border | Same as `--border` |
| `--sidebar-ring` | Sidebar focus | Same as `--ring` (gold) |

---

## Appendix D: Status Badge Variant Mapping

Map database status enums to shadcn Badge variants:

### Feature Status
| Status | Old CSS Class | New Badge Variant | Display |
|---|---|---|---|
| `Draft` | `.badge-draft` | `secondary` | Muted |
| `Submitted` | `.badge-submitted` | `warning` | Gold |
| `In_Progress` | `.badge-in_progress` | `warning` | Gold |
| `Complete` | `.badge-completed` | `success` | Green |
| `Failed` | `.badge-failed` | `destructive` | Red |

### Task Status
| Status | Old CSS Class | New Badge Variant | Display |
|---|---|---|---|
| `Pending` | `.badge-pending` | `secondary` | Muted |
| `Approved` | `.badge-approved` | `info` | Blue |
| `Queued` | `.badge-queued` | `warning` | Gold |
| `Running` | `.badge-running` | `warning` | Gold |
| `Complete` | `.badge-completed` | `success` | Green |
| `Failed` | `.badge-failed` | `destructive` | Red |
| `Stopped` | `.badge-stopped` | `destructive` | Red |

### Agent Run Status
| Status | Old CSS Class | New Badge Variant | Display |
|---|---|---|---|
| `running` | `.badge-running` | `warning` | Gold |
| `completed` | `.badge-completed` | `success` | Green |
| `failed` | `.badge-failed` | `destructive` | Red |
| `cancelled` | `.badge-stopped` | `destructive` | Red |

### Pipeline Status
| Status | New Badge Variant | Display |
|---|---|---|
| `idle` | `secondary` | Muted |
| `running` | `warning` | Gold |
| `paused` | `info` | Blue |
| `error` | `destructive` | Red |

### Helper Function

Create `web/src/lib/components/status-badge.svelte`:

```svelte
<script lang="ts" module>
    import type { BadgeVariant } from '$lib/components/ui/badge/index.js';

    const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
        // Success states
        complete: 'success',
        completed: 'success',
        active: 'success',
        // Warning/in-progress states
        submitted: 'warning',
        in_progress: 'warning',
        queued: 'warning',
        running: 'warning',
        approved: 'info',
        paused: 'info',
        // Error states
        failed: 'destructive',
        stopped: 'destructive',
        cancelled: 'destructive',
        error: 'destructive',
        // Neutral states
        draft: 'secondary',
        pending: 'secondary',
        idle: 'secondary',
        archived: 'outline',
    };

    export function resolve_status_variant(status: string): BadgeVariant {
        return STATUS_VARIANT_MAP[status.toLowerCase()] ?? 'secondary';
    }
</script>

<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';

    let { status, class: class_name }: { status: string; class?: string } = $props();
    const variant = $derived(resolve_status_variant(status));
    const label = $derived(status.replace(/_/g, ' '));
</script>

<Badge {variant} class={class_name}>{label}</Badge>
```

---

## Appendix E: Animation Specifications

| Element | Tailwind Classes | Notes |
|---|---|---|
| Sidebar collapse/expand | Built-in to shadcn Sidebar (200ms) | No custom CSS needed |
| Mobile sidebar (Sheet) | Built-in to shadcn Sheet | Slide from left |
| Dialog open/close | Built-in to shadcn Dialog | Fade + scale via tw-animate-css |
| Toast enter/exit | Built-in to Sonner | Slide from bottom |
| Skeleton shimmer | `animate-pulse` on shadcn Skeleton | Built-in |
| Button hover | Defined in `tv()` variant classes | `transition-colors` |
| Card hover | `transition-shadow hover:shadow-lg` | Only on interactive cards |
| Spinner | `animate-spin` on Lucide `Loader2` | Built-in |
| Focus ring | `ring-ring/50 transition-shadow` | Via `@layer base` |

---

## Appendix F: Migration Execution Constraints

These constraints are **non-negotiable**. The implementing agent must follow them:

### Svelte 5 Rules
- `$props()` — never `export let`
- `$state()` — never `writable()` or stores
- `$derived()` — never `$:` reactive statements
- `{@render children?.()}` — never `<slot>`
- Callback props — never `createEventDispatcher`

### Architecture Rules
- Page components: max 300 lines, decompose into subcomponents
- SSR is disabled (`ssr: false` in `+layout.ts`) — all client-side
- Data fetching: `onMount` + polling — not SvelteKit `load()` functions
- `snake_case` for variables/functions, `PascalCase` for types, `kebab-case` for files

### Package Management
- `bun` only — no npm, yarn, or pnpm
- Do NOT add new dependencies without explicit justification

### Styling Rules
- All colors via CSS custom properties — no hardcoded hex in components
- All component styles via Tailwind classes — no `<style>` blocks
- Mobile breakpoint: 768px (via Tailwind `md:` prefix)
- Dark theme default — no theme toggle

### Behavioral Preservation
- All API integrations must continue working
- Auth flow (WebAuthn passkeys) must remain functional
- SSE notifications must keep working
- Chat streaming must not break
- Drag-and-drop in pipeline must be preserved
- Event stream subscriptions must remain intact
- Polling intervals must remain unchanged

### Commit Strategy
- Type-check after every phase: `cd web && bun run check`
- Commit at phase boundaries (not per-file)
- Commit message format: `Migrate [scope] to shadcn-svelte`
- Each commit must leave the app in a working state

---

## Appendix G: File Inventory After Migration

```
web/src/
├── app.css                         # Tailwind + theme (new)
├── app.html                        # Updated (no Google Fonts CDN)
├── lib/
│   ├── api/
│   │   ├── client.ts               # Unchanged
│   │   └── event-stream.ts         # Unchanged
│   ├── auth.ts                     # Unchanged
│   ├── components/
│   │   ├── app-sidebar.svelte      # NEW: shadcn Sidebar wrapper
│   │   ├── notification-bell/      # Restyled with shadcn Popover
│   │   ├── code-block/             # Restyled with Tailwind
│   │   ├── status-badge.svelte     # NEW: status → badge variant resolver
│   │   └── ui/                     # shadcn-svelte components (generated)
│   │       ├── accordion/
│   │       ├── alert/
│   │       ├── alert-dialog/
│   │       ├── avatar/
│   │       ├── badge/              # Customized: added success/warning/info/muted
│   │       ├── breadcrumb/
│   │       ├── button/             # Customized: added primary/danger variants
│   │       ├── card/
│   │       ├── checkbox/
│   │       ├── collapsible/
│   │       ├── dialog/
│   │       ├── dropdown-menu/
│   │       ├── empty/
│   │       ├── input/
│   │       ├── label/
│   │       ├── pagination/
│   │       ├── popover/
│   │       ├── progress/
│   │       ├── scroll-area/
│   │       ├── select/
│   │       ├── separator/
│   │       ├── sheet/
│   │       ├── sidebar/
│   │       ├── skeleton/
│   │       ├── sonner/             # Customized: dark mode hardcoded
│   │       ├── spinner/
│   │       ├── switch/
│   │       ├── table/
│   │       ├── tabs/
│   │       ├── textarea/
│   │       └── tooltip/
│   ├── hooks/                      # shadcn hooks (if any)
│   ├── stores/                     # Auth store only (toast store deleted)
│   ├── styles/
│   │   └── hljs-dark.css           # Kept for code highlighting
│   ├── types/
│   │   └── index.ts                # Unchanged
│   └── utils.ts                    # cn() + utility types (new/augmented)
└── routes/
    ├── +layout.svelte              # Rewritten with Sidebar.Provider
    ├── +page.svelte                # Dashboard (restyled)
    ├── +error.svelte               # Error page (restyled)
    ├── AuthScreen.svelte           # Auth (restyled)
    ├── notification-stream.ts      # Unchanged
    ├── ActivityFeed.svelte         # Restyled
    ├── KpiBar.svelte               # Restyled
    ├── PipelineCard.svelte         # Restyled
    ├── SystemStatsCard.svelte      # Restyled
    ├── admin/                      # All pages restyled
    ├── chat/                       # Restyled, streaming preserved
    ├── monitoring/                 # Restyled
    ├── pipeline/                   # Restyled, drag-and-drop preserved
    ├── projects/                   # Restyled
    ├── prompts/                    # Restyled
    ├── skills/                     # Restyled
    └── usage/                      # Restyled
```

### Deleted Files (Post-Cleanup)
```
DELETED: web/src/lib/components/primitives/     # All old primitives
DELETED: web/src/lib/components/accordion/
DELETED: web/src/lib/components/checkbox/
DELETED: web/src/lib/components/confirm-modal/
DELETED: web/src/lib/components/empty-state/
DELETED: web/src/lib/components/error-banner/
DELETED: web/src/lib/components/loading-spinner/
DELETED: web/src/lib/components/skeleton/
DELETED: web/src/lib/components/stat-card/
DELETED: web/src/lib/components/status-badge/
DELETED: web/src/lib/components/tabs/
DELETED: web/src/lib/components/toast/
DELETED: web/src/lib/components/pagination/
DELETED: web/src/lib/styles/global.css
DELETED: web/src/routes/Sidebar.svelte
DELETED: web/src/routes/SidebarNav.svelte
DELETED: web/src/routes/AuthFeedback.svelte     # Merged into AuthScreen
DELETED: web/src/lib/stores/toast.ts
```
