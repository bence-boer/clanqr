<script lang="ts">
    import { LoadingSpinner, StatCard } from '$lib/components';
    import type { UsageSummary } from '$lib/types';

    interface Props {
        summary: UsageSummary | null
        loading: boolean
    }

    let { summary, loading }: Props = $props();

    function fmt(n: number): string {
        return n.toLocaleString();
    }

    function fmt_cost(n: number): string {
        if (n === 0) return '$0';
        if (n < 0.01) return `$${n.toFixed(4)}`;
        return `$${n.toFixed(2)}`;
    }

    function fmt_duration(ms: number): string {
        if (ms === 0) return '0s';
        const mins = Math.floor(ms / 60_000);
        const secs = Math.round((ms % 60_000) / 1000);
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    }

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
    <div class="stats-grid token-row">
        <StatCard icon="input" value={fmt(summary.total_prompt_tokens)} label="Prompt Tokens" />
        <StatCard icon="output" value={fmt(summary.total_completion_tokens)} label="Completion Tokens" />
        <StatCard icon="cached" value={fmt(summary.total_cache_read_tokens ?? 0)} label="Cache Read" />
        <StatCard icon="save" value={fmt(summary.total_cache_write_tokens ?? 0)} label="Cache Write" />
        <StatCard icon="payments" value={fmt_cost(summary.total_estimated_cost ?? 0)} label="Est. Cost" />
        <StatCard icon="timer" value={fmt_duration(summary.total_duration_ms ?? 0)} label="Total Duration" />
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

    .token-row {
        grid-template-columns: repeat(3, 1fr);
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
        .token-row {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    @media (max-width: 480px) {
        .stats-row {
            grid-template-columns: 1fr;
        }
    }
</style>
