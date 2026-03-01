<script lang="ts">
    import { CodeBlock } from '$lib/components';
    import { Button } from '$lib/components/primitives';

    let {
        selected_log,
        log_content,
        on_close
    }: {
        selected_log: string
        log_content: string
        on_close: () => void
    } = $props();
</script>

<div class="log-panel">
    <div class="log-header">
        <h3><span class="icon" style="font-size:16px">terminal</span> Log: {selected_log.slice(0, 8)}...</h3>
        <Button variant="secondary" size="sm" onclick={on_close}>
            <span class="icon" style="font-size:14px">close</span> Close
        </Button>
    </div>
    <CodeBlock content={log_content} max_height="500px" />
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
    .log-header h3 {
        font-size: 0.85rem;
        color: var(--fg);
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
</style>
