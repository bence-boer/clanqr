<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import type { PromptRecord, Trait } from '$lib/types';
  import PromptList from './PromptList.svelte';
  import TraitList from './TraitList.svelte';

  // ── Tab state ──────────────────────────────────────────────────────────────
  let active_tab = $state<'prompts' | 'traits'>('prompts');

  // ── Prompts state ──────────────────────────────────────────────────────────
  let prompts = $state<PromptRecord[]>([]);
  let prompts_loading = $state(true);
  let prompts_error = $state('');
  let syncing = $state(false);
  let sync_message = $state('');

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

  // ── Traits state ──────────────────────────────────────────────────────────
  let traits = $state<Trait[]>([]);
  let traits_loading = $state(true);
  let traits_error = $state('');
  let trait_list_ref: TraitList | undefined = $state();

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

  // ── Initial load ──────────────────────────────────────────────────────────
  onMount(() => {
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
      <button class="btn btn-primary" onclick={() => trait_list_ref?.open_new_form()}>
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
    {:else}
      <PromptList {prompts} {edit_state} on_updated={load_prompts} />
    {/if}
  {/if}

  <!-- ── Tab 2: Traits Library ────────────────────────────────────────────── -->
  {#if active_tab === 'traits'}
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
    {:else}
      <TraitList bind:this={trait_list_ref} {traits} on_updated={load_traits} />
    {/if}
  {/if}
</div>

<style>
  .page { max-width: 1100px; }

  .page-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
  }
  .page-header h2 {
    font-size: 1.5rem; color: var(--fg);
    display: flex; align-items: center; gap: 0.5rem;
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
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .toast {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.65rem 1rem; background: rgba(201, 84, 74, 0.15);
    color: var(--danger); border: 1px solid rgba(201, 84, 74, 0.3);
    border-radius: var(--radius); font-size: 0.85rem; margin-bottom: 1rem;
  }
  .toast-success {
    background: rgba(74, 158, 110, 0.15); color: var(--success);
    border-color: rgba(74, 158, 110, 0.3);
  }

  .tabs {
    display: flex; gap: 0.25rem;
    border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;
  }
  .tab-btn {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.65rem 1.1rem; background: none; border: none;
    border-bottom: 2px solid transparent; color: var(--fg-muted);
    font-size: 0.875rem; font-weight: 500; cursor: pointer;
    font-family: var(--font); transition: all 0.15s; margin-bottom: -1px;
  }
  .tab-btn:hover { color: var(--fg); }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }

  .count-badge {
    background: var(--bg-elevated); color: var(--fg-muted);
    font-size: 0.65rem; padding: 0.1rem 0.4rem;
    border-radius: 10px; font-weight: 600;
  }

  .loading-state, .error-state {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 2rem; color: var(--fg-muted); font-size: 0.9rem;
  }
  .error-state { color: var(--danger); }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
