<script lang="ts">
    import { SvelteDate } from 'svelte/reactivity';
    import type { AgentRun, PipelineStatus } from '$lib/types';

    let {
        pipeline,
        history
    }: {
        pipeline: PipelineStatus | null
        history: AgentRun[]
    } = $props();

    const completed_today = $derived(() => {
        const today = new SvelteDate();
        today.setHours(0, 0, 0, 0);
        const midnight = today.getTime();
        return history.filter((item) =>
            item.status === 'completed' && item.finished_at && new Date(item.finished_at).getTime() >= midnight
        ).length;
    });

    const avg_duration_ms = $derived(() => {
        const completed = history.filter((r) => r.status === 'completed' && r.duration_ms);
        if (completed.length === 0) return 0;
        const total = completed.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0);
        return Math.round(total / completed.length);
    });

    function format_duration_ms(ms: number): string {
        if (ms === 0) return '—';
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        return `${m}m ${s % 60}s`;
    }

    const queue_eta_ms = $derived(() => {
        const depth = pipeline?.queue_depth ?? 0;
        const avg = avg_duration_ms();
        if (depth === 0 || avg === 0) return 0;
        return depth * avg;
    });
</script>

{#if completed_today() > 0 || (pipeline?.queue_depth ?? 0) > 0}
    <div class="stats-bar">
        <span class="stat">
            <span class="stat-label">Completed today:</span>
            <span class="stat-value">{completed_today()}</span>
        </span>
        {#if avg_duration_ms() > 0}
            <span class="stat-sep">·</span>
            <span class="stat">
                <span class="stat-label">Avg duration:</span>
                <span class="stat-value">{format_duration_ms(avg_duration_ms())}</span>
            </span>
        {/if}
        {#if queue_eta_ms() > 0}
            <span class="stat-sep">·</span>
            <span class="stat">
                <span class="stat-label">Queue ETA:</span>
                <span class="stat-value">~{format_duration_ms(queue_eta_ms())}</span>
            </span>
        {/if}
    </div>
{/if}

<style>
    .stats-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 1.25rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        margin-bottom: 1.5rem;
        font-size: 0.8rem;
        flex-wrap: wrap;
    }

    .stat {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
    }

    .stat-label {
        color: var(--fg-muted);
    }

    .stat-value {
        color: var(--fg);
        font-weight: 600;
    }

    .stat-sep {
        color: var(--border);
    }
</style>
