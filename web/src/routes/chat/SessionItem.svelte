<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import type { ChatSession } from '$lib/types';

    let {
        session,
        is_active,
        on_select,
        on_delete
    }: {
        session: ChatSession
        is_active: boolean
        on_select: () => void
        on_delete: (event: MouseEvent) => void
    } = $props();

    function format_title(session: ChatSession): string {
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

<div
    class="session-item"
    class:active={is_active}
    role="button"
    tabindex="0"
    onclick={on_select}
    onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            on_select();
        }
    }}
>
    <div class="session-info">
        <span class="session-label">{format_title(session)}</span>
        <div class="session-meta">
            <span class="model-badge">{short_model(session.model)}</span>
            <span class="session-time">{relative_time(session.updated_at)}</span>
        </div>
    </div>
    <Button
        variant="ghost"
        size="icon"
        class="btn-delete"
        onclick={(event: MouseEvent) => on_delete(event)}
        title="Delete session"
        icon="close"
        aria-label="Delete session"
    />
</div>

<style>
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
</style>
