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

    function relative_time(date_str: string): string {
        const now = Date.now();
        const then = new Date(date_str).getTime();
        const diff_sec = Math.floor((now - then) / 1000);
        if (diff_sec < 60) return 'just now';
        const diff_min = Math.floor(diff_sec / 60);
        if (diff_min < 60) return `${diff_min}m ago`;
        const diff_hr = Math.floor(diff_min / 60);
        if (diff_hr < 24) return `${diff_hr}h ago`;
        const diff_day = Math.floor(diff_hr / 24);
        if (diff_day < 30) return `${diff_day}d ago`;
        return new Date(date_str).toLocaleDateString();
    }

    function short_model(model: string): string {
        return model.replace('claude-', '').replace('gpt-', '').replace('-preview', '');
    }
</script>

<aside class="sessions-panel">
    <div class="sessions-header">
        <span class="sessions-title">Sessions</span>
        <Button variant="secondary" size="icon" onclick={oncreate} title="New chat" icon="add" style="border-radius: 50%" aria-label="New chat session" />
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
                        <div class="session-info">
                            <span class="session-label">{format_session_title(session)}</span>
                            <div class="session-meta">
                                <span class="model-badge">{short_model(session.model)}</span>
                                <span class="session-time">{relative_time(session.updated_at)}</span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="btn-delete"
                            onclick={(event: MouseEvent) => ondelete(session.id, event)}
                            title="Delete session"
                            icon="close"
                            aria-label="Delete session"
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

    .session-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .session-label {
        font-size: 0.8rem;
        color: var(--fg);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .session-meta {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .model-badge {
        font-size: 0.65rem;
        color: var(--fg-muted);
        background: var(--bg);
        padding: 0.05rem 0.35rem;
        border-radius: 3px;
        white-space: nowrap;
    }

    .session-time {
        font-size: 0.65rem;
        color: var(--fg-muted);
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
        flex-shrink: 0;
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
