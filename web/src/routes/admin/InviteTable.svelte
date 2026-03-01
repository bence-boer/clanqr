<script lang="ts">
    import { api } from '$lib/api/client';
    import { EmptyState, ErrorBanner, LoadingSpinner } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
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

    function invite_status(inv: InviteToken): 'Active' | 'Expired' | 'Used' {
        if (inv.used_at) return 'Used';
        if (new Date(inv.expires_at) <= new Date()) return 'Expired';
        return 'Active';
    }

    function format_datetime(iso: string) {
        return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    async function revoke_invite(id: string) {
        revoking = new Set([...revoking, id]);
        revoke_error = '';
        try {
            await api.revoke_invite(id);
            invites = invites.filter((invite) => invite.id !== id);
        }
        catch (err: unknown) {
            revoke_error = err instanceof Error ? err.message : String(err);
        }
        finally {
            revoking = new Set([...revoking].filter((i) => i !== id));
        }
    }
</script>

{#if revoke_error}
    <ErrorBanner message={revoke_error} />
{/if}

<h3 class="section-title">Existing Invites</h3>
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
                                    <Button variant="danger" size="sm" onclick={() => revoke_invite(inv.id)} disabled={revoking.has(inv.id)}>
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

<style>
    /* Table */
    .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--border);
        border-radius: var(--radius);
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
    }
    thead th {
        background: var(--bg-surface);
        color: var(--fg-muted);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
    }
    tbody tr {
        border-bottom: 1px solid var(--border);
        transition: background 0.1s;
    }
    tbody tr:last-child {
        border-bottom: none;
    }
    tbody tr:hover {
        background: var(--bg-surface);
    }
    td {
        padding: 0.75rem 1rem;
        color: var(--fg);
        vertical-align: middle;
    }
    .date-cell {
        color: var(--fg-muted);
        font-size: 0.8rem;
        white-space: nowrap;
    }
    .label-cell {
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Row actions */
    .row-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .token-preview {
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 0.75rem;
        color: var(--fg-muted);
        background: var(--bg-elevated);
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
    }

    .section-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--fg);
        margin-bottom: 0.75rem;
    }

    /* Mobile */
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
        td {
            padding: 0; font-size: 0.85rem;
            display: flex; align-items: center; gap: 0.5rem;
        }
        td::before {
            content: attr(data-label); font-size: 0.7rem; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.04em;
            color: var(--fg-muted); min-width: 80px; flex-shrink: 0;
        }
        .row-actions { flex-wrap: wrap; }
    }
</style>
