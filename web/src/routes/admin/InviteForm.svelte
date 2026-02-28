<script lang="ts">
  import { api } from '$lib/api/client';

  let { oninvite_created }: {
    oninvite_created: () => void;
  } = $props();

  let invites_error = $state('');
  let invite_label = $state('');
  let invite_role: 'user' | 'admin' = $state('user');
  let expiry_mode: 'relative' | 'absolute' = $state('relative');
  let relative_minutes = $state(60);
  let absolute_datetime = $state('');
  let generating = $state(false);

  let new_invite_url: string | null = $state(null);
  let copy_done = $state(false);

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
      oninvite_created();
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
    } catch (_) {
      // clipboard not available
    }
  }
</script>

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

<style>
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
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }

  /* Feedback */
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

  /* Mobile */
  @media (max-width: 768px) {
    .form-row { flex-direction: column; }
    .form-field { min-width: 0; }
    .invite-url-row { flex-direction: column; align-items: flex-start; }
    .invite-url { width: 100%; }
    .preset-buttons { gap: 0.3rem; }
    .preset-btn { padding: 0.25rem 0.55rem; }
  }
</style>
