<script lang="ts">
    import { EmptyState, LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import type { ChatSession } from '$lib/types';

    let {
        sessions,
        active_session,
        loading_sessions,
        onselect,
        ondelete,
        oncreate
    }: {
        sessions: ChatSession[]
        active_session: ChatSession | null
        loading_sessions: boolean
        onselect: (session: ChatSession) => void
        ondelete: (session_id: string, event: MouseEvent) => void
        oncreate: () => void
    } = $props();

    function format_session_title(session: ChatSession) {
        return session.title ?? `Chat ${new Date(session.created_at).toLocaleDateString()}`;
    }
</script>

<aside class="sessions-panel">
    <div class="sessions-header">
        <span class="sessions-title">Sessions</span>
        <Button variant="secondary" size="icon" onclick={oncreate} title="New chat" icon="add" style="border-radius: 50%" />
    </div>

    {#if loading_sessions}
        <div class="panel-center">
            <LoadingSpinner size="sm" />
        </div>
    {:else if sessions.length === 0}
        <div class="panel-center">
            <EmptyState icon="chat" message="No sessions yet." />
        </div>
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
                        onkeydown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onselect(session);
                            }
                        }}
                    >
                        <span class="session-label">{format_session_title(session)}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="btn-delete"
                            onclick={(event: MouseEvent) => ondelete(session.id, event)}
                            title="Delete session"
                            icon="close"
                        />
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

    .session-item:hover {
        background: var(--bg-elevated);
    }
    .session-item.active {
        background: var(--accent-dim);
        border: 1px solid var(--accent);
    }

    .session-label {
        flex: 1;
        font-size: 0.8rem;
        color: var(--fg);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    :global(.btn-delete) {
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

    .session-item:hover :global(.btn-delete),
    .session-item.active :global(.btn-delete) {
        opacity: 1;
    }
    :global(.btn-delete:hover) {
        color: var(--danger);
    }
    :global(.btn-delete .icon) {
        font-size: 14px;
    }

    .panel-center {
        display: flex;
        justify-content: center;
        padding: 1rem;
    }

    @media (max-width: 768px) {
        .sessions-panel {
            width: 100%;
            height: 180px;
            margin-right: 0;
            margin-bottom: 0;
        }
    }
</style>
