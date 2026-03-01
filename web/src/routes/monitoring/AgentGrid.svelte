<script lang="ts">
    import { Badge, Button } from '$lib/components/primitives';

    interface AgentEntry {
        status: string
        type: string
        started_at: string | null
        finished_at?: string | null
    }

    let {
        entries,
        on_view_log,
        on_stop_agent
    }: {
        entries: [string, AgentEntry][]
        on_view_log: (id: string) => void
        on_stop_agent: (id: string) => void
    } = $props();
</script>

<div class="agent-grid">
    {#each entries as [id, agent] (id)}
        <div class="agent-card" class:running={agent.status === 'running'} class:failed={agent.status === 'failed'}>
            <div class="agent-header">
                <div class="agent-info">
                    <span class="icon agent-icon">{agent.type === 'manager' ? 'assignment' : 'build'}</span>
                    <div>
                        <span class="agent-type">{agent.type}</span>
                        <span class="agent-id">{id}</span>
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

            <div class="agent-times">
                <span><span class="icon" style="font-size:14px">schedule</span> Started: {new Date(agent.started_at ?? '').toLocaleTimeString()}</span>
                {#if agent.finished_at}
                    <span><span class="icon" style="font-size:14px">flag</span> Finished: {new Date(agent.finished_at).toLocaleTimeString()}</span>
                {/if}
            </div>

            <div class="agent-actions">
                <Button variant="secondary" size="sm" onclick={() => on_view_log(id)}>
                    <span class="icon" style="font-size:14px">description</span> Log
                </Button>
                {#if agent.status === 'running'}
                    <Button variant="danger" size="sm" onclick={() => on_stop_agent(id)}>
                        <span class="icon" style="font-size:14px">stop</span> Stop
                    </Button>
                {/if}
            </div>
        </div>
    {/each}
</div>

<style>
    .agent-grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .agent-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1rem;
    }
    .agent-card.running {
        border-color: rgba(106, 168, 254, 0.4);
    }
    .agent-card.failed {
        border-color: rgba(201, 84, 74, 0.4);
    }

    .agent-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .agent-info {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }
    .agent-icon {
        font-size: 24px;
        color: var(--accent);
    }
    .agent-type {
        display: block;
        font-weight: 600;
        color: var(--fg);
        text-transform: capitalize;
        font-size: 0.9rem;
    }
    .agent-id {
        display: block;
        font-size: 0.7rem;
        color: var(--fg-muted);
        font-family: monospace;
    }

    .agent-times {
        font-size: 0.8rem;
        color: var(--fg-muted);
        display: flex;
        gap: 1.5rem;
        margin-bottom: 0.5rem;
        flex-wrap: wrap;
    }
    .agent-times span {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }
    .agent-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
</style>
