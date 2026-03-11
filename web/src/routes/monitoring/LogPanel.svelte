<script lang="ts">
    import { CodeBlock } from '$lib/components';
    import { Button } from '$lib/components/primitives';

    let {
        selected_log,
        log_content,
        agent_status,
        on_close,
        on_refresh
    }: {
        selected_log: string
        log_content: string
        agent_status: string | null
        on_close: () => void
        on_refresh: () => void
    } = $props();

    let scroll_container: HTMLDivElement | null = $state(null);
    let prev_content_length = $state(0);

    let is_live = $derived(agent_status === 'running');

    $effect(() => {
        if (!is_live) return;

        const interval = setInterval(() => { on_refresh(); }, 3000);
        return () => clearInterval(interval);
    });

    $effect(() => {
        if (log_content.length > prev_content_length && scroll_container) {
            requestAnimationFrame(() => {
                scroll_container?.scrollTo({ top: scroll_container.scrollHeight, behavior: 'smooth' });
            });
        }
        prev_content_length = log_content.length;
    });
</script>

<div class="log-panel">
    <div class="log-header">
        <div class="log-title">
            <h3><span class="icon" style="font-size:16px">terminal</span> Log: {selected_log.slice(0, 8)}...</h3>
            {#if is_live}
                <span class="live-indicator">
                    <span class="live-dot"></span>
                    Live
                </span>
            {/if}
        </div>
        <Button variant="secondary" size="sm" onclick={on_close}>
            <span class="icon" style="font-size:14px">close</span> Close
        </Button>
    </div>
    <div class="log-scroll-container" bind:this={scroll_container}>
        <CodeBlock content={log_content} max_height="500px" />
    </div>
</div>

<style>
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
    .log-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .log-header h3 {
        font-size: 0.85rem;
        color: var(--fg);
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .live-indicator {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--success);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--success);
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
    }

    .log-scroll-container {
        max-height: 500px;
        overflow-y: auto;
    }
</style>
