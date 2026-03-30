<script lang="ts">
    import { EmptyState } from '$lib/components';
    import { Badge, Pagination, Select } from '$lib/components/primitives';
    import type { AgentSession } from '$lib/types';
    import HistoryItem from './HistoryItem.svelte';

    let {
        history,
        history_total,
        history_page,
        history_total_pages,
        filter_status,
        onfilter_change,
        onpage_change,
        onretry
    }: {
        history: AgentSession[]
        history_total: number
        history_page: number
        history_total_pages: number
        filter_status: string
        onfilter_change: (status: string) => void
        onpage_change: (page: number) => void
        onretry?: (task_id: string) => void
    } = $props();

    let expanded_run = $state<string | null>(null);

    function toggle_run_log(id: string) {
        expanded_run = expanded_run === id ? null : id;
    }
</script>

<section class="section">
    <div class="section-header-row">
        <h3 class="section-title">
            <span class="icon">history</span>
            Run History
            {#if history_total > 0}
                <Badge variant="muted">{history_total}</Badge>
            {/if}
        </h3>
        <div class="history-filters">
            <Select
                class="filter-select"
                value={filter_status}
                onchange={(e) => {
                    onfilter_change(e.currentTarget.value);
                }}
            >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
            </Select>
        </div>
    </div>

    {#if history.length === 0}
        <EmptyState icon="receipt_long" message="No runs yet" />
    {:else}
        <div class="history-list">
            {#each history as run (run.id)}
                <HistoryItem {run} expanded={expanded_run === run.id} on_toggle_log={toggle_run_log} {onretry} />
            {/each}
        </div>

        <Pagination current_page={history_page} total_pages={history_total_pages} onpage_change={(page) => onpage_change(page)} />
    {/if}
</section>

<style>
    .section {
        margin-bottom: 2rem;
    }

    .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .section-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .section-header-row .section-title {
        margin-bottom: 0;
    }

    .history-filters {
        display: flex;
        gap: 0.5rem;
    }

    .history-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
</style>
