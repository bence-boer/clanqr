<script lang="ts">
    import { resolve } from '$app/paths';
    import type { PipelineStatus } from '$lib/types';

    let { pipeline }: { pipeline: PipelineStatus | null } = $props();

    function state_label(state: string) {
        if (state === 'running') return 'Running';
        if (state === 'paused') return 'Paused';
        return 'Idle';
    }

    function state_color(state: string) {
        if (state === 'running') return '#6ea8fe';
        if (state === 'paused') return 'var(--accent)';
        return 'var(--fg-muted)';
    }
</script>

<a href={resolve('/pipeline')} class="stat-card pipeline-stat" style="--state-color: {pipeline ? state_color(pipeline.state) : 'var(--fg-muted)'}">
    <span class="icon stat-icon">account_tree</span>
    <span class="stat-value">{pipeline ? state_label(pipeline.state) : '—'}</span>
    <span class="stat-label">Pipeline · {pipeline?.queue_depth ?? 0} queued</span>
</a>

<style>
    .stat-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.25rem;
        text-align: center;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        transition: border-color 0.15s;
    }
    .stat-card:hover {
        border-color: var(--accent);
    }
    .stat-icon {
        font-size: 24px;
        color: var(--accent);
        display: block;
        margin-bottom: 0.5rem;
    }
    .pipeline-stat .stat-value {
        color: var(--state-color);
    }
    .stat-value {
        display: block;
        font-size: 2rem;
        font-weight: 700;
        color: var(--fg);
    }
    .stat-label {
        display: block;
        font-size: 0.8rem;
        color: var(--fg-muted);
        margin-top: 0.25rem;
    }
    @media (max-width: 768px) {
        .stat-card {
            padding: 0.75rem 0.5rem;
        }
        .stat-value {
            font-size: 1.25rem;
        }
    }
</style>
