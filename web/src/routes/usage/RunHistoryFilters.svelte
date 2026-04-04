<script lang="ts">
    import { Select } from '$lib/components/primitives';

    type DateRange = 'today' | '7d' | '30d' | 'all';

    interface Props {
        date_range: DateRange
        filter_type: string
        filter_status: string
        ondate_range_change?: (value: DateRange) => void
        onfilter_type_change: (value: string) => void
        onfilter_status_change: (value: string) => void
    }

    let { date_range, filter_type, filter_status, ondate_range_change, onfilter_type_change, onfilter_status_change }: Props = $props();

    const date_range_options: { value: DateRange, label: string }[] = [
        { value: 'today', label: 'Today' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: 'all', label: 'All time' }
    ];

    function on_type_change(event: Event) {
        onfilter_type_change((event.currentTarget as HTMLSelectElement).value);
    }

    function on_status_change(event: Event) {
        onfilter_status_change((event.currentTarget as HTMLSelectElement).value);
    }
</script>

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
