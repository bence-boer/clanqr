<script lang="ts">
    import type { StructuredLogEntry } from '$lib/api/telemetry-client';
    import type { AgentProcess } from '$lib/types';
    import { SvelteSet } from 'svelte/reactivity';

    let { entries, agent }: {
        entries: StructuredLogEntry[]
        agent: AgentProcess
    } = $props();

    let total_input = $derived(sum_usage('input_tokens'));
    let total_output = $derived(sum_usage('output_tokens'));
    let total_cache_read = $derived(sum_usage('cache_read_tokens'));
    let total_cache_write = $derived(sum_usage('cache_write_tokens'));
    let total_cost = $derived(sum_usage_float('cost'));
    let tool_count = $derived(entries.filter((e) => e.type === 'tool_complete').length);

    let models_used = $derived(() => {
        const models = new SvelteSet<string>();
        for (const e of entries) {
            if (e.type === 'usage' && e.data.model) models.add(String(e.data.model));
        }
        return [...models];
    });

    let duration_display = $derived(compute_duration());

    function sum_usage(field: string): number {
        let total = 0;
        for (const e of entries) {
            if (e.type === 'usage' && typeof e.data[field] === 'number') {
                total += e.data[field] as number;
            }
        }
        return total;
    }

    function sum_usage_float(field: string): number {
        let total = 0;
        for (const e of entries) {
            if (e.type === 'usage' && typeof e.data[field] === 'number') {
                total += e.data[field] as number;
            }
        }
        return Math.round(total * 1000) / 1000;
    }

    function compute_duration(): string {
        if (!agent.started_at) return '—';
        const start = new Date(agent.started_at).getTime();
        const end = agent.finished_at ? new Date(agent.finished_at).getTime() : Date.now();
        const seconds = Math.floor((end - start) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    }

    function fmt(n: number): string {
        return n.toLocaleString();
    }
</script>

<div class="metrics-grid">
    <div class="metric-card">
        <span class="metric-label">Input tokens</span>
        <span class="metric-value">{fmt(total_input)}</span>
    </div>
    <div class="metric-card">
        <span class="metric-label">Output tokens</span>
        <span class="metric-value">{fmt(total_output)}</span>
    </div>
    <div class="metric-card">
        <span class="metric-label">Cache read</span>
        <span class="metric-value">{fmt(total_cache_read)}</span>
    </div>
    <div class="metric-card">
        <span class="metric-label">Cache write</span>
        <span class="metric-value">{fmt(total_cache_write)}</span>
    </div>
    <div class="metric-card">
        <span class="metric-label">Cost multiplier</span>
        <span class="metric-value">{total_cost > 0 ? `${total_cost}×` : '—'}</span>
    </div>
    <div class="metric-card">
        <span class="metric-label">Tool calls</span>
        <span class="metric-value">{tool_count}</span>
    </div>
    <div class="metric-card">
        <span class="metric-label">Duration</span>
        <span class="metric-value">{duration_display}</span>
    </div>
    <div class="metric-card">
        <span class="metric-label">Models</span>
        <span class="metric-value models">{models_used().join(', ') || '—'}</span>
    </div>
</div>

<style>
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.75rem;
    }
    .metric-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .metric-label {
        font-size: 0.65rem;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .metric-value {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--fg);
        font-family: var(--font-mono, monospace);
    }
    .metric-value.models {
        font-size: 0.75rem;
        font-weight: 400;
        word-break: break-all;
    }
</style>
