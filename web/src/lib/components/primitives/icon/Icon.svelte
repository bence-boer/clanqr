<script lang="ts">
    import type { MaterialSymbol } from '$lib/types';
    import type { HTMLAttributes } from 'svelte/elements';

    export type IconProperties = HTMLAttributes<HTMLSpanElement> & {
        ref?: HTMLSpanElement | null
        type: MaterialSymbol
        size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    };

    let {
        ref = $bindable(null),
        type,
        size = 'md',
        class: class_name,
        ...rest_props
    }: IconProperties = $props();

    const size_classes: Record<Required<IconProperties>['size'], string> = {
        xs: 'size-xs',
        sm: 'size-sm',
        md: 'size-md',
        lg: 'size-lg',
        xl: 'size-xl'
    };
</script>

<span data-slot="icon" class={['icon', class_name, (type === 'progress_activity' ? 'spin' : ''), size_classes[size]].filter(Boolean).join(' ')} {...rest_props}>{type}</span>

<style>
    .icon {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        font-size: 20px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .icon.spin {
        animation: spin 1s linear infinite;
    }

    .icon.size-xs {
        font-size: 0.5rem;
    }

    .icon.size-sm {
        font-size: 0.75rem;
    }

    .icon.size-md {
        font-size: 1rem;
    }

    .icon.size-lg {
        font-size: 1.5rem;
    }

    .icon.size-xl {
        font-size: 2rem;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
