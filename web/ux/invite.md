# Invite (`/invite?token=...`)

Public registration page for invited users. Bypasses the normal auth gate — rendered directly without sidebar or auth check.

---

## Token Source

- Token read from URL query parameter: `?token={value}`
- Page checks both auth status and invite validity on mount

---

## States

### Loading
- Centered card with spinning `progress_activity` icon

### Already Authenticated
- If `check_auth()` returns `authenticated`: immediate redirect to [/](index.md)
- No visible state — navigates away

### Invalid Invite (error + invite not valid)

Centered card:
- Icon: `link_off` (large, accent)
- Heading: "Ralph Agent Workspace"
- Error message (varies by reason):
  - `not_found`: "This invite link is invalid."
  - `used`: "This invite link has already been used — each link can only be used once."
  - `expired`: "This invite link has expired."
  - No token: "Invalid invite link."
- "Go to login" link → navigates to [/](index.md) (via login screen)

### Valid Invite (registration form)

Centered card (max-width 380px):
- Icon: `person_add` (large, accent)
- Heading: "Ralph Agent Workspace"
- Subtitle: "You've been invited. Create a passkey to get started."
- Invite metadata (conditional):
  - Expiry date: "Expires {date}" (if `expires_at` is set)
- Display name input (text, disabled while submitting)
  - Enter key → submits form
- "Create Passkey" / "Creating…" button (primary, fingerprint icon)
  - Disabled while submitting
- Error text (conditional, below button)

### Registration Flow

1. User enters display name
2. Click "Create Passkey" or press Enter
3. Validation: if empty, shows "Please enter a display name."
4. Calls `register_passkey(display_name, token)` → triggers WebAuthn registration
5. On success: redirects to [/](index.md) (now authenticated)
6. On failure:
   - 409 / "already used" → "This invite link has already been used."
   - "expired" → "This invite link has expired."
   - Other → shows error message

---

## Layout

- Full-screen centered, no sidebar, no navigation
- Card: surface background, bordered, rounded, padded (2.5rem, reduced on mobile)
- Same visual style as the main AuthScreen
