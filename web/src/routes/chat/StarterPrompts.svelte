<script lang="ts">
    let { on_select }: {
        on_select: (text: string) => void
    } = $props();

    const prompts = [
        { icon: 'lightbulb', text: 'Help me design a new feature' },
        { icon: 'architecture', text: 'Explain the current project architecture' },
        { icon: 'bug_report', text: 'Write tests for the auth module' }
    ];
</script>

<div class="starter-prompts">
    {#each prompts as prompt (prompt.text)}
        <button type="button" class="starter-btn" onclick={() => on_select(prompt.text)}>
            <span class="icon" style="font-size: 18px">{prompt.icon}</span>
            <span>{prompt.text}</span>
        </button>
    {/each}
</div>

<style>
    .starter-prompts {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.5rem;
        width: 100%;
        max-width: 340px;
    }

    .starter-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        padding: 0.6rem 0.85rem;
        cursor: pointer;
        font-size: 0.8rem;
        font-family: var(--font);
        text-align: left;
        transition: background 150ms, border-color 150ms;
    }
    .starter-btn:hover {
        background: var(--accent-dim);
        border-color: var(--accent);
    }
    .starter-btn .icon { color: var(--accent); }
</style>
