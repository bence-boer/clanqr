<script lang="ts">
    import { Select } from '$lib/components/primitives';

    type DateRange = 'today' | '7d' | '30d' | 'all';

    interface Props {
        date_range: DateRange
        filter_type: string
        filter_status: string
        on_date_range_change?: (value: DateRange) => void
        on_filter_type_change: (value: string) => void
        on_filter_status_change: (value: string) => void
    }

    let { date_range, filter_type, filter_status, on_date_range_change, on_filter_type_change, on_filter_status_change }: Props = $props();

    const date_range_options: { value: DateRange, label: string }[] = [
        { value: 'today', label: 'Today' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: 'all', label: 'All time' }
    ];

    function on_type_change(event: Event) {
        on_filter_type_change((event.currentTarget as HTMLSelectElement).value);
    }

    function on_status_change(event: Event) {
        on_filter_status_change((event.currentTarget as HTMLSelectElement).value);
    }
</script>

<div class="filters">
    <div class="date-pills" role="group" aria-label="Filter by date range">
        {#each date_range_options as opt (opt.value)}
            <button
                class="date-pill"
                class:active={date_range === opt.value}
                onclick={() => on_date_range_change?.(opt.value)}
            >{opt.label}</button>
        {/each}
    </div>
    <Select style="flex: 1;" onchange={on_type_change} value={filter_type} aria-label="Filter by type">
        <option value="">All types</option>
        <option value="manager">manager</option>
        <option value="ralph">Clanqr</option>
        <option value="chat">chat</option>
    </Select>
    <Select style="flex: 1;" onchange={on_status_change} value={filter_status} aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="completed">completed</option>
        <option value="failed">failed</option>
        <option value="running">running</option>
        <option value="stopped">stopped</option>
        <option value="queued">queued</option>
    </Select>
</div>

<style>
    .filters { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .date-pills { display: flex; gap: 0.25rem; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .date-pill {
        background: transparent; border: none; color: var(--fg-muted);
        font-size: 0.75rem; padding: 0.35rem 0.65rem; cursor: pointer;
        transition: background 0.15s, color 0.15s; white-space: nowrap;
    }
    .date-pill:hover { background: var(--bg-elevated); }
    .date-pill.active { background: var(--accent); color: var(--bg); font-weight: 600; }
    @media (max-width: 768px) {
        .filters { flex-wrap: wrap; }
    }
    @media (max-width: 768px) {
        .date-pills { width: 100%; }
        .date-pill { flex: 1; text-align: center; }
    }
</style>
