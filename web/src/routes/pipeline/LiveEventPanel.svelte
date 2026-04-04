<script lang="ts">
    import { telemetry_api, type StructuredLogEntry } from '$lib/api/telemetry-client';
    import { onMount } from 'svelte';
    import SessionEvents from '../monitoring/SessionEvents.svelte';

    let {
        sdk_session_id,
        visible
    }: {
        sdk_session_id: string | null | undefined
        visible: boolean
    } = $props();

    let entries = $state<StructuredLogEntry[]>([]);
    let event_source: EventSource | null = null;
    let poll_index = $state(0);

    function connect_stream(sdk_sid: string) {
        disconnect_stream();
        entries = [];
        poll_index = 0;
        event_source = telemetry_api.create_session_stream(sdk_sid);
        event_source.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                entries = [...entries, {
                    index: entries.length,
                    type: data.type ?? 'unknown',
                    timestamp: data.timestamp ?? new Date().toISOString(),
                    data: data.data ?? data
                }];
            }
            catch {
                // skip parse errors
            }
        };
        event_source.onerror = () => {
            start_polling(sdk_sid);
        };
    }

    function disconnect_stream() {
        event_source?.close();
        event_source = null;
    }

    function start_polling(sdk_sid: string) {
        disconnect_stream();
        const id = setInterval(async () => {
            try {
                const result = await telemetry_api.session_logs(sdk_sid, poll_index);
                if (result.entries.length > 0) {
                    entries = [...entries, ...result.entries];
                    poll_index = entries.length;
                }
            }
            catch {
                // ignore polling errors
            }
        }, 3000);
        return () => clearInterval(id);
    }

    $effect(() => {
        if (visible && sdk_session_id) {
            connect_stream(sdk_session_id);
        }
        else {
            disconnect_stream();
        }
        return () => disconnect_stream();
    });

    onMount(() => () => disconnect_stream());
</script>

{#if visible}
    <div class="log-panel">
        <div class="log-toolbar">
            <span class="log-label">
                <span class="live-dot"></span> Live Events ({entries.length})
            </span>
        </div>
        <div class="log-scroll">
            <SessionEvents {entries} is_live={true} />
        </div>
    </div>
{/if}

<style>
    .log-panel {
        margin-top: 0.85rem; border: 1px solid var(--border);
        border-radius: var(--radius); overflow: hidden;
    }
    .log-toolbar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.4rem 0.75rem; background: var(--bg-elevated);
        border-bottom: 1px solid var(--border);
    }
    .log-label {
        font-size: 0.75rem; color: var(--fg-muted); font-weight: 600;
        display: flex; align-items: center; gap: 0.4rem;
    }
    .log-scroll {
        max-height: 400px; overflow-y: auto; padding: 0.5rem 0.75rem;
    }
    .live-dot {
        display: inline-block; width: 8px; height: 8px; border-radius: 50%;
        background: var(--success); animation: pulse-dot 1.5s ease-in-out infinite;
    }
    @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }
</style>
