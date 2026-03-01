<script lang="ts">
    import { EmptyState, ErrorBanner, LoadingSpinner } from '$lib/components';
    import { Badge } from '$lib/components/primitives';
    import type { User } from '$lib/types';
    import UserActions from './UserActions.svelte';

    let {
        users, users_loading, users_error, self_id, admin_count,
        ontoggle_role, ondelete_user
    }: {
        users: User[]
        users_loading: boolean
        users_error: string
        self_id: string | null
        admin_count: number
        ontoggle_role: (user: User) => Promise<void>
        ondelete_user: (user_id: string) => Promise<void>
    } = $props();

    let confirm_delete: string | null = $state(null);
    let role_toggling: Set<string> = $state(new Set());
    let deleting: Set<string> = $state(new Set());

    function format_date(iso: string) {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    async function toggle_role(user: User) {
        role_toggling = new Set([...role_toggling, user.id]);
        try {
            await ontoggle_role(user);
        }
        catch {
            /* Parent handles error display */
        }
        finally {
            role_toggling = new Set([...role_toggling].filter((id) => id !== user.id));
        }
    }

    async function delete_user(user_id: string) {
        deleting = new Set([...deleting, user_id]);
        try {
            await ondelete_user(user_id);
            confirm_delete = null;
        }
        catch {
            /* Parent handles error display */
        }
        finally {
            deleting = new Set([...deleting].filter((id) => id !== user_id));
        }
    }
</script>

<div class="tab-content">
    {#if users_error}
        <ErrorBanner message={users_error} />
    {/if}

    {#if users_loading}
        <LoadingSpinner label="Loading users..." />
    {:else if users.length === 0}
        <EmptyState icon="group" message="No users found." />
    {:else}
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Display Name</th>
                        <th>Role</th>
                        <th>Registered</th>
                        <th>Sessions</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each users as user (user.id)}
                        <tr class:self-row={user.id === self_id}>
                            <td data-label="Name">
                                <span class="display-name">
                                    {user.display_name ?? '(unnamed)'}
                                    {#if user.id === self_id}
                                        <Badge variant="info" style="margin-left:0.4rem; vertical-align:middle">you</Badge>
                                    {/if}
                                </span>
                            </td>
                            <td data-label="Role">
                                <Badge variant={user.role === 'admin' ? 'warning' : 'muted'}>{user.role}</Badge>
                            </td>
                            <td data-label="Registered" class="date-cell">{format_date(user.created_at)}</td>
                            <td data-label="Sessions" class="count-cell">{user.session_count}</td>
                            <td data-label="Actions">
                                <UserActions
                                    {user} {self_id} {admin_count} {confirm_delete}
                                    {role_toggling} {deleting}
                                    on_toggle_role={toggle_role}
                                    on_delete={delete_user}
                                    on_confirm_delete={(id) => (confirm_delete = id)}
                                    on_cancel_delete={() => (confirm_delete = null)}
                                />
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

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
    tbody tr.self-row {
        background: rgba(99, 102, 241, 0.05);
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
    .count-cell {
        color: var(--fg-muted);
        text-align: center;
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
    }
</style>
