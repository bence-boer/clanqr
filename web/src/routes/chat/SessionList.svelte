<script lang="ts">
    import { EmptyState, LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import type { ChatSession } from '$lib/types';
    import SessionItem from './SessionItem.svelte';

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
                    <SessionItem
                        {session}
                        is_active={active_session?.id === session.id}
                        on_select={() => onselect(session)}
                        on_delete={(event) => ondelete(session.id, event)}
                    />
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
