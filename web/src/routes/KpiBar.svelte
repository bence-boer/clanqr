<script lang="ts">
    import { resolve } from '$app/paths';
    import type { PipelineStatus, SystemStats } from '$lib/types';

    interface Props {
        pipeline: PipelineStatus | null
        active_agents: number
        pending_approval_count: number
        system_stats: SystemStats | null
        onhealth_click?: () => void
    }

    const { pipeline, active_agents, pending_approval_count, system_stats, onhealth_click }: Props = $props();

    function health_status(stats: SystemStats | null): 'green' | 'yellow' | 'red' {
        if (!stats) return 'red';
        if (stats.cpu_percent > 90 || stats.memory_percent > 90 || stats.storage_percent > 90) return 'red';
        if (stats.cpu_percent > 70 || stats.memory_percent > 70 || stats.storage_percent > 80) return 'yellow';
        return 'green';
    }

    function pipeline_label(state: string): string {
        if (state === 'running') return 'Running';
        if (state === 'paused') return 'Paused';
        return 'Idle';
    }

    const health = $derived(health_status(system_stats));
</script>

<div class="kpi-bar">
    <a href={resolve('/pipeline')} class="kpi-item">
        <span class="kpi-label">Pipeline</span>
        <span class="kpi-value kpi-{pipeline?.state ?? 'idle'}">{pipeline ? pipeline_label(pipeline.state) : '—'}</span>
    </a>
    <a href={resolve('/projects')} class="kpi-item">
        <span class="kpi-label">Awaiting Approval</span>
        <span class="kpi-value">{pending_approval_count}</span>
    </a>
    <a href={resolve('/monitoring')} class="kpi-item">
        <span class="kpi-label">Active Agents</span>
        <span class="kpi-value">{active_agents}</span>
    </a>
    <button class="kpi-item kpi-health" onclick={onhealth_click}>
        <span class="kpi-label">System Health</span>
        <span class="health-dot health-{health}"></span>
    </button>
</div>

<style>
    .kpi-bar {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }

    .kpi-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        transition: border-color 150ms ease;
        font-family: var(--font);
    }

    .kpi-item:hover {
        border-color: var(--accent);
    }

    button.kpi-item {
        border: 1px solid var(--border);
        background: var(--bg-surface);
    }

    .kpi-label {
        font-size: 0.7rem;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-weight: 600;
    }

    .kpi-value {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--fg);
    }

    .kpi-running { color: var(--info); }
    .kpi-paused { color: var(--accent); }
    .kpi-idle { color: var(--fg-muted); }

    .health-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-top: 0.15rem;
    }

    .health-green { background: var(--success); }
    .health-yellow { background: var(--accent); }
    .health-red { background: var(--danger); }

    @media (max-width: 768px) {
        .kpi-bar {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>
