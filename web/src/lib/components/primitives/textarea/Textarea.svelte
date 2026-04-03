<script lang="ts">
    import type { HTMLTextareaAttributes } from 'svelte/elements';
    import { Label } from '../label';
    import { generate_id } from '$lib/utils/id';

    export type TextareaProperties = HTMLTextareaAttributes & {
        ref?: HTMLTextAreaElement | null
        value?: unknown
        label?: string
        id?: string
        required?: boolean
    };

    let {
        ref = $bindable(null),
        value = $bindable(),
        class: class_name,
        label,
        id,
        required,
        ...rest_props
    }: TextareaProperties = $props();

    const fallback_id = `textarea-${generate_id().slice(0, 8)}`;
    const textarea_id = $derived(id || fallback_id);
</script>

<div class="textarea">
    {#if label}
        <Label for={textarea_id} {required}>
            {label}
        </Label>
    {/if}

    <textarea
        {...rest_props}
        {required}
        id={textarea_id}
        data-slot="textarea"
        bind:this={ref}
        bind:value
        class={['base-textarea', class_name].filter(Boolean).join(' ')}
    ></textarea>
</div>

<style>
    .textarea {
        display: flex;
        flex-direction: column;
    }

    .base-textarea {
        background-color: var(--bg, #fff);
        border: 1px solid var(--border, #ccc);
        border-radius: var(--radius, 4px);
        color: var(--fg, #333);
        font-family: var(--font, inherit);
        font-size: 0.875rem;
        padding: 0.5rem 0.75rem;
        width: 100%;
        outline: none;
        transition: border-color 0.15s;
        resize: vertical;
        min-height: 60px;
    }

    .base-textarea:focus:not(:focus-visible) {
        outline: none;
    }

    .base-textarea:focus-visible {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.25);
    }

    .base-textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
