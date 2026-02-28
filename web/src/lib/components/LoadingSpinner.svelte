<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
  }

  const { size = 'md', label = 'Loading...' }: Props = $props();
</script>

<div class="spinner-wrap spinner-{size}" role="status" aria-label={label}>
  <span class="icon spin">progress_activity</span>
  {#if size !== 'sm'}
    <span class="spinner-label">{label}</span>
  {/if}
</div>

<style>
  .spinner-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
  }

  .spinner-sm .icon { font-size: 16px; }
  .spinner-md .icon { font-size: 20px; }
  .spinner-lg .icon { font-size: 32px; }

  .spinner-label {
    font-size: 14px;
  }
</style>
