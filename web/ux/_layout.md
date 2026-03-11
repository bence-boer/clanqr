# Layout Shell (`+layout.svelte`)

The root layout gates all rendering through an auth state machine before showing any content.

---

## Auth Gate (top-level branch)

The layout renders **exactly one** of three branches based on auth state + current path:

| Condition | Renders |
|---|---|
| Path starts with `/invite` | `children()` directly — no sidebar, no auth check |
| `auth_store.state !== 'authenticated'` | [AuthScreen](#auth-screen) (full-screen, replaces everything) |
| `auth_store.state === 'authenticated'` | App shell with sidebar + main content |

---

## Auth Screen

Full-screen centered card. Four visual states driven by `auth_store.state`:

### State: `loading`
- **Layout:** Centered card with a spinning `progress_activity` icon
- **Interactions:** None

### State: `error`
- **Layout:** Centered card
- **Elements:**
  - Icon: `cloud_off` (48px, accent color)
  - Heading: "Ralph Agent Workspace"
  - Subtitle: "Could not reach the API server. Is it running?"
  - Button: "Retry" (primary) — reloads the page (`window.location.reload()`)
- **Interactions:** Click "Retry" → full page reload

### State: `setup`
- **Layout:** Centered card (max-width 380px)
- **Elements:**
  - Icon: `passkey` (48px, accent color)
  - Heading: "Ralph Agent Workspace"
  - Subtitle: "Set up a passkey to secure your workspace."
  - Text input: "Display name" (bound to `setup_name`)
  - Button: "Create Passkey" (primary, fingerprint icon)
  - Error text (conditionally shown if `error` is set)
- **Interactions:**
  - Type in display name field
  - Click "Create Passkey" → calls `onregister(setup_name || 'Admin')` → triggers WebAuthn registration flow → on success: transitions to `authenticated`
  - On failure: error message appears below button

### State: `login`
- **Layout:** Centered card (max-width 380px)
- **Elements:**
  - Icon: `lock` (48px, accent color)
  - Heading: "Ralph Agent Workspace"
  - Subtitle: "Authenticate with your passkey to continue."
  - Button: "Sign in with Passkey" (primary, fingerprint icon) — disabled while `pending`
  - While pending: button text becomes "Authenticating…", icon becomes `progress_activity`
  - Error text (conditionally shown if `error` is set)
- **Interactions:**
  - Click "Sign in with Passkey" → triggers WebAuthn authentication flow → on success: transitions to `authenticated`, loads system stats
  - On failure: error message appears below button

---

## Authenticated App Shell

**Layout:** Flex row, full viewport height.

### Mobile toggle button
- Hidden on desktop (≥769px)
- Fixed position top-left on mobile
- Icon: `menu` when sidebar closed, `close` when open
- Click → toggles `sidebar_open`

### Sidebar overlay (mobile only)
- Visible only when `sidebar_open` is true on mobile
- Semi-transparent black backdrop (`rgba(0,0,0,0.5)`)
- Click → closes sidebar

### Sidebar
See [Sidebar](#sidebar) below.

### Main content area
- Left margin: 220px on desktop, 0 on mobile
- Padding: 2rem desktop, 1rem mobile (with 3.5rem top on mobile for toggle button)
- Max-width: 1200px
- Contains:
  1. **Critical alerts banner** (conditional) — shown if any system alerts have `severity === 'critical'`
     - Red background, error icon, joined alert messages separated by ` · `
  2. **Page content** (`children()`)

### Toast container
- Rendered after the app shell
- Displays toast notifications (success/error/warning/info)
- Error toasts auto-dismiss at 10s, others at 5s
- Each toast has a dismiss button

---

## Sidebar

Fixed left panel, 220px wide. Scrollable vertically.

### Logo section
- Robot icon (`smart_toy`, 28px, accent color)
- "Ralph" heading
- "Agent Workspace" subtitle (uppercase, small)

### Navigation (SidebarNav)
Grouped into sections with uppercase labels:

**Workspace section:**
| Link | Icon | Path | Active when |
|---|---|---|---|
| Dashboard | `dashboard` | `/` | Exact match `/` |
| Projects | `folder` | `/projects` | Path starts with `/projects` |
| Pipeline | `account_tree` | `/pipeline` | Path starts with `/pipeline` |
| Monitoring | `monitoring` | `/monitoring` | Path starts with `/monitoring` |

**AI section:**
| Link | Icon | Path | Active when |
|---|---|---|---|
| Chat | `chat` | `/chat` | Path starts with `/chat` |
| Usage | `analytics` | `/usage` | Path starts with `/usage` |

**Configure section:**
| Link | Icon | Path | Active when |
|---|---|---|---|
| Prompts & Traits | `tune` | `/prompts` | Path starts with `/prompts` |
| Skills | `extension` | `/skills` | Path starts with `/skills` |

**Settings section** (admin only — hidden if `role !== 'admin'`):
| Link | Icon | Path | Active when |
|---|---|---|---|
| Admin | `admin_panel_settings` | `/admin` | Path starts with `/admin` |

Active link styling: accent-colored text, accent left border, background change.
Each link click also fires `onclose` (closes mobile sidebar).

### Footer
- **System mini stats** (conditional — shown if `system_stats` is available):
  - Memory icon, "CPU {percent}%", optionally "· {temp}°C"
- **Sign out button** (ghost variant, full width, `logout` icon) → calls `onlogout` → clears auth state, returns to login screen

---

## Error Page (`+error.svelte`)

Rendered by SvelteKit when a route error occurs.

**Layout:** Centered card (max-width 420px), full viewport height.

**Elements:**
- Error icon (48px, danger color)
- Heading: "Something went wrong"
- Subtitle: "The page you're looking for doesn't exist." (404) or "An unexpected error occurred. Please try again." (other)
- Error detail (conditional) — monospace block showing `page.error.message`
- Two action buttons:
  - "Go Home" (primary, home icon) → navigates to `/`
  - "Retry" (default, refresh icon) → `window.location.reload()`
