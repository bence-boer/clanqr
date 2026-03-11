# Admin (`/admin`)

User management and invite link generation. Admin-only page (redirects non-admins to `/` with error toast).

---

## Access Control

- On mount: checks `auth_store.role`
- If not `admin`: toast "Admin access required" → redirect to [/](index.md)
- While checking: LoadingSpinner "Checking permissions…"

---

## Page Header

- Heading: "Admin"

## Tabs

| Tab | Icon | Label |
|---|---|---|
| Users | `group` | "Users" |
| Invite Links | `link` | "Invite Links" |

---

## Tab 1: Users

### State: Loading
- LoadingSpinner: "Loading users..."

### State: Error
- ErrorBanner with error message

### State: Empty
- EmptyState: group icon, "No users found."

### State: Has Users

**Table columns (desktop):**

| Column | Content |
|---|---|
| Display Name | User name + "you" badge (info) if current user |
| Role | Badge: admin (warning) / user (muted) |
| Registered | Formatted date |
| Sessions | Session count (centered) |
| Actions | See below |

**Mobile:** Table transforms to stacked cards with `data-label` attributes.

Current user's row has subtle purple highlight.

### User Actions (per user)

**Default state:**
- "Make User" / "Make Admin" button (secondary, sm) — toggles role
  - Disabled if: toggling in progress, is current user, or is last admin being demoted
  - Tooltip explains disabled reason
- "Revoke Access" button (danger, sm)
  - Disabled if current user
  - Tooltip: "Cannot revoke your own access"

**Delete confirmation state** (after clicking "Revoke Access"):
- "Are you sure?" text (muted)
- "Confirm" / "Deleting..." button (danger, sm)
- "Cancel" button (secondary, sm)

**Actions:**
- Toggle role → optimistic update → `api.update_user_role()` → rollback on failure
- Confirm delete → `api.delete_user()` → removes from list

---

## Tab 2: Invite Links

### Invite Form

Card titled "Generate Invite Link":

**Fields:**
- Row: Label input (optional, "e.g. For Alice") + Role select (User / Admin)
- Expiry Mode tabs: "Valid for" (relative) / "Valid until" (absolute)

**Relative mode (default):**
- Preset duration buttons: 1m, 5m, 30m, 1h, 3h, 6h, 12h, 24h
- Active preset highlighted

**Absolute mode:**
- datetime-local input (min: 1 minute from now, max: 24 hours from now)

**Generate button:** "Generate Link" / "Generating..." (primary, add_link icon)
- Disabled while generating or if absolute mode with no datetime selected

### Invite Success Banner (conditional)

Green-tinted card shown after successful generation:
- Header: check_circle icon + "Invite link created" + dismiss (X) button
- URL row: monospace code block with full URL + "Copy Link" / "Copied!" button
- Warning: "This link will not be shown again."
- Copy → clipboard API, "Copied!" state for 2 seconds

### Invite Table

**Header:** "Existing Invites"

### State: Loading
- LoadingSpinner: "Loading invites..."

### State: Empty
- EmptyState: link_off icon, "No invite links yet."

### State: Has Invites

**Table columns:**

| Column | Content |
|---|---|
| Label | Invite label or "—" (truncated 160px) |
| Role | Badge: admin (warning) / user (muted) |
| Status | Badge: Active (success) / Expired (muted) / Used (info) |
| Expires | Formatted datetime |
| Used By | Display name or "—" |
| Actions | See below |

**Actions (only for Active invites):**
- Token preview (monospace, small, muted background) — if available
- "Revoke" / "Revoking..." button (danger, sm)
  - Action: `api.revoke_invite()` → removes from list

Mobile: table transforms to stacked cards.
