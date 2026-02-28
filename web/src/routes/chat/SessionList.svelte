<script lang="ts">
  import type { ChatSession } from '$lib/types';

  let {
    sessions,
    active_session,
    loading_sessions,
    onselect,
    ondelete,
    oncreate,
  }: {
    sessions: ChatSession[];
    active_session: ChatSession | null;
    loading_sessions: boolean;
    onselect: (session: ChatSession) => void;
    ondelete: (session_id: string, event: MouseEvent) => void;
    oncreate: () => void;
  } = $props();

  function format_session_title(session: ChatSession) {
    return session.title ?? `Chat ${new Date(session.created_at).toLocaleDateString()}`;
  }
</script>

<aside class="sessions-panel">
  <div class="sessions-header">
    <span class="sessions-title">Sessions</span>
    <button class="btn-new" onclick={oncreate} title="New chat">
      <span class="icon">add</span>
    </button>
  </div>

  {#if loading_sessions}
    <p class="muted-sm">Loading...</p>
  {:else if sessions.length === 0}
    <p class="muted-sm">No sessions yet.</p>
  {:else}
    <ul class="session-list">
      {#each sessions as session (session.id)}
        <li>
          <div
            class="session-item"
            class:active={active_session?.id === session.id}
            role="button"
            tabindex="0"
            onclick={() => onselect(session)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onselect(session); } }}
          >
            <span class="session-label">{format_session_title(session)}</span>
            <button
              class="btn-delete"
              onclick={(event) => ondelete(session.id, event)}
              title="Delete session"
            >
              <span class="icon">close</span>
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .sessions-panel {
    width: 240px;
    flex-shrink: 0;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    margin-right: 1rem;
  }

  .sessions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .sessions-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--fg);
  }

  .btn-new {
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    border-radius: 50%;
    color: var(--accent);
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-new:hover { background: var(--accent); color: var(--bg); }
  .btn-new .icon { font-size: 16px; }

  .session-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem;
  }

  .session-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.15s;
    background: none;
    border: 1px solid transparent;
    color: inherit;
    font-family: inherit;
    font-size: inherit;
    width: 100%;
    text-align: left;
  }

  .session-item:hover { background: var(--bg-elevated); }
  .session-item.active { background: var(--accent-dim); border: 1px solid var(--accent); }

  .session-label {
    flex: 1;
    font-size: 0.8rem;
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-delete {
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .session-item:hover .btn-delete,
  .session-item.active .btn-delete { opacity: 1; }
  .btn-delete:hover { color: var(--danger); }
  .btn-delete .icon { font-size: 14px; }

  .muted-sm {
    font-size: 0.8rem;
    color: var(--fg-muted);
    padding: 1rem;
  }

  @media (max-width: 768px) {
    .sessions-panel { width: 100%; height: 180px; margin-right: 0; margin-bottom: 0; }
  }
</style>
