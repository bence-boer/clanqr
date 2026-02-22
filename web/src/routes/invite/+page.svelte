<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { check_auth, register_passkey } from "$lib/auth";
  import { api } from "$lib/api/client";
  import type { InviteStatus } from "$lib/types";

  let token = $derived(page.url.searchParams.get("token"));
  let display_name = $state("");
  let error = $state("");
  let loading = $state(true);
  let submitting = $state(false);
  let invite_info: InviteStatus | null = $state(null);

  onMount(async () => {
    if (!token) {
      error = "Invalid invite link.";
      loading = false;
      return;
    }
    try {
      const status = await check_auth();
      if (status.authenticated) {
        goto("/");
        return;
      }
    } catch (_) {
      // not authenticated — proceed
    }
    try {
      const info = await api.get_invite_status(token);
      invite_info = info;
      if (!info.valid) {
        const reasons: Record<string, string> = {
          not_found: "This invite link is invalid.",
          used: "This invite link has already been used — each link can only be used once.",
          expired: "This invite link has expired.",
        };
        error = reasons[info.reason ?? ""] ?? "This invite link is invalid.";
      }
    } catch (err) {
      console.error('Failed to check invite status:', err);
    }
    loading = false;
  });

  async function handle_submit() {
    if (!display_name.trim()) {
      error = "Please enter a display name.";
      return;
    }
    error = "";
    submitting = true;
    try {
      const ok = await register_passkey(display_name.trim(), token!);
      if (ok) {
        goto("/");
      }
    } catch (e: any) {
      const msg: string = e.message ?? "";
      if (msg.includes("409") || msg.toLowerCase().includes("already used")) {
        error = "This invite link has already been used.";
      } else if (msg.toLowerCase().includes("expired")) {
        error = "This invite link has expired.";
      } else {
        error = msg || "Registration failed. Please try again.";
      }
    } finally {
      submitting = false;
    }
  }
</script>

<div class="auth-screen">
  <div class="auth-card">
    {#if loading}
      <span class="icon spin">progress_activity</span>
    {:else if error && (!invite_info || !invite_info.valid)}
      <span class="icon large">link_off</span>
      <h1>Ralph Agent Workspace</h1>
      <p class="auth-subtitle">{error}</p>
      <a href="/" class="auth-link">Go to login</a>
    {:else}
      <span class="icon large">person_add</span>
      <h1>Ralph Agent Workspace</h1>
      <p class="auth-subtitle">You've been invited. Create a passkey to get started.</p>
      {#if invite_info?.valid}
        <div class="invite-meta">
          <span class="role-badge role-{invite_info.role}">You'll join as {invite_info.role}</span>
          {#if invite_info.label}<span class="invite-label">{invite_info.label}</span>{/if}
        </div>
      {/if}
      <input
        type="text"
        bind:value={display_name}
        placeholder="Display name"
        class="auth-input"
        disabled={submitting}
        onkeydown={(e) => e.key === "Enter" && handle_submit()}
      />
      <button class="btn-primary" onclick={handle_submit} disabled={submitting}>
        <span class="icon">{submitting ? "progress_activity" : "fingerprint"}</span>
        {submitting ? "Creating…" : "Create Passkey"}
      </button>
      {#if error}
        <p class="auth-error">{error}</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .auth-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1rem;
    background: var(--bg);
  }

  .auth-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2.5rem;
    text-align: center;
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .auth-card h1 {
    font-size: 1.5rem;
    color: var(--fg);
    margin-bottom: 0.5rem;
  }

  .auth-subtitle {
    color: var(--fg-muted);
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .auth-input {
    width: 100%;
    padding: 0.65rem 0.85rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--fg);
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .auth-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .auth-error {
    color: var(--danger);
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }

  .icon {
    font-family: "Material Symbols Rounded", sans-serif;
    font-size: 1.2rem;
    line-height: 1;
  }

  .icon.large {
    font-size: 2.5rem;
    color: var(--accent);
    margin-bottom: 0.5rem;
  }

  .icon.spin {
    font-size: 2rem;
    color: var(--accent);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
    justify-content: center;
    transition: opacity 0.15s;
  }

  button:hover:not(:disabled) {
    opacity: 0.9;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-link {
    color: var(--accent);
    text-decoration: none;
    font-size: 0.85rem;
  }
  .auth-link:hover { text-decoration: underline; }

  .invite-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }
  .role-badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-weight: 500;
  }
  .role-admin { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
  .role-user { background: rgba(108, 117, 125, 0.15); color: var(--fg-muted); }
  .invite-label { color: var(--fg-muted); font-size: 0.85rem; }

  @media (max-width: 768px) {
    .auth-card { max-width: 100%; padding: 1.5rem; }
  }
</style>
