<script lang="ts">
  import { getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api/client';
  import type { User, InviteToken } from '$lib/types';

  // ── Auth context ────────────────────────────────────────────────────────────
  const role_ctx = getContext<{ role: string | null }>('role');
  const passkey_ctx = getContext<{ passkey_id: string | null }>('passkey_id');
  let self_id = $derived(passkey_ctx?.passkey_id ?? null);

  // Redirect non-admin users
  $effect(() => {
    if (role_ctx?.role !== null && role_ctx?.role !== 'admin') {
      goto('/');
    }
  });

  // ── Tabs ────────────────────────────────────────────────────────────────────
  let active_tab: 'users' | 'invites' = $state('users');

  // ── Users tab ───────────────────────────────────────────────────────────────
  let users: User[] = $state([]);
  let users_loading = $state(true);
  let users_error = $state('');
  let confirm_delete: string | null = $state(null);
  let role_toggling: Set<string> = $state(new Set());
  let deleting: Set<string> = $state(new Set());

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
    role_toggling = new Set([...role_toggling, user.id]);

    try {
      await api.update_user_role(user.id, new_role);
    } catch (err: any) {
      // Rollback
      users = users.map(u => u.id === user.id ? { ...u, role: prev_role } : u);
      users_error = err.message;
    } finally {
      role_toggling = new Set([...role_toggling].filter(id => id !== user.id));
    }
  }

  async function delete_user(user_id: string) {
    deleting = new Set([...deleting, user_id]);
    try {
      await api.delete_user(user_id);
      users = users.filter(u => u.id !== user_id);
      confirm_delete = null;
    } catch (err: any) {
      users_error = err.message;
    } finally {
      deleting = new Set([...deleting].filter(id => id !== user_id));
    }
  }

  // ── Invites tab ─────────────────────────────────────────────────────────────
  let invites: InviteToken[] = $state([]);
  let invites_loading = $state(true);
  let invites_error = $state('');

  // Form state
  let invite_label = $state('');
  let invite_role: 'user' | 'admin' = $state('user');
  let expiry_mode: 'relative' | 'absolute' = $state('relative');
  let relative_minutes = $state(60);
  let absolute_datetime = $state('');
  let generating = $state(false);

  // Success panel
  let new_invite_url: string | null = $state(null);
  let copy_done = $state(false);

  let revoking: Set<string> = $state(new Set());

  async function load_invites() {
    invites_loading = true;
    invites_error = '';
    try {
      invites = await api.list_invites();
    } catch (err: any) {
      invites_error = err.message;
    } finally {
      invites_loading = false;
    }
  }

  function invite_status(inv: InviteToken): 'Active' | 'Expired' | 'Used' {
    if (inv.used_at) return 'Used';
    if (new Date(inv.expires_at) <= new Date()) return 'Expired';
    return 'Active';
  }

  function compute_expires_at(): string {
    if (expiry_mode === 'absolute') return new Date(absolute_datetime).toISOString();
    return new Date(Date.now() + relative_minutes * 60_000).toISOString();
  }

  async function generate_invite() {
    generating = true;
    invites_error = '';
    try {
      const expires_at = compute_expires_at();
      const result = await api.create_invite({
        role: invite_role,
        expires_at,
        label: invite_label.trim() || undefined,
      });
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      new_invite_url = `${base}/invite?token=${result.token}`;
      await load_invites();
    } catch (err: any) {
      invites_error = err.message;
    } finally {
      generating = false;
    }
  }

  async function copy_invite_url() {
    if (!new_invite_url) return;
    try {
      await navigator.clipboard.writeText(new_invite_url);
      copy_done = true;
      setTimeout(() => { copy_done = false; }, 2000);
    } catch {
      // clipboard not available
    }
  }

  async function revoke_invite(id: string) {
    revoking = new Set([...revoking, id]);
    try {
      await api.revoke_invite(id);
      invites = invites.filter(inv => inv.id !== id);
    } catch (err: any) {
      invites_error = err.message;
    } finally {
      revoking = new Set([...revoking].filter(i => i !== id));
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  $effect(() => {
    load_users();
    load_invites();
  });

  function format_date(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function format_datetime(iso: string) {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const RELATIVE_PRESETS = [
    { label: '1m', minutes: 1 },
    { label: '5m', minutes: 5 },
    { label: '30m', minutes: 30 },
    { label: '1h', minutes: 60 },
    { label: '3h', minutes: 180 },
    { label: '6h', minutes: 360 },
    { label: '12h', minutes: 720 },
    { label: '24h', minutes: 1440 },
  ];
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
    <div class="tab-content">
      {#if users_error}
        <div class="error-banner">{users_error}</div>
      {/if}

      {#if users_loading}
        <p class="loading"><span class="icon spin">progress_activity</span> Loading users...</p>
      {:else if users.length === 0}
        <div class="empty-state">
          <span class="icon" style="font-size:40px;color:var(--fg-muted)">group</span>
          <p>No users found.</p>
        </div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Role</th>
                <th>Registered</th>
                <th>Sessions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user (user.id)}
                <tr class:self-row={user.id === self_id}>
                  <td data-label="Name">
                    <span class="display-name">
                      {user.display_name ?? '(unnamed)'}
                      {#if user.id === self_id}
                        <span class="you-badge">you</span>
                      {/if}
                    </span>
                  </td>
                  <td data-label="Role">
                    <span class="role-badge role-{user.role}">{user.role}</span>
                  </td>
                  <td data-label="Registered" class="date-cell">{format_date(user.created_at)}</td>
                  <td data-label="Sessions" class="count-cell">{user.session_count}</td>
                  <td data-label="Actions">
                    <div class="row-actions">
                      {#if confirm_delete === user.id}
                        <span class="confirm-text">Are you sure?</span>
                        <button
                          class="btn btn-danger btn-sm"
                          onclick={() => delete_user(user.id)}
                          disabled={deleting.has(user.id)}
                        >
                          {deleting.has(user.id) ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick={() => confirm_delete = null}>
                          Cancel
                        </button>
                      {:else}
                        <button
                          class="btn btn-secondary btn-sm"
                          onclick={() => toggle_role(user)}
                          disabled={role_toggling.has(user.id) || user.id === self_id || (user.role === 'admin' && admin_count <= 1)}
                          title={user.id === self_id ? 'Cannot change your own role' : (user.role === 'admin' && admin_count <= 1) ? 'Cannot demote last admin' : ''}
                        >
                          {role_toggling.has(user.id) ? '...' : user.role === 'admin' ? 'Make User' : 'Make Admin'}
                        </button>
                        <button
                          class="btn btn-danger btn-sm"
                          onclick={() => confirm_delete = user.id}
                          disabled={user.id === self_id}
                          title={user.id === self_id ? 'Cannot revoke your own access' : ''}
                        >
                          Revoke Access
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}

  {#if active_tab === 'invites'}
    <div class="tab-content">
      {#if invites_error}
        <div class="error-banner">{invites_error}</div>
      {/if}

      <div class="invite-form-card">
        <h3>Generate Invite Link</h3>

        <div class="form-row">
          <div class="form-field">
            <label for="invite-label">Label <span class="optional">(optional)</span></label>
            <input id="invite-label" type="text" bind:value={invite_label} placeholder="e.g. For Alice" />
          </div>
          <div class="form-field">
            <label for="invite-role">Role</label>
            <select id="invite-role" bind:value={invite_role}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label>Expiry</label>
          <div class="expiry-tabs">
            <button
              class="expiry-tab"
              class:active={expiry_mode === 'relative'}
              onclick={() => expiry_mode = 'relative'}
            >Valid for</button>
            <button
              class="expiry-tab"
              class:active={expiry_mode === 'absolute'}
              onclick={() => expiry_mode = 'absolute'}
            >Valid until</button>
          </div>

          {#if expiry_mode === 'relative'}
            <div class="preset-buttons">
              {#each RELATIVE_PRESETS as preset}
                <button
                  class="preset-btn"
                  class:active={relative_minutes === preset.minutes}
                  onclick={() => relative_minutes = preset.minutes}
                >{preset.label}</button>
              {/each}
            </div>
          {:else}
            <input
              type="datetime-local"
              bind:value={absolute_datetime}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              max={new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 16)}
            />
          {/if}
        </div>

        <button
          class="btn btn-primary"
          onclick={generate_invite}
          disabled={generating || (expiry_mode === 'absolute' && !absolute_datetime)}
        >
          <span class="icon">add_link</span>
          {generating ? 'Generating...' : 'Generate Link'}
        </button>
      </div>

      {#if new_invite_url}
        <div class="invite-success">
          <div class="invite-success-header">
            <span class="icon" style="color:var(--success)">check_circle</span>
            <strong>Invite link created</strong>
            <button class="btn btn-sm btn-secondary" onclick={() => { new_invite_url = null; }}>
              <span class="icon" style="font-size:14px">close</span>
            </button>
          </div>
          <div class="invite-url-row">
            <code class="invite-url">{new_invite_url}</code>
            <button class="btn btn-sm btn-secondary" onclick={copy_invite_url}>
              <span class="icon" style="font-size:14px">{copy_done ? 'check' : 'content_copy'}</span>
              {copy_done ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <p class="invite-warning">
            <span class="icon" style="font-size:14px;color:var(--warning, #f59e0b)">warning</span>
            This link will not be shown again.
          </p>
        </div>
      {/if}

      <h3 class="section-title">Existing Invites</h3>
      {#if invites_loading}
        <p class="loading"><span class="icon spin">progress_activity</span> Loading invites...</p>
      {:else if invites.length === 0}
        <div class="empty-state">
          <span class="icon" style="font-size:40px;color:var(--fg-muted)">link_off</span>
          <p>No invite links yet.</p>
        </div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Role</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Used By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each invites as inv (inv.id)}
                {@const status = invite_status(inv)}
                <tr>
                  <td data-label="Label" class="label-cell">{inv.label ?? '—'}</td>
                  <td data-label="Role"><span class="role-badge role-{inv.role}">{inv.role}</span></td>
                  <td data-label="Status"><span class="status-badge status-{status.toLowerCase()}">{status}</span></td>
                  <td data-label="Expires" class="date-cell">{format_datetime(inv.expires_at)}</td>
                  <td data-label="Used By" class="date-cell">{inv.used_by_display_name ?? '—'}</td>
                  <td data-label="Actions">
                    {#if status === 'Active'}
                      <div class="row-actions">
                        {#if inv.token_preview}
                          <code class="token-preview">{inv.token_preview}</code>
                        {/if}
                        <button
                          class="btn btn-danger btn-sm"
                          onclick={() => revoke_invite(inv.id)}
                          disabled={revoking.has(inv.id)}
                        >
                          {revoking.has(inv.id) ? 'Revoking...' : 'Revoke'}
                        </button>
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
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

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.5rem 1rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: var(--font);
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover:not(:disabled) { opacity: 0.9; }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); border: 1px solid var(--border); }
  .btn-secondary:hover:not(:disabled) { opacity: 0.85; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover:not(:disabled) { opacity: 0.9; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }

  /* Table */
  .table-wrap {
    overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius);
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  thead th {
    background: var(--bg-surface); color: var(--fg-muted);
    font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; padding: 0.75rem 1rem; text-align: left;
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: var(--bg-surface); }
  tbody tr.self-row { background: rgba(99, 102, 241, 0.05); }
  td { padding: 0.75rem 1rem; color: var(--fg); vertical-align: middle; }
  .date-cell { color: var(--fg-muted); font-size: 0.8rem; white-space: nowrap; }
  .count-cell { color: var(--fg-muted); text-align: center; }
  .label-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Badges */
  .role-badge {
    display: inline-block; font-size: 0.7rem; padding: 0.2rem 0.55rem;
    border-radius: 12px; font-weight: 600; text-transform: uppercase;
  }
  .role-admin { background: rgba(234, 179, 8, 0.15); color: #ca8a04; }
  .role-user { background: var(--bg-elevated); color: var(--fg-muted); }

  .status-badge {
    display: inline-block; font-size: 0.7rem; padding: 0.2rem 0.55rem;
    border-radius: 12px; font-weight: 600; text-transform: uppercase;
  }
  .status-active { background: rgba(74, 158, 110, 0.15); color: var(--success); }
  .status-expired { background: var(--bg-elevated); color: var(--fg-muted); }
  .status-used { background: rgba(99, 102, 241, 0.12); color: var(--accent); }

  .you-badge {
    font-size: 0.65rem; background: rgba(99, 102, 241, 0.15); color: var(--accent);
    padding: 0.1rem 0.4rem; border-radius: 8px; font-weight: 600;
    margin-left: 0.4rem; vertical-align: middle;
  }
  .display-name { font-weight: 500; color: var(--fg); }

  /* Row actions */
  .row-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .confirm-text { font-size: 0.8rem; color: var(--danger); font-weight: 600; }
  .token-preview {
    font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem;
    color: var(--fg-muted); background: var(--bg-elevated);
    padding: 0.15rem 0.4rem; border-radius: 4px;
  }

  /* Feedback */
  .loading { color: var(--fg-muted); display: flex; align-items: center; gap: 0.5rem; padding: 1rem 0; }
  .empty-state {
    text-align: center; padding: 3rem; color: var(--fg-muted);
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  }
  .error-banner {
    background: rgba(201, 84, 74, 0.1); border: 1px solid rgba(201, 84, 74, 0.3);
    border-radius: var(--radius); color: var(--danger);
    padding: 0.75rem 1rem; font-size: 0.875rem; margin-bottom: 1rem;
  }

  /* Invite form */
  .invite-form-card {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1.5rem;
  }
  .invite-form-card h3 { font-size: 1rem; color: var(--fg); margin-bottom: 1rem; }

  .form-row { display: flex; gap: 1rem; margin-bottom: 0; flex-wrap: wrap; }

  .form-field {
    display: flex; flex-direction: column; gap: 0.35rem;
    flex: 1; min-width: 160px; margin-bottom: 0.75rem;
  }
  .form-field label {
    font-size: 0.8rem; font-weight: 600; color: var(--fg-muted);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .optional { font-weight: 400; text-transform: none; font-size: 0.75rem; }

  .form-field input[type="text"],
  .form-field input[type="datetime-local"],
  .form-field select {
    background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--fg); padding: 0.5rem 0.75rem; font-size: 0.875rem;
    font-family: var(--font); outline: none; transition: border-color 0.15s;
  }
  .form-field input:focus, .form-field select:focus { border-color: var(--accent); }

  .expiry-tabs {
    display: flex; border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; width: fit-content; margin-bottom: 0.75rem;
  }
  .expiry-tab {
    padding: 0.35rem 0.9rem; background: var(--bg); border: none;
    color: var(--fg-muted); font-size: 0.8rem; font-weight: 500;
    cursor: pointer; font-family: var(--font); transition: all 0.15s;
  }
  .expiry-tab.active { background: var(--accent); color: #fff; }

  .preset-buttons { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .preset-btn {
    padding: 0.3rem 0.65rem; background: var(--bg-elevated);
    border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--fg-muted); font-size: 0.8rem; font-weight: 600;
    cursor: pointer; font-family: var(--font); transition: all 0.15s;
  }
  .preset-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .preset-btn:hover:not(.active) { border-color: var(--accent); color: var(--fg); }

  /* Invite success */
  .invite-success {
    background: rgba(74, 158, 110, 0.08); border: 1px solid rgba(74, 158, 110, 0.3);
    border-radius: var(--radius); padding: 1rem; margin-bottom: 1.5rem;
  }
  .invite-success-header {
    display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;
  }
  .invite-success-header strong { flex: 1; color: var(--fg); }

  .invite-url-row {
    display: flex; align-items: center; gap: 0.75rem;
    flex-wrap: wrap; margin-bottom: 0.5rem;
  }
  .invite-url {
    flex: 1; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem;
    color: var(--fg); background: var(--bg-elevated); padding: 0.4rem 0.6rem;
    border-radius: 4px; word-break: break-all; min-width: 0;
  }
  .invite-warning {
    font-size: 0.8rem; color: var(--fg-muted);
    display: flex; align-items: center; gap: 0.35rem;
  }

  .section-title { font-size: 0.95rem; font-weight: 600; color: var(--fg); margin-bottom: 0.75rem; }

  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Mobile */
  @media (max-width: 768px) {
    .tabs { overflow-x: auto; }

    .table-wrap { border: none; border-radius: 0; overflow-x: visible; }
    table { display: block; }
    thead { display: none; }
    tbody { display: flex; flex-direction: column; gap: 0.75rem; }
    tbody tr {
      display: flex; flex-direction: column; gap: 0.4rem;
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 0.75rem;
    }
    tbody tr:hover { background: var(--bg-surface); }
    td {
      padding: 0; font-size: 0.85rem;
      display: flex; align-items: center; gap: 0.5rem;
    }
    td::before {
      content: attr(data-label);
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--fg-muted);
      min-width: 80px; flex-shrink: 0;
    }

    .form-row { flex-direction: column; }
    .form-field { min-width: 0; }

    .invite-url-row { flex-direction: column; align-items: flex-start; }
    .invite-url { width: 100%; }

    .preset-buttons { gap: 0.3rem; }
    .preset-btn { padding: 0.25rem 0.55rem; }

    .row-actions { flex-wrap: wrap; }
  }
</style>
