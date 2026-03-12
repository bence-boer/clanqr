<script lang="ts">
    let {
        pending = false,
        show_timeout_hint = false,
        error = null,
        error_icon = 'error',
        error_message = ''
    }: {
        pending?: boolean
        show_timeout_hint?: boolean
        error?: string | null
        error_icon?: string
        error_message?: string
    } = $props();
</script>

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
        <span class="icon" style="font-size:14px">{error_icon}</span>
        {error_message}
    </p>
{/if}

<style>
    .icon.pulse {
        font-size: 18px;
        color: var(--accent);
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
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
