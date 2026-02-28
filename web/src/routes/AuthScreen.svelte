<script lang="ts">
  let {
    auth_state,
    error = null,
    pending = false,
    onregister,
    onlogin,
  }: {
    auth_state: string;
    error?: string | null;
    pending?: boolean;
    onregister: (name: string) => void;
    onlogin: () => void;
  } = $props();

  let setup_name: string = $state("");
</script>

{#if auth_state === "loading"}
  <div class="auth-screen">
    <div class="auth-card">
      <span class="icon spin">progress_activity</span>
    </div>
  </div>
{:else if auth_state === "error"}
  <div class="auth-screen">
    <div class="auth-card">
      <span class="icon large">cloud_off</span>
      <h1>Ralph Agent Workspace</h1>
      <p class="auth-subtitle">Could not reach the API server. Is it running?</p>
      <button class="btn-primary" onclick={() => window.location.reload()}>
        <span class="icon">refresh</span>
        Retry
      </button>
    </div>
  </div>
{:else if auth_state === "setup"}
  <div class="auth-screen">
    <div class="auth-card">
      <span class="icon large">passkey</span>
      <h1>Ralph Agent Workspace</h1>
      <p class="auth-subtitle">Set up a passkey to secure your workspace.</p>
      <input
        type="text"
        bind:value={setup_name}
        placeholder="Display name"
        class="auth-input"
      />
      <button class="btn-primary" onclick={() => onregister(setup_name || "Admin")}>
        <span class="icon">fingerprint</span>
        Create Passkey
      </button>
      {#if error}
        <p class="auth-error">{error}</p>
      {/if}
    </div>
  </div>
{:else if auth_state === "login"}
  <div class="auth-screen">
    <div class="auth-card">
      <span class="icon large">lock</span>
      <h1>Ralph Agent Workspace</h1>
      <p class="auth-subtitle">Authenticate with your passkey to continue.</p>
      <button class="btn-primary" onclick={onlogin} disabled={pending}>
        <span class="icon">{pending ? 'progress_activity' : 'fingerprint'}</span>
        {pending ? 'Authenticating…' : 'Sign in with Passkey'}
      </button>
      {#if error}
        <p class="auth-error">{error}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .icon.large {
    font-size: 48px;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .icon.spin {
    font-size: 32px;
    color: var(--accent);
  }

  .auth-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1rem;
  }

  .auth-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2.5rem;
    text-align: center;
    max-width: 380px;
    width: 100%;
  }

  .auth-card h1 {
    font-size: 1.5rem;
    color: var(--fg);
    margin-bottom: 0.5rem;
  }

  .auth-subtitle {
    color: var(--fg-muted);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .auth-input {
    width: 100%;
    padding: 0.65rem 0.85rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    font-family: var(--font);
  }

  .auth-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .auth-error {
    color: var(--danger);
    font-size: 0.8rem;
    margin-top: 1rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font);
    transition: opacity 0.15s;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
