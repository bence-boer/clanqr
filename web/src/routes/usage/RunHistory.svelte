<script lang="ts">
    import { EmptyState, LoadingSpinner, StatusBadge } from '$lib/components';
    import { Badge, Pagination, Select } from '$lib/components/primitives';
    import type { AgentRun } from '$lib/types';
    import RunDetailRow from './RunDetailRow.svelte';

    type DateRange = 'today' | '7d' | '30d' | 'all';
    type SortField = 'type' | 'model' | 'status' | 'duration' | 'tokens' | 'date';
    type SortDir = 'asc' | 'desc';

    let {
        runs,
        total_pages,
        total_count,
        loading,
        filter_type,
        filter_status,
        current_page,
        date_range = 'all',
        onfilter_type_change,
        onfilter_status_change,
        onpage_change,
        ondate_range_change
    }: {
        runs: AgentRun[]
        total_pages: number
        total_count: number
        loading: boolean
        filter_type: string
        filter_status: string
        current_page: number
        date_range?: DateRange
        onfilter_type_change: (value: string) => void
        onfilter_status_change: (value: string) => void
        onpage_change: (page: number) => void
        ondate_range_change?: (value: DateRange) => void
    } = $props();

    let sort_field = $state<SortField>('date');
    let sort_dir = $state<SortDir>('desc');
    let expanded_row = $state<string | null>(null);

    function toggle_sort(field: SortField) {
        if (sort_field === field) {
            sort_dir = sort_dir === 'asc' ? 'desc' : 'asc';
        }
        else {
            sort_field = field;
            sort_dir = 'desc';
        }
    }

    function sort_indicator(field: SortField): string {
        if (sort_field !== field) return '';
        return sort_dir === 'asc' ? ' ▲' : ' ▼';
    }

    function get_tokens(run: AgentRun): number {
        return (run.prompt_tokens ?? 0) + (run.completion_tokens ?? 0);
    }

    let sorted_runs = $derived.by(() => {
        const arr = [...runs];
        const dir = sort_dir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            switch (sort_field) {
                case 'type': return dir * (a.type ?? '').localeCompare(b.type ?? '');
                case 'model': return dir * (a.model ?? '').localeCompare(b.model ?? '');
                case 'status': return dir * (a.status ?? '').localeCompare(b.status ?? '');
                case 'duration': return dir * ((a.duration_ms ?? 0) - (b.duration_ms ?? 0));
                case 'tokens': return dir * (get_tokens(a) - get_tokens(b));
                case 'date': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                default: return 0;
            }
        });
        return arr;
    });

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

    function format_datetime(date_str: string | null): string {
        if (!date_str) return '-';
        return new Date(date_str).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function on_type_change(event: Event) {
        onfilter_type_change((event.currentTarget as HTMLSelectElement).value);
    }

    function on_status_change(event: Event) {
        onfilter_status_change((event.currentTarget as HTMLSelectElement).value);
    }

    const date_range_options: { value: DateRange, label: string }[] = [
        { value: 'today', label: 'Today' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: 'all', label: 'All time' }
    ];
</script>

<div class="history-section">
    <div class="history-header">
        <h3>
            Recent Runs {#if total_count > 0}<Badge variant="muted">{total_count}</Badge>{/if}
        </h3>
        <div class="filters">
            <div class="date-pills">
                {#each date_range_options as opt (opt.value)}
                    <button
                        class="date-pill"
                        class:active={date_range === opt.value}
                        onclick={() => ondate_range_change?.(opt.value)}
                    >{opt.label}</button>
                {/each}
            </div>
            <Select style="flex: 1;" onchange={on_type_change} value={filter_type}>
                <option value="">All types</option>
                <option value="manager">manager</option>
                <option value="ralph">ralph</option>
                <option value="chat">chat</option>
            </Select>
            <Select style="flex: 1;" onchange={on_status_change} value={filter_status}>
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
    {:else if sorted_runs.length === 0}
        <EmptyState icon="analytics" message="No runs found" detail="Try adjusting your filters." />
    {:else}
        <div class="table-wrap">
            <table class="runs-table">
                <thead>
                    <tr>
                        <th class="sortable" onclick={() => toggle_sort('type')}>Type{sort_indicator('type')}</th>
                        <th class="sortable" onclick={() => toggle_sort('model')}>Model{sort_indicator('model')}</th>
                        <th class="sortable" onclick={() => toggle_sort('status')}>Status{sort_indicator('status')}</th>
                        <th class="sortable" onclick={() => toggle_sort('duration')}>Duration{sort_indicator('duration')}</th>
                        <th class="sortable" onclick={() => toggle_sort('tokens')}>Tokens{sort_indicator('tokens')}</th>
                        <th class="sortable" onclick={() => toggle_sort('date')}>Date{sort_indicator('date')}</th>
                    </tr>
                </thead>
                <tbody>
                    {#each sorted_runs as run (run.id)}
                        <tr
                            class="clickable-row"
                            class:expanded={expanded_row === run.id}
                            onclick={() => expanded_row = expanded_row === run.id ? null : run.id}
                        >
                            <td><Badge variant={run.type === 'manager' ? 'info' : run.type === 'chat' ? 'success' : 'warning'}>{run.type}</Badge></td>
                            <td class="model-col">{run.model ?? 'default'}</td>
                            <td><StatusBadge status={run.status} /></td>
                            <td class="mono">{format_duration(run.duration_ms)}</td>
                            <td class="mono">{format_tokens(run.prompt_tokens, run.completion_tokens)}</td>
                            <td class="date-col">{format_relative(run.created_at)}</td>
                        </tr>
                        {#if expanded_row === run.id}
                            <RunDetailRow {run} {format_duration} {format_datetime} {get_tokens} />
                        {/if}
                    {/each}
                </tbody>
            </table>
        </div>

        <div class="pagination-border">
            <Pagination {current_page} {total_pages} {onpage_change} />
        </div>
    {/if}
</div>

<style>
    .history-section { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .history-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.9rem 1.25rem; border-bottom: 1px solid var(--border);
        flex-wrap: wrap; gap: 0.75rem;
    }
    .history-header h3 { font-size: 1rem; color: var(--fg); display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
    .filters { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .date-pills { display: flex; gap: 0.25rem; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .date-pill {
        background: transparent; border: none; color: var(--fg-muted);
        font-size: 0.75rem; padding: 0.35rem 0.65rem; cursor: pointer;
        transition: background 0.15s, color 0.15s; white-space: nowrap;
    }
    .date-pill:hover { background: var(--bg-elevated); }
    .date-pill.active { background: var(--accent); color: var(--bg); font-weight: 600; }
    .table-wrap { overflow-x: auto; }
    .runs-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .runs-table thead tr { border-bottom: 1px solid var(--border); }
    .runs-table th {
        padding: 0.6rem 1.25rem; text-align: left; font-size: 0.7rem;
        text-transform: uppercase; letter-spacing: 0.07em; color: var(--fg-muted);
        font-weight: 600; white-space: nowrap;
    }
    .runs-table th.sortable { cursor: pointer; user-select: none; transition: color 0.15s; }
    .runs-table th.sortable:hover { color: var(--fg); }
    .runs-table td { padding: 0.65rem 1.25rem; color: var(--fg); border-bottom: 1px solid var(--border); vertical-align: middle; }
    .runs-table tbody tr:last-child td { border-bottom: none; }
    .runs-table tbody tr.clickable-row { cursor: pointer; }
    .runs-table tbody tr.clickable-row:hover { background: var(--bg-elevated); }
    .runs-table tbody tr.expanded { background: rgba(212, 175, 55, 0.04); }
    .mono { font-variant-numeric: tabular-nums; font-size: 0.82rem; }
    .runs-table td.date-col { color: var(--fg-muted); font-size: 0.8rem; }
    .runs-table td.model-col { font-size: 0.8rem; color: var(--fg-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pagination-border { border-top: 1px solid var(--border); padding: 0.75rem 1.25rem; }
    .loading-row { padding: 2rem 1.25rem; display: flex; justify-content: center; }
    @media (max-width: 768px) { .filters { flex-wrap: wrap; } }
    @media (max-width: 640px) {
        .history-header { flex-direction: column; align-items: flex-start; }
        .date-pills { width: 100%; }
        .date-pill { flex: 1; text-align: center; }
    }
</style>
