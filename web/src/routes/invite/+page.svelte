<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import { api } from '$lib/api/client';
    import { check_auth, register_passkey } from '$lib/auth';
    import { Button, Input } from '$lib/components/primitives';
    import Icon from '$lib/components/primitives/icon/Icon.svelte';
    import type { InviteStatus } from '$lib/types';
    import { onMount } from 'svelte';

    let token = $derived(page.url.searchParams.get('token'));
    let display_name = $state('');
    let error = $state('');
    let loading = $state(true);
    let submitting = $state(false);
    let invite_info: InviteStatus | null = $state(null);

    onMount(async () => {
        if (!token) {
            error = 'Invalid invite link.';
            loading = false;
            return;
        }
        try {
            const status = await check_auth();
            if (status.authenticated) {
                await goto(resolve('/'));
                return;
            }
        }
        catch {
            // not authenticated — proceed
        }
        try {
            const info = await api.get_invite_status(token);
            invite_info = info;
            if (!info.valid) {
                const reasons: Record<string, string> = {
                    not_found: 'This invite link is invalid.',
                    used: 'This invite link has already been used — each link can only be used once.',
                    expired: 'This invite link has expired.'
                };
                error = reasons[info.reason ?? ''] ?? 'This invite link is invalid.';
            }
        }
        catch (err) {
            console.error('Failed to check invite status:', err);
        }
        loading = false;
    });

    async function handle_submit() {
        if (!display_name.trim()) {
            error = 'Please enter a display name.';
            return;
        }
        error = '';
        submitting = true;
        try {
            const ok = await register_passkey(display_name.trim(), token as string);
            if (ok) {
                await goto(resolve('/'));
            }
        }
        catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : String(err);
            const lower = message.toLowerCase();
            if (message.includes('409') || lower.includes('already used')) {
                error = 'This invite link has already been used.';
            }
            else if (lower.includes('expired')) {
                error = 'This invite link has expired.';
            }
            else if (lower.includes('notallowed') || lower.includes('not allowed') || lower.includes('cancelled') || lower.includes('abort')) {
                error = 'Passkey creation was cancelled. Click the button to try again.';
            }
            else if (lower.includes('not supported') || lower.includes('webauthn')) {
                error = 'WebAuthn is not supported in this browser. Try Chrome, Safari, or Edge.';
            }
            else if (lower.includes('network') || lower.includes('fetch')) {
                error = 'Network error — check your connection and try again.';
            }
            else {
                error = message || 'Registration failed. Please try again.';
            }
        }
        finally {
            submitting = false;
        }
    }
</script>

<div class="auth-screen">
    <div class="auth-card">
        {#if loading}
            <span class="icon spin">progress_activity</span>
        {:else if error && (!invite_info || !invite_info.valid)}
            <span class="icon large">link_off</span>
            <h1>Ralph Agent Workspace</h1>
            <p class="auth-subtitle">{error}</p>
            <a href={resolve('/')} class="auth-link">Go to login</a>
        {:else}
            <span class="icon large">person_add</span>
            <h1>Welcome!</h1>
            <p class="auth-subtitle">You've been invited to Ralph Agent Workspace. Create a passkey to get started.</p>
            {#if invite_info?.valid}
                <div class="invite-meta">
                    {#if invite_info.label}
                        <span class="meta-badge"><Icon type="badge" /> {invite_info.label}</span>
                    {/if}
                    {#if invite_info.expires_at}
                        <span class="meta-badge">
                            <Icon type="schedule" />
                            Expires {new Date(invite_info.expires_at).toLocaleDateString()}
                        </span>
                    {/if}
                </div>
            {/if}
            <div class="input-wrap">
                <Input
                    type="text"
                    bind:value={display_name}
                    placeholder="Display name"
                    disabled={submitting}
                    onkeydown={(event) => event.key === 'Enter' && handle_submit()}
                />
            </div>
            <Button
                variant="primary"
                icon={submitting ? 'progress_activity' : 'fingerprint'}
                onclick={handle_submit}
                disabled={submitting}
                class="w-full justify-center"
            >
                {submitting ? 'Creating…' : 'Create Passkey'}
            </Button>
            {#if error}
                <p class="auth-error">{error}</p>
            {/if}
        {/if}
    </div>
</div>

<style>
    .auth-screen {
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; padding: 1rem; background: var(--bg);
    }
    .auth-card {
        background: var(--bg-surface); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 2.5rem; text-align: center;
        width: 100%; max-width: 380px;
        display: flex; flex-direction: column; align-items: center; gap: 1rem;
    }
    .auth-card h1 { font-size: 1.5rem; color: var(--fg); margin-bottom: 0.5rem; }
    .auth-subtitle { color: var(--fg-muted); font-size: 0.9rem; margin-bottom: 0.5rem; }
    .input-wrap { width: 100%; }
    .auth-error { color: var(--danger); font-size: 0.8rem; margin-top: 0.5rem; }
    .icon {
        font-family: 'Material Symbols Rounded', sans-serif;
        font-size: 1.2rem; line-height: 1;
    }
    .icon.large { font-size: 2.5rem; color: var(--accent); margin-bottom: 0.5rem; }
    .icon.spin { font-size: 2rem; color: var(--accent); animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .auth-link { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
    .auth-link:hover { text-decoration: underline; }
    .invite-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
    .meta-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.78rem;
        color: var(--fg-muted);
        background: var(--bg-elevated);
        padding: 0.25rem 0.6rem;
        border-radius: 12px;
        border: 1px solid var(--border);
    }
    @media (max-width: 768px) {
        .auth-card { max-width: 100%; padding: 1.5rem; }
    }
</style>
