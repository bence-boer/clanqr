<script lang="ts">
  import { api } from '$lib/api/client';
  import type { PromptRecord, Trait } from '$lib/types';

  // ── Tab state ──────────────────────────────────────────────────────────────
  let active_tab = $state<'prompts' | 'traits'>('prompts');

  // ── Prompts state ──────────────────────────────────────────────────────────
  let prompts = $state<PromptRecord[]>([]);
  let prompts_loading = $state(true);
  let prompts_error = $state('');
  let syncing = $state(false);
  let sync_message = $state('');

  // Per-role edit state
  interface PromptEditState {
    editing: boolean;
    content: string;
    saving: boolean;
  }
  let edit_state = $state<Record<string, PromptEditState>>({});

  async function load_prompts() {
    try {
      prompts_error = '';
      const result = await api.list_prompts();
      prompts = result;
      for (const prompt of result) {
        if (!edit_state[prompt.role]) {
          edit_state[prompt.role] = { editing: false, content: prompt.content, saving: false };
        }
      }
    } catch (err: any) {
      prompts_error = err.message ?? 'Failed to load prompts';
    } finally {
      prompts_loading = false;
    }
  }

  async function sync_from_repo() {
    syncing = true;
    sync_message = '';
    try {
      await api.sync_prompts();
      sync_message = 'Synced successfully';
      await load_prompts();
      for (const prompt of prompts) {
        edit_state[prompt.role] = { editing: false, content: prompt.content, saving: false };
      }
    } catch (err: any) {
      sync_message = err.message ?? 'Sync failed';
    } finally {
      syncing = false;
      setTimeout(() => { sync_message = ''; }, 3000);
    }
  }

  function start_edit(role: string, current_content: string) {
    edit_state[role] = { editing: true, content: current_content, saving: false };
  }

  function cancel_edit(role: string, original_content: string) {
    edit_state[role] = { editing: false, content: original_content, saving: false };
  }

  async function save_prompt(role: string) {
    const state = edit_state[role];
    if (!state) return;
    state.saving = true;
    try {
      const updated = await api.update_prompt(role, state.content);
      prompts = prompts.map(prompt => prompt.role === role ? updated : prompt);
      edit_state[role] = { editing: false, content: updated.content, saving: false };
    } catch (err: any) {
      state.saving = false;
    }
  }

  function format_date(date_string: string): string {
    return new Date(date_string).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Traits state ──────────────────────────────────────────────────────────
  let traits = $state<Trait[]>([]);
  let traits_loading = $state(true);
  let traits_error = $state('');
  let trait_filter = $state<'all' | 'manager' | 'ralph'>('all');

  let filtered_traits = $derived(
    trait_filter === 'all' ? traits : traits.filter(trait => trait.target === trait_filter)
  );

  interface TraitForm {
    name: string;
    description: string;
    target: 'manager' | 'ralph';
    is_global: boolean;
    content: string;
  }

  const default_trait_form = (): TraitForm => ({
    name: '',
    description: '',
    target: 'ralph',
    is_global: false,
    content: '',
  });

  let show_trait_form = $state(false);
  let editing_trait_id = $state<string | null>(null);
  let trait_form = $state<TraitForm>(default_trait_form());
  let trait_form_saving = $state(false);
  let trait_form_error = $state('');
  let delete_confirm_id = $state<string | null>(null);
  let deleting_id = $state<string | null>(null);

  async function load_traits() {
    try {
      traits_error = '';
      traits = await api.list_traits();
    } catch (err: any) {
      traits_error = err.message ?? 'Failed to load traits';
    } finally {
      traits_loading = false;
    }
  }

  function open_new_trait_form() {
    editing_trait_id = null;
    trait_form = default_trait_form();
    trait_form_error = '';
    show_trait_form = true;
  }

  function open_edit_trait_form(trait: Trait) {
    editing_trait_id = trait.id;
    trait_form = {
      name: trait.name,
      description: trait.description ?? '',
      target: trait.target,
      is_global: trait.is_global,
      content: trait.content,
    };
    trait_form_error = '';
    show_trait_form = true;
  }

  function close_trait_form() {
    show_trait_form = false;
    editing_trait_id = null;
    trait_form = default_trait_form();
    trait_form_error = '';
  }

  async function save_trait() {
    if (!trait_form.name.trim()) {
      trait_form_error = 'Name is required';
      return;
    }
    if (!trait_form.content.trim()) {
      trait_form_error = 'Content is required';
      return;
    }
    trait_form_saving = true;
    trait_form_error = '';
    try {
      const data = {
        name: trait_form.name.trim(),
        description: trait_form.description.trim() || null,
        target: trait_form.target,
        is_global: trait_form.is_global,
        content: trait_form.content,
      };
      if (editing_trait_id) {
        const updated = await api.update_trait(editing_trait_id, data);
        traits = traits.map(trait => trait.id === editing_trait_id ? updated : trait);
      } else {
        const created = await api.create_trait(data as any);
        traits = [created, ...traits];
      }
      close_trait_form();
    } catch (err: any) {
      trait_form_error = err.message ?? 'Save failed';
    } finally {
      trait_form_saving = false;
    }
  }

  async function delete_trait(id: string) {
    deleting_id = id;
    try {
      await api.delete_trait(id);
      traits = traits.filter(trait => trait.id !== id);
      delete_confirm_id = null;
    } catch (err: any) {
      traits_error = err.message ?? 'Delete failed';
    } finally {
      deleting_id = null;
    }
  }

  function truncate(text: string | null, max_len = 80): string {
    if (!text) return '';
    return text.length > max_len ? text.slice(0, max_len) + '…' : text;
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  $effect(() => {
    load_prompts();
    load_traits();
  });
</script>

<div class="page">
  <div class="page-header">
    <h2><span class="icon">tune</span> Prompts &amp; Traits</h2>
    {#if active_tab === 'prompts'}
      <button class="btn btn-secondary" onclick={sync_from_repo} disabled={syncing}>
        <span class="icon" class:spin={syncing}>
          {syncing ? 'progress_activity' : 'sync'}
        </span>
        {syncing ? 'Syncing…' : 'Sync from Repo'}
      </button>
    {:else}
      <button class="btn btn-primary" onclick={open_new_trait_form}>
        <span class="icon">add</span>
        New Trait
      </button>
    {/if}
  </div>

  {#if sync_message}
    <div class="toast" class:toast-success={sync_message.includes('success')}>
      <span class="icon" style="font-size:16px">
        {sync_message.includes('success') ? 'check_circle' : 'error'}
      </span>
      {sync_message}
    </div>
  {/if}

  <div class="tabs">
    <button
      class="tab-btn"
      class:active={active_tab === 'prompts'}
      onclick={() => { active_tab = 'prompts'; }}
    >
      <span class="icon">description</span>
      Base Prompts
    </button>
    <button
      class="tab-btn"
      class:active={active_tab === 'traits'}
      onclick={() => { active_tab = 'traits'; }}
    >
      <span class="icon">psychology</span>
      Traits Library
      {#if traits.length > 0}
        <span class="count-badge">{traits.length}</span>
      {/if}
    </button>
  </div>

  <!-- ── Tab 1: Base Prompts ──────────────────────────────────────────────── -->
  {#if active_tab === 'prompts'}
    {#if prompts_loading}
      <div class="loading-state">
        <span class="icon spin">progress_activity</span>
        Loading prompts…
      </div>
    {:else if prompts_error}
      <div class="error-state">
        <span class="icon">error</span>
        {prompts_error}
      </div>
    {:else if prompts.length === 0}
      <div class="empty-state">
        <span class="icon empty-icon">description</span>
        <p>No prompts found.</p>
        <p class="hint">Click "Sync from Repo" to load prompts from the agents/prompts/ directory.</p>
      </div>
    {:else}
      <div class="prompts-grid">
        {#each prompts as prompt (prompt.role)}
          {@const role_state = edit_state[prompt.role]}
          <div class="prompt-card" class:editing={role_state?.editing}>
            <div class="prompt-card-header">
              <div class="prompt-role-info">
                <span class="icon role-icon">
                  {prompt.role === 'manager' ? 'assignment' : 'build'}
                </span>
                <div>
                  <h3 class="prompt-role">
                    {prompt.role === 'manager' ? 'Manager' : 'Ralph'} Prompt
                  </h3>
                  <span class="prompt-meta">
                    v{prompt.version} · Updated {format_date(prompt.updated_at)}
                  </span>
                </div>
              </div>
              {#if !role_state?.editing}
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => start_edit(prompt.role, prompt.content)}
                >
                  <span class="icon" style="font-size:16px">edit</span>
                  Edit
                </button>
              {/if}
            </div>

            <textarea
              class="prompt-textarea"
              class:editable={role_state?.editing}
              readonly={!role_state?.editing}
              value={role_state?.content ?? prompt.content}
              oninput={(event) => {
                if (role_state) role_state.content = (event.target as HTMLTextAreaElement).value;
              }}
              rows={18}
            ></textarea>

            {#if role_state?.editing}
              <div class="prompt-actions">
                <button
                  class="btn btn-primary"
                  onclick={() => save_prompt(prompt.role)}
                  disabled={role_state.saving}
                >
                  <span class="icon" style="font-size:16px" class:spin={role_state.saving}>
                    {role_state.saving ? 'progress_activity' : 'save'}
                  </span>
                  {role_state.saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  class="btn btn-secondary"
                  onclick={() => cancel_edit(prompt.role, prompt.content)}
                  disabled={role_state.saving}
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- ── Tab 2: Traits Library ────────────────────────────────────────────── -->
  {#if active_tab === 'traits'}
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

    {#if show_trait_form}
      <div class="trait-form-panel">
        <div class="trait-form-header">
          <h3>
            <span class="icon" style="font-size:18px">
              {editing_trait_id ? 'edit' : 'add_circle'}
            </span>
            {editing_trait_id ? 'Edit Trait' : 'New Trait'}
          </h3>
          <button class="icon-btn" onclick={close_trait_form} aria-label="Close form">
            <span class="icon">close</span>
          </button>
        </div>

        <div class="trait-form-body">
          <div class="form-row">
            <div class="form-field">
              <label for="trait-name">
                Name <span class="required">*</span>
              </label>
              <input
                id="trait-name"
                type="text"
                class="form-input"
                bind:value={trait_form.name}
                placeholder="e.g. verbose_logging"
              />
            </div>
            <div class="form-field">
              <label for="trait-target">
                Target <span class="required">*</span>
              </label>
              <select id="trait-target" class="form-input" bind:value={trait_form.target}>
                <option value="ralph">Ralph</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          <div class="form-field">
            <label for="trait-desc">Description</label>
            <input
              id="trait-desc"
              type="text"
              class="form-input"
              bind:value={trait_form.description}
              placeholder="Short description of this trait…"
            />
          </div>

          <div class="form-field">
            <label for="trait-content">
              Content <span class="required">*</span>
            </label>
            <textarea
              id="trait-content"
              class="form-input form-textarea"
              bind:value={trait_form.content}
              rows={6}
              placeholder="The prompt text injected by this trait…"
            ></textarea>
          </div>

          <div class="form-toggle-row">
            <label class="toggle-label">
              <button
                type="button"
                class="toggle-btn"
                class:active={trait_form.is_global}
                onclick={() => { trait_form.is_global = !trait_form.is_global; }}
                role="switch"
                aria-checked={trait_form.is_global}
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

          {#if trait_form_error}
            <div class="form-error">
              <span class="icon" style="font-size:15px">error</span>
              {trait_form_error}
            </div>
          {/if}

          <div class="form-actions">
            <button
              class="btn btn-primary"
              onclick={save_trait}
              disabled={trait_form_saving}
            >
              <span class="icon" style="font-size:16px" class:spin={trait_form_saving}>
                {trait_form_saving ? 'progress_activity' : 'save'}
              </span>
              {trait_form_saving ? 'Saving…' : editing_trait_id ? 'Update Trait' : 'Create Trait'}
            </button>
            <button
              class="btn btn-secondary"
              onclick={close_trait_form}
              disabled={trait_form_saving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if traits_loading}
      <div class="loading-state">
        <span class="icon spin">progress_activity</span>
        Loading traits…
      </div>
    {:else if traits_error}
      <div class="error-state">
        <span class="icon">error</span>
        {traits_error}
      </div>
    {:else if filtered_traits.length === 0}
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
                <button
                  class="btn btn-danger btn-sm"
                  onclick={() => delete_trait(trait.id)}
                  disabled={deleting_id === trait.id}
                >
                  {deleting_id === trait.id ? '…' : 'Yes'}
                </button>
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => { delete_confirm_id = null; }}
                >
                  No
                </button>
              {:else}
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => open_edit_trait_form(trait)}
                >
                  <span class="icon" style="font-size:14px">edit</span>
                  Edit
                </button>
                <button
                  class="btn btn-danger-outline btn-sm"
                  onclick={() => { delete_confirm_id = trait.id; }}
                  aria-label="Delete {trait.name}"
                >
                  <span class="icon" style="font-size:14px">delete</span>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  /* ── Page layout ──────────────────────────────────────────────────────────── */
  .page {
    max-width: 1100px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .page-header h2 {
    font-size: 1.5rem;
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── Buttons ─────────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--radius);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font);
  }

  .btn-primary {
    background: var(--accent);
    color: var(--bg);
  }

  .btn-primary:hover:not(:disabled) { opacity: 0.9; }

  .btn-secondary {
    background: var(--bg-elevated);
    color: var(--fg);
  }

  .btn-secondary:hover:not(:disabled) { opacity: 0.85; }

  .btn-danger {
    background: var(--danger);
    color: #fff;
  }

  .btn-danger:hover:not(:disabled) { opacity: 0.9; }

  .btn-danger-outline {
    background: transparent;
    color: var(--danger);
    border: 1px solid rgba(201, 84, 74, 0.35);
  }

  .btn-danger-outline:hover:not(:disabled) {
    background: rgba(201, 84, 74, 0.1);
  }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--fg-muted);
    padding: 0.25rem;
    border-radius: var(--radius);
    transition: color 0.15s;
    display: flex;
    align-items: center;
  }

  .icon-btn:hover { color: var(--fg); }

  /* ── Toast ───────────────────────────────────────────────────────────────── */
  .toast {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    background: rgba(201, 84, 74, 0.15);
    color: var(--danger);
    border: 1px solid rgba(201, 84, 74, 0.3);
    border-radius: var(--radius);
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }

  .toast-success {
    background: rgba(74, 158, 110, 0.15);
    color: var(--success);
    border-color: rgba(74, 158, 110, 0.3);
  }

  /* ── Tabs ────────────────────────────────────────────────────────────────── */
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 1.5rem;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 1.1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--fg-muted);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font);
    transition: all 0.15s;
    margin-bottom: -1px;
  }

  .tab-btn:hover { color: var(--fg); }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .count-badge {
    background: var(--bg-elevated);
    color: var(--fg-muted);
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-weight: 600;
  }

  /* ── States ──────────────────────────────────────────────────────────────── */
  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--fg-muted);
    font-size: 0.9rem;
  }

  .error-state { color: var(--danger); }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--fg-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .empty-icon {
    font-size: 48px;
    color: var(--fg-muted);
  }

  .hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  /* ── Prompts grid ────────────────────────────────────────────────────────── */
  .prompts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .prompt-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: border-color 0.15s;
  }

  .prompt-card.editing {
    border-color: var(--accent);
  }

  .prompt-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .prompt-role-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .role-icon {
    font-size: 24px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .prompt-role {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg);
    margin-bottom: 0.15rem;
  }

  .prompt-meta {
    font-size: 0.75rem;
    color: var(--fg-muted);
  }

  .prompt-textarea {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg-muted);
    font-size: 0.78rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    line-height: 1.6;
    padding: 0.75rem;
    resize: vertical;
    transition: border-color 0.15s, color 0.15s;
    outline: none;
  }

  .prompt-textarea.editable {
    border-color: var(--accent);
    color: var(--fg);
    background: var(--bg-elevated);
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.12);
  }

  .prompt-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  /* ── Traits ──────────────────────────────────────────────────────────────── */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 0.35rem 0.85rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--fg-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font);
    transition: all 0.15s;
  }

  .filter-btn:hover { color: var(--fg); }

  .filter-btn.active {
    background: var(--accent-dim);
    border-color: rgba(212, 175, 55, 0.4);
    color: var(--accent);
  }

  .filter-count {
    margin-left: auto;
    font-size: 0.8rem;
    color: var(--fg-muted);
  }

  /* ── Trait form ──────────────────────────────────────────────────────────── */
  .trait-form-panel {
    background: var(--bg-surface);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    margin-bottom: 1.25rem;
    overflow: hidden;
  }

  .trait-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 1.25rem;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
  }

  .trait-form-header h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .trait-form-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .required { color: var(--danger); }

  .form-input {
    width: 100%;
    padding: 0.55rem 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.875rem;
    font-family: var(--font);
    transition: border-color 0.15s;
    outline: none;
  }

  .form-input:focus { border-color: var(--accent); }

  .form-textarea {
    resize: vertical;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.8rem;
    line-height: 1.6;
  }

  select.form-input {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%239e978a' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2.25rem;
  }

  .form-toggle-row {
    display: flex;
    align-items: center;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-size: 0.875rem;
    color: var(--fg);
    cursor: pointer;
    user-select: none;
  }

  .form-hint {
    color: var(--fg-muted);
    font-size: 0.8rem;
  }

  .toggle-btn {
    width: 36px;
    height: 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 20px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    position: relative;
    flex-shrink: 0;
  }

  .toggle-btn.active {
    background: var(--accent);
    border-color: var(--accent);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--fg-muted);
    border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-btn.active .toggle-thumb {
    transform: translateX(16px);
    background: var(--bg);
  }

  .form-error {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--danger);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-top: 0.25rem;
  }

  /* ── Traits list ─────────────────────────────────────────────────────────── */
  .traits-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .trait-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.85rem 1.1rem;
    transition: border-color 0.15s;
    flex-wrap: wrap;
  }

  .trait-row:hover {
    border-color: var(--bg-elevated);
  }

  .trait-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .trait-header-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .trait-name {
    font-weight: 600;
    color: var(--fg);
    font-size: 0.875rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .trait-badges {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .badge {
    font-size: 0.62rem;
    padding: 0.15rem 0.45rem;
    border-radius: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .badge-target.badge-manager {
    background: rgba(106, 168, 254, 0.15);
    color: #6ea8fe;
  }

  .badge-target.badge-ralph {
    background: rgba(212, 175, 55, 0.15);
    color: var(--accent);
  }

  .badge-global {
    background: rgba(74, 158, 110, 0.15);
    color: var(--success);
  }

  .trait-desc {
    font-size: 0.82rem;
    color: var(--fg-muted);
  }

  .trait-preview {
    font-size: 0.75rem;
    color: var(--fg-muted);
    opacity: 0.55;
    font-family: 'SF Mono', 'Fira Code', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trait-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .confirm-text {
    font-size: 0.8rem;
    color: var(--danger);
    font-weight: 600;
    white-space: nowrap;
  }

  /* ── Spin animation ──────────────────────────────────────────────────────── */
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .prompts-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .filter-count {
      margin-left: 0;
      width: 100%;
    }
  }
</style>
