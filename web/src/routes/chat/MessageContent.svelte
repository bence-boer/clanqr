<script lang="ts">
    import '$lib/styles/hljs-dark.css';
    import { render_markdown } from '$lib/utils/markdown';

    let { content, role }: {
        content: string
        role: string
    } = $props();
</script>

{#if role === 'assistant'}
    <div class="message-content markdown-body">{@html render_markdown(content)}</div>
{:else}
    <p class="message-content">{content}</p>
{/if}

<style>
    .message-content {
        font-size: 0.875rem;
        color: var(--fg);
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
    }

    .markdown-body {
        white-space: normal;
    }
    .markdown-body :global(h1),
    .markdown-body :global(h2),
    .markdown-body :global(h3) {
        color: var(--fg);
        margin: 0.75rem 0 0.35rem;
        font-size: 1rem;
    }
    .markdown-body :global(h1) { font-size: 1.1rem; }
    .markdown-body :global(p) { margin: 0.25rem 0; }
    .markdown-body :global(code) {
        background: var(--bg);
        padding: 0.15rem 0.35rem;
        border-radius: 3px;
        font-size: 0.8rem;
    }
    .markdown-body :global(pre) {
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.75rem;
        overflow-x: auto;
        margin: 0.5rem 0;
    }
    .markdown-body :global(pre code) {
        background: none;
        padding: 0;
        white-space: pre;
    }
    .markdown-body :global(ul),
    .markdown-body :global(ol) {
        padding-left: 1.25rem;
        margin: 0.35rem 0;
    }
    .markdown-body :global(a) {
        color: var(--accent);
    }
    .markdown-body :global(blockquote) {
        border-left: 3px solid var(--border);
        padding-left: 0.75rem;
        color: var(--fg-muted);
        margin: 0.5rem 0;
    }
    .markdown-body :global(.code-block-wrapper) {
        position: relative;
    }
    .markdown-body :global(.copy-code-btn) {
        position: absolute;
        top: 0.35rem;
        right: 0.35rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--fg-muted);
        font-size: 0.7rem;
        padding: 0.2rem 0.5rem;
        cursor: pointer;
        opacity: 0;
        transition: opacity 150ms;
    }
    .markdown-body :global(.code-block-wrapper:hover .copy-code-btn) {
        opacity: 1;
    }
</style>
