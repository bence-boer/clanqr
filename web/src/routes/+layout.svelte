<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { check_auth, register_passkey, login_passkey, logout } from "$lib/auth";
  import { api } from "$lib/api/client";
  import type { SystemStats } from "$lib/types";

  let { children } = $props();

  let auth_state: "loading" | "setup" | "login" | "authenticated" | "error" = $state("loading");
  let auth_error: string = $state("");
  let setup_name: string = $state("");
  let sidebar_open: boolean = $state(false);
  let system_stats: SystemStats | null = $state(null);
  let current_path = $derived($page.url.pathname);

  onMount(async () => {
    try {
      const status = await check_auth();
      if (status.authenticated) {
        auth_state = "authenticated";
        load_system_stats();
      } else if (!status.is_setup) {
        auth_state = "setup";
      } else {
        auth_state = "login";
      }
    } catch {
      auth_state = "error";
    }
  });

  async function load_system_stats() {
    try {
      system_stats = await api.system_stats();
    } catch {
      // silently fail — stats are non-critical
    }
  }

  async function handle_register() {
    auth_error = "";
    try {
      const ok = await register_passkey(setup_name || "Admin");
      if (ok) auth_state = "authenticated";
    } catch (e: any) {
      auth_error = e.message;
    }
  }

  async function handle_login() {
    auth_error = "";
    try {
      const ok = await login_passkey();
      if (ok) auth_state = "authenticated";
    } catch (e: any) {
      auth_error = e.message;
    }
  }

  async function handle_logout() {
    await logout();
    auth_state = "login";
  }

  function close_sidebar() {
    sidebar_open = false;
  }

  function is_active(path: string) {
    if (path === "/") return current_path === "/";
    return current_path.startsWith(path);
  }
</script>

<svelte:head>
  <title>Ralph Agent Workspace</title>
</svelte:head>

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
      <button class="btn-primary" onclick={handle_register}>
        <span class="icon">fingerprint</span>
        Create Passkey
      </button>
      {#if auth_error}
        <p class="auth-error">{auth_error}</p>
      {/if}
    </div>
  </div>
{:else if auth_state === "login"}
  <div class="auth-screen">
    <div class="auth-card">
      <span class="icon large">lock</span>
      <h1>Ralph Agent Workspace</h1>
      <p class="auth-subtitle">Authenticate with your passkey to continue.</p>
      <button class="btn-primary" onclick={handle_login}>
        <span class="icon">fingerprint</span>
        Sign in with Passkey
      </button>
      {#if auth_error}
        <p class="auth-error">{auth_error}</p>
      {/if}
    </div>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="app" class:sidebar-open={sidebar_open}>
    <button class="mobile-toggle" onclick={() => sidebar_open = !sidebar_open}>
      <span class="icon">{sidebar_open ? "close" : "menu"}</span>
    </button>

    {#if sidebar_open}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="sidebar-overlay" onclick={close_sidebar}></div>
    {/if}

    <nav class="sidebar">
      <div class="logo">
        <span class="icon logo-icon">smart_toy</span>
        <div>
          <h1>Ralph</h1>
          <span class="subtitle">Agent Workspace</span>
        </div>
      </div>

      <div class="nav-section">
        <span class="nav-section-label">Workspace</span>
        <ul class="nav-links">
          <li>
            <a href="/" onclick={close_sidebar} class:active={is_active("/") && current_path === "/"}>
              <span class="icon">dashboard</span>
              Dashboard
            </a>
          </li>
          <li>
            <a href="/projects" onclick={close_sidebar} class:active={is_active("/projects")}>
              <span class="icon">folder</span>
              Projects
            </a>
          </li>
          <li>
            <a href="/pipeline" onclick={close_sidebar} class:active={is_active("/pipeline")}>
              <span class="icon">account_tree</span>
              Pipeline
            </a>
          </li>
        </ul>
      </div>

      <div class="nav-section">
        <span class="nav-section-label">AI</span>
        <ul class="nav-links">
          <li>
            <a href="/chat" onclick={close_sidebar} class:active={is_active("/chat")}>
              <span class="icon">chat</span>
              Chat
            </a>
          </li>
          <li>
            <a href="/usage" onclick={close_sidebar} class:active={is_active("/usage")}>
              <span class="icon">analytics</span>
              Usage
            </a>
          </li>
        </ul>
      </div>

      <div class="nav-section">
        <span class="nav-section-label">Configure</span>
        <ul class="nav-links">
          <li>
            <a href="/prompts" onclick={close_sidebar} class:active={is_active("/prompts")}>
              <span class="icon">tune</span>
              Prompts &amp; Traits
            </a>
          </li>
          <li>
            <a href="/skills" onclick={close_sidebar} class:active={is_active("/skills")}>
              <span class="icon">extension</span>
              Skills
            </a>
          </li>
        </ul>
      </div>

      <div class="sidebar-footer">
        {#if system_stats}
          <div class="system-mini-stats">
            <span class="icon" style="font-size:14px">memory</span>
            CPU {system_stats.cpu_percent}%
            {#if system_stats.cpu_temp_celsius !== null}
              · {system_stats.cpu_temp_celsius}°C
            {/if}
          </div>
        {/if}
        <button class="logout-btn" onclick={handle_logout}>
          <span class="icon">logout</span>
          Sign out
        </button>
      </div>
    </nav>
    <main class="content">
      {@render children()}
    </main>
  </div>
{/if}

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(:root) {
    --bg: #1a1816;
    --bg-surface: #231f1c;
    --bg-elevated: #2c2724;
    --fg: #e6e1d6;
    --fg-muted: #9e978a;
    --border: #3d3630;
    --accent: #d4af37;
    --accent-dim: rgba(212, 175, 55, 0.15);
    --danger: #c9544a;
    --success: #4a9e6e;
    --radius: 8px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  :global(body) {
    font-family: var(--font);
    background: var(--bg);
    color: var(--fg);
    line-height: 1.5;
  }

  :global(::selection) {
    background-color: var(--accent);
    color: var(--bg);
  }

  .icon {
    font-family: 'Material Symbols Rounded';
    font-weight: normal;
    font-style: normal;
    font-size: 20px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }

  :global(.icon) {
    font-family: 'Material Symbols Rounded';
    font-weight: normal;
    font-style: normal;
    font-size: 20px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }

  .icon.large {
    font-size: 48px;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .icon.spin {
    font-size: 32px;
    color: var(--accent);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Auth screens */
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

  :global(.btn-primary) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    transition: opacity 0.15s;
  }

  :global(.btn-primary:hover) {
    opacity: 0.9;
  }

  /* App layout */
  .app {
    display: flex;
    min-height: 100vh;
  }

  .mobile-toggle {
    display: none;
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 60;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    padding: 0.5rem;
    cursor: pointer;
    line-height: 1;
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 39;
  }

  .sidebar {
    width: 220px;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    padding: 1.5rem 0.75rem;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    z-index: 40;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0 0.5rem;
    margin-bottom: 1.5rem;
  }

  .logo-icon {
    font-size: 28px;
    color: var(--accent);
  }

  .logo h1 {
    font-size: 1.2rem;
    color: var(--fg);
    line-height: 1.2;
  }

  .subtitle {
    font-size: 0.65rem;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .nav-links {
    list-style: none;
  }

  .nav-links li {
    margin-bottom: 0.15rem;
  }

  .nav-links a {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    color: var(--fg-muted);
    text-decoration: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    transition: all 0.15s;
    border-left: 2px solid transparent;
  }

  .nav-links a:hover {
    background: var(--bg-elevated);
    color: var(--fg);
  }

  .nav-links a.active {
    background: var(--bg);
    color: var(--accent);
    border-left-color: var(--accent);
  }

  .nav-section {
    margin-bottom: 1rem;
  }

  .nav-section-label {
    display: block;
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0 0.75rem;
    margin-bottom: 0.25rem;
  }

  .sidebar-footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .system-mini-stats {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin-bottom: 0.25rem;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.55rem 0.75rem;
    background: none;
    border: none;
    color: var(--fg-muted);
    font-size: 0.875rem;
    cursor: pointer;
    border-radius: var(--radius);
    font-family: var(--font);
    transition: all 0.15s;
  }

  .logout-btn:hover {
    background: var(--bg-elevated);
    color: var(--fg);
  }

  .content {
    flex: 1;
    margin-left: 220px;
    padding: 2rem;
    max-width: 1200px;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .mobile-toggle {
      display: block;
    }

    .sidebar {
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }

    .sidebar-open .sidebar {
      transform: translateX(0);
    }

    .sidebar-open .sidebar-overlay {
      display: block;
    }

    .content {
      margin-left: 0;
      padding: 1rem;
      padding-top: 3.5rem;
    }
  }
</style>
