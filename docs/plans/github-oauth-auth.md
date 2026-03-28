# PLAN-PLAN: GitHub OAuth Authentication Migration

> **What this document is**: Instructions for a future agent to create the actual implementation plan
> for migrating ralph-agent-workspace from WebAuthn passkey auth to GitHub OAuth.
>
> **What this document is NOT**: The implementation plan itself. Do not implement from this document.
> First produce a detailed, phased implementation plan — then implement from that.

---

## 1 · Objective

Replace the current WebAuthn passkey authentication system with GitHub OAuth.
After migration:

- Users authenticate via "Sign in with GitHub" (standard OAuth 2.0 authorization code flow)
- User identity comes from the GitHub API (`/user` endpoint)
- Admin role is determined by a configurable allowlist of GitHub user IDs
- The user's GitHub OAuth access token (`gho_xxx`) is stored securely for reuse by `copilot-sdk`
- Invite tokens and passkeys are removed entirely
- Sessions remain cookie-based (HTTPOnly, Secure, SameSite=Lax) backed by the DB

---

## 2 · Current System Summary

The planning agent MUST read these files before writing the plan.
Do not skip any — every file contains decisions that affect the migration.

### Backend (Hono on Bun, port 3001)

| File | What it does | Migration impact |
|------|-------------|------------------|
| `server/src/routes/auth.ts` | Main auth hub: `GET /status`, `POST /logout`, `GET /invite/status`, mounts register/login sub-routes | **Replace entirely.** New endpoints: `/auth/github`, `/auth/callback`, `/auth/logout`, `/auth/status` |
| `server/src/routes/auth_login.ts` | WebAuthn login: generate challenge → verify response → create session | **Delete.** Replaced by OAuth callback handler |
| `server/src/routes/auth_register.ts` | WebAuthn registration: generate options → verify credential → store passkey → claim invite atomically | **Delete.** GitHub handles identity; no registration step needed |
| `server/src/routes/auth_shared.ts` | Exports: `RP_NAME`, `RP_ID`, `RP_ORIGIN`, `challenge_store`, `generate_session_token()` | **Partially keep.** `generate_session_token()` is reusable. Delete WebAuthn constants and challenge store |
| `server/src/middleware/auth_middleware.ts` | Validates session cookie, joins `sessions→passkeys` to get role, sets `passkey_id` and `role` on context | **Rewrite.** Join `sessions→users` instead. Replace `passkey_id` with `user_id` on context. Keep cookie extraction and expiry check logic |
| `server/src/middleware/admin_middleware.ts` | Checks `context.get('role') === 'admin'` | **Keep as-is.** Role source changes (DB user.role instead of passkey.role) but middleware logic is identical |
| `server/src/routes/admin.ts` | User management: list/update/delete users, invite CRUD, session revocation | **Rewrite partially.** Remove invite endpoints. User list queries `users` table instead of `passkeys`. Role update, delete, session revocation stay similar |
| `server/src/utils/dev_sessions.ts` | Dev-mode session tokens and passkey IDs | **Update.** Replace `dev-passkey` / `dev-admin` with `dev-user` / `dev-admin-user` pointing to seeded dev users |
| `server/src/index.ts` | App entry: middleware stack, route mounting, boot sequence (session cleanup, etc.) | **Update route mounting.** Replace `/api/auth/register/*` and `/api/auth/login/*` with new OAuth routes. Keep session cleanup. Remove invite cleanup |
| `server/src/env.ts` | Zod schema for env vars: `RP_ID`, `RP_ORIGIN`, etc. | **Replace auth vars.** Remove `RP_ID`, `RP_ORIGIN`. Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `ADMIN_GITHUB_IDS`, `SESSION_SECRET` (for token encryption) |

### Frontend (SvelteKit + Svelte 5, SPA mode, port 3002)

| File | What it does | Migration impact |
|------|-------------|------------------|
| `web/src/lib/auth.ts` | Functions: `check_auth()`, `register_passkey()`, `login_passkey()`, `logout()` | **Rewrite.** Replace passkey functions with `redirect_to_github()` and `handle_oauth_callback(code, state)`. Keep `check_auth()` and `logout()` (similar shape) |
| `web/src/lib/stores/auth.svelte.ts` | Svelte 5 reactive class: states `loading→setup→login→authenticated→error`, tracks `role`, `passkey_id` | **Rewrite.** States become `loading→unauthenticated→redirecting→authenticated→error`. Replace `passkey_id` with `user` object (github_id, login, avatar_url, display_name). Remove `setup` state (no first-time passkey creation) |
| `web/src/routes/AuthScreen.svelte` | UI: setup screen (first passkey), login screen (existing passkey), error states | **Rewrite.** Single "Sign in with GitHub" button. Remove passkey-specific UI (display name input, browser passkey prompt, timeout hints). Add GitHub avatar + username display for authenticated state |
| `web/src/lib/api/client.ts` | Type-safe Hono client, 401→reset auth store, admin API calls (invites, users) | **Update.** Remove invite-related API calls. Update admin user calls (passkey_id → user_id). Keep 401 handling |
| `web/src/lib/api/rpc.ts` | Custom fetch with credentials: 'include' | **Keep as-is** |

### Database (Supabase Postgres via Docker)

| Table | Current schema | Migration |
|-------|---------------|-----------|
| `passkeys` | credential_id, public_key, counter, device_type, backed_up, transports, display_name, role | **Drop.** Replaced by `users` table |
| `sessions` | id (UUID), passkey_id (FK→passkeys), token, expires_at | **Alter.** Replace `passkey_id` FK with `user_id` FK→users |
| `invite_tokens` | token, role, label, created_by_passkey_id, expires_at, used_at, used_by_passkey_id | **Drop.** GitHub handles identity — no invite flow needed |
| `users` (new) | github_id, github_login, display_name, avatar_url, email, role, github_access_token_encrypted, created_at, updated_at | **Create.** Central user identity table |

### Key migrations in `supabase/supabase/migrations/`

The planning agent must list existing migrations to understand ordering:
```bash
ls -la supabase/supabase/migrations/
```

Relevant existing migrations:
- `20260219111526_auth_passkeys.sql` — creates passkeys + sessions tables
- `20260221140000_admin_roles_invites.sql` — adds role to passkeys, creates invite_tokens
- `20260222120000_db_tech_debt_fixes.sql` — adds RLS policies to auth tables

---

## 3 · Target Architecture

### New Endpoints

```
GET  /auth/github     → Generate state param, redirect to GitHub authorization URL
GET  /auth/callback   → Exchange code for token, fetch profile, upsert user, create session, redirect to app
POST /auth/logout     → Delete session, clear cookie
GET  /auth/status     → Return { authenticated, user: { github_id, login, display_name, avatar_url, role } }
```

### OAuth Flow

```
Browser                     Hono API                    GitHub
  │                            │                           │
  ├─ GET /auth/github ────────►│                           │
  │                            ├─ Generate state param     │
  │                            ├─ Store state (cookie/DB)  │
  │◄─── 302 Redirect ─────────┤                           │
  │                            │                           │
  ├─ GET github.com/login/oauth/authorize ────────────────►│
  │                            │                           │
  │◄──── 302 to /auth/callback?code=xxx&state=yyy ────────┤
  │                            │                           │
  ├─ GET /auth/callback ──────►│                           │
  │                            ├─ Validate state           │
  │                            ├─ POST /login/oauth/access_token ──►│
  │                            │◄── { access_token } ──────┤
  │                            ├─ GET /user (Bearer token) ────────►│
  │                            │◄── { id, login, name, avatar_url, email } ─┤
  │                            ├─ Upsert user in DB        │
  │                            ├─ Store encrypted token    │
  │                            ├─ Create session           │
  │                            ├─ Set session cookie       │
  │◄─── 302 Redirect to app ──┤                           │
  │                            │                           │
```

### New Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user',       -- 'admin' | 'user'
  github_access_token_encrypted TEXT,       -- AES-256-GCM encrypted gho_xxx token
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_github_id ON users(github_id);

-- Sessions: replace passkey_id FK with user_id FK
ALTER TABLE sessions DROP CONSTRAINT sessions_passkey_id_fkey;
ALTER TABLE sessions RENAME COLUMN passkey_id TO user_id;
ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Drop old tables
DROP TABLE invite_tokens;
DROP TABLE passkeys;
```

### Environment Variables

```
GITHUB_CLIENT_ID       — OAuth App client ID
GITHUB_CLIENT_SECRET   — OAuth App client secret
GITHUB_CALLBACK_URL    — Full callback URL (https://clanqr.dev/auth/callback or https://test.clanqr.dev/auth/callback)
ADMIN_GITHUB_IDS       — Comma-separated GitHub user IDs for admin role (e.g., "12345,67890")
SESSION_SECRET         — 32-byte key for encrypting GitHub access tokens at rest
```

Remove: `RP_ID`, `RP_ORIGIN`

### Context Type Changes

```typescript
// Before (server/src/middleware/auth.ts AppBindings)
type Variables = {
  supabase: SupabaseClient;
  passkey_id: string;
  role: string;
  request_id: string;
};

// After
type Variables = {
  supabase: SupabaseClient;
  user_id: string;        // UUID from users table
  github_id: number;      // GitHub user ID (for admin check, copilot-sdk)
  role: string;           // 'admin' | 'user'
  request_id: string;
};
```

---

## 4 · Dependencies and Ordering

### Branch Dependency: `feature/database-redesign`

> The planning agent must check if `feature/database-redesign` exists and what schema changes it introduces.
> If it adds a `users` table or modifies `sessions`, the OAuth migration must align with or build on that schema.

```bash
git branch -a | grep database-redesign
# If it exists, diff the migrations:
git diff main..feature/database-redesign -- supabase/supabase/migrations/
```

### Package Changes

**Add:**
- None required — GitHub OAuth is a simple HTTP flow (code exchange via `fetch`). No SDK needed.
- If token encryption is needed: Node.js `crypto` module is built into Bun — no external package.

**Remove:**
- `@simplewebauthn/server` (server/package.json)
- `@simplewebauthn/browser` (web/package.json)
- `@simplewebauthn/types` (if present)

### Migration Order

The implementation plan MUST specify this order:

1. **Database migration first** — create `users` table, alter `sessions`, drop old tables
2. **Backend auth routes** — new OAuth endpoints
3. **Backend middleware** — updated session validation
4. **Backend admin routes** — remove invite endpoints, update user queries
5. **Frontend auth** — new OAuth flow, updated store, new UI
6. **Frontend admin** — remove invite management UI
7. **Cleanup** — remove passkey packages, old files, old env vars

---

## 5 · Security Requirements

The planning agent MUST address each of these in the implementation plan:

### OAuth Security

| Requirement | Implementation |
|-------------|---------------|
| **CSRF (state parameter)** | Generate cryptographically random state, store in HTTPOnly cookie with 10-minute TTL, validate on callback |
| **Code exchange** | Server-side only — never expose client_secret to frontend |
| **Token storage** | GitHub access token encrypted with AES-256-GCM using `SESSION_SECRET` before DB storage |
| **Session cookies** | HTTPOnly, Secure (unless localhost), SameSite=Lax, Path=/ |
| **Callback URL validation** | Hardcoded in env var — never accept callback URL from request params |
| **SSRF on callback** | Validate the `code` parameter format, don't use it in any URL construction beyond the GitHub token endpoint |
| **Token exposure** | Never return `github_access_token` in any API response. Only use server-side for copilot-sdk |
| **Rate limiting** | Keep existing rate limits on auth endpoints (10/min for login-equivalent routes) |

### Admin Role Assignment

```
Option A (recommended): ADMIN_GITHUB_IDS env var — comma-separated list of GitHub user IDs
  - On user upsert: check if github_id is in ADMIN_GITHUB_IDS → set role = 'admin'
  - Simple, declarative, no DB migration needed for role changes
  - Restart required to change admin list (acceptable for single-tenant)

Option B: DB-based role management
  - Admin can promote/demote users via admin panel
  - First user to authenticate becomes admin (like current passkey flow)
  - More flexible, but more complex
```

The planning agent should evaluate both and recommend one.

### Dev Mode

```
- Keep dev session shortcut pattern (dev-session-token, dev-admin-session-token)
- Seed dev users in database on startup when NODE_ENV=development
- Dev users: { github_id: 1, login: 'dev-user', role: 'user' }, { github_id: 2, login: 'dev-admin', role: 'admin' }
- OAuth flow should work with real GitHub OAuth app pointing to localhost (GitHub supports http://localhost callbacks)
- Alternative: MOCK_GITHUB_OAUTH=true env var that skips the redirect and creates a session directly
```

---

## 6 · Copilot SDK Integration

### Why This Matters

The copilot-sdk (`@anthropic/copilot-sdk` or `github/copilot-sdk`) accepts a `githubToken` parameter
when creating a `CopilotClient`. The user's GitHub OAuth token (`gho_xxx`) can be passed directly,
enabling per-user Copilot access without a separate auth step.

### What the Planning Agent Must Understand

Read these docs before planning the token storage:
```
/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/setup/github-oauth.md
/home/scoy/.copilot/skills/copilot-sdk/references/copilot-sdk/docs/auth/index.md
```

Key points from the docs:
- `gho_xxx` tokens (OAuth user access tokens) are a supported token type
- Tokens can be passed explicitly: `new CopilotClient({ githubToken: 'gho_xxx' })`
- Token priority: explicit `githubToken` > env vars > stored creds > gh CLI

### Token Lifecycle

```
User authenticates via GitHub OAuth
  → Server receives access_token (gho_xxx)
  → Server encrypts token with AES-256-GCM (SESSION_SECRET key)
  → Server stores encrypted token in users.github_access_token_encrypted
  → When copilot-sdk needs the token:
    → Decrypt from DB
    → Pass to CopilotClient({ githubToken: decrypted_token })
  → On re-authentication:
    → Update the stored token (user may have re-authorized, getting a new token)
  → On user deletion:
    → Token deleted with user row (CASCADE or explicit)
```

### Token Encryption Utility

The plan should include a utility module:
```typescript
// server/src/utils/token_encryption.ts
export function encrypt_token(plaintext: string, key: string): string;
export function decrypt_token(ciphertext: string, key: string): string;
// Using AES-256-GCM via Node.js crypto (available in Bun)
// Ciphertext format: base64(iv + authTag + encrypted)
```

---

## 7 · Frontend Implementation Details

### OAuth Callback Handling

SvelteKit is in SPA mode (SSR disabled). The OAuth callback needs special handling:

```
GitHub redirects to: https://clanqr.dev/auth/callback?code=xxx&state=yyy
```

**Option A (recommended): Backend handles callback directly**
- `GET /auth/callback` is a Hono route (not SvelteKit)
- Hono exchanges code, creates session, sets cookie, redirects to `/` (SvelteKit app)
- SvelteKit app loads, `onMount` calls `check_auth()`, finds valid session
- No SvelteKit callback route needed
- Requires: nginx/proxy config routes `/auth/callback` to Hono (port 3001), not SvelteKit (port 3002)

**Option B: SvelteKit callback page**
- SvelteKit route `web/src/routes/auth/callback/+page.svelte`
- Page extracts `code` and `state` from URL params
- Sends to backend `POST /auth/exchange` with code + state
- Backend exchanges code, creates session, returns success
- Frontend redirects to `/`
- More complex, but keeps all browser-facing URLs in SvelteKit

The planning agent should evaluate both given the nginx config in `nginx.dev.conf`.

### Auth Store Migration

```typescript
// Current states: 'loading' | 'setup' | 'login' | 'authenticated' | 'error'
// New states:     'loading' | 'unauthenticated' | 'redirecting' | 'authenticated' | 'error'

// Current data: role, passkey_id
// New data:     role, user { github_id, login, display_name, avatar_url }
```

### UI Changes

```
Current AuthScreen:
  ├── Loading state (spinner)
  ├── Setup state (first-time: enter display name → create passkey)
  ├── Login state (click "Sign in with Passkey" → browser prompt)
  └── Error state (network, unsupported browser, cancelled, etc.)

New AuthScreen:
  ├── Loading state (spinner)
  ├── Unauthenticated state ("Sign in with GitHub" button with GitHub logo)
  └── Error state (OAuth failed, access denied, network error)
```

Remove:
- Display name input (GitHub profile provides this)
- Passkey-specific error messages (browser support, timeout hints)
- Invite token handling in auth UI

Add:
- GitHub logo/branding on sign-in button
- User avatar + username display in app header after auth

---

## 8 · Files to Create, Modify, and Delete

### Create

| File | Purpose |
|------|---------|
| `server/src/routes/auth_oauth.ts` | OAuth endpoints: `/auth/github`, `/auth/callback` |
| `server/src/utils/token_encryption.ts` | AES-256-GCM encrypt/decrypt for GitHub tokens |
| `supabase/supabase/migrations/YYYYMMDDHHMMSS_github_oauth_auth.sql` | Create users table, alter sessions, drop passkeys + invite_tokens |
| `web/src/routes/auth/callback/+page.svelte` | OAuth callback handler (if Option B chosen) |

### Modify

| File | Changes |
|------|---------|
| `server/src/routes/auth.ts` | Replace all endpoints with OAuth flow routes |
| `server/src/routes/auth_shared.ts` | Remove WebAuthn constants, keep `generate_session_token()` |
| `server/src/middleware/auth_middleware.ts` | Join sessions→users instead of sessions→passkeys, set `user_id` + `github_id` on context |
| `server/src/routes/admin.ts` | Remove invite endpoints, query `users` table, update role by user_id |
| `server/src/env.ts` | Replace `RP_ID`/`RP_ORIGIN` with OAuth env vars |
| `server/src/index.ts` | Update route mounting, remove invite cleanup from boot sequence |
| `server/src/utils/dev_sessions.ts` | Update dev user references |
| `web/src/lib/auth.ts` | Replace passkey functions with OAuth redirect/callback |
| `web/src/lib/stores/auth.svelte.ts` | New states, user object instead of passkey_id |
| `web/src/routes/AuthScreen.svelte` | "Sign in with GitHub" UI |
| `web/src/lib/api/client.ts` | Remove invite API calls, update admin user calls |
| `web/src/lib/types/index.ts` | Update `AuthStatus` type, add `User` type |
| `server/package.json` | Remove `@simplewebauthn/server` |
| `web/package.json` | Remove `@simplewebauthn/browser` |
| `nginx.dev.conf` | Ensure `/auth/callback` routes to correct backend |

### Delete

| File | Reason |
|------|--------|
| `server/src/routes/auth_login.ts` | WebAuthn login — replaced by OAuth |
| `server/src/routes/auth_register.ts` | WebAuthn registration — replaced by OAuth |

---

## 9 · Downstream Impact Analysis

The planning agent must search for ALL references to the following and update them:

```bash
# Find everything that references the old auth model
grep -rn 'passkey_id' server/src/ web/src/
grep -rn 'passkey' server/src/ web/src/
grep -rn 'RP_ID\|RP_ORIGIN\|RP_NAME' server/src/
grep -rn 'invite_token\|invite' server/src/ web/src/
grep -rn 'register_passkey\|login_passkey' web/src/
grep -rn 'startRegistration\|startAuthentication' web/src/
grep -rn 'simplewebauthn' server/ web/
grep -rn 'challenge_store' server/src/
grep -rn 'is_setup' server/src/ web/src/

# Find all route handlers that use context.get('passkey_id')
grep -rn "get('passkey_id')" server/src/

# Find all places the admin panel references invites
grep -rn 'invite' web/src/routes/
```

Known downstream references (the planning agent must verify these are complete):

| Location | Reference | Action |
|----------|-----------|--------|
| `server/src/services/agent_service.ts` | `context.get('passkey_id')` for agent run tracking | Change to `context.get('user_id')` |
| `server/src/services/pipeline_service.ts` | May reference passkey_id for audit | Change to user_id |
| `web/src/routes/admin/` | Invite management UI | Remove invite components |
| `web/src/routes/+layout.svelte` | Auth check on mount, passkey_id usage | Update to user object |
| `server/src/routes/features.ts` | May track who created features via passkey_id | Change to user_id |
| Agent runs table in DB | `created_by` or similar field referencing passkeys | Update FK to users |

---

## 10 · Testing Strategy

### Type Checking (mandatory)

```bash
cd server && bun run --bun tsc --noEmit    # 0 errors
cd web && bun run check                     # 0 errors
```

### Manual Verification

```bash
# 1. Dev mode auth shortcut still works
curl -sf -b "session=dev-session-token" http://localhost:3001/api/auth/status

# 2. OAuth redirect works
curl -sf -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:3001/auth/github
# Expect: 302, redirect to github.com/login/oauth/authorize?client_id=...&state=...

# 3. Protected route returns 401 without session
curl -sf -o /dev/null -w '%{http_code}' http://localhost:3001/api/pipeline/status
# Expect: 401

# 4. Auth status returns user profile when authenticated
curl -sf -b "session=dev-admin-session-token" http://localhost:3001/api/auth/status
# Expect: { authenticated: true, user: { github_id: 2, login: "dev-admin", role: "admin" } }
```

### E2E Test Considerations

The planning agent should specify how e2e tests authenticate:
- Option: Seed a test user + session in DB before test run
- Option: Use dev session tokens (already established pattern)
- The `e2e/` directory exists — check what test framework is used and how auth is currently handled

```bash
ls -la e2e/
cat e2e/README.md 2>/dev/null || head -20 e2e/*.ts 2>/dev/null || echo "Check e2e/ structure"
```

---

## 11 · Environment Configuration

### Production (clanqr.dev)

```env
GITHUB_CLIENT_ID=<prod OAuth App client ID>
GITHUB_CLIENT_SECRET=<prod OAuth App client secret>
GITHUB_CALLBACK_URL=https://clanqr.dev/auth/callback
ADMIN_GITHUB_IDS=<comma-separated GitHub user IDs>
SESSION_SECRET=<32-byte random key, base64 encoded>
NODE_ENV=production
```

### Test (test.clanqr.dev)

```env
GITHUB_CLIENT_ID=<test OAuth App client ID>
GITHUB_CLIENT_SECRET=<test OAuth App client secret>
GITHUB_CALLBACK_URL=https://test.clanqr.dev/auth/callback
ADMIN_GITHUB_IDS=<comma-separated GitHub user IDs>
SESSION_SECRET=<32-byte random key, base64 encoded>
NODE_ENV=production
```

### Development (localhost)

```env
GITHUB_CLIENT_ID=<dev OAuth App client ID — can be same as test>
GITHUB_CLIENT_SECRET=<dev OAuth App client secret>
GITHUB_CALLBACK_URL=http://localhost:3001/auth/callback
ADMIN_GITHUB_IDS=<your GitHub user ID>
SESSION_SECRET=dev-session-secret-at-least-32-bytes!!
NODE_ENV=development
```

GitHub OAuth Apps support `http://localhost` callbacks — no tunnel or HTTPS needed for dev.

---

## 12 · Skills the Planning Agent Must Invoke

Before writing the implementation plan, the agent MUST invoke these skills and incorporate their guidance:

| Skill | Why | What to ask |
|-------|-----|-------------|
| `meta-engineer` | OAuth is an external system integration with security-critical state transitions | Route through: scenarios/integration, domains/security, domains/invariants, domains/state-and-data |
| `hono-backend-architect` | New routes, middleware rewrite, Zod validation | How to structure OAuth routes, middleware factories, error boundaries in Hono on Bun |
| `svelte-engineer` | Auth store rewrite, new components | Svelte 5 runes patterns for auth state (NOT stores), callback page, reactive user profile |
| `copilot-sdk` | Token integration | How `githubToken` option works, token lifecycle, refresh patterns |
| `supabase-postgres-best-practices` | Schema migration, encrypted column, index design | Migration strategy for dropping/creating tables with FKs, encrypted column patterns |

---

## 13 · Copilot Instructions the Planning Agent Must Follow

These are non-negotiable constraints from `AGENTS.md` and the project's copilot instructions:

1. **Validate security implications** of every change touching auth, data, secrets, or permissions
2. **Handle errors explicitly** — no silent failures or broad catch-all masking
3. **Explore existing code paths** before changing behavior — `grep -rn` for all references
4. **Keep observability intact** — logs, actionable errors, and diagnosability
5. **Svelte 5 only** — `$state()`, `$derived()`, `$props()`, `{@render}`. No `export let`, no `$:`, no stores, no `createEventDispatcher`
6. **snake_case** for variables/functions, **PascalCase** for types
7. **Do not add new packages** without explicit approval (the OAuth flow needs no new packages — it's just `fetch`)
8. **Single-tenant design** — do not add multi-tenant isolation
9. **Atomic state transitions** — use optimistic locking for status updates (`.update({...}).eq("status", "expected")`)
10. **Dev mode gating** — dev shortcuts must be rejected in production

---

## 14 · Risks and Open Questions

The planning agent should address these in the plan:

| Risk / Question | Consideration |
|-----------------|---------------|
| **Token expiration** | GitHub OAuth tokens (from OAuth Apps) don't expire unless revoked. GitHub App tokens DO expire. Confirm which type of OAuth App is being used |
| **Token revocation** | If a user revokes the OAuth app on GitHub, the stored token becomes invalid. The plan needs a re-auth flow when API calls fail with 401 |
| **Scope requirements** | What OAuth scopes are needed? `read:user` for profile, `user:email` for email. Copilot-sdk may need additional scopes |
| **Data migration** | Existing passkey users lose access. The plan should specify: is this a clean cut (acceptable for single-tenant)? Or do we need a migration period? |
| **Session duration** | Current: 30 days. Keep or change? GitHub tokens don't expire, but sessions should still have a TTL |
| **Concurrent sessions** | Current system allows multiple sessions per user. Keep this behavior? |
| **Feature branch dependency** | If `feature/database-redesign` modifies the sessions table or adds a users table, this migration must build on that, not conflict |
| **Nginx routing** | `/auth/callback` must reach Hono (port 3001), not SvelteKit (port 3002). Verify nginx config handles this |
| **CORS** | The OAuth callback is a browser redirect (not fetch), so CORS is not an issue for the callback itself. But `GET /auth/status` is called via fetch — ensure CORS headers are correct |

---

## 15 · Definition of Done for the Implementation Plan

The implementation plan produced by the planning agent is complete when it specifies:

- [ ] Exact file-by-file changes (create/modify/delete) with code structure for each
- [ ] Ordered implementation phases with dependency arrows
- [ ] Database migration SQL (exact, tested)
- [ ] All environment variables with descriptions and example values
- [ ] Security controls for every auth-related endpoint
- [ ] Dev mode behavior for every auth endpoint
- [ ] Error handling for every failure mode (network, invalid code, expired state, revoked token, etc.)
- [ ] Frontend state machine diagram (all states and transitions)
- [ ] Type definitions for all new/changed interfaces
- [ ] Downstream reference update list (every file that touches `passkey_id`, `invite`, etc.)
- [ ] Testing commands and expected outputs
- [ ] Rollback strategy (how to revert if something goes wrong mid-migration)
- [ ] Explicit list of packages to add/remove
- [ ] CI/CD pipeline changes (if any — check `.github/workflows/deploy-pi.yml` for auth-related steps)

---

## 16 · Execution Checklist for the Planning Agent

```
□ Read ALL files listed in § 2 (do not skip any)
□ Invoke skills listed in § 12
□ Check feature/database-redesign branch for conflicts (§ 4)
□ Run downstream reference search (§ 9)
□ Check e2e/ test structure (§ 10)
□ Check nginx.dev.conf for routing implications (§ 7)
□ Check .github/workflows/deploy-pi.yml for auth-related deploy steps
□ Address all risks in § 14
□ Produce implementation plan meeting all criteria in § 15
□ Type-check both projects after planning (to establish baseline)
□ Commit plan to docs/plans/github-oauth-auth-implementation.md
```
