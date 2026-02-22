<script lang="ts">
  interface ModelOption {
    value: string;
    label: string;
  }

  interface Props {
    models: ModelOption[];
    on_create: (data: { title: string; description?: string; model: string | null; resources: { url: string; title?: string }[] }) => Promise<void>;
    on_cancel: () => void;
  }

  let { models, on_create, on_cancel }: Props = $props();

  let title = $state('');
  let description = $state('');
  let model = $state('');
  let resources = $state<{ url: string; title: string }[]>([]);
  let creating = $state(false);

  function add_resource_field() {
    resources = [...resources, { url: '', title: '' }];
  }

  function remove_resource(index: number) {
    resources = resources.filter((_, i) => i !== index);
  }

  async function handle_submit() {
    if (!title.trim()) return;
    creating = true;
    try {
      const clean_resources = resources
        .filter(r => r.url.trim())
        .map(r => ({ url: r.url.trim(), title: r.title.trim() || undefined }));

      await on_create({
        title: title.trim(),
        description: description.trim() || undefined,
        model: model || null,
        resources: clean_resources,
      });
      title = '';
      description = '';
      model = '';
      resources = [];
    } finally {
      creating = false;
    }
  }
</script>

<form class="create-form" onsubmit={(e) => { e.preventDefault(); handle_submit(); }}>
  <input type="text" placeholder="Feature title" bind:value={title} class="input" required />
  <textarea placeholder="Description" bind:value={description} class="input textarea" rows="4"></textarea>
  <select bind:value={model} class="input select">
    {#each models as m}
      <option value={m.value}>{m.label}</option>
    {/each}
  </select>
  <div class="resources-section">
    <div class="resources-header">
      <span><span class="icon" style="font-size:16px">link</span> Resources</span>
      <button type="button" class="btn btn-sm btn-secondary" onclick={add_resource_field}>
        <span class="icon" style="font-size:14px">add</span> Add URL
      </button>
    </div>
    {#each resources as resource, index}
      <div class="resource-row">
        <input type="url" placeholder="https://..." bind:value={resource.url} class="input" />
        <input type="text" placeholder="Title" bind:value={resource.title} class="input input-title" />
        <button type="button" class="btn btn-danger btn-icon" onclick={() => remove_resource(index)}>
          <span class="icon" style="font-size:16px">close</span>
        </button>
      </div>
    {/each}
  </div>
  <div class="form-actions">
    <button type="button" class="btn btn-secondary" onclick={on_cancel}>Cancel</button>
    <button type="submit" class="btn btn-primary" disabled={creating || !title.trim()}>
      <span class="icon" style="font-size:16px">save</span>
      {creating ? 'Creating...' : 'Save Draft'}
    </button>
  </div>
</form>

<style>
  .create-form {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1.5rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .input {
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.6rem 0.8rem; color: var(--fg); font-size: 0.875rem; width: 100%;
    font-family: var(--font);
  }
  .input:focus { outline: none; border-color: var(--accent); }
  .textarea { resize: vertical; font-family: var(--font); }
  .input-title { max-width: 180px; }
  .resources-section { margin-top: 0.5rem; }
  .resources-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--fg-muted);
  }
  .resources-header span { display: inline-flex; align-items: center; gap: 0.3rem; }
  .resource-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
  .btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.5rem 1rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; white-space: nowrap; font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: var(--bg); }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); }
  .btn-secondary:hover { opacity: 0.85; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover { opacity: 0.9; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
  .btn-icon { padding: 0.35rem; min-width: 0; }
  .select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 0.6rem center; padding-right: 2rem;
  }
  @media (max-width: 768px) {
    .resource-row { flex-direction: column; }
    .input-title { max-width: 100%; }
  }
</style>
