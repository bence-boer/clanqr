<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import { copy_to_clipboard } from '$lib/utils/clipboard';

    interface Props {
        content: string
        max_height?: string
        label?: string
    }

    const { content, max_height = '350px', label = 'Log' }: Props = $props();
</script>

<div class="code-block-wrapper">
    <div class="code-block-header">
        <Button
            variant="ghost"
            size="icon"
            icon="content_copy"
            onclick={() => copy_to_clipboard(content, label)}
            aria-label="Copy {label}"
        />
    </div>
    <pre class="code-block" style:max-height={max_height}>{content || '(no output yet)'}</pre>
</div>

<style>
    .code-block-wrapper {
        position: relative;
    }

    .code-block-header {
        position: absolute;
        top: 0.35rem;
        right: 0.35rem;
        z-index: 1;
        opacity: 0;
        transition: opacity 150ms ease;
    }

    .code-block-wrapper:hover .code-block-header {
        opacity: 1;
    }

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
