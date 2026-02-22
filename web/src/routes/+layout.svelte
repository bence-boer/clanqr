<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { api } from "$lib/api/client";
  import { auth_store } from "$lib/stores/auth.svelte";
  import "$lib/styles/global.css";
  import type { SystemStats } from "$lib/types";

  let { children } = $props();

  let setup_name: string = $state("");
  let sidebar_open: boolean = $state(false);
  let system_stats: SystemStats | null = $state(null);
  let current_path = $derived(page.url.pathname);

  onMount(async () => {
    await auth_store.check(current_path.startsWith("/invite"));
    if (auth_store.state === "authenticated" && !current_path.startsWith("/invite")) {
      load_system_stats();
    }
  });

  async function load_system_stats() {
    try {
      system_stats = await api.system_stats();
    } catch (err) {
      console.error('Failed to load system stats:', err);
    }
  }

  async function handle_register() {
    await auth_store.register(setup_name || "Admin");
  }

  async function handle_login() {
    await auth_store.login();
  }

  async function handle_logout() {
    await auth_store.sign_out();
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

{#if auth_store.state === "loading"}
  <div class="auth-screen">
    <div class="auth-card">
      <span class="icon spin">progress_activity</span>
    </div>
  </div>
{:else if auth_store.state === "error"}
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
{:else if auth_store.state === "setup"}
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
      {#if auth_store.error}
        <p class="auth-error">{auth_store.error}</p>
      {/if}
    </div>
  </div>
{:else if auth_store.state === "login"}
  <div class="auth-screen">
    <div class="auth-card">
      <span class="icon large">lock</span>
      <h1>Ralph Agent Workspace</h1>
      <p class="auth-subtitle">Authenticate with your passkey to continue.</p>
      <button class="btn-primary" onclick={handle_login}>
        <span class="icon">fingerprint</span>
        Sign in with Passkey
      </button>
      {#if auth_store.error}
        <p class="auth-error">{auth_store.error}</p>
      {/if}
    </div>
  </div>
{:else if current_path.startsWith("/invite")}
  {@render children()}
{:else}
  <div class="app" class:sidebar-open={sidebar_open}>
    <button class="mobile-toggle" onclick={() => sidebar_open = !sidebar_open}>
      <span class="icon">{sidebar_open ? "close" : "menu"}</span>
    </button>

    {#if sidebar_open}
      <button class="sidebar-overlay" onclick={close_sidebar} aria-label="Close sidebar"></button>
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

      {#if auth_store.role === "admin"}
        <div class="nav-section">
          <span class="nav-section-label">Settings</span>
          <ul class="nav-links">
            <li>
              <a href="/admin" onclick={close_sidebar} class:active={is_active("/admin")}>
                <span class="icon">admin_panel_settings</span>
                Admin
              </a>
            </li>
          </ul>
        </div>
      {/if}

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
  .icon.large {
    font-size: 48px;
    color: var(--accent);
    margin-bottom: 1rem;
  }

  .icon.spin {
    font-size: 32px;
    color: var(--accent);
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
    border: none;
    cursor: pointer;
    font-size: 0;
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
      transition: left 0.2s ease;
    }

    .sidebar-open .mobile-toggle {
      left: calc(220px + 0.75rem);
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
