<script lang="ts">
    import type { StructuredLogEntry } from '$lib/api/telemetry-client';
    import { format_time } from '$lib/utils/format';

    let { entries, is_live }: {
        entries: StructuredLogEntry[]
        is_live: boolean
    } = $props();

    let scroll_el: HTMLDivElement | null = $state(null);
    let prev_count = 0;

    $effect(() => {
        if (entries.length > prev_count && scroll_el) {
            requestAnimationFrame(() => {
                scroll_el?.scrollTo({ top: scroll_el.scrollHeight, behavior: 'smooth' });
            });
        }
        prev_count = entries.length;
    });

    function icon_for(type: string): string {
        if (type.startsWith('tool_')) return 'build';
        if (type.startsWith('agent_')) return 'smart_toy';
        if (type === 'usage') return 'data_usage';
        if (type === 'error' || type === 'warning') return 'warning';
        if (type === 'shutdown') return 'power_settings_new';
        if (type === 'session_start' || type === 'turn_start') return 'play_arrow';
        return 'info';
    }

    function color_for(type: string): string {
        if (type === 'error') return 'var(--danger)';
        if (type === 'warning') return '#e6a23c';
        if (type === 'tool_complete') return 'var(--success)';
        if (type === 'agent_output' || type === 'agent_message') return 'var(--accent)';
        if (type === 'usage') return 'var(--fg-muted)';
        return 'var(--fg-muted)';
    }

    function format_detail(entry: StructuredLogEntry): string {
        const d = entry.data;
        if (entry.type === 'tool_start') return String(d.tool_name ?? '');
        if (entry.type === 'tool_complete') {
            const name = String(d.tool_name ?? '');
            const ok = d.success !== false ? '✓' : '✗';
            return `${name} ${ok}`;
        }
        if (entry.type === 'agent_output' || entry.type === 'agent_message') {
            const text = String(d.text ?? d.content ?? '');
            return text.length > 200 ? text.slice(0, 200) + '…' : text;
        }
        if (entry.type === 'agent_intent') return String(d.intent ?? '');
        if (entry.type === 'usage') {
            const inp = Number(d.input_tokens ?? 0);
            const out = Number(d.output_tokens ?? 0);
            const model = d.model ? ` (${d.model})` : '';
            return `${inp.toLocaleString()} in / ${out.toLocaleString()} out${model}`;
        }
        if (entry.type === 'error' || entry.type === 'warning') {
            return String(d.message ?? d.text ?? '');
        }
        if (entry.type === 'shutdown') return `${d.shutdown_type ?? 'completed'}`;
        return '';
    }
</script>

<div class="events-feed" bind:this={scroll_el}>
    {#if entries.length === 0}
        <p class="empty">{is_live ? 'Waiting for events…' : 'No events recorded.'}</p>
    {:else}
        {#each entries as entry (entry.index)}
            {@const detail = format_detail(entry)}
            <div class="event-row">
                <span class="event-time">{format_time(entry.timestamp)}</span>
                <span class="event-icon icon" style="color:{color_for(entry.type)};font-size:14px">
                    {icon_for(entry.type)}
                </span>
                <span class="event-type">{entry.type}</span>
                {#if detail}
                    <span class="event-detail">{detail}</span>
                {/if}
            </div>
        {/each}
    {/if}
</div>

<style>
    .events-feed {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.8rem;
        font-family: var(--font-mono, monospace);
    }
    .empty {
        color: var(--fg-muted);
        font-style: italic;
        padding: 1rem 0;
    }
    .event-row {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 3px 0;
        border-bottom: 1px solid var(--border);
    }
    .event-row:last-child {
        border-bottom: none;
    }
    .event-time {
        color: var(--fg-muted);
        flex-shrink: 0;
        font-size: 0.7rem;
        min-width: 70px;
    }
    .event-icon {
        flex-shrink: 0;
    }
    .event-type {
        color: var(--fg);
        font-weight: 600;
        flex-shrink: 0;
        min-width: 90px;
    }
    .event-detail {
        color: var(--fg-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
    }
</style>
