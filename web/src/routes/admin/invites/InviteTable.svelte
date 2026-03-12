<script lang="ts">
    import { api } from '$lib/api/client';
    import { ConfirmModal, EmptyState, ErrorBanner, LoadingSpinner } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { InviteToken } from '$lib/types';

    let {
        invites = $bindable(),
        invites_loading
    }: {
        invites: InviteToken[]
        invites_loading: boolean
    } = $props();

    let revoking: Set<string> = $state(new Set());
    let revoke_error = $state('');
    let show_revoke_modal = $state(false);
    let revoke_target: InviteToken | null = $state(null);
    let clearing_expired = $state(false);

    function invite_status(inv: InviteToken): 'Active' | 'Expired' | 'Used' {
        if (inv.used_at) return 'Used';
        if (new Date(inv.expires_at) <= new Date()) return 'Expired';
        return 'Active';
    }

    let has_expired = $derived(invites.some((inv) => invite_status(inv) === 'Expired' || invite_status(inv) === 'Used'));

    function format_datetime(iso: string) {
        return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function request_revoke(inv: InviteToken) {
        revoke_target = inv;
        show_revoke_modal = true;
    }

    async function confirm_revoke() {
        if (!revoke_target) return;
        const id = revoke_target.id;
        revoking = new Set([...revoking, id]);
        revoke_error = '';
        try {
            await api.revoke_invite(id);
            invites = invites.filter((invite) => invite.id !== id);
            show_revoke_modal = false;
            revoke_target = null;
        }
        catch (err: unknown) {
            revoke_error = err instanceof Error ? err.message : String(err);
        }
        finally {
            revoking = new Set([...revoking].filter((i) => i !== id));
        }
    }

    async function clear_expired() {
        clearing_expired = true;
        try {
            await api.clear_old_invites();
            invites = invites.filter((inv) => invite_status(inv) === 'Active');
            toast_store.success('Expired and used invites cleared');
        }
        catch (err: unknown) {
            toast_store.error(err instanceof Error ? err.message : 'Failed to clear expired invites');
        }
        finally {
            clearing_expired = false;
        }
    }
</script>

{#if revoke_error}
    <ErrorBanner message={revoke_error} />
{/if}

<div class="section-header">
    <h3 class="section-title">Existing Invites</h3>
    {#if has_expired}
        <Button variant="secondary" size="sm" onclick={clear_expired} disabled={clearing_expired}>
            <span class="icon" style="font-size:14px">{clearing_expired ? 'progress_activity' : 'delete_sweep'}</span>
            {clearing_expired ? 'Clearing…' : 'Clear Expired'}
        </Button>
    {/if}
</div>
{#if invites_loading}
    <LoadingSpinner label="Loading invites..." />
{:else if invites.length === 0}
    <EmptyState icon="link_off" message="No invite links yet." />
{:else}
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Label</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Used By</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each invites as inv (inv.id)}
                    {@const status = invite_status(inv)}
                    <tr>
                        <td data-label="Label" class="label-cell">{inv.label ?? '—'}</td>
                        <td data-label="Role"><Badge variant={inv.role === 'admin' ? 'warning' : 'muted'}>{inv.role}</Badge></td>
                        <td data-label="Status"><Badge variant={status === 'Active' ? 'success' : status === 'Expired' ? 'muted' : 'info'}>{status}</Badge></td>
                        <td data-label="Expires" class="date-cell">{format_datetime(inv.expires_at)}</td>
                        <td data-label="Used By" class="date-cell">{inv.used_by_display_name ?? '—'}</td>
                        <td data-label="Actions">
                            {#if status === 'Active'}
                                <div class="row-actions">
                                    {#if inv.token_preview}
                                        <code class="token-preview">{inv.token_preview}</code>
                                    {/if}
                                    <Button variant="danger" size="sm" onclick={() => request_revoke(inv)} disabled={revoking.has(inv.id)}>
                                        {revoking.has(inv.id) ? 'Revoking...' : 'Revoke'}
                                    </Button>
                                </div>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

<ConfirmModal
    bind:open={show_revoke_modal}
    title="Revoke Invite"
    message={revoke_target ? `Revoke the invite "${revoke_target.label ?? 'unlabeled'}"? It will no longer be usable.` : ''}
    confirm_label="Revoke"
    variant="danger"
    loading={revoke_target ? revoking.has(revoke_target.id) : false}
    onconfirm={confirm_revoke}
    oncancel={() => {
        show_revoke_modal = false;
        revoke_target = null;
    }}
/>

<style>
    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    thead th {
        background: var(--bg-surface); color: var(--fg-muted); font-size: 0.75rem;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
        padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap;
    }
    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: var(--bg-surface); }
    td { padding: 0.75rem 1rem; color: var(--fg); vertical-align: middle; }
    .date-cell { color: var(--fg-muted); font-size: 0.8rem; white-space: nowrap; }
    .label-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .token-preview {
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 0.75rem; color: var(--fg-muted);
        background: var(--bg-elevated); padding: 0.15rem 0.4rem; border-radius: 4px;
    }
    .section-title { font-size: 0.95rem; font-weight: 600; color: var(--fg); }
    .section-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
    @media (max-width: 768px) {
        .table-wrap { border: none; border-radius: 0; overflow-x: visible; }
        table { display: block; }
        thead { display: none; }
        tbody { display: flex; flex-direction: column; gap: 0.75rem; }
        tbody tr {
            display: flex; flex-direction: column; gap: 0.4rem;
            background: var(--bg-surface); border: 1px solid var(--border);
            border-radius: var(--radius); padding: 0.75rem;
        }
        td { padding: 0; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; }
        td::before {
            content: attr(data-label); font-size: 0.7rem; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.04em;
            color: var(--fg-muted); min-width: 80px; flex-shrink: 0;
        }
        .row-actions { flex-wrap: wrap; }
    }
</style>
