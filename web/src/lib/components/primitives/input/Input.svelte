<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';
    import { Label, type LabelProperties } from '../label';
    import { generate_id } from '$lib/utils/id';

    export type InputProperties = HTMLInputAttributes & {
        ref?: HTMLInputElement | null
        label?: string
        required?: LabelProperties['required']
    };

    let {
        ref = $bindable(null),
        value = $bindable(),
        class: class_name,
        label,
        id,
        required,
        type = 'text',
        ...rest_props
    }: InputProperties = $props();

    const fallback_id = `input-${generate_id().slice(0, 8)}`;
    const input_id = $derived(id || fallback_id);
</script>

<div class="input">
    {#if label}
        <Label for={input_id} required={Boolean(required)}>
            {label}
        </Label>
    {/if}

    <input
        {...rest_props}
        {type}
        {required}
        id={input_id}
        data-slot="input"
        bind:this={ref}
        bind:value
        class={['base-input', class_name].filter(Boolean).join(' ')}
    />
</div>

<style>
    .input {
        display: flex;
        flex-direction: column;
    }

    .base-input {
        background-color: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        color: var(--fg);
        font-family: var(--font, inherit);
        font-size: 0.875rem;
        padding: 0.5rem 0.75rem;
        width: 100%;
        outline: none;
        transition: border-color 0.15s;
    }

    .base-input:focus:not(:focus-visible) {
        outline: none;
    }

    .base-input:focus-visible {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.25);
    }

    .base-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
