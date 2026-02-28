<script lang="ts">
    import { api } from '$lib/api/client';
    import { LoadingSpinner, StatCard } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { AgentRun, UsageBreakdown, UsageSummary } from '$lib/types';
    import { onMount } from 'svelte';
    import RunHistory from './RunHistory.svelte';
    import UsageBreakdownPanel from './UsageBreakdown.svelte';

    let summary = $state<UsageSummary | null>(null);
    let breakdown = $state<UsageBreakdown | null>(null);
    let runs = $state<AgentRun[]>([]);
    let total_pages = $state(1);
    let total_count = $state(0);
    let loading_summary = $state(true);
    let loading_breakdown = $state(true);
    let loading_history = $state(true);
    let filter_type = $state('');
    let filter_status = $state('');
    let current_page = $state(1);

    onMount(() => {
        api.usage_summary()
            .then((data) => {
                summary = data;
            })
            .catch((err) => {
                console.error('usage summary error:', err);
                toast_store.error('Failed to load usage summary');
            })
            .finally(() => {
                loading_summary = false;
            });

        api.usage_breakdown()
            .then((data) => {
                breakdown = data;
            })
            .catch((err) => {
                console.error('usage breakdown error:', err);
                toast_store.error('Failed to load usage breakdown');
            })
            .finally(() => {
                loading_breakdown = false;
            });
    });

    $effect(() => {
        const page = current_page;
        const type = filter_type;
        const status = filter_status;

        loading_history = true;
        api.usage_history(page, 20, type || undefined, status || undefined)
            .then((result) => {
                runs = result.runs;
                total_pages = result.total_pages;
                total_count = result.total;
            })
            .catch((err) => {
                console.error('usage history error:', err);
                toast_store.error('Failed to load usage history');
            })
            .finally(() => {
                loading_history = false;
            });
    });
</script>

<div class="page">
    <div class="page-header">
        <h2>Usage Analytics</h2>
    </div>

    {#if loading_summary}
        <div class="loading-row">
            <LoadingSpinner label="Loading stats..." />
        </div>
    {:else if summary}
        <div class="stats-grid stats-3">
            <StatCard icon="bar_chart" value={summary.total_runs} label="Total Runs" />
            <StatCard icon="today" value={summary.today_runs} label="Today" />
            <StatCard icon="date_range" value={summary.week_runs} label="This Week" />
        </div>
        <div class="stats-grid stats-2">
            <StatCard icon="check_circle" value={summary.completed_runs} label="Completed" />
            <StatCard icon="error" value={summary.failed_runs} label="Failed" />
        </div>
    {/if}

    <UsageBreakdownPanel {breakdown} loading={loading_breakdown} />

    <RunHistory
        {runs}
        {total_pages}
        {total_count}
        loading={loading_history}
        {filter_type}
        {filter_status}
        {current_page}
        onfilter_type_change={(value) => {
            filter_type = value;
            current_page = 1;
        }}
        onfilter_status_change={(value) => {
            filter_status = value;
            current_page = 1;
        }}
        onpage_change={(page) => {
            current_page = page;
        }}
    />
</div>

<style>
    .page {
        max-width: 960px;
        overflow-x: hidden;
    }

    .page-header {
        display: flex;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
    }

    .stats-grid {
        display: grid;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .stats-3 {
        grid-template-columns: repeat(3, 1fr);
    }
    .stats-2 {
        grid-template-columns: repeat(2, 1fr);
        margin-bottom: 1.5rem;
    }

    .loading-row {
        padding: 2rem 1.25rem;
        display: flex;
        justify-content: center;
    }
</style>
