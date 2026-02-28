<script lang="ts">
    import { EmptyState, LoadingSpinner, StatusBadge } from '$lib/components';
    import { Button, Select, Badge } from '$lib/components/primitives';
    import type { AgentRun } from '$lib/types';

    let {
        runs,
        total_pages,
        total_count,
        loading,
        filter_type,
        filter_status,
        current_page,
        onfilter_type_change,
        onfilter_status_change,
        onpage_change
    }: {
        runs: AgentRun[];
        total_pages: number;
        total_count: number;
        loading: boolean;
        filter_type: string;
        filter_status: string;
        current_page: number;
        onfilter_type_change: (value: string) => void;
        onfilter_status_change: (value: string) => void;
        onpage_change: (page: number) => void;
    } = $props();

    function format_duration(ms: number | null): string {
        if (ms === null) return '-';
        if (ms < 1000) return '< 1s';
        const secs = Math.floor(ms / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const rem_secs = secs % 60;
        return rem_secs > 0 ? `${mins}m ${rem_secs}s` : `${mins}m`;
    }

    function format_relative(date_str: string | null): string {
        if (!date_str) return '-';
        const diff_secs = Math.floor((Date.now() - new Date(date_str).getTime()) / 1000);
        if (diff_secs < 60) return `${diff_secs}s ago`;
        if (diff_secs < 3600) return `${Math.floor(diff_secs / 60)}m ago`;
        if (diff_secs < 86400) return `${Math.floor(diff_secs / 3600)}h ago`;
        const days = Math.floor(diff_secs / 86400);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    function format_tokens(prompt: number | null, completion: number | null): string {
        if (prompt === null && completion === null) return '-';
        return ((prompt ?? 0) + (completion ?? 0)).toLocaleString();
    }

    function on_type_change(event: Event) {
        onfilter_type_change((event.currentTarget as HTMLSelectElement).value);
    }

    function on_status_change(event: Event) {
        onfilter_status_change((event.currentTarget as HTMLSelectElement).value);
    }
</script>

<div class="history-section">
    <div class="history-header">
        <h3>
            Recent Runs {#if total_count > 0}<Badge variant="muted">{total_count}</Badge>{/if}
        </h3>
        <div class="filters">
            <Select class="select" onchange={on_type_change} value={filter_type}>
                <option value="">All types</option>
                <option value="manager">manager</option>
                <option value="ralph">ralph</option>
                <option value="chat">chat</option>
            </Select>
            <Select class="select" onchange={on_status_change} value={filter_status}>
                <option value="">All statuses</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
                <option value="running">running</option>
                <option value="stopped">stopped</option>
                <option value="queued">queued</option>
            </Select>
        </div>
    </div>

    {#if loading}
        <div class="loading-row">
            <LoadingSpinner label="Loading runs..." />
        </div>
    {:else if runs.length === 0}
        <EmptyState icon="analytics" message="No runs found" detail="Try adjusting your filters." />
    {:else}
        <div class="table-wrap">
            <table class="runs-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Model</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Tokens</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    {#each runs as run}
                        <tr>
                            <td><Badge variant={run.type === 'manager' ? 'info' : run.type === 'chat' ? 'success' : 'warning'}>{run.type}</Badge></td>
                            <td class="model-col">{run.model ?? 'default'}</td>
                            <td><StatusBadge status={run.status} /></td>
                            <td class="mono">{format_duration(run.duration_ms)}</td>
                            <td class="mono">{format_tokens(run.prompt_tokens, run.completion_tokens)}</td>
                            <td class="date-col">{format_relative(run.created_at)}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        {#if total_pages > 1}
            <div class="pagination">
                <Button variant="secondary" icon="chevron_left" disabled={current_page <= 1} onclick={() => onpage_change(current_page - 1)} />
                <span class="page-info">Page {current_page} of {total_pages}</span>
                <Button variant="secondary" icon="chevron_right" disabled={current_page >= total_pages} onclick={() => onpage_change(current_page + 1)} />
            </div>
        {/if}
    {/if}
</div>

<style>
    .history-section {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
    }

    .history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.9rem 1.25rem;
        border-bottom: 1px solid var(--border);
        flex-wrap: wrap;
        gap: 0.75rem;
    }

    .history-header h3 {
        font-size: 1rem;
        color: var(--fg);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
    }

    /* ── Table ─────────────────────────────────────────────────────────────── */
    .table-wrap {
        overflow-x: auto;
    }

    .runs-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }

    .runs-table thead tr {
        border-bottom: 1px solid var(--border);
    }

    .runs-table th {
        padding: 0.6rem 1.25rem;
        text-align: left;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--fg-muted);
        font-weight: 600;
        white-space: nowrap;
    }

    .runs-table td {
        padding: 0.65rem 1.25rem;
        color: var(--fg);
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
    }

    .runs-table tbody tr:last-child td {
        border-bottom: none;
    }

    .runs-table tbody tr:hover {
        background: var(--bg-elevated);
    }

    .mono {
        font-variant-numeric: tabular-nums;
        font-size: 0.82rem;
    }

    .runs-table td.date-col {
        color: var(--fg-muted);
        font-size: 0.8rem;
    }

    .runs-table td.model-col {
        font-size: 0.8rem;
        color: var(--fg-muted);
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* ── Pagination ────────────────────────────────────────────────────────── */
    .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.75rem 1.25rem;
        border-top: 1px solid var(--border);
    }

    .page-info {
        font-size: 0.82rem;
        color: var(--fg-muted);
    }

    .loading-row {
        padding: 2rem 1.25rem;
        display: flex;
        justify-content: center;
    }

    @media (max-width: 768px) {
        .filters {
            flex-wrap: wrap;
        }
    }

    @media (max-width: 640px) {
        .history-header {
            flex-direction: column;
            align-items: flex-start;
        }
        .filters {
            flex-direction: column;
            width: 100%;
        }
    }
</style>
