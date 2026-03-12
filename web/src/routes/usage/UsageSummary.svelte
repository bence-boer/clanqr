<script lang="ts">
    import { LoadingSpinner, StatCard } from '$lib/components';
    import type { UsageSummary } from '$lib/types';

    interface Props {
        summary: UsageSummary | null
        loading: boolean
    }

    let { summary, loading }: Props = $props();

    let success_rate = $derived.by(() => {
        if (!summary) return null;
        const total = summary.completed_runs + summary.failed_runs;
        if (total === 0) return null;
        return Math.round((summary.completed_runs / total) * 100);
    });

    let success_rate_color = $derived(
        success_rate === null
            ? 'var(--fg-muted)'
            : success_rate >= 80
                ? 'var(--success, #4ade80)'
                : success_rate >= 50
                    ? 'var(--accent)'
                    : 'var(--danger)'
    );
</script>

{#if loading}
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

<style>
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
