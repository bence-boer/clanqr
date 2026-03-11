<script lang="ts">
    import { api } from '$lib/api/client';
    import { ErrorBanner } from '$lib/components';
    import { Button, Input, Select } from '$lib/components/primitives';
    import InviteSuccess from './InviteSuccess.svelte';

    let { oninvite_created }: { oninvite_created: () => void } = $props();

    let invites_error = $state('');
    let invite_label = $state('');
    let invite_role: 'user' | 'admin' = $state('user');
    let expiry_mode: 'relative' | 'absolute' = $state('relative');
    let relative_minutes = $state(60);
    let absolute_datetime = $state('');
    let generating = $state(false);
    let new_invite_url: string | null = $state(null);
    let copy_done = $state(false);

    const RELATIVE_PRESETS = [
        { label: '1m', minutes: 1 }, { label: '5m', minutes: 5 },
        { label: '30m', minutes: 30 }, { label: '1h', minutes: 60 },
        { label: '3h', minutes: 180 }, { label: '6h', minutes: 360 },
        { label: '12h', minutes: 720 }, { label: '24h', minutes: 1440 }
    ];

    function compute_expires_at(): string {
        if (expiry_mode === 'absolute') return new Date(absolute_datetime).toISOString();
        return new Date(Date.now() + relative_minutes * 60_000).toISOString();
    }

    async function generate_invite() {
        generating = true;
        invites_error = '';
        try {
            const expires_at = compute_expires_at();
            const result = await api.create_invite({ role: invite_role, expires_at, label: invite_label.trim() || undefined });
            const base = typeof window !== 'undefined' ? window.location.origin : '';
            new_invite_url = `${base}/invite?token=${result.token}`;
            // Auto-copy to clipboard
            try {
                await navigator.clipboard.writeText(new_invite_url);
                copy_done = true;
                setTimeout(() => { copy_done = false; }, 2000);
            } catch {
                // Clipboard not available — user can copy manually
            }
            oninvite_created();
        }
        catch (err: unknown) {
            invites_error = err instanceof Error ? err.message : String(err);
        }
        finally {
            generating = false;
        }
    }

    async function copy_invite_url() {
        if (!new_invite_url) return;
        try {
            await navigator.clipboard.writeText(new_invite_url);
            copy_done = true;
            setTimeout(() => {
                copy_done = false;
            }, 2000);
        }
        catch {
            /* clipboard not available */
        }
    }
</script>

{#if invites_error}
    <ErrorBanner message={invites_error} />
{/if}

<div class="invite-form-card">
    <h3>Generate Invite Link</h3>

    <div class="form-row">
        <div class="form-field">
            <Input
                id="invite-label"
                type="text"
                label="Label"
                bind:value={invite_label}
                placeholder="(Optional) e.g. For Alice"
            />
        </div>
        <div class="form-field">
            <Select id="invite-role" label="Role" bind:value={invite_role}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
            </Select>
        </div>
    </div>

    <div class="form-field">
        <span class="field-label">Expiry Mode</span>
        <div class="expiry-tabs">
            <Button variant="tab" active={expiry_mode === 'relative'} onclick={() => (expiry_mode = 'relative')}>Valid for</Button>
            <Button variant="tab" active={expiry_mode === 'absolute'} onclick={() => (expiry_mode = 'absolute')}>Valid until</Button>
        </div>

        {#if expiry_mode === 'relative'}
            <div class="preset-buttons">
                {#each RELATIVE_PRESETS as preset (preset.label)}
                    <Button variant="filter" active={relative_minutes === preset.minutes} onclick={() => (relative_minutes = preset.minutes)}
                        >{preset.label}</Button
                    >
                {/each}
            </div>
        {:else}
            <Input
                type="datetime-local"
                bind:value={absolute_datetime}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                max={new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 16)}
            />
        {/if}
    </div>

    <Button variant="primary" onclick={generate_invite} disabled={generating || (expiry_mode === 'absolute' && !absolute_datetime)}>
        <span class="icon">add_link</span>
        {generating ? 'Generating...' : 'Generate Link'}
    </Button>
</div>

<InviteSuccess bind:new_invite_url {copy_done} on_copy={copy_invite_url} on_dismiss={() => {
    new_invite_url = null;
}} />

<style>
    /* Invite form */
    .invite-form-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
        margin-bottom: 1.5rem;
    }
    .invite-form-card h3 {
        font-size: 1rem;
        color: var(--fg);
        margin-bottom: 1rem;
    }

    .form-row {
        display: flex;
        gap: 1rem;
        margin-bottom: 0;
        flex-wrap: wrap;
    }

    .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        flex: 1;
        min-width: 160px;
        margin-bottom: 0.75rem;
    }

    .field-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .expiry-tabs {
        display: flex;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        width: fit-content;
        margin-bottom: 0.75rem;
    }
    .preset-buttons {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        margin-bottom: 0.75rem;
    }

    /* Mobile */
    @media (max-width: 768px) {
        .form-row { flex-direction: column; }
        .form-field { min-width: 0; }
        .preset-buttons { gap: 0.3rem; }
    }
</style>
