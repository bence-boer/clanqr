<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api/client';
  import { auth_store } from '$lib/stores/auth.svelte';
  import type { User, InviteToken } from '$lib/types';
  import UserTable from './UserTable.svelte';
  import InviteForm from './InviteForm.svelte';
  import InviteTable from './InviteTable.svelte';

  // ── Auth ────────────────────────────────────────────────────────────────────
  let self_id = $derived(auth_store.passkey_id);

  // Redirect non-admin users
  $effect(() => {
    if (auth_store.role !== null && auth_store.role !== 'admin') {
      goto('/');
    }
  });

  // ── Tabs ────────────────────────────────────────────────────────────────────
  let active_tab: 'users' | 'invites' = $state('users');

  // ── Users tab ───────────────────────────────────────────────────────────────
  let users: User[] = $state([]);
  let users_loading = $state(true);
  let users_error = $state('');

  let admin_count = $derived(users.filter(u => u.role === 'admin').length);

  async function load_users() {
    users_loading = true;
    users_error = '';
    try {
      users = await api.list_users();
    } catch (err: any) {
      users_error = err.message;
    } finally {
      users_loading = false;
    }
  }

  async function toggle_role(user: User) {
    const new_role = user.role === 'admin' ? 'user' : 'admin';
    const prev_role = user.role;

    // Optimistic update
    users = users.map(u => u.id === user.id ? { ...u, role: new_role } : u);

    try {
      await api.update_user_role(user.id, new_role);
    } catch (err: any) {
      // Rollback
      users = users.map(u => u.id === user.id ? { ...u, role: prev_role } : u);
      users_error = err.message;
      throw err;
    }
  }

  async function delete_user(user_id: string) {
    try {
      await api.delete_user(user_id);
      users = users.filter(u => u.id !== user_id);
    } catch (err: any) {
      users_error = err.message;
      throw err;
    }
  }

  // ── Invites tab ─────────────────────────────────────────────────────────────
  let invites: InviteToken[] = $state([]);
  let invites_loading = $state(true);

  async function load_invites() {
    invites_loading = true;
    try {
      invites = await api.list_invites();
    } catch (err: any) {
      // Errors handled by subcomponents
    } finally {
      invites_loading = false;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  onMount(() => {
    load_users();
    load_invites();
  });
</script>

<div class="page">
  <div class="page-header">
    <h2>Admin</h2>
  </div>

  <div class="tabs">
    <button class="tab" class:active={active_tab === 'users'} onclick={() => active_tab = 'users'}>
      <span class="icon">group</span>
      Users
    </button>
    <button class="tab" class:active={active_tab === 'invites'} onclick={() => active_tab = 'invites'}>
      <span class="icon">link</span>
      Invite Links
    </button>
  </div>

  {#if active_tab === 'users'}
    <UserTable
      {users}
      {users_loading}
      {users_error}
      {self_id}
      {admin_count}
      ontoggle_role={toggle_role}
      ondelete_user={delete_user}
    />
  {/if}

  {#if active_tab === 'invites'}
    <div class="tab-content">
      <InviteForm oninvite_created={load_invites} />
      <InviteTable bind:invites {invites_loading} />
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1000px; overflow-x: hidden; }

  .page-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
  }
  .page-header h2 { font-size: 1.5rem; color: var(--fg); }

  /* Tabs */
  .tabs {
    display: flex; gap: 0.25rem; margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .tab {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.6rem 1rem; background: none; border: none;
    border-bottom: 2px solid transparent; color: var(--fg-muted);
    font-size: 0.9rem; font-weight: 500; cursor: pointer;
    transition: all 0.15s; font-family: var(--font); margin-bottom: -1px;
  }
  .tab:hover { color: var(--fg); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  /* Mobile */
  @media (max-width: 768px) {
    .tabs { overflow-x: auto; }
  }
</style>
