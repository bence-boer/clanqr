<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';

    interface Props extends Omit<HTMLInputAttributes, 'type' | 'class'> {
        checked?: boolean
        class?: string
    }

    let {
        checked = $bindable(false),
        class: class_name = '',
        onchange,
        ...rest_props
    }: Props = $props();
</script>

<input
    type="checkbox"
    {checked}
    onchange={(e) => {
        checked = e.currentTarget.checked;
        if (onchange) onchange(e);
    }}
    class={['custom-checkbox', class_name].filter(Boolean).join(' ')}
    {...rest_props}
/>

<style>
    .custom-checkbox {
        appearance: none;
        -webkit-appearance: none;
        width: 1.125rem;
        height: 1.125rem;
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) * 0.5);
        background: var(--bg-surface);
        display: inline-block;
        vertical-align: middle;
        position: relative;
        cursor: pointer;
        transition: all 0.15s ease;
        margin: 0;
        flex-shrink: 0;
    }

    .custom-checkbox:hover {
        border-color: var(--fg-muted);
    }

    .custom-checkbox:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }

    .custom-checkbox:checked {
        background: var(--accent);
        border-color: var(--accent);
    }

    .custom-checkbox:checked::after {
        content: "";
        position: absolute;
        width: 4px;
        height: 8px;
        border: solid var(--bg);
        border-width: 0 2px 2px 0;
        top: 2px;
        left: 5px;
        transform: rotate(45deg);
    }

    .custom-checkbox:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
