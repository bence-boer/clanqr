# Implementation Plan: GitHub OAuth Authentication Migration

> **Branch**: `feature/github-oauth-auth`
> **Depends on**: `feature/database-redesign` (merged into `develop`)
> **Baseline**: The nuke_and_rebuild migration (20260328100000) already provides the target schema.

---

## 1 · Overview

Replace the stubbed-out auth endpoints (currently returning 501) with a working GitHub OAuth 2.0
authorization code flow. The database schema is already in place — this plan covers only the
application-layer implementation.

**What already exists (from database-redesign)**:
- `users` table with `github_id` (BIGINT, UNIQUE), `username`, `display_name`, `avatar_url`, `email`, `role`
- `sessions` table with `user_id` FK, `github_access_token`, `github_refresh_token`, `token_expires_at`
- `env.ts` with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`
- Auth middleware joining `sessions→users`, setting `user_id` + `role` on context
- Seed data with dev users (github_id: 1000001, 1000002) and dev session tokens
- Stubbed `auth_login.ts` and `auth_register.ts` returning 501

**What this plan adds**:
- OAuth route implementation (redirect → callback → session creation)
- Token encryption utility (AES-256-GCM for GitHub tokens at rest)
- Frontend OAuth flow (redirect to GitHub, handle callback)
- Cleanup of WebAuthn/passkey remnants

---

## 2 · Architectural Decisions

### 2.1 Admin Role Assignment → Option A: ADMIN_GITHUB_IDS env var

Simpler, declarative, fits single-tenant design. On user upsert, check if `github_id ∈ ADMIN_GITHUB_IDS`.
Restart required to change admins (acceptable).

### 2.2 OAuth Callback → Backend-handled (Option A)

`GET /api/auth/callback` is a Hono route. GitHub redirects the browser there. Hono exchanges the code,
creates a session, sets the cookie, and 302-redirects to the frontend app root (`/`). No SvelteKit
callback page needed.

**Rationale**: All `/api/*` requests already route to Hono (port 3001) in both dev and production.
The nginx.dev.conf only handles PostgREST — auth is entirely at the app layer. No nginx changes needed.

### 2.3 Token Encryption → Application-layer AES-256-GCM

As specified by the migration comments: `COMMENT ON COLUMN sessions.github_access_token IS 'SENSITIVE: Encrypt at application layer'`.
Use `SESSION_SECRET` (already in env.ts) as the encryption key.

### 2.4 No New Packages

GitHub OAuth is just HTTP requests via `fetch()`. Token encryption uses Node.js `crypto` (available in Bun).
Remove `@simplewebauthn/server` and `@simplewebauthn/browser`.

### 2.5 OAuth Scopes

Request `read:user` and `user:email`. These provide profile data and primary email.
copilot-sdk accepts any `gho_xxx` token — no additional scopes needed for Copilot access.

---

## 3 · Implementation Phases

```
Phase 1: Token Encryption Utility
  │
  ▼
Phase 2: Backend OAuth Routes
  │
  ▼
Phase 3: Frontend OAuth Flow
  │
  ▼
Phase 4: Cleanup &amp; Downstream Updates
  │
  ▼
Phase 5: CI/CD &amp; Environment
  │
  ▼
Phase 6: Testing &amp; Verification
```

---

## 4 · Phase 1: Token Encryption Utility

### CREATE: `server/src/utils/token_encryption.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function derive_key(secret: string): Buffer {
  // SHA-256 hash to get exactly 32 bytes from any-length secret
  const { createHash } = require('crypto');
  return createHash('sha256').update(secret).digest();
}

export function encrypt_token(plaintext: string, secret: string): string {
  const key = derive_key(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const auth_tag = cipher.getAuthTag();
  // Format: base64(iv + authTag + ciphertext)
  return Buffer.concat([iv, auth_tag, encrypted]).toString('base64');
}

export function decrypt_token(ciphertext: string, secret: string): string {
  const key = derive_key(secret);
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const auth_tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(auth_tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

**Security**: AES-256-GCM provides authenticated encryption. Each encryption uses a unique random IV.
The auth tag prevents tampering. `SESSION_SECRET` must be at least 32 characters.

---

## 5 · Phase 2: Backend OAuth Routes

### 5.1 MODIFY: `server/src/env.ts`

**Add** to Zod schema:
```typescript
GITHUB_CALLBACK_URL: z.string().url().default('http://localhost:3001/api/auth/callback'),
ADMIN_GITHUB_IDS: z.string().default(''),  // comma-separated GitHub user IDs
```

**Remove**:
```typescript
RP_ID: ...     // WebAuthn relying party ID
RP_ORIGIN: ... // WebAuthn origin
```

**Full env var list after changes**:

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | OAuth App client ID | `Iv1.abc123` |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret | `secret_xxx` |
| `GITHUB_CALLBACK_URL` | Full callback URL | `https://agents.benceboer.com/api/auth/callback` |
| `ADMIN_GITHUB_IDS` | Comma-separated admin GitHub user IDs | `12345,67890` |
| `SESSION_SECRET` | 32+ char key for token encryption | `my-super-secret-key-at-least-32-chars` |
| `FRONTEND_URL` | Frontend app URL (for redirect after auth) | `https://agents.benceboer.com` |

### 5.2 REWRITE: `server/src/routes/auth_login.ts`

Replace the 501 stubs with the full OAuth flow:

```typescript
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { AppBindings } from '../middleware/supabase';
import { env } from '../env';
import { generate_session_token } from './auth_shared';
import { encrypt_token } from '../utils/token_encryption';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

const admin_github_ids = new Set(
  env.ADMIN_GITHUB_IDS.split(',').filter(Boolean).map(Number)
);

export const login_routes = new Hono<AppBindings>()

  // GET /api/auth/login/github → Redirect to GitHub authorization
  .get('/github', async (context) => {
    const state = generate_session_token(); // cryptographic random
    setCookie(context, 'oauth_state', state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email',
      state,
    });
    return context.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`);
  })

  // GET /api/auth/login/callback → Exchange code, create session, redirect
  .get('/callback', async (context) => {
    const db = context.get('supabase');
    const code = context.req.query('code');
    const state = context.req.query('state');
    const stored_state = getCookie(context, 'oauth_state');

    // Validate state parameter (CSRF protection)
    if (!state || !stored_state || state !== stored_state) {
      return context.redirect(`${env.FRONTEND_URL}?auth_error=invalid_state`);
    }

    // Clear state cookie
    setCookie(context, 'oauth_state', '', { maxAge: 0, path: '/' });

    if (!code) {
      return context.redirect(`${env.FRONTEND_URL}?auth_error=missing_code`);
    }

    // Exchange code for access token
    let token_data: { access_token: string; token_type: string; scope: string };
    try {
      const token_response = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.GITHUB_CALLBACK_URL,
        }),
      });
      token_data = await token_response.json();
    } catch {
      return context.redirect(`${env.FRONTEND_URL}?auth_error=token_exchange_failed`);
    }

    if (!token_data.access_token) {
      return context.redirect(`${env.FRONTEND_URL}?auth_error=no_access_token`);
    }

    // Fetch GitHub user profile
    let github_user: {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string;
      email: string | null;
    };
    try {
      const user_response = await fetch(GITHUB_USER_URL, {
        headers: { Authorization: `Bearer ${token_data.access_token}` },
      });
      if (!user_response.ok) {
        return context.redirect(`${env.FRONTEND_URL}?auth_error=profile_fetch_failed`);
      }
      github_user = await user_response.json();
    } catch {
      return context.redirect(`${env.FRONTEND_URL}?auth_error=profile_fetch_failed`);
    }

    // Determine role
    const role = admin_github_ids.has(github_user.id) ? 'admin' : 'member';

    // Upsert user
    const { data: user, error: upsert_error } = await db
      .from('users')
      .upsert(
        {
          github_id: github_user.id,
          username: github_user.login,
          display_name: github_user.name ?? github_user.login,
          avatar_url: github_user.avatar_url,
          email: github_user.email,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'github_id' }
      )
      .select('id')
      .single();

    if (upsert_error || !user) {
      console.error('User upsert failed:', upsert_error);
      return context.redirect(`${env.FRONTEND_URL}?auth_error=user_creation_failed`);
    }

    // Create session with encrypted token
    const session_token = generate_session_token();
    const encrypted_access_token = encrypt_token(token_data.access_token, env.SESSION_SECRET);
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const { error: session_error } = await db.from('sessions').insert({
      user_id: user.id,
      token: session_token,
      github_access_token: encrypted_access_token,
      expires_at: expires_at.toISOString(),
    });

    if (session_error) {
      console.error('Session creation failed:', session_error);
      return context.redirect(`${env.FRONTEND_URL}?auth_error=session_creation_failed`);
    }

    // Set session cookie
    setCookie(context, 'session', session_token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return context.redirect(env.FRONTEND_URL);
  });
```

### 5.3 REWRITE: `server/src/routes/auth_register.ts`

With GitHub OAuth, there is no separate registration step. First login auto-creates the user.
Replace with a simple redirect to the login flow:

```typescript
import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';

export const register_routes = new Hono<AppBindings>()
  .get('/github', (context) => {
    // Registration is handled by the login flow (auto-creates user on first login)
    return context.redirect('/api/auth/login/github');
  });
```

### 5.4 MODIFY: `server/src/routes/auth_shared.ts`

```typescript
// KEEP: generate_session_token()
// DELETE: challenge_store (WebAuthn-specific)

export function generate_session_token(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

### 5.5 MODIFY: `server/src/routes/auth.ts`

**Changes**:
- Remove `is_setup` check from `/status` (no setup step with OAuth — user just clicks "Sign in")
- OR keep `is_setup` to indicate whether any users exist (useful for first-visit UX)
- Mount login routes with GET methods (OAuth uses GET redirects, not POST)

Update route mounting in `server/src/index.ts`:
```typescript
// Current (POST-based stubs):
auth.route('/register', register_routes);
auth.route('/login', login_routes);

// Updated (same mount points, but routes now have GET handlers):
// No change needed — Hono routes both GET and POST based on route definitions
```

### 5.6 MODIFY: `server/src/index.ts`

Update rate limiting for the new GET endpoints:
```typescript
// The login/register routes now use GET (redirects), not POST
// Rate limiting should apply to /api/auth/login/callback specifically
// to prevent token exchange abuse
```

Ensure `/api/auth/login/github` and `/api/auth/login/callback` are accessible without auth middleware
(they already are — auth routes are mounted before the auth_middleware guard).

---

## 6 · Phase 3: Frontend OAuth Flow

### 6.1 REWRITE: `web/src/lib/auth.ts`

```typescript
import { api_url } from './api/client';

export interface AuthStatus {
  authenticated: boolean;
  is_setup: boolean;
  user: {
    id: string;
    github_id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}

export async function check_auth(): Promise<AuthStatus> {
  try {
    const response = await fetch(`${api_url}/api/auth/status`, {
      credentials: 'include',
    });
    if (!response.ok) {
      return { authenticated: false, is_setup: false, user: null };
    }
    return await response.json();
  } catch {
    return { authenticated: false, is_setup: false, user: null };
  }
}

export function login_github(): void {
  // Redirect the browser to the OAuth initiation endpoint
  window.location.href = `${api_url}/api/auth/login/github`;
}

export async function logout(): Promise<void> {
  await fetch(`${api_url}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
```

**Removed**: `register_passkey()`, `login_passkey()`, `@simplewebauthn/browser` import, `AuthStatus.passkey_id`.

### 6.2 REWRITE: `web/src/lib/stores/auth.svelte.ts`

```typescript
import { check_auth, login_github, logout, type AuthStatus } from '$lib/auth';

type AuthState = 'loading' | 'unauthenticated' | 'redirecting' | 'authenticated' | 'error';

class AuthStore {
  state: AuthState = $state('loading');
  error: string | null = $state(null);
  role: string | null = $state(null);
  user_id: string | null = $state(null);
  user: AuthStatus['user'] = $state(null);
  pending = $state(false);
  is_admin = $derived(this.role === 'admin');

  async check() {
    this.state = 'loading';
    this.error = null;
    try {
      const status = await check_auth();
      if (status.authenticated && status.user) {
        this.state = 'authenticated';
        this.role = status.user.role;
        this.user_id = status.user.id;
        this.user = status.user;
      } else {
        this.state = 'unauthenticated';
        this.role = null;
        this.user_id = null;
        this.user = null;
      }
    } catch (err) {
      this.state = 'error';
      this.error = err instanceof Error ? err.message : 'Auth check failed';
    }
  }

  login() {
    this.state = 'redirecting';
    this.pending = true;
    login_github(); // browser redirect — does not return
  }

  async sign_out() {
    try {
      await logout();
    } finally {
      this.state = 'unauthenticated';
      this.role = null;
      this.user_id = null;
      this.user = null;
      this.pending = false;
      this.error = null;
    }
  }

  reset() {
    this.state = 'unauthenticated';
    this.role = null;
    this.user_id = null;
    this.user = null;
    this.pending = false;
    this.error = null;
  }
}

export const auth_store = new AuthStore();
```

**State machine**:
```
loading ──────────► authenticated (if valid session)
   │
   └──────────────► unauthenticated (if no session)
   │
   └──────────────► error (if check fails)

unauthenticated ──► redirecting (user clicks "Sign in with GitHub")
                         │
                         └──► [browser leaves page → GitHub → callback → redirect back]
                                  │
                                  └──► loading (page reloads, check() runs again)

authenticated ────► unauthenticated (user signs out)

error ────────────► unauthenticated (user retries)
```

### 6.3 REWRITE: `web/src/routes/AuthScreen.svelte`

```svelte
<script lang="ts">
  let {
    auth_state,
    error,
    pending,
    onlogin,
  }: {
    auth_state: string;
    error: string | null;
    pending: boolean;
    onlogin: () => void;
  } = $props();

  let classified_error = $derived(classify_error(error));

  function classify_error(err: string | null): { title: string; message: string } | null {
    if (!err) return null;
    if (err.includes('invalid_state')) {
      return { title: 'Session Expired', message: 'Your login session expired. Please try again.' };
    }
    if (err.includes('token_exchange_failed') || err.includes('no_access_token')) {
      return { title: 'Authentication Failed', message: 'Could not complete GitHub authentication. Please try again.' };
    }
    if (err.includes('profile_fetch_failed')) {
      return { title: 'Profile Error', message: 'Could not fetch your GitHub profile. Please try again.' };
    }
    if (err.includes('access_denied')) {
      return { title: 'Access Denied', message: 'You denied the authorization request. Click below to try again.' };
    }
    return { title: 'Error', message: err };
  }
</script>

<div class="auth-screen">
  <div class="auth-card">
    <div class="auth-header">
      <h1>Ralph Agent Workspace</h1>
    </div>

    {#if auth_state === 'loading' || auth_state === 'redirecting'}
      <div class="auth-loading">
        <div class="spinner"></div>
        <p>{auth_state === 'redirecting' ? 'Redirecting to GitHub...' : 'Checking authentication...'}</p>
      </div>
    {:else if auth_state === 'unauthenticated' || auth_state === 'error'}
      {#if classified_error}
        <div class="auth-error">
          <p class="error-title">{classified_error.title}</p>
          <p class="error-message">{classified_error.message}</p>
        </div>
      {/if}
      <button class="btn btn-github" onclick={onlogin} disabled={pending}>
        <svg class="github-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        Sign in with GitHub
      </button>
    {/if}
  </div>
</div>
```

**Removed**: Setup state, display name input, passkey-specific errors, browser support hints.
**Added**: GitHub logo SVG, OAuth-specific error classification, "Redirecting to GitHub..." state.

### 6.4 MODIFY: `web/src/routes/+layout.svelte`

Update the auth handler functions:
```typescript
// Replace:
//   async function handle_register(display_name) { await auth_store.register(display_name); }
//   async function handle_login() { await auth_store.login(); }
// With:
function handle_login() { auth_store.login(); }

// Check URL params for auth errors on mount:
// const url_params = new URLSearchParams(window.location.search);
// const auth_error = url_params.get('auth_error');
// if (auth_error) { auth_store.error = auth_error; auth_store.state = 'error'; }
```

Update AuthScreen props:
```svelte
<!-- Remove: onregister={handle_register} -->
<!-- Keep: onlogin={handle_login} -->
<AuthScreen
  auth_state={auth_store.state}
  error={auth_store.error}
  pending={auth_store.pending}
  onlogin={handle_login}
/>
```

---

## 7 · Phase 4: Cleanup &amp; Downstream Updates

### 7.1 Downstream Reference Updates

| File | Change |
|------|--------|
| `web/src/lib/api/rpc.ts:30` | `auth_store.passkey_id = null` → `auth_store.reset()` |
| `web/src/lib/api/chat-client.ts:35` | `auth_store.passkey_id = null` → `auth_store.reset()` |
| `web/src/routes/admin/users/+page.svelte:9` | `auth_store.passkey_id` → `auth_store.user_id` |
| `web/src/routes/AuthFeedback.svelte` | Update text from "passkey" → "GitHub" |

### 7.2 Remove WebAuthn Remnants

| File | Action |
|------|--------|
| `server/src/routes/auth_shared.ts` | Delete `challenge_store` export |
| `server/src/env.ts` | Remove `RP_ID`, `RP_ORIGIN` from Zod schema |
| `server/src/env.test.ts` | Remove `RP_ID`, `RP_ORIGIN` test assertions |
| `server/package.json` | `bun remove @simplewebauthn/server` |
| `web/package.json` | `bun remove @simplewebauthn/browser` |

### 7.3 File Actions Summary

| Action | File | Description |
|--------|------|-------------|
| **CREATE** | `server/src/utils/token_encryption.ts` | AES-256-GCM encrypt/decrypt |
| **REWRITE** | `server/src/routes/auth_login.ts` | OAuth initiation + callback |
| **REWRITE** | `server/src/routes/auth_register.ts` | Redirect to login flow |
| **REWRITE** | `web/src/lib/auth.ts` | OAuth functions replacing passkey |
| **REWRITE** | `web/src/lib/stores/auth.svelte.ts` | New state machine, user object |
| **REWRITE** | `web/src/routes/AuthScreen.svelte` | GitHub sign-in UI |
| **MODIFY** | `server/src/routes/auth_shared.ts` | Remove challenge_store |
| **MODIFY** | `server/src/routes/auth.ts` | Minor status endpoint updates |
| **MODIFY** | `server/src/env.ts` | Add GITHUB_CALLBACK_URL, ADMIN_GITHUB_IDS; remove RP_ID, RP_ORIGIN |
| **MODIFY** | `server/src/index.ts` | Update rate limit paths for GET routes |
| **MODIFY** | `web/src/routes/+layout.svelte` | Update auth handlers, handle URL error params |
| **MODIFY** | `web/src/routes/AuthFeedback.svelte` | Update text |
| **MODIFY** | `web/src/lib/api/rpc.ts` | Fix passkey_id → reset() |
| **MODIFY** | `web/src/lib/api/chat-client.ts` | Fix passkey_id → reset() |
| **MODIFY** | `web/src/routes/admin/users/+page.svelte` | Fix passkey_id → user_id |
| **MODIFY** | `server/src/env.test.ts` | Remove RP_ID/RP_ORIGIN tests |
| **MODIFY** | `.github/workflows/deploy-pi.yml` | Update secrets |
| **DELETE** | none | Auth stubs are rewritten, not deleted |

---

## 8 · Phase 5: CI/CD &amp; Environment

### 8.1 Deploy Workflow Changes (`.github/workflows/deploy-pi.yml`)

**Add** to env block:
```yaml
GITHUB_CLIENT_ID: ${{ secrets.GITHUB_CLIENT_ID }}
GITHUB_CLIENT_SECRET: ${{ secrets.GITHUB_CLIENT_SECRET }}
GITHUB_CALLBACK_URL: ${{ secrets.GITHUB_CALLBACK_URL }}
ADMIN_GITHUB_IDS: ${{ secrets.ADMIN_GITHUB_IDS }}
```

**Remove** from env block:
```yaml
RP_ID: ${{ secrets.RP_ID }}
RP_ORIGIN: ${{ secrets.RP_ORIGIN }}
```

### 8.2 GitHub Repository Secrets to Configure

| Secret | Value | Environment |
|--------|-------|-------------|
| `GITHUB_CLIENT_ID` | OAuth App client ID | Production |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret | Production |
| `GITHUB_CALLBACK_URL` | `https://agents.benceboer.com/api/auth/callback` | Production |
| `ADMIN_GITHUB_IDS` | Owner's GitHub user ID(s) | Production |

### 8.3 Local Development `.env`

```env
GITHUB_CLIENT_ID=<dev OAuth App client ID>
GITHUB_CLIENT_SECRET=<dev OAuth App client secret>
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/callback
ADMIN_GITHUB_IDS=<your GitHub user ID>
SESSION_SECRET=dev-session-secret-at-least-32-bytes!!
```

GitHub OAuth Apps support `http://localhost` callbacks — no tunnel needed for dev.

---

## 9 · Security Controls

### 9.1 Per-Endpoint Security

| Endpoint | Auth Required | Rate Limit | Security Controls |
|----------|--------------|------------|-------------------|
| `GET /api/auth/login/github` | No | 10/min | State param in HTTPOnly cookie (10min TTL) |
| `GET /api/auth/login/callback` | No | 10/min | State validation, code exchange server-side only |
| `GET /api/auth/status` | No | 100/min | Returns minimal info for unauthenticated |
| `GET /api/auth/me` | Yes | 100/min | Session cookie validation |
| `POST /api/auth/logout` | Yes | 10/min | Deletes session from DB + clears cookie |

### 9.2 Token Security

- **GitHub access tokens**: Encrypted with AES-256-GCM before DB storage
- **Session tokens**: 32-byte cryptographic random, stored as HTTPOnly Secure SameSite=Lax cookies
- **OAuth state**: Stored in HTTPOnly cookie with 10-minute TTL (not in DB)
- **Client secret**: Never exposed to frontend — server-side only
- **Token exposure**: `github_access_token` never returned in any API response

### 9.3 Dev Mode Security

- Dev session tokens (`dev-session-token`, `dev-admin-session-token`) are **rejected in production**
  (existing check in `auth.ts` and `auth middleware`)
- Dev users are seeded only when `NODE_ENV=development`
- OAuth flow works normally in dev (GitHub supports localhost callbacks)

---

## 10 · Error Handling

### 10.1 OAuth Flow Errors

| Error | Cause | Handling |
|-------|-------|---------|
| `invalid_state` | CSRF attack or expired state cookie | Redirect to frontend with `?auth_error=invalid_state` |
| `missing_code` | User denied authorization or malformed callback | Redirect with `?auth_error=missing_code` |
| `token_exchange_failed` | GitHub token endpoint unreachable or returned error | Redirect with `?auth_error=token_exchange_failed` |
| `no_access_token` | GitHub returned response without access_token | Redirect with `?auth_error=no_access_token` |
| `profile_fetch_failed` | GitHub user API failed (rate limit, revoked token) | Redirect with `?auth_error=profile_fetch_failed` |
| `user_creation_failed` | DB upsert error (constraint violation, DB down) | Redirect with `?auth_error=user_creation_failed` |
| `session_creation_failed` | DB insert error for session | Redirect with `?auth_error=session_creation_failed` |

### 10.2 Runtime Errors

| Error | Cause | Handling |
|-------|-------|---------|
| Expired session | Session `expires_at` in the past | Auth middleware returns 401; frontend resets to unauthenticated |
| Revoked GitHub token | User revoked OAuth app on GitHub | copilot-sdk calls fail; log error, prompt re-auth |
| Decryption failure | `SESSION_SECRET` changed or data corrupted | Log error, return 500; user must re-authenticate |

### 10.3 Frontend Error Display

The frontend reads `?auth_error` from URL params on mount and displays a user-friendly message.
Errors auto-dismiss after 10 seconds. The user can retry by clicking "Sign in with GitHub" again.

---

## 11 · Type Definitions

### 11.1 Backend Context (no changes — already correct)

```typescript
// server/src/middleware/supabase.ts
type AppBindings = {
  Variables: {
    supabase: SupabaseClient<Database>;
    user_id: string;
    role: string;
    request_id: string;
  };
};
```

### 11.2 Frontend Auth Types

```typescript
// web/src/lib/auth.ts
interface AuthStatus {
  authenticated: boolean;
  is_setup: boolean;
  user: {
    id: string;
    github_id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}
```

### 11.3 Auth Store State

```typescript
type AuthState = 'loading' | 'unauthenticated' | 'redirecting' | 'authenticated' | 'error';
```

---

## 12 · Testing Strategy

### 12.1 Type Checking (mandatory)

```bash
cd server && bun run --bun tsc --noEmit   # Must be 0 errors
cd web && bun run check                    # Must be 0 errors (warnings OK)
```

### 12.2 Manual Verification Commands

```bash
# 1. Dev mode auth shortcut still works
curl -sf -b "session=dev-session-token" http://localhost:3001/api/auth/status
# Expect: { "authenticated": true, "is_setup": true, "user": { "github_id": 1000002, ... } }

# 2. Admin dev session works
curl -sf -b "session=dev-admin-session-token" http://localhost:3001/api/auth/me
# Expect: { "id": "...", "username": "dev-admin", "role": "admin", "github_id": 1000001 }

# 3. OAuth redirect works
curl -sf -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:3001/api/auth/login/github
# Expect: 302 https://github.com/login/oauth/authorize?client_id=...&state=...

# 4. Protected route returns 401 without session
curl -sf -o /dev/null -w '%{http_code}' http://localhost:3001/api/pipeline/status
# Expect: 401

# 5. Auth status without session
curl -sf http://localhost:3001/api/auth/status
# Expect: { "authenticated": false, "is_setup": true/false }
```

### 12.3 E2E Tests

Existing E2E tests use `dev-session-token` cookies — this pattern continues to work with no changes.
The dev session tokens are pre-seeded in the database and bypass OAuth entirely.

No new E2E tests needed for the OAuth redirect flow itself (requires browser interaction with GitHub).
However, verify:
- All existing E2E tests still pass with `dev-session-token`
- New auth screen renders correctly in unauthenticated state
- Auth error params display correctly

```bash
cd e2e && bun run test
```

---

## 13 · Rollback Strategy

### If something goes wrong mid-implementation:

1. **Database**: No migration needed — schema already exists. No rollback concern.
2. **Backend**: Revert the auth route files to their 501 stubs. The rest of the backend is unchanged.
3. **Frontend**: Revert `auth.ts`, `auth.svelte.ts`, `AuthScreen.svelte` to their passkey versions.
4. **Packages**: Re-add `@simplewebauthn/server` and `@simplewebauthn/browser`.

### If something goes wrong post-deploy:

1. `git revert HEAD` the merge commit on develop
2. Push to trigger redeploy
3. Dev session tokens will continue to work regardless

### Point of no return:

There is no point of no return in this migration. The old passkey endpoints were already stubbed out
(returning 501) by the database-redesign branch. Users cannot currently authenticate via passkeys.
The OAuth implementation is purely additive.

---

## 14 · Packages

### Remove

| Package | Location | Reason |
|---------|----------|--------|
| `@simplewebauthn/server` | `server/package.json` | WebAuthn no longer used |
| `@simplewebauthn/browser` | `web/package.json` | WebAuthn no longer used |

### Add

None. GitHub OAuth uses native `fetch()`. Token encryption uses Node.js `crypto` (built into Bun).

---

## 15 · Risks &amp; Mitigations

| Risk | Mitigation |
|------|-----------|
| **Token expiration**: GitHub OAuth App tokens don't expire unless revoked | No refresh logic needed. If token becomes invalid, copilot-sdk calls fail and user re-authenticates |
| **Token revocation**: User revokes app on GitHub | Catch 401 from GitHub API in copilot-sdk calls; prompt re-auth |
| **Data migration**: Existing passkey users lose access | Acceptable — passkeys were already disabled (501 stubs). Clean cut. |
| **Session duration**: 30 days | Keep existing 30-day TTL. GitHub tokens don't expire but sessions should still rotate |
| **Concurrent sessions**: Multiple sessions per user | Keep — each OAuth login creates a new session. Sessions expire independently |
| **CORS**: OAuth callback is a browser redirect (not fetch) | No CORS issue for callback. `/api/auth/status` already has CORS configured via FRONTEND_URL |
| **Nginx routing**: `/api/auth/callback` must reach Hono | Already works — all `/api/*` routes go to Hono (port 3001). No nginx change needed |
| **Scope requirements**: copilot-sdk may need additional scopes | Start with `read:user user:email`. If copilot-sdk needs more, add scopes and re-authorize |

---

## 16 · Implementation Order Checklist

```
□ Phase 1: Create server/src/utils/token_encryption.ts
□ Phase 2: Update server/src/env.ts (add GITHUB_CALLBACK_URL, ADMIN_GITHUB_IDS; remove RP_ID, RP_ORIGIN)
□ Phase 2: Rewrite server/src/routes/auth_login.ts (OAuth flow)
□ Phase 2: Rewrite server/src/routes/auth_register.ts (redirect to login)
□ Phase 2: Update server/src/routes/auth_shared.ts (remove challenge_store)
□ Phase 2: Update server/src/routes/auth.ts (status endpoint adjustments)
□ Phase 2: Update server/src/index.ts (rate limit path adjustments)
□ Phase 2: Type-check server: cd server && bun run --bun tsc --noEmit
□ Phase 3: Rewrite web/src/lib/auth.ts (OAuth functions)
□ Phase 3: Rewrite web/src/lib/stores/auth.svelte.ts (new state machine)
□ Phase 3: Rewrite web/src/routes/AuthScreen.svelte (GitHub sign-in UI)
□ Phase 3: Update web/src/routes/+layout.svelte (auth handlers)
□ Phase 3: Update web/src/routes/AuthFeedback.svelte (text updates)
□ Phase 3: Type-check frontend: cd web && bun run check
□ Phase 4: Update web/src/lib/api/rpc.ts (passkey_id → reset())
□ Phase 4: Update web/src/lib/api/chat-client.ts (passkey_id → reset())
□ Phase 4: Update web/src/routes/admin/users/+page.svelte (passkey_id → user_id)
□ Phase 4: Remove @simplewebauthn/server from server/package.json
□ Phase 4: Remove @simplewebauthn/browser from web/package.json
□ Phase 4: Update server/src/env.test.ts (remove RP_ID/RP_ORIGIN tests)
□ Phase 5: Update .github/workflows/deploy-pi.yml (secrets)
□ Phase 5: Update .env.example with new OAuth vars
□ Phase 6: Type-check both projects (0 errors)
□ Phase 6: Run manual verification commands
□ Phase 6: Run E2E tests
□ Phase 6: Commit, push, verify CI green
□ Phase 6: Verify live deployment
```
