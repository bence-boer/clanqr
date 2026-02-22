<script lang="ts">
  import type { Trait } from '$lib/types';
  import { api } from '$lib/api/client';

  interface TraitForm {
    name: string;
    description: string;
    target: 'manager' | 'ralph';
    is_global: boolean;
    content: string;
  }

  interface Props {
    traits: Trait[];
    on_updated: () => void;
  }

  let { traits, on_updated }: Props = $props();

  let trait_filter = $state<'all' | 'manager' | 'ralph'>('all');
  let filtered_traits = $derived(
    trait_filter === 'all' ? traits : traits.filter(trait => trait.target === trait_filter)
  );

  const default_trait_form = (): TraitForm => ({
    name: '',
    description: '',
    target: 'ralph',
    is_global: false,
    content: '',
  });

  let show_form = $state(false);
  let editing_id = $state<string | null>(null);
  let form = $state<TraitForm>(default_trait_form());
  let form_saving = $state(false);
  let form_error = $state('');
  let delete_confirm_id = $state<string | null>(null);
  let deleting_id = $state<string | null>(null);
  let list_error = $state('');

  export function open_new_form() {
    editing_id = null;
    form = default_trait_form();
    form_error = '';
    show_form = true;
  }

  function open_edit_form(trait: Trait) {
    editing_id = trait.id;
    form = {
      name: trait.name,
      description: trait.description ?? '',
      target: trait.target,
      is_global: trait.is_global,
      content: trait.content,
    };
    form_error = '';
    show_form = true;
  }

  function close_form() {
    show_form = false;
    editing_id = null;
    form = default_trait_form();
    form_error = '';
  }

  async function save_trait() {
    if (!form.name.trim()) {
      form_error = 'Name is required';
      return;
    }
    if (!form.content.trim()) {
      form_error = 'Content is required';
      return;
    }
    form_saving = true;
    form_error = '';
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        target: form.target,
        is_global: form.is_global,
        content: form.content,
      };
      if (editing_id) {
        await api.update_trait(editing_id, data);
      } else {
        await api.create_trait(data as any);
      }
      close_form();
      on_updated();
    } catch (err: any) {
      form_error = err.message ?? 'Save failed';
    } finally {
      form_saving = false;
    }
  }

  async function delete_trait(id: string) {
    deleting_id = id;
    try {
      await api.delete_trait(id);
      delete_confirm_id = null;
      on_updated();
    } catch (err: any) {
      list_error = err.message ?? 'Delete failed';
    } finally {
      deleting_id = null;
    }
  }

  function truncate(text: string | null, max_len = 80): string {
    if (!text) return '';
    return text.length > max_len ? text.slice(0, max_len) + '…' : text;
  }
</script>

<div class="filter-bar">
  {#each (['all', 'manager', 'ralph'] as const) as filter_val}
    <button
      class="filter-btn"
      class:active={trait_filter === filter_val}
      onclick={() => { trait_filter = filter_val; }}
    >
      {filter_val === 'all' ? 'All' : filter_val === 'manager' ? 'Manager' : 'Ralph'}
    </button>
  {/each}
  <span class="filter-count">
    {filtered_traits.length} trait{filtered_traits.length !== 1 ? 's' : ''}
  </span>
</div>

{#if show_form}
  <div class="trait-form-panel">
    <div class="trait-form-header">
      <h3>
        <span class="icon" style="font-size:18px">
          {editing_id ? 'edit' : 'add_circle'}
        </span>
        {editing_id ? 'Edit Trait' : 'New Trait'}
      </h3>
      <button class="icon-btn" onclick={close_form} aria-label="Close form">
        <span class="icon">close</span>
      </button>
    </div>

    <div class="trait-form-body">
      <div class="form-row">
        <div class="form-field">
          <label for="trait-name">Name <span class="required">*</span></label>
          <input id="trait-name" type="text" class="form-input" bind:value={form.name} placeholder="e.g. verbose_logging" />
        </div>
        <div class="form-field">
          <label for="trait-target">Target <span class="required">*</span></label>
          <select id="trait-target" class="form-input" bind:value={form.target}>
            <option value="ralph">Ralph</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>

      <div class="form-field">
        <label for="trait-desc">Description</label>
        <input id="trait-desc" type="text" class="form-input" bind:value={form.description} placeholder="Short description of this trait…" />
      </div>

      <div class="form-field">
        <label for="trait-content">Content <span class="required">*</span></label>
        <textarea id="trait-content" class="form-input form-textarea" bind:value={form.content} rows={6} placeholder="The prompt text injected by this trait…"></textarea>
      </div>

      <div class="form-toggle-row">
        <label class="toggle-label">
          <button
            type="button"
            class="toggle-btn"
            class:active={form.is_global}
            onclick={() => { form.is_global = !form.is_global; }}
            role="switch"
            aria-checked={form.is_global}
            aria-label="Toggle global trait"
          >
            <span class="toggle-thumb"></span>
          </button>
          <span>
            Global trait
            <span class="form-hint">(applied to all tasks automatically)</span>
          </span>
        </label>
      </div>

      {#if form_error}
        <div class="form-error">
          <span class="icon" style="font-size:15px">error</span>
          {form_error}
        </div>
      {/if}

      <div class="form-actions">
        <button class="btn btn-primary" onclick={save_trait} disabled={form_saving}>
          <span class="icon" style="font-size:16px" class:spin={form_saving}>
            {form_saving ? 'progress_activity' : 'save'}
          </span>
          {form_saving ? 'Saving…' : editing_id ? 'Update Trait' : 'Create Trait'}
        </button>
        <button class="btn btn-secondary" onclick={close_form} disabled={form_saving}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

{#if list_error}
  <div class="error-state">
    <span class="icon">error</span>
    {list_error}
  </div>
{/if}

{#if filtered_traits.length === 0}
  <div class="empty-state">
    <span class="icon empty-icon">psychology</span>
    <p>{trait_filter === 'all' ? 'No traits yet.' : `No ${trait_filter} traits.`}</p>
    <p class="hint">Create a trait to extend agent behaviour on specific tasks.</p>
  </div>
{:else}
  <div class="traits-list">
    {#each filtered_traits as trait (trait.id)}
      <div class="trait-row">
        <div class="trait-main">
          <div class="trait-header-row">
            <span class="trait-name">{trait.name}</span>
            <div class="trait-badges">
              <span class="badge badge-target badge-{trait.target}">{trait.target}</span>
              {#if trait.is_global}
                <span class="badge badge-global">global</span>
              {/if}
            </div>
          </div>
          {#if trait.description}
            <p class="trait-desc">{truncate(trait.description)}</p>
          {/if}
          <p class="trait-preview">{truncate(trait.content, 120)}</p>
        </div>

        <div class="trait-actions">
          {#if delete_confirm_id === trait.id}
            <span class="confirm-text">Delete?</span>
            <button class="btn btn-danger btn-sm" onclick={() => delete_trait(trait.id)} disabled={deleting_id === trait.id}>
              {deleting_id === trait.id ? '…' : 'Yes'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick={() => { delete_confirm_id = null; }}>No</button>
          {:else}
            <button class="btn btn-secondary btn-sm" onclick={() => open_edit_form(trait)}>
              <span class="icon" style="font-size:14px">edit</span> Edit
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick={() => { delete_confirm_id = trait.id; }} aria-label="Delete {trait.name}">
              <span class="icon" style="font-size:14px">delete</span>
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .filter-bar {
    display: flex; align-items: center; gap: 0.5rem;
    margin-bottom: 1.25rem; flex-wrap: wrap;
  }

  .filter-btn {
    padding: 0.35rem 0.85rem; background: var(--bg-elevated);
    border: 1px solid var(--border); border-radius: 20px;
    color: var(--fg-muted); font-size: 0.8rem; font-weight: 500;
    cursor: pointer; font-family: var(--font); transition: all 0.15s;
  }
  .filter-btn:hover { color: var(--fg); }
  .filter-btn.active {
    background: var(--accent-dim); border-color: rgba(212, 175, 55, 0.4); color: var(--accent);
  }
  .filter-count { margin-left: auto; font-size: 0.8rem; color: var(--fg-muted); }

  .trait-form-panel {
    background: var(--bg-surface); border: 1px solid var(--accent);
    border-radius: var(--radius); margin-bottom: 1.25rem; overflow: hidden;
  }

  .trait-form-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.85rem 1.25rem; background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
  }
  .trait-form-header h3 {
    font-size: 0.9rem; font-weight: 600; color: var(--fg);
    display: flex; align-items: center; gap: 0.4rem;
  }

  .icon-btn {
    background: none; border: none; cursor: pointer;
    color: var(--fg-muted); padding: 0.25rem; border-radius: var(--radius);
    transition: color 0.15s; display: flex; align-items: center;
  }
  .icon-btn:hover { color: var(--fg); }

  .trait-form-body {
    padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem;
  }

  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
  .form-field { display: flex; flex-direction: column; gap: 0.35rem; }
  .form-field label {
    font-size: 0.75rem; font-weight: 600; color: var(--fg-muted);
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .required { color: var(--danger); }

  .form-input {
    width: 100%; padding: 0.55rem 0.75rem; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--fg); font-size: 0.875rem; font-family: var(--font);
    transition: border-color 0.15s; outline: none;
  }
  .form-input:focus { border-color: var(--accent); }
  .form-textarea {
    resize: vertical; font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.8rem; line-height: 1.6;
  }
  select.form-input {
    cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%239e978a' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2.25rem;
  }

  .form-toggle-row { display: flex; align-items: center; }
  .toggle-label {
    display: flex; align-items: center; gap: 0.65rem;
    font-size: 0.875rem; color: var(--fg); cursor: pointer; user-select: none;
  }
  .form-hint { color: var(--fg-muted); font-size: 0.8rem; }

  .toggle-btn {
    width: 36px; height: 20px; background: var(--bg-elevated);
    border: 1px solid var(--border); border-radius: 20px;
    cursor: pointer; transition: background 0.2s, border-color 0.2s;
    position: relative; flex-shrink: 0;
  }
  .toggle-btn.active { background: var(--accent); border-color: var(--accent); }
  .toggle-thumb {
    position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
    background: var(--fg-muted); border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }
  .toggle-btn.active .toggle-thumb { transform: translateX(16px); background: var(--bg); }

  .form-error {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.82rem; color: var(--danger);
  }
  .form-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; padding-top: 0.25rem; }

  .traits-list {
    overflow-x: hidden; display: flex; flex-direction: column; gap: 0.5rem;
  }

  .trait-row {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.85rem 1.1rem; transition: border-color 0.15s;
    flex-wrap: wrap; max-width: 100%; overflow: hidden; box-sizing: border-box;
  }
  .trait-row:hover { border-color: var(--bg-elevated); }

  .trait-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .trait-header-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .trait-name {
    font-weight: 600; color: var(--fg); font-size: 0.875rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }
  .trait-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }

  .badge {
    font-size: 0.62rem; padding: 0.15rem 0.45rem; border-radius: 10px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;
  }
  .badge-target.badge-manager { background: rgba(106, 168, 254, 0.15); color: #6ea8fe; }
  .badge-target.badge-ralph { background: rgba(212, 175, 55, 0.15); color: var(--accent); }
  .badge-global { background: rgba(74, 158, 110, 0.15); color: var(--success); }

  .trait-desc { font-size: 0.82rem; color: var(--fg-muted); }
  .trait-preview {
    font-size: 0.75rem; color: var(--fg-muted); opacity: 0.55;
    font-family: 'SF Mono', 'Fira Code', monospace;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .trait-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
  .confirm-text { font-size: 0.8rem; color: var(--danger); font-weight: 600; white-space: nowrap; }

  .empty-state {
    text-align: center; padding: 3rem; color: var(--fg-muted);
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  }
  .empty-icon { font-size: 48px; color: var(--fg-muted); }
  .hint { font-size: 0.85rem; opacity: 0.7; }

  .error-state {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 2rem; color: var(--danger); font-size: 0.9rem;
  }

  .btn {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.5rem 1rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: var(--bg); }
  .btn-primary:hover:not(:disabled) { opacity: 0.9; }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); }
  .btn-secondary:hover:not(:disabled) { opacity: 0.85; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover:not(:disabled) { opacity: 0.9; }
  .btn-danger-outline {
    background: transparent; color: var(--danger);
    border: 1px solid rgba(201, 84, 74, 0.35);
  }
  .btn-danger-outline:hover:not(:disabled) { background: rgba(201, 84, 74, 0.1); }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 768px) {
    .form-row { grid-template-columns: 1fr; }
    .filter-bar { flex-direction: column; align-items: stretch; }
    .filter-count { margin-left: 0; width: 100%; }
    .trait-row { flex-direction: column; align-items: flex-start; }
    .trait-actions { align-self: flex-end; flex-wrap: wrap; }
  }
</style>
