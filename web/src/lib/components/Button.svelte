<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'icon';
    size?: 'sm' | 'md';
    children?: Snippet;
  }

  let {
    variant = 'secondary',
    size = 'md',
    children,
    class: class_name,
    ...rest_props
  }: Props = $props();

  const base = 'btn';
  let variant_class = $derived(variant === 'danger-outline' ? 'btn-danger-outline' : `btn-${variant}`);
  let size_class = $derived(size === 'sm' ? 'btn-sm' : '');
</script>

<button class="{base} {variant_class} {size_class} {class_name ?? ''}" {...rest_props}>
  {#if children}
    {@render children()}
  {/if}
</button>
