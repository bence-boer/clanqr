<script lang="ts">
    import { resolve } from '$app/paths';
    import type { Pathname } from '$app/types';
    import type { ActivityEvent } from '$lib/types';
    import { EmptyState } from '$lib/components';

    interface Props {
        events: ActivityEvent[]
        loading?: boolean
    }

    const { events, loading = false }: Props = $props();

    function relative_time(ts: string): string {
        const diff = Date.now() - new Date(ts).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    const severity_colors: Record<string, string> = {
        success: 'var(--success)',
        danger: 'var(--danger)',
        warning: 'var(--accent)',
        info: '#6ea8fe',
        muted: 'var(--fg-muted)'
    };
</script>

<section class="activity-feed">
    <h3>Recent Activity</h3>
    {#if events.length === 0 && !loading}
        <EmptyState icon="history" message="No recent activity" detail="Activity will appear here as agents run and tasks complete" />
    {:else}
        <div class="feed-list">
            {#each events as event (event.id)}
                <div class="feed-item">
                    <span class="icon feed-icon" style="color: {severity_colors[event.severity] || 'var(--fg-muted)'}">{event.icon}</span>
                    <div class="feed-content">
                        {#if event.link}
                            <a href={resolve(event.link as Pathname)} class="feed-message">{event.message}</a>
                        {:else}
                            <span class="feed-message">{event.message}</span>
                        {/if}
                        <span class="feed-time">{relative_time(event.timestamp)}</span>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</section>

<style>
    .activity-feed h3 {
        font-size: 1.05rem;
        color: var(--fg);
        margin: 0 0 1rem;
    }

    .feed-list {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .feed-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.65rem 0;
        border-bottom: 1px solid var(--border);
    }

    .feed-item:last-child {
        border-bottom: none;
    }

    .feed-icon {
        font-size: 18px;
        margin-top: 1px;
        flex-shrink: 0;
    }

    .feed-content {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.5rem;
        min-width: 0;
    }

    .feed-message {
        font-size: 0.85rem;
        color: var(--fg);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    a.feed-message {
        color: var(--fg);
        text-decoration: none;
    }
    a.feed-message:hover {
        color: var(--accent);
    }

    .feed-time {
        font-size: 0.75rem;
        color: var(--fg-muted);
        flex-shrink: 0;
    }
</style>
