<script lang="ts">
    import { resolve } from '$app/paths';
    import { EmptyState, StatusBadge } from '$lib/components';
    import { Badge } from '$lib/components/primitives';
    import type { Task } from '$lib/types';

    let { queue }: { queue: Task[] } = $props();
</script>

<section class="section">
    <h3 class="section-title">
        <span class="icon">queue</span>
        Queue
        {#if queue.length > 0}
            <Badge variant="muted">{queue.length}</Badge>
        {/if}
    </h3>

    {#if queue.length === 0}
        <EmptyState icon="done_all" message="No tasks waiting in queue" />
    {:else}
        <div class="queue-list">
            {#each queue as task, i (task.id)}
                <div class="queue-item">
                    <span class="queue-number">{i + 1}</span>
                    <div class="queue-content">
                        <div class="queue-breadcrumb">
                            {#if task.features?.projects?.id}
                                <a href={resolve(`/projects/${task.features.projects.id}`)} class="crumb-link">{task.features.projects.name}</a>
                            {/if}
                            {#if task.features?.id && task.features.projects?.id}
                                <span class="crumb-sep">/</span>
                                <a href={resolve(`/projects/${task.features.projects.id}?feature=${task.features.id}`)} class="crumb-link">{task.features.title}</a>
                            {/if}
                            <span class="crumb-sep">/</span>
                            <span class="crumb-current">{task.title ?? task.description?.slice(0, 40)}</span>
                        </div>
                        {#if task.title}
                            <p class="queue-desc">{task.description}</p>
                        {/if}
                    </div>
                    <StatusBadge status={task.status} />
                </div>
            {/each}
        </div>
    {/if}
</section>

<style>
    .section {
        margin-bottom: 2rem;
    }

    .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .queue-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .queue-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.6rem 0.85rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
    }

    .queue-number {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--fg-muted);
        min-width: 1.2rem;
        text-align: center;
        padding-top: 0.1rem;
    }

    .queue-content {
        flex: 1;
        min-width: 0;
    }

    .queue-breadcrumb {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.8rem;
        flex-wrap: wrap;
    }

    .crumb-link {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
    }

    .crumb-link:hover {
        text-decoration: underline;
    }

    .crumb-sep {
        color: var(--border);
        font-size: 0.75rem;
    }

    .crumb-current {
        color: var(--fg);
        font-weight: 600;
    }

    .queue-desc {
        font-size: 0.8rem;
        color: var(--fg-muted);
        margin-top: 0.2rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    @media (max-width: 768px) {
        .queue-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }
    }
</style>
