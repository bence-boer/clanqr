<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { api } from '$lib/api/client';
    import { API_URL } from '$lib/api/rpc';
    import { LoadingSpinner, StatCard } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import { auth_store } from '$lib/stores/auth.svelte';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { InviteToken, User } from '$lib/types';
    import { onMount } from 'svelte';
    import InviteForm from './InviteForm.svelte';
    import InviteTable from './InviteTable.svelte';
    import UserTable from './UserTable.svelte';

    // ── Auth ────────────────────────────────────────────────────────────────────
    let self_id = $derived(auth_store.passkey_id);
    let role_checked = $state(false);

    // Redirect non-admin users
    $effect(() => {
        if (auth_store.role !== null) {
            if (auth_store.role !== 'admin') {
                toast_store.error('Admin access required');
                goto(resolve('/'));
            }
            else {
                role_checked = true;
            }
        }
    });

    // ── Tabs ────────────────────────────────────────────────────────────────────
    let active_tab: 'users' | 'invites' | 'metrics' | 'maintenance' = $state('users');

    // ── Users tab ───────────────────────────────────────────────────────────────
    let users: User[] = $state([]);
    let users_loading = $state(true);
    let users_error = $state('');

    let admin_count = $derived(users.filter((u) => u.role === 'admin').length);

    async function load_users() {
        users_loading = true;
        users_error = '';
        try {
            users = await api.list_users();
        }
        catch (err: unknown) {
            toast_store.error(err instanceof Error ? err.message : 'Failed to create invite');
        }
        finally {
            users_loading = false;
        }
    }

    async function toggle_role(user: User) {
        const new_role = user.role === 'admin' ? 'user' : 'admin';
        const prev_role = user.role;

        // Optimistic update
        users = users.map((u) => (u.id === user.id ? { ...u, role: new_role } : u));

        try {
            await api.update_user_role(user.id, new_role);
        }
        catch (err: unknown) {
            // Rollback
            users = users.map((u) => (u.id === user.id ? { ...u, role: prev_role } : u));
            users_error = err instanceof Error ? err.message : String(err);
            throw err;
        }
    }

    async function delete_user(user_id: string) {
        try {
            await api.delete_user(user_id);
            users = users.filter((u) => u.id !== user_id);
        }
        catch (err: unknown) {
            users_error = err instanceof Error ? err.message : String(err);
            throw err;
        }
    }

    // ── Invites tab ─────────────────────────────────────────────────────────────
    let invites: InviteToken[] = $state([]);
    let invites_loading = $state(true);

    async function load_invites() {
        invites_loading = true;
        try {
            invites = await api.list_invites();
        }
        catch {
            // Errors handled by subcomponents
        }
        finally {
            invites_loading = false;
        }
    }

    // ── Metrics tab ─────────────────────────────────────────────────────────────
    interface MetricEntry {
        total_requests: number
        total_errors: number
        avg_latency_ms: number
        p95_latency_ms: number
    }

    let metrics: Record<string, MetricEntry> = $state({});
    let metrics_loading = $state(false);

    let sorted_metrics = $derived(
        Object.entries(metrics)
            .map(([route, data]) => ({ route, ...data }))
            .sort((a, b) => b.p95_latency_ms - a.p95_latency_ms)
    );

    let error_routes = $derived(
        sorted_metrics.filter(m => m.total_errors > 0).sort((a, b) => b.total_errors - a.total_errors)
    );

    let top_volume = $derived(
        [...sorted_metrics].sort((a, b) => b.total_requests - a.total_requests).slice(0, 10)
    );

    async function load_metrics() {
        metrics_loading = true;
        try {
            const resp = await fetch(`${API_URL}/api/admin/metrics`, { credentials: 'include' });
            if (!resp.ok) throw new Error('Failed to load metrics');
            metrics = await resp.json();
        }
        catch {
            toast_store.error('Failed to load metrics');
        }
        finally {
            metrics_loading = false;
        }
    }

    // ── Maintenance ─────────────────────────────────────────────────────────────
    let cleanup_loading = $state(false);

    async function cleanup_workspaces() {
        cleanup_loading = true;
        try {
            const resp = await fetch(`${API_URL}/api/admin/cleanup-workspaces`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!resp.ok) throw new Error('Cleanup failed');
            const data: { cleaned: number } = await resp.json();
            toast_store.success(`Cleaned up ${data.cleaned} workspace(s)`);
        }
        catch {
            toast_store.error('Workspace cleanup failed');
        }
        finally {
            cleanup_loading = false;
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────────
    onMount(() => {
        load_users();
        load_invites();
    });
</script>

<div class="page">
    {#if !role_checked}
        <LoadingSpinner label="Checking permissions…" />
    {:else}
        <div class="page-header">
            <h2>Admin</h2>
        </div>

        <div class="tabs">
            <Button variant="tab" active={active_tab === 'users'} icon="group" onclick={() => (active_tab = 'users')}>Users</Button>
            <Button variant="tab" active={active_tab === 'invites'} icon="link" onclick={() => (active_tab = 'invites')}>Invite Links</Button>
            <Button variant="tab" active={active_tab === 'metrics'} icon="monitoring" onclick={() => { active_tab = 'metrics'; if (Object.keys(metrics).length === 0) load_metrics(); }}>Metrics</Button>
            <Button variant="tab" active={active_tab === 'maintenance'} icon="build" onclick={() => (active_tab = 'maintenance')}>Maintenance</Button>
        </div>

        {#if active_tab === 'users'}
            <UserTable {users} {users_loading} {users_error} {self_id} {admin_count} ontoggle_role={toggle_role} ondelete_user={(user_id) => delete_user(user_id)} />
        {/if}

        {#if active_tab === 'invites'}
            <div class="tab-content">
                <InviteForm oninvite_created={load_invites} />
                <InviteTable bind:invites {invites_loading} />
            </div>
        {/if}

        {#if active_tab === 'metrics'}
            <div class="tab-content">
                {#if metrics_loading}
                    <LoadingSpinner label="Loading metrics…" />
                {:else if sorted_metrics.length === 0}
                    <p class="empty-text">No metrics data available yet.</p>
                {:else}
                    <div class="metrics-grid">
                        <StatCard label="Total Endpoints" value={String(sorted_metrics.length)} icon="api" />
                        <StatCard label="Total Requests" value={String(sorted_metrics.reduce((s, m) => s + m.total_requests, 0))} icon="trending_up" />
                        <StatCard label="Total Errors" value={String(sorted_metrics.reduce((s, m) => s + m.total_errors, 0))} icon="error" />
                    </div>

                    <h4 class="section-heading">Slowest Endpoints (P95)</h4>
                    <div class="metrics-table-wrap">
                        <table class="metrics-table">
                            <thead><tr><th>Route</th><th>P95 (ms)</th><th>Avg (ms)</th><th>Reqs</th><th>Errors</th></tr></thead>
                            <tbody>
                                {#each sorted_metrics.slice(0, 15) as m (m.route)}
                                    <tr>
                                        <td class="route-cell">{m.route}</td>
                                        <td class="num">{m.p95_latency_ms}</td>
                                        <td class="num">{m.avg_latency_ms}</td>
                                        <td class="num">{m.total_requests}</td>
                                        <td class="num" class:error-cell={m.total_errors > 0}>{m.total_errors}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    {#if error_routes.length > 0}
                        <h4 class="section-heading">Error Routes</h4>
                        <div class="metrics-table-wrap">
                            <table class="metrics-table">
                                <thead><tr><th>Route</th><th>Errors</th><th>Error Rate</th></tr></thead>
                                <tbody>
                                    {#each error_routes as m (m.route)}
                                        <tr>
                                            <td class="route-cell">{m.route}</td>
                                            <td class="num error-cell">{m.total_errors}</td>
                                            <td class="num error-cell">{m.total_requests > 0 ? ((m.total_errors / m.total_requests) * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}

                    <h4 class="section-heading">Highest Volume</h4>
                    <div class="metrics-table-wrap">
                        <table class="metrics-table">
                            <thead><tr><th>Route</th><th>Requests</th><th>Avg (ms)</th></tr></thead>
                            <tbody>
                                {#each top_volume as m (m.route)}
                                    <tr>
                                        <td class="route-cell">{m.route}</td>
                                        <td class="num">{m.total_requests}</td>
                                        <td class="num">{m.avg_latency_ms}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 1rem;">
                        <Button variant="secondary" size="sm" icon="refresh" onclick={load_metrics}>Refresh Metrics</Button>
                    </div>
                {/if}
            </div>
        {/if}

        {#if active_tab === 'maintenance'}
            <div class="tab-content">
                <div class="maintenance-section">
                    <h4 class="section-heading">Workspace Cleanup</h4>
                    <p class="maintenance-desc">Remove agent workspaces older than 7 days to free disk space.</p>
                    <Button variant="danger" icon="delete_sweep" onclick={cleanup_workspaces} disabled={cleanup_loading}>
                        {cleanup_loading ? 'Cleaning…' : 'Clean Up Workspaces'}
                    </Button>
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .page {
        max-width: 1000px;
        overflow-x: hidden;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
    }

    /* Tabs */
    .tabs {
        box-sizing: border-box;
        display: flex;
        gap: 0.25rem;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid var(--border);
    }

    /* Mobile */
    @media (max-width: 768px) {
        .tabs {
            overflow-x: auto;
        }
    }

    /* Metrics */
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }
    .section-heading {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin: 1.25rem 0 0.5rem;
    }
    .metrics-table-wrap {
        overflow-x: auto;
    }
    .metrics-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.78rem;
    }
    .metrics-table th {
        text-align: left;
        padding: 0.45rem 0.6rem;
        color: var(--fg-muted);
        border-bottom: 1px solid var(--border);
        font-weight: 600;
        white-space: nowrap;
    }
    .metrics-table td {
        padding: 0.4rem 0.6rem;
        border-bottom: 1px solid var(--border);
        color: var(--fg);
    }
    .route-cell {
        font-family: var(--font-mono, monospace);
        font-size: 0.72rem;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .error-cell { color: var(--danger, #c9544a); font-weight: 600; }
    .empty-text { color: var(--fg-muted); font-size: 0.85rem; }

    /* Maintenance */
    .maintenance-section {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
    }
    .maintenance-desc {
        color: var(--fg-muted);
        font-size: 0.85rem;
        margin-bottom: 1rem;
    }
</style>
