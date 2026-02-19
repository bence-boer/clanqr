<script lang="ts">
  interface Props {
    icon?: string;
    value: string | number;
    label: string;
    unit?: string;
  }

  const { icon, value, label, unit = '' }: Props = $props();
</script>

<div class="stat-card">
  {#if icon}
    <span class="icon stat-icon">{icon}</span>
  {/if}
  <div class="stat-content">
    <span class="stat-value">{value}{unit}</span>
    <span class="stat-label">{label}</span>
  </div>
</div>

<style>
  .stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .stat-icon {
    font-size: 24px;
    color: var(--text-muted);
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    line-height: 1;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
