<script lang="ts">
  import type { User } from '$lib/types';

  let { users, users_loading, users_error, self_id, admin_count, ontoggle_role, ondelete_user }: {
    users: User[];
    users_loading: boolean;
    users_error: string;
    self_id: string | null;
    admin_count: number;
    ontoggle_role: (user: User) => Promise<void>;
    ondelete_user: (user_id: string) => Promise<void>;
  } = $props();

  let confirm_delete: string | null = $state(null);
  let role_toggling: Set<string> = $state(new Set());
  let deleting: Set<string> = $state(new Set());

  function format_date(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function toggle_role(user: User) {
    role_toggling = new Set([...role_toggling, user.id]);
    try {
      await ontoggle_role(user);
    } catch {
      // Parent handles error display
    } finally {
      role_toggling = new Set([...role_toggling].filter(id => id !== user.id));
    }
  }

  async function delete_user(user_id: string) {
    deleting = new Set([...deleting, user_id]);
    try {
      await ondelete_user(user_id);
      confirm_delete = null;
    } catch {
      // Parent handles error display
    } finally {
      deleting = new Set([...deleting].filter(id => id !== user_id));
    }
  }
</script>

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

<style>
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

  /* Badges */
  .role-badge {
    display: inline-block; font-size: 0.7rem; padding: 0.2rem 0.55rem;
    border-radius: 12px; font-weight: 600; text-transform: uppercase;
  }
  .role-admin { background: rgba(234, 179, 8, 0.15); color: #ca8a04; }
  .role-user { background: var(--bg-elevated); color: var(--fg-muted); }

  .you-badge {
    font-size: 0.65rem; background: rgba(99, 102, 241, 0.15); color: var(--accent);
    padding: 0.1rem 0.4rem; border-radius: 8px; font-weight: 600;
    margin-left: 0.4rem; vertical-align: middle;
  }
  .display-name { font-weight: 500; color: var(--fg); }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.5rem 1rem; border: none; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: var(--font);
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); border: 1px solid var(--border); }
  .btn-secondary:hover:not(:disabled) { opacity: 0.85; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover:not(:disabled) { opacity: 0.9; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }

  /* Row actions */
  .row-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .confirm-text { font-size: 0.8rem; color: var(--danger); font-weight: 600; }

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

  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Mobile */
  @media (max-width: 768px) {
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
    .row-actions { flex-wrap: wrap; }
  }
</style>
