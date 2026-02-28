<script lang="ts">
    import { api } from '$lib/api/client';
    import { CodeBlock, EmptyState, ErrorBanner, LoadingSpinner, StatCard } from '$lib/components';
    import { Badge, Button } from '$lib/components/primitives';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { use_polling } from '$lib/utils/polling.svelte';

    let agent_status = $state<Record<string, any>>({});
    let selected_log = $state<string | null>(null);
    let log_content = $state('');
    let loading = $state(true);
    let stopping = $state(false);

    async function load_status() {
        try {
            agent_status = await api.agent_status();
            polling.mark_success();
        } catch (error) {
            console.error('Failed to load agent status:', error);
            toast_store.error('Failed to load agent status');
        } finally {
            loading = false;
        }
    }

    const polling = use_polling(load_status, 3000);

    async function view_log(task_id: string) {
        selected_log = task_id;
        try {
            const result = await api.agent_log(task_id);
            log_content = result.log || 'No log output yet.';
        } catch (err) {
            console.error('Failed to load log:', err);
            toast_store.error('Failed to load log');
            log_content = 'Failed to load log.';
        }
    }

    async function stop_all() {
        stopping = true;
        try {
            await api.stop_all_agents();
            await load_status();
        } catch (error) {
            console.error('Failed to stop agents:', error);
            toast_store.error('Failed to stop agents');
        } finally {
            stopping = false;
        }
    }

    async function stop_agent(task_id: string) {
        try {
            await api.stop_agent(task_id);
            await load_status();
        } catch (error) {
            console.error('Failed to stop agent:', error);
            toast_store.error('Failed to stop agent');
        }
    }

    let entries = $derived(Object.entries(agent_status));
    let running_count = $derived(entries.filter(([_, a]) => a.status === 'running').length);
    let completed_count = $derived(entries.filter(([_, a]) => a.status === 'completed').length);
    let failed_count = $derived(entries.filter(([_, a]) => a.status === 'failed').length);
</script>

<div class="page" aria-busy={loading}>
    <div class="page-header">
        <h2>Agent Monitoring</h2>
        {#if running_count > 0}
            <Button variant="danger" onclick={stop_all} disabled={stopping}>
                <span class="icon">stop_circle</span>
                {stopping ? 'Stopping...' : 'Stop All'}
            </Button>
        {/if}
    </div>

    {#if polling.is_stale}
        <ErrorBanner variant="stale" message="Data may be outdated — unable to reach server" />
    {/if}

    <div class="stats">
        <StatCard icon="play_circle" value={running_count} label="Running" />
        <StatCard icon="check_circle" value={completed_count} label="Completed" />
        <StatCard icon="error" value={failed_count} label="Failed" />
    </div>

    {#if loading}
        <LoadingSpinner label="Loading agent status..." />
    {:else if entries.length === 0}
        <EmptyState icon="smart_toy" message="No agent processes yet." detail="Submit a feature to trigger the Manager agent, or approve tasks to trigger Ralph agents." />
    {:else}
        <div class="agent-grid">
            {#each entries as [id, agent]}
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
                        <span><span class="icon" style="font-size:14px">schedule</span> Started: {new Date(agent.started_at).toLocaleTimeString()}</span>
                        {#if agent.finished_at}
                            <span><span class="icon" style="font-size:14px">flag</span> Finished: {new Date(agent.finished_at).toLocaleTimeString()}</span>
                        {/if}
                    </div>

                    <div class="agent-actions">
                        <Button variant="secondary" size="sm" onclick={() => view_log(id)}>
                            <span class="icon" style="font-size:14px">description</span> Log
                        </Button>
                        {#if agent.status === 'running'}
                            <Button variant="danger" size="sm" onclick={() => stop_agent(id)}>
                                <span class="icon" style="font-size:14px">stop</span> Stop
                            </Button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if selected_log}
        <div class="log-panel">
            <div class="log-header">
                <h3><span class="icon" style="font-size:16px">terminal</span> Log: {selected_log.slice(0, 8)}...</h3>
                <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => {
                        selected_log = null;
                        log_content = '';
                    }}
                >
                    <span class="icon" style="font-size:14px">close</span> Close
                </Button>
            </div>
            <CodeBlock content={log_content} max_height="500px" />
        </div>
    {/if}
</div>

<style>
    .page {
        max-width: 1000px;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    .page-header h2 {
        font-size: 1.5rem;
        color: var(--fg);
    }

    .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin-bottom: 2rem;
    }

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

    .log-panel {
        margin-top: 1.5rem;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
    }

    .log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
    }
    .log-header h3 {
        font-size: 0.85rem;
        color: var(--fg);
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    @media (max-width: 768px) {
        .stats {
            grid-template-columns: 1fr;
        }
    }
</style>
