<script lang="ts">
    import { resolve } from '$app/paths';
    import { EmptyState } from '$lib/components';
    import { Button } from '$lib/components/primitives';
    import type { PipelineStatus } from '$lib/types';
    import LiveEventPanel from './LiveEventPanel.svelte';

    let {
        pipeline,
        action_busy,
        on_stop,
        format_duration
    }: {
        pipeline: PipelineStatus | null
        action_busy: boolean
        on_stop: () => void
        format_duration: (started_at: string | null) => string
    } = $props();

    let elapsed = $state('');
    let log_visible = $state(false);

    $effect(() => {
        const task = pipeline?.current_task;
        if (!task?.updated_at) {
            elapsed = '';
            return;
        }
        const update = () => {
            const diff = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 1000);
            const m = Math.floor(diff / 60);
            const s = diff % 60;
            elapsed = m > 0 ? `${m}m ${s}s` : `${s}s`;
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    });
</script>

<section class="section">
    <h3 class="section-title">
        <span class="icon">play_arrow</span>
        Currently Executing
    </h3>

    {#if pipeline?.current_task}
        {@const task = pipeline.current_task}
        {@const task_title = task.title ?? task.description?.slice(0, 80) ?? 'Untitled task'}
        <div class="current-task-card">
            {#if task.project_name || task.feature_title}
                <div class="breadcrumb">
                    {#if task.project_name}
                        {#if task.project_id}
                            <a href={resolve(`/projects/${task.project_id}`)} class="breadcrumb-link">
                                <span class="icon" style="font-size:14px">folder</span>
                                {task.project_name}
                            </a>
                        {:else}
                            <span class="breadcrumb-text">{task.project_name}</span>
                        {/if}
                    {/if}
                    {#if task.feature_title}
                        {#if task.project_name}
                            <span class="breadcrumb-sep">/</span>
                        {/if}
                        {#if task.project_id && task.feature_id}
                            <a href={resolve(`/projects/${task.project_id}?feature=${task.feature_id}`)} class="breadcrumb-link">
                                <span class="icon" style="font-size:14px">category</span>
                                {task.feature_title}
                            </a>
                        {:else}
                            <span class="breadcrumb-text">{task.feature_title}</span>
                        {/if}
                    {/if}
                </div>
            {/if}

            <div class="current-task-body">
                <div class="current-task-info">
                    <h4 class="task-title">{task_title}</h4>
                    {#if task.title}
                        <p class="task-desc">{task.description}</p>
                    {/if}
                    <div class="task-meta">
                        <span class="icon spin-small" style="font-size:14px">sync</span>
                        <span>Running for {elapsed || format_duration(task.updated_at)}</span>
                    </div>
                </div>
            </div>

            <div class="current-task-actions">
                <Button variant="secondary" size="sm" icon="terminal" onclick={() => {
                    log_visible = !log_visible;
                }}>
                    {log_visible ? 'Hide Log' : 'View Log'}
                </Button>
                <Button variant="danger" size="sm" icon="stop" onclick={on_stop} disabled={action_busy}>Stop</Button>
            </div>

            <LiveEventPanel
                sdk_session_id={pipeline?.current_sdk_session_id}
                visible={log_visible}
            />
        </div>
    {:else}
        <EmptyState icon="hourglass_empty" message="No task is currently running" />
    {/if}
</section>

<style>
    .section { margin-bottom: 2rem; }
    .section-title {
        font-size: 0.875rem; font-weight: 600; color: var(--fg-muted);
        text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem;
        display: flex; align-items: center; gap: 0.4rem;
    }
    .current-task-card {
        background: var(--bg-surface); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 1rem 1.25rem;
    }
    .current-task-body { min-width: 0; }
    .breadcrumb {
        display: flex; align-items: center; gap: 0.35rem;
        font-size: 0.875rem; flex-wrap: wrap; margin-bottom: 0.3rem;
    }
    .breadcrumb-link {
        color: var(--accent); text-decoration: none;
        display: inline-flex; align-items: center; gap: 0.2rem; font-weight: 500;
    }
    .breadcrumb-link:hover { text-decoration: underline; }
    .breadcrumb-text { color: var(--fg-muted); }
    .breadcrumb-sep { color: var(--border); font-size: 0.8rem; }
    .task-title {
        font-size: 1rem; color: var(--fg); font-weight: 600;
        line-height: 1.4; margin-bottom: 0.3rem;
    }
    .task-desc {
        font-size: 0.85rem; color: var(--fg-muted);
        margin-bottom: 0.45rem; line-height: 1.4;
    }
    .task-meta {
        font-size: 0.8rem; color: var(--fg-muted);
        display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;
    }
    .current-task-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
</style>
