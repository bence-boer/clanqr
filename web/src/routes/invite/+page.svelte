<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { page } from '$app/stores';
    import { BASE_URL } from '$lib/api/rpc';
    import { check_auth } from '$lib/auth';

    let invite_state: 'loading' | 'valid' | 'error' | 'redirecting' = $state('loading');
    let error_reason: string = $state('');
    let expires_at: string | null = $state(null);

    const error_messages: Record<string, string> = {
        missing_token: 'Invalid invite link.',
        not_found: 'This invite link is invalid.',
        used: 'This invite link has already been used — each link can only be used once.',
        expired: 'This invite link has expired.'
    };

    async function start_login() {
        const token = $page.url.searchParams.get('token');
        if (!token) return;

        invite_state = 'redirecting';

        // Set invite token via server-side endpoint (HttpOnly cookie)
        const resp = await fetch(`${BASE_URL}/api/auth/invite/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token })
        });

        if (!resp.ok) {
            invite_state = 'error';
            error_reason = 'not_found';
            return;
        }

        window.location.href = `${BASE_URL}/api/auth/login/github`;
    }

    onMount(async () => {
        // If already authenticated, redirect to app
        const auth = await check_auth();
        if (auth.authenticated) {
            goto(resolve('/'));
            return;
        }

        const token = $page.url.searchParams.get('token');
        if (!token) {
            invite_state = 'error';
            error_reason = 'missing_token';
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/auth/invite/status?token=${encodeURIComponent(token)}`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.valid) {
                invite_state = 'valid';
                expires_at = data.expires_at ?? null;
            }
            else {
                invite_state = 'error';
                error_reason = data.error ?? 'not_found';
            }
        }
        catch {
            invite_state = 'error';
            error_reason = 'not_found';
        }
    });
</script>

<div class="invite-page">
    <div class="invite-card">
        {#if invite_state === 'loading' || invite_state === 'redirecting'}
            <span class="material-symbols-outlined icon spinning">progress_activity</span>
            <h1>Ralph Agent Workspace</h1>
            <p class="subtitle">
                {invite_state === 'redirecting' ? 'Redirecting to GitHub...' : 'Checking invite...'}
            </p>

        {:else if invite_state === 'error'}
            <span class="material-symbols-outlined icon error-icon">link_off</span>
            <h1>Ralph Agent Workspace</h1>
            <p class="error-text">{error_messages[error_reason] ?? 'Invalid invite link.'}</p>
            <a href={resolve('/')} class="link">Go to login</a>

        {:else if invite_state === 'valid'}
            <span class="material-symbols-outlined icon">person_add</span>
            <h1>Ralph Agent Workspace</h1>
            <p class="subtitle">You've been invited. Sign in with GitHub to get started.</p>
            {#if expires_at}
                <p class="meta">Expires {new Date(expires_at).toLocaleDateString()}</p>
            {/if}
            <button class="btn-primary" onclick={start_login}>
                <!-- eslint-disable-next-line @stylistic/max-len -->
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                Sign in with GitHub
            </button>
        {/if}
    </div>
</div>

<style>
    .invite-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--bg);
        padding: 1rem;
    }

    .invite-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 2.5rem;
        max-width: 380px;
        width: 100%;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    .icon {
        font-size: 3rem;
        color: var(--accent);
    }

    .error-icon {
        color: var(--danger, #ef4444);
    }

    h1 {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--fg);
        margin: 0;
    }

    .subtitle {
        color: var(--fg-muted);
        font-size: 0.875rem;
        margin: 0;
        line-height: 1.5;
    }

    .meta {
        color: var(--fg-muted);
        font-size: 0.75rem;
        margin: 0;
    }

    .error-text {
        color: var(--danger, #ef4444);
        font-size: 0.875rem;
        margin: 0;
        line-height: 1.5;
    }

    .link {
        color: var(--accent);
        text-decoration: none;
        font-size: 0.875rem;
    }
    .link:hover {
        text-decoration: underline;
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: var(--fg);
        color: var(--bg);
        border: none;
        border-radius: var(--radius);
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.15s;
        margin-top: 0.5rem;
    }
    .btn-primary:hover {
        opacity: 0.9;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    .spinning {
        animation: spin 1s linear infinite;
    }

    @media (max-width: 768px) {
        .invite-card {
            padding: 1.5rem;
        }
    }
</style>
