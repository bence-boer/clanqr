<script lang="ts">
    import { Checkbox } from '$lib/components';

    interface CheckboxItem {
        key: string
        name: string
        description?: string | null
    }

    interface Props {
        items: CheckboxItem[]
        is_checked: (key: string) => boolean
        on_toggle: (key: string) => void
        empty_message: string
    }

    let { items, is_checked, on_toggle, empty_message }: Props = $props();
</script>

{#if items.length === 0}
    <p class="empty">{empty_message}</p>
{:else}
    {#each items as item (item.key)}
        <label class="artifact-check">
            <Checkbox checked={is_checked(item.key)} onchange={() => on_toggle(item.key)} />
            <span class="artifact-copy">
                <span class="artifact-name">{item.name}</span>
                {#if item.description}
                    <span class="artifact-desc">{item.description}</span>
                {/if}
            </span>
        </label>
    {/each}
{/if}

<style>
    .artifact-check {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        font-size: 0.8rem;
        color: var(--fg);
        padding: 0.55rem 0.65rem;
        cursor: pointer;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 2px);
    }
    .artifact-copy {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
        flex: 1;
    }
    .artifact-name {
        font-weight: 600;
        color: var(--fg);
    }
    .artifact-desc {
        color: var(--fg-muted);
        font-size: 0.75rem;
        line-height: 1.45;
    }
    .empty {
        color: var(--fg-muted);
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
</style>
