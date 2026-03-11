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
    let date_range = $state<'today' | '7d' | '30d' | 'all'>('all');

    let success_rate = $derived.by(() => {
        if (!summary) return null;
        const total = summary.completed_runs + summary.failed_runs;
        if (total === 0) return null;
        return Math.round((summary.completed_runs / total) * 100);
    });

    let success_rate_color = $derived(
        success_rate === null ? 'var(--fg-muted)' :
        success_rate >= 80 ? 'var(--success, #4ade80)' :
        success_rate >= 50 ? 'var(--accent)' :
        'var(--danger)'
    );

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

    function get_date_cutoff(range: typeof date_range): Date | null {
        const now = new Date();
        if (range === 'today') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            return start;
        }
        if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return null;
    }

    let filtered_runs = $derived.by(() => {
        const cutoff = get_date_cutoff(date_range);
        if (!cutoff) return runs;
        return runs.filter((run) => new Date(run.created_at) >= cutoff);
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
        <div class="stats-grid stats-row">
            <StatCard icon="bar_chart" value={summary.total_runs} label="Total Runs" />
            <StatCard icon="today" value={summary.today_runs} label="Today" />
            <StatCard icon="date_range" value={summary.week_runs} label="This Week" />
            <StatCard icon="check_circle" value={summary.completed_runs} label="Completed" />
            <StatCard icon="error" value={summary.failed_runs} label="Failed" />
        </div>
        {#if success_rate !== null}
            <div class="success-rate-bar">
                <span class="success-label">Success Rate</span>
                <span class="success-value" style="color: {success_rate_color}">{success_rate}%</span>
                <div class="success-track">
                    <div class="success-fill" style="width: {success_rate}%; background: {success_rate_color}"></div>
                </div>
            </div>
        {/if}
    {/if}

    <UsageBreakdownPanel {breakdown} loading={loading_breakdown} />

    <RunHistory
        runs={filtered_runs}
        {total_pages}
        {total_count}
        loading={loading_history}
        {filter_type}
        {filter_status}
        {current_page}
        {date_range}
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
        ondate_range_change={(value) => {
            date_range = value;
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

    .stats-row {
        grid-template-columns: repeat(5, 1fr);
        margin-bottom: 1rem;
    }

    .success-rate-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem 1rem;
        margin-bottom: 1.5rem;
    }
    .success-label {
        font-size: 0.8rem;
        color: var(--fg-muted);
        font-weight: 600;
        white-space: nowrap;
    }
    .success-value {
        font-size: 1.1rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .success-track {
        flex: 1;
        height: 6px;
        background: var(--bg-elevated);
        border-radius: 3px;
        overflow: hidden;
    }
    .success-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .loading-row {
        padding: 2rem 1.25rem;
        display: flex;
        justify-content: center;
    }

    @media (max-width: 768px) {
        .stats-row {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    @media (max-width: 480px) {
        .stats-row {
            grid-template-columns: 1fr;
        }
    }
</style>
