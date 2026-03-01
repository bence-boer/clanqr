<script lang="ts">
    interface Props {
        content: string
        max_height?: string
    }

    const { content, max_height = '350px' }: Props = $props();
</script>

<pre class="code-block" style:max-height={max_height}>{content || '(no output yet)'}</pre>

<style>
    .code-block {
        background: var(--bg);
        padding: 0.85rem;
        border-radius: var(--radius);
        font-size: 0.75rem;
        color: var(--fg-muted);
        font-family: 'SF Mono', 'Fira Code', monospace;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-y: auto;
        margin: 0;
        border: 1px solid var(--border);
    }
</style>
