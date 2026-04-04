<script lang="ts">
    import { resolve } from '$app/paths';
    import type { AgentProcess } from '$lib/types';
    import { Badge, Button } from '$lib/components/primitives';

    let {
        agents,
        on_view_log
    }: {
        agents: AgentProcess[]
        on_view_log: (id: string) => void
    } = $props();

    let now = $state(Date.now());

    $effect(() => {
        const has_running = agents.some((agent) => agent.status === 'running');
        if (!has_running) return;

        const interval = setInterval(() => {
            now = Date.now();
        }, 1000);
        return () => clearInterval(interval);
    });

    function format_duration(ms: number): string {
        const total_seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(total_seconds / 60);
        const seconds = total_seconds % 60;
        if (minutes === 0) return `${seconds}s`;
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }

    function elapsed_ms(started_at: string): number {
        return Math.max(0, now - new Date(started_at).getTime());
    }

    function duration_class(ms: number): string {
        const minutes = ms / 60_000;
        if (minutes > 15) return 'duration-danger';
        if (minutes >= 5) return 'duration-warning';
        return 'duration-muted';
    }
</script>

<div class="agent-grid">
    {#each agents as agent (agent.id)}
        {@const is_manager = agent.agent_type === 'manager'}
        <div class="agent-card" class:running={agent.status === 'running'} class:failed={agent.status === 'failed'}>
            <div class="agent-header">
                <div class="agent-info">
                    <span class="icon agent-icon">{is_manager ? 'assignment' : 'build'}</span>
                    <div>
                        <span class="agent-type">{agent.agent_type}</span>
                        <span class="agent-id">{agent.id.slice(0, 8)}{agent.model ? ` · ${agent.model}` : ''}</span>
                    </div>
                </div>
                <Badge
                    variant={agent.status === 'running'
                        ? 'info'
                        : agent.status === 'completed'
                            ? 'success'
                            : agent.status === 'failed'
                                ? 'danger'
                                : 'muted'}>{agent.status}</Badge
                >
            </div>

            {#if is_manager && agent.feature_id}
                <nav class="breadcrumb" aria-label="Agent context">
                    <a href={resolve('/projects')} class="breadcrumb-link">
                        <span class="icon" style="font-size:14px">folder</span> Projects
                    </a>
                    <span class="breadcrumb-sep">/</span>
                    <span class="breadcrumb-item" title={agent.feature_id}>Feature {agent.feature_id.slice(0, 8)}</span>
                </nav>
            {:else if !is_manager && agent.task_id}
                <nav class="breadcrumb" aria-label="Agent context">
                    <a href={resolve('/projects')} class="breadcrumb-link">
                        <span class="icon" style="font-size:14px">folder</span> Projects
                    </a>
                    <span class="breadcrumb-sep">/</span>
                    <span class="breadcrumb-item">Feature</span>
                    <span class="breadcrumb-sep">/</span>
                    <span class="breadcrumb-item" title={agent.task_id}>Task {agent.task_id.slice(0, 8)}</span>
                </nav>
            {/if}

            <div class="agent-times">
                <span><span class="icon" style="font-size:14px">schedule</span> Started: {new Date(agent.started_at ?? '').toLocaleTimeString()}</span>
                {#if agent.status === 'running' && agent.started_at}
                    {@const ms = elapsed_ms(agent.started_at)}
                    <span class={duration_class(ms)}>
                        <span class="icon" style="font-size:14px">timer</span> Running for {format_duration(ms)}
                    </span>
                {:else if agent.finished_at}
                    <span><span class="icon" style="font-size:14px">flag</span> Finished: {new Date(agent.finished_at).toLocaleTimeString()}</span>
                {/if}
            </div>

            <div class="agent-actions">
                <Button variant="secondary" size="sm" onclick={() => on_view_log(agent.id)}>
                    <span class="icon" style="font-size:14px">description</span> Log
                </Button>
            </div>
        </div>
    {/each}
</div>

<style>
    .agent-grid { display: flex; flex-direction: column; gap: 0.75rem; }
    .agent-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; }
    .agent-card.running { border-color: rgba(106, 168, 254, 0.4); }
    .agent-card.failed { border-color: rgba(201, 84, 74, 0.4); }
    .agent-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem; }
    .agent-info { display: flex; align-items: center; gap: 0.6rem; }
    .agent-icon { font-size: 24px; color: var(--accent); }
    .agent-type { display: block; font-weight: 600; color: var(--fg); text-transform: capitalize; font-size: 0.9rem; }
    .agent-id { display: block; font-size: 0.7rem; color: var(--fg-muted); font-family: monospace; }
    .breadcrumb { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: var(--fg-muted); margin-bottom: 0.5rem; }
    .breadcrumb-link { display: inline-flex; align-items: center; gap: 0.2rem; color: var(--accent); text-decoration: none; }
    .breadcrumb-link:hover { text-decoration: underline; }
    .breadcrumb-sep { color: var(--fg-muted); opacity: 0.5; }
    .breadcrumb-item { font-family: monospace; }
    .agent-times { font-size: 0.8rem; color: var(--fg-muted); display: flex; gap: 1.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .agent-times span { display: inline-flex; align-items: center; gap: 0.25rem; }
    .duration-muted { color: var(--fg-muted); }
    .duration-warning { color: #e6a23c; font-weight: 600; }
    .duration-danger { color: var(--danger); font-weight: 700; }
    .agent-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
</style>
