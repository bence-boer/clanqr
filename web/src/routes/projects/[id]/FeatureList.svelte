<script lang="ts">
  import type { Feature } from '$lib/types';

  interface Props {
    features: Feature[];
    selected_feature: Feature | null;
    on_select: (feature: Feature) => void;
    on_delete_selected: (ids: Set<string>) => Promise<void>;
  }

  let { features, selected_feature, on_select, on_delete_selected }: Props = $props();

  let selected_ids = $state<Set<string>>(new Set());
  let deleting = $state(false);
  let all_selected = $derived(features.length > 0 && selected_ids.size === features.length);

  function toggle_select(id: string, event: MouseEvent) {
    event.stopPropagation();
    const next = new Set(selected_ids);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected_ids = next;
  }

  function toggle_all() {
    if (all_selected) {
      selected_ids = new Set();
    } else {
      selected_ids = new Set(features.map(f => f.id));
    }
  }

  async function delete_selected() {
    if (selected_ids.size === 0) return;
    if (!confirm(`Delete ${selected_ids.size} feature(s)?`)) return;
    deleting = true;
    try {
      await on_delete_selected(selected_ids);
      selected_ids = new Set();
    } finally {
      deleting = false;
    }
  }

  function status_icon(status: string): string {
    const map: Record<string, string> = {
      draft: 'edit_note', submitted: 'send', in_progress: 'sync', done: 'check_circle',
      pending_approval: 'pending', approved: 'thumb_up', complete: 'check_circle',
      failed: 'error', skipped: 'skip_next',
      pending: 'hourglass_empty', fetched: 'check', error: 'error',
    };
    return map[status.toLowerCase()] ?? 'help';
  }

  function status_class(status: string): string {
    const map: Record<string, string> = {
      draft: 'muted', submitted: 'info', in_progress: 'warn', done: 'success',
      pending_approval: 'warn', approved: 'info', complete: 'success',
      failed: 'danger', skipped: 'warn',
      pending: 'muted', fetched: 'success', error: 'danger',
    };
    return map[status.toLowerCase()] ?? 'muted';
  }
</script>

<div class="features-panel">
  <div class="features-panel-header">
    <h3><span class="icon" style="font-size:18px">category</span> Features ({features.length})</h3>
    <div class="features-panel-actions">
      {#if features.length > 0}
        <label class="select-all-label">
          <input type="checkbox" checked={all_selected} onchange={toggle_all} />
          All
        </label>
      {/if}
      {#if selected_ids.size > 0}
        <button class="btn btn-danger btn-sm" onclick={delete_selected} disabled={deleting}>
          <span class="icon" style="font-size:14px">delete</span> {selected_ids.size}
        </button>
      {/if}
    </div>
  </div>
  {#if features.length === 0}
    <p class="empty">No features yet.</p>
  {:else}
    {#each features as feature}
      <button
        class="feature-item"
        class:selected={selected_feature?.id === feature.id}
        onclick={() => on_select(feature)}
      >
        <div class="feature-item-header">
          <div class="feature-name-row">
            <input type="checkbox" checked={selected_ids.has(feature.id)} onclick={(e: MouseEvent) => toggle_select(feature.id, e)} />
            <span class="feature-name">{feature.title}</span>
          </div>
          <span class="badge badge-{status_class(feature.status)}">
            <span class="icon" style="font-size:12px">{status_icon(feature.status)}</span>
            {feature.status.replace('_', ' ')}
          </span>
        </div>
        <div class="feature-item-meta">
          <span class="icon" style="font-size:12px">task</span> {feature.tasks?.length ?? 0}
          <span class="icon" style="font-size:12px;margin-left:0.5rem">link</span> {feature.resources?.length ?? 0}
          <span class="badge badge-muted" style="margin-left:0.5rem; transform: scale(0.9)">{feature.cli || 'copilot'}</span>
          {#if feature.model}
            <span class="badge badge-info" style="margin-left:0.25rem; transform: scale(0.9)">{feature.model}</span>
          {/if}
        </div>
      </button>
    {/each}
  {/if}
</div>

<style>
  .features-panel {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1rem;
  }
  .features-panel h3 {
    font-size: 0.95rem; color: var(--fg); margin-bottom: 0;
    display: flex; align-items: center; gap: 0.4rem;
  }
  .features-panel-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;
  }
  .features-panel-actions {
    display: flex; align-items: center; gap: 0.5rem;
  }
  .select-all-label {
    display: flex; align-items: center; gap: 0.3rem;
    font-size: 0.75rem; color: var(--fg-muted); cursor: pointer;
  }
  .feature-name-row {
    display: flex; align-items: center; gap: 0.4rem;
  }
  .feature-item {
    display: block; width: 100%; text-align: left; background: transparent;
    border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem;
    margin-bottom: 0.5rem; cursor: pointer; color: inherit; transition: all 0.15s;
    font-family: var(--font); font-size: inherit;
  }
  .feature-item:hover { border-color: var(--accent); }
  .feature-item.selected { border-color: var(--accent); background: var(--bg); }
  .feature-item-header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .feature-name { font-weight: 600; color: var(--fg); font-size: 0.875rem; }
  .feature-item-meta {
    font-size: 0.7rem; color: var(--fg-muted); margin-top: 0.25rem;
    display: flex; align-items: center;
  }
  .btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.5rem 1rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; white-space: nowrap; font-family: var(--font);
  }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover { opacity: 0.9; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .badge {
    font-size: 0.65rem; font-weight: 600; text-transform: uppercase; white-space: nowrap;
    padding: 0.15rem 0.45rem; border-radius: 10px;
    display: inline-flex; align-items: center; gap: 0.2rem;
  }
  .badge-muted { background: var(--bg-elevated); color: var(--fg-muted); }
  .badge-info { background: rgba(106, 168, 254, 0.15); color: #6ea8fe; }
  .badge-warn { background: var(--accent-dim); color: var(--accent); }
  .badge-success { background: rgba(74, 158, 110, 0.15); color: var(--success); }
  .badge-danger { background: rgba(201, 84, 74, 0.15); color: var(--danger); }
  .empty {
    color: var(--fg-muted); font-size: 0.85rem;
    display: flex; align-items: center; gap: 0.5rem;
  }
</style>
