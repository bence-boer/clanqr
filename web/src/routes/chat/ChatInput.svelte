<script lang="ts">
    import { Button, Textarea } from '$lib/components/primitives';
    let {
        input_text = $bindable(''),
        is_streaming,
        onsend,
        onstop
    }: {
        input_text: string
        is_streaming: boolean
        onsend: () => void
        onstop?: () => void
    } = $props();

    function handle_key_down(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onsend();
        }
    }
</script>

<div class="input-area">
    <Textarea
        class="message-input"
        bind:value={input_text}
        placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
        disabled={is_streaming}
        onkeydown={handle_key_down}
        rows={3}
    />
    {#if is_streaming && onstop}
        <Button variant="danger" size="icon" onclick={onstop} title="Stop generating" icon="stop" />
    {:else}
        <Button
            variant="primary"
            size="icon"
            onclick={onsend}
            disabled={!input_text.trim() || is_streaming}
            loading={is_streaming}
            icon={is_streaming ? undefined : 'send'}
        />
    {/if}
</div>

<style>
    .input-area {
        display: flex;
        gap: 0.75rem;
        padding: 0.75rem;
        border-top: 1px solid var(--border);
        flex-shrink: 0;
    }

    :global(.message-input) {
        flex: 1;
        font-size: 0.875rem;
        resize: none;
    }

    @media (max-width: 768px) {
        .input-area {
            padding-bottom: env(safe-area-inset-bottom, 0.75rem);
        }
    }
</style>
