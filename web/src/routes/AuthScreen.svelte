<script lang="ts">
    import { Button } from '$lib/components/primitives/button';
    import AuthFeedback from './AuthFeedback.svelte';
    let {
        auth_state,
        error = null,
        pending = false,
        onlogin
    }: {
        auth_state: string
        error?: string | null
        pending?: boolean
        onlogin: () => void
    } = $props();

    function classify_error(err: string | null): { title: string, message: string } | null {
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
        if (err.includes('user_creation_failed') || err.includes('session_creation_failed')) {
            return { title: 'Server Error', message: 'Could not create your account. Please try again.' };
        }
        if (err.includes('network') || err.includes('fetch') || err.includes('failed to fetch')) {
            return { title: 'Network Error', message: 'Could not reach the server. Check your connection and try again.' };
        }
        return { title: 'Error', message: err };
    }

    let classified_error = $derived(classify_error(error ?? null));

    const gh_d = [
        'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205',
        '11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795',
        '-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015',
        '-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105',
        '-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385',
        '1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27',
        '1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24',
        '2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475',
        '5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0',
        '.315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z'
    ].join(' ');
</script>

{#if auth_state === 'loading' || auth_state === 'redirecting'}
    <div class="auth-screen">
        <div class="auth-card">
            <span class="icon spin">progress_activity</span>
            <p class="auth-subtitle">{auth_state === 'redirecting' ? 'Redirecting to GitHub...' : 'Checking authentication...'}</p>
        </div>
    </div>
{:else if auth_state === 'error' && !error}
    <div class="auth-screen">
        <div class="auth-card">
            <span class="icon large">cloud_off</span>
            <h1>Ralph Agent Workspace</h1>
            <p class="auth-subtitle">Could not reach the API server. Is it running?</p>
            <Button variant="primary" onclick={() => window.location.reload()}>
                <span class="icon">refresh</span>
                Retry
            </Button>
        </div>
    </div>
{:else}
    <div class="auth-screen">
        <div class="auth-card">
            <svg class="github-logo" viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d={gh_d}/>
            </svg>
            <h1>Ralph Agent Workspace</h1>
            {#if classified_error}
                <AuthFeedback error={error} error_icon="error" error_message={classified_error.message} />
            {/if}
            <Button variant="primary" onclick={onlogin} disabled={pending}>
                <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 0.4rem;">
                    <path fill="currentColor" d={gh_d}/>
                </svg>
                Sign in with GitHub
            </Button>
        </div>
    </div>
{/if}

<style>
    .github-logo {
        color: var(--accent);
        margin-bottom: 1rem;
    }

    .icon.large {
        font-size: 48px;
        color: var(--accent);
        margin-bottom: 1rem;
    }

    .icon.spin {
        font-size: 32px;
        color: var(--accent);
    }

    .auth-screen {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1rem;
    }

    .auth-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 2.5rem;
        text-align: center;
        max-width: 380px;
        width: 100%;
    }

    .auth-card h1 {
        font-size: 1.5rem;
        color: var(--fg);
        margin-bottom: 0.5rem;
    }

    .auth-subtitle {
        color: var(--fg-muted);
        font-size: 0.875rem;
        margin-bottom: 1.5rem;
    }
</style>
