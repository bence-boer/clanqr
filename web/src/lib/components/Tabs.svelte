<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';

    interface TabItem {
        label: string
        value: string
    }

    interface Props extends HTMLAttributes<HTMLDivElement> {
        ref?: HTMLDivElement | null
        items: TabItem[]
        value?: string
        aria_label?: string
    }

    let {
        ref = $bindable(null),
        class: class_name,
        items,
        value = $bindable(''),
        aria_label = 'Tabs',
        ...rest_props
    }: Props = $props();

    $effect(() => {
        if (items.length === 0) return;
        if (items.some((item) => item.value === value)) return;
        value = items[0].value;
    });

    function focus_tab(index: number) {
        const tab_buttons = ref?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
        tab_buttons?.[index]?.focus();
    }

    function handle_keydown(event: KeyboardEvent, current_index: number) {
        if (items.length === 0) return;

        let next_index = current_index;

        if (event.key === 'ArrowRight') next_index = (current_index + 1) % items.length;
        else if (event.key === 'ArrowLeft') next_index = (current_index - 1 + items.length) % items.length;
        else if (event.key === 'Home') next_index = 0;
        else if (event.key === 'End') next_index = items.length - 1;
        else return;

        event.preventDefault();
        value = items[next_index].value;
        focus_tab(next_index);
    }
</script>

<div
    bind:this={ref}
    role="tablist"
    aria-label={aria_label}
    data-slot="tabs"
    class={['tabs', class_name].filter(Boolean).join(' ')}
    {...rest_props}
>
    {#each items as item, index (item.value)}
        <button
            type="button"
            role="tab"
            class="tab-button"
            class:selected={value === item.value}
            aria-selected={value === item.value}
            tabindex={value === item.value ? 0 : -1}
            onkeydown={(event) => {
                handle_keydown(event, index);
            }}
            onclick={() => {
                value = item.value;
            }}
        >
            {item.label}
        </button>
    {/each}
</div>

<style>
    .tabs {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
        scrollbar-width: thin;
    }

    .tab-button {
        padding: 0.75rem 0.65rem 0.6rem;
        margin-bottom: -1px;
        border: 0;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: var(--fg-muted);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition:
            color 0.15s ease,
            border-color 0.15s ease;
        white-space: nowrap;
    }

    .tab-button:hover {
        color: var(--fg);
    }

    .tab-button.selected {
        color: var(--accent);
        border-color: var(--accent);
    }
</style>
