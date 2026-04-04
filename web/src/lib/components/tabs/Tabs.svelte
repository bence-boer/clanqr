/**
 * Tabs component — renders a `role="tablist"` bar.
 *
 * Consumers should render the corresponding tab content inside a container with
 * `role="tabpanel"` to complete the accessible tabs pattern.
 */
<script lang="ts" generics="ValueType">
    import { Icon } from '../primitives';
    import type { TabsProperties } from './types';

    let {
        ref = $bindable(null),
        class: class_name,
        items,
        value = $bindable<ValueType>(),
        aria_label = 'Tabs',
        on_tab_select,
        ...rest_props
    }: TabsProperties<ValueType> = $props();

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
                if (on_tab_select) on_tab_select(value);
            }}
        >
            {#if item.icon}
                <Icon type={item.icon} />
            {/if}
            {item.label}
        </button>
    {/each}
</div>

<style>
    .tabs {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
    }

    .tabs::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 1px;
        background-color: var(--border);
        z-index: -1;
    }

    .tab-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;

        padding: calc(0.75rem - 1px) 0.75rem calc(0.75rem + 1px);
        border: 0;
        background: transparent;
        color: var(--fg-muted);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.15s ease;
        white-space: nowrap;
    }

    .tab-button::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background-color: transparent;
        transition: background-color 0.15s ease;
    }

    .tab-button:hover {
        color: var(--fg);
    }

    .tab-button.selected {
        color: var(--accent);
    }

    .tab-button.selected::after {
        background-color: var(--accent);
    }
</style>
