<script lang="ts">
    import { Button } from '$lib/components/primitives/button';
    import { Input } from '$lib/components/primitives';
    let {
        auth_state,
        error = null,
        pending = false,
        onregister,
        onlogin
    }: {
        auth_state: string
        error?: string | null
        pending?: boolean
        onregister: (name: string) => void
        onlogin: () => void
    } = $props();

    let setup_name: string = $state('');
    let show_timeout_hint = $state(false);
    let timeout_timer: ReturnType<typeof setTimeout> | null = $state(null);

    function classify_error(err: string | null): { message: string, icon: string } {
        if (!err) return { message: '', icon: 'error' };
        const lower = err.toLowerCase();
        if (lower.includes('notallowed') || lower.includes('not allowed') || lower.includes('cancelled') || lower.includes('canceled') || lower.includes('abort')) {
            return { message: 'Passkey request was cancelled. Try again when ready.', icon: 'cancel' };
        }
        if (lower.includes('not supported') || lower.includes('webauthn') || lower.includes('credential')) {
            return { message: 'WebAuthn is not supported in this browser. Use Chrome, Safari, or Edge.', icon: 'browser_not_supported' };
        }
        if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
            return { message: 'Network error — check your connection and try again.', icon: 'wifi_off' };
        }
        if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid')) {
            return { message: 'Authentication failed — passkey not recognized.', icon: 'lock' };
        }
        if (lower.includes('500') || lower.includes('server')) {
            return { message: 'Server error — please try again in a moment.', icon: 'cloud_off' };
        }
        return { message: err, icon: 'error' };
    }

    let classified_error = $derived(classify_error(error ?? null));

    function handle_login() {
        show_timeout_hint = false;
        if (timeout_timer) clearTimeout(timeout_timer);
        timeout_timer = setTimeout(() => {
            show_timeout_hint = true;
        }, 10000);
        onlogin();
    }

    function handle_register(name: string) {
        show_timeout_hint = false;
        if (timeout_timer) clearTimeout(timeout_timer);
        timeout_timer = setTimeout(() => {
            show_timeout_hint = true;
        }, 10000);
        onregister(name);
    }

    $effect(() => {
        if (!pending) {
            show_timeout_hint = false;
            if (timeout_timer) {
                clearTimeout(timeout_timer);
                timeout_timer = null;
            }
        }
    });
</script>

{#if auth_state === 'loading'}
    <div class="auth-screen">
        <div class="auth-card">
            <span class="icon spin">progress_activity</span>
        </div>
    </div>
{:else if auth_state === 'error'}
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
{:else if auth_state === 'setup'}
    <div class="auth-screen">
        <div class="auth-card">
            <span class="icon large">passkey</span>
            <h1>Ralph Agent Workspace</h1>
            <p class="auth-subtitle">Set up a passkey to secure your workspace.</p>
            <Input type="text" bind:value={setup_name} placeholder="Display name" class="auth-input" />
            <Button variant="primary" onclick={() => handle_register(setup_name || 'Admin')} disabled={pending}>
                <span class="icon">{pending ? 'progress_activity' : 'fingerprint'}</span>
                {pending ? 'Creating…' : 'Create Passkey'}
            </Button>
            {#if pending}
                <p class="auth-waiting">
                    <span class="icon pulse">fingerprint</span>
                    Waiting for your passkey…
                </p>
                {#if show_timeout_hint}
                    <p class="auth-hint">Taking longer than expected. Check your browser for a passkey prompt.</p>
                {/if}
            {/if}
            {#if error}
                <p class="auth-error">
                    <span class="icon" style="font-size:14px">{classified_error.icon}</span>
                    {classified_error.message}
                </p>
            {/if}
        </div>
    </div>
{:else if auth_state === 'login'}
    <div class="auth-screen">
        <div class="auth-card">
            <span class="icon large">lock</span>
            <h1>Ralph Agent Workspace</h1>
            <p class="auth-subtitle">Authenticate with your passkey to continue.</p>
            <Button variant="primary" onclick={handle_login} disabled={pending}>
                <span class="icon">{pending ? 'progress_activity' : 'fingerprint'}</span>
                {pending ? 'Authenticating…' : 'Sign in with Passkey'}
            </Button>
            {#if pending}
                <p class="auth-waiting">
                    <span class="icon pulse">fingerprint</span>
                    Waiting for your passkey…
                </p>
                {#if show_timeout_hint}
                    <p class="auth-hint">Taking longer than expected. Check your browser for a passkey prompt.</p>
                {/if}
            {/if}
            {#if error}
                <p class="auth-error">
                    <span class="icon" style="font-size:14px">{classified_error.icon}</span>
                    {classified_error.message}
                </p>
            {/if}
        </div>
    </div>
{/if}

<style>
    .icon.large {
        font-size: 48px;
        color: var(--accent);
        margin-bottom: 1rem;
    }

    .icon.spin {
        font-size: 32px;
        color: var(--accent);
    }

    .icon.pulse {
        font-size: 18px;
        color: var(--accent);
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
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

    :global(.auth-input) {
        padding: 0.65rem 0.85rem;
        margin-bottom: 1rem;
    }

    .auth-error {
        color: var(--danger);
        font-size: 0.8rem;
        margin-top: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
    }

    .auth-waiting {
        color: var(--accent);
        font-size: 0.82rem;
        margin-top: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
    }

    .auth-hint {
        color: var(--fg-muted);
        font-size: 0.75rem;
        margin-top: 0.5rem;
        font-style: italic;
    }

</style>
