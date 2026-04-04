<script lang="ts">
    import type { AgentProcess } from '$lib/types';
    import { telemetry_api, type StructuredLogEntry } from '$lib/api/telemetry-client';
    import { Button } from '$lib/components/primitives';
    import { Tabs } from '$lib/components';
    import type { TabItem } from '$lib/components/tabs/types';
    import { onMount } from 'svelte';
    import SessionEvents from './SessionEvents.svelte';
    import SessionMetrics from './SessionMetrics.svelte';

    let { agent, on_close }: {
        agent: AgentProcess
        on_close: () => void
    } = $props();

    type TabValue = 'events' | 'metrics';
    let active_tab = $state<TabValue>('events');
    let entries = $state<StructuredLogEntry[]>([]);
    let event_source = $state<EventSource | null>(null);
    let last_index = $state(-1);

    const tabs: TabItem<TabValue>[] = [
        { label: 'Events', value: 'events', icon: 'list' },
        { label: 'Metrics', value: 'metrics', icon: 'analytics' }
    ];

    let is_live = $derived(agent.status === 'running');
    let sdk_id = $derived(agent.sdk_session_id ?? '');

    async function load_logs() {
        if (!sdk_id) return;
        try {
            const result = await telemetry_api.session_logs(sdk_id, last_index >= 0 ? last_index : undefined);
            if (result.entries.length > 0) {
                entries = [...entries, ...result.entries];
                last_index = result.entries[result.entries.length - 1].index;
            }
        }
        catch {
            /* session may not exist yet */
        }
    }

    function connect_sse() {
        if (!sdk_id || !is_live) return;
        const es = telemetry_api.create_session_stream(sdk_id);
        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                const entry: StructuredLogEntry = {
                    index: entries.length,
                    type: data.type ?? ev.type ?? 'unknown',
                    timestamp: data.timestamp ?? new Date().toISOString(),
                    data
                };
                entries = [...entries, entry];
            }
            catch {
                /* ignore parse errors */
            }
        };
        es.onerror = () => {
            es.close();
            event_source = null;
        };
        event_source = es;
    }

    onMount(() => {
        load_logs();
        if (is_live) connect_sse();

        const poll = !is_live ? null : setInterval(load_logs, 5000);
        return () => {
            event_source?.close();
            if (poll) clearInterval(poll);
        };
    });

    $effect(() => {
        if (!is_live && event_source) {
            event_source.close();
            event_source = null;
        }
    });
</script>

<div class="detail-panel">
    <div class="detail-header">
        <div class="header-left">
            <h3>
                <span class="icon" style="font-size:16px">
                    {agent.agent_type === 'manager' ? 'assignment' : 'build'}
                </span>
                {agent.agent_type} — {agent.id.slice(0, 8)}
            </h3>
            {#if is_live}
                <span class="live-badge"><span class="live-dot"></span> Live</span>
            {/if}
        </div>
        <Button variant="secondary" size="sm" onclick={on_close}>
            <span class="icon" style="font-size:14px">close</span>
        </Button>
    </div>

    <Tabs items={tabs} value={active_tab} ontabselect={(v) => active_tab = v} />

    <div class="detail-body">
        {#if active_tab === 'events'}
            <SessionEvents {entries} {is_live} />
        {:else}
            <SessionMetrics {entries} {agent} />
        {/if}
    </div>
</div>

<style>
    .detail-panel {
        margin-top: 1.5rem;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
    }
    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
    }
    .header-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .detail-header h3 {
        font-size: 0.85rem;
        color: var(--fg);
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0;
    }
    .live-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.65rem;
        font-weight: 600;
        color: var(--success);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--success);
        animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }
    .detail-body {
        max-height: 500px;
        overflow-y: auto;
        padding: 0.75rem 1rem;
    }
</style>
