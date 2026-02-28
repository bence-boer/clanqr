<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import { onMount } from 'svelte';
    import { api } from '$lib/api/client';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { EmptyState, ErrorBanner, LoadingSpinner } from '$lib/components';
    import type { SkillInfo } from '$lib/types';

    let skills = $state<Omit<SkillInfo, 'content'>[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let refreshing = $state(false);
    let refresh_message = $state<string | null>(null);
    let expanded_skill = $state<string | null>(null);
    let skill_content = $state<string | null>(null);
    let skill_files = $state<{ name: string; content: string }[]>([]);
    let content_loading = $state(false);

    async function load_skills() {
        try {
            skills = await api.list_skills();
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load skills';
        } finally {
            loading = false;
        }
    }

    async function handle_refresh() {
        refreshing = true;
        refresh_message = null;
        try {
            const result = await api.refresh_skills();
            refresh_message = `Found ${result.refreshed} skill${result.refreshed !== 1 ? 's' : ''}`;
            skills = await api.list_skills();
        } catch (err) {
            refresh_message = err instanceof Error ? err.message : 'Refresh failed';
        } finally {
            refreshing = false;
        }
    }

    async function toggle_skill(name: string) {
        if (expanded_skill === name) {
            expanded_skill = null;
            skill_content = null;
            skill_files = [];
            return;
        }
        expanded_skill = name;
        skill_content = null;
        skill_files = [];
        content_loading = true;
        try {
            const full = await api.get_skill(name);
            skill_content = full.content;
            skill_files = full.files ?? [];
        } catch (err) {
            console.error('Failed to load skill content:', err);
            toast_store.error('Failed to load skill content');
            skill_content = 'Failed to load skill content.';
        } finally {
            content_loading = false;
        }
    }

    onMount(() => {
        load_skills();
    });
</script>

<div class="page" aria-busy={loading}>
    <div class="page-header">
        <div class="header-left">
            <h2>Skills</h2>
            <p class="subtitle">Copilot CLI skills available on this system (from ~/.copilot/skills/)</p>
        </div>
        <div class="header-right">
            {#if refresh_message}
                <span class="refresh-msg">{refresh_message}</span>
            {/if}
            <Button variant="secondary" icon={refreshing ? 'progress_activity' : 'refresh'} onclick={handle_refresh} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : 'Refresh Skills'}
            </Button>
        </div>
    </div>

    {#if loading}
        <div class="loading-wrap">
            <LoadingSpinner label="Loading skills…" />
        </div>
    {:else if error}
        <ErrorBanner message={error} />
    {:else if skills.length === 0}
        <EmptyState icon="extension" message="No skills found." detail="Add skill directories to ~/.copilot/skills/" />
    {:else}
        <div class="skills-grid">
            {#each skills as skill (skill.name)}
                {@const is_expanded = expanded_skill === skill.name}
                <div class="skill-card" class:expanded={is_expanded}>
                    <button class="skill-header" aria-expanded={is_expanded} onclick={() => toggle_skill(skill.name)}>
                        <div class="skill-title-row">
                            <span class="icon skill-icon">extension</span>
                            <span class="skill-name">{skill.name}</span>
                            <span class="icon chevron">{is_expanded ? 'expand_less' : 'expand_more'}</span>
                        </div>
                        <p class="skill-description">{skill.description || 'No description available.'}</p>
                        <p class="skill-path">{skill.path}</p>
                    </button>

                    {#if is_expanded}
                        <div class="skill-detail" id="skill-detail-{skill.name}">
                            <div class="detail-divider"></div>
                            {#if content_loading}
                                <div class="content-loading">
                                    <LoadingSpinner size="sm" label="Loading content…" />
                                </div>
                            {:else}
                                <pre class="skill-content">{skill_content}</pre>
                                {#if skill_files.length > 0}
                                    <div class="skill-extra-files">
                                        {#each skill_files as file}
                                            <details class="extra-file">
                                                <summary class="extra-file-name">
                                                    <span class="icon" style="font-size:14px">description</span>
                                                    {file.name}
                                                </summary>
                                                <pre class="skill-content">{file.content}</pre>
                                            </details>
                                        {/each}
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .page {
        padding: 2rem;
        max-width: 960px;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
    }

    .header-left h2 {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--fg);
        margin: 0 0 0.25rem;
    }

    .subtitle {
        font-size: 0.85rem;
        color: var(--fg-muted);
        margin: 0;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-shrink: 0;
    }

    .refresh-msg {
        font-size: 0.82rem;
        color: var(--accent);
        background: rgba(212, 175, 55, 0.1);
        border: 1px solid rgba(212, 175, 55, 0.25);
        border-radius: var(--radius);
        padding: 0.3rem 0.65rem;
    }

    .loading-wrap {
        display: flex;
        justify-content: center;
        padding: 4rem 0;
    }

    .skills-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
        align-items: start;
    }

    .skill-card {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        transition: border-color 0.15s;
    }

    .skill-card:hover {
        border-color: rgba(212, 175, 55, 0.4);
    }

    .skill-card.expanded {
        border-color: var(--accent);
        grid-column: 1 / -1;
    }

    .skill-header {
        width: 100%;
        background: none;
        border: none;
        text-align: left;
        padding: 1rem 1.1rem;
        cursor: pointer;
        color: inherit;
        font-family: inherit;
    }

    .skill-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .skill-icon {
        font-size: 20px;
        color: var(--accent);
        flex-shrink: 0;
    }

    .skill-name {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--fg);
        flex: 1;
    }

    .chevron {
        font-size: 20px;
        color: var(--fg-muted);
        flex-shrink: 0;
    }

    .skill-description {
        font-size: 0.83rem;
        color: var(--fg-muted);
        margin: 0 0 0.4rem;
        line-height: 1.45;
    }

    .skill-path {
        font-size: 0.75rem;
        color: var(--fg-muted);
        opacity: 0.6;
        margin: 0;
        font-family: monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .skill-detail {
        padding: 0 1.1rem 1rem;
    }

    .detail-divider {
        height: 1px;
        background: var(--border);
        margin-bottom: 1rem;
    }

    .content-loading {
        padding: 1rem 0;
    }

    .skill-content {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 2px);
        padding: 1rem;
        font-size: 0.8rem;
        line-height: 1.6;
        color: var(--fg);
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        max-height: 480px;
        overflow-y: auto;
    }

    .skill-extra-files {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.75rem;
    }

    .extra-file-name {
        cursor: pointer;
        font-size: 0.82rem;
        color: var(--accent);
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.3rem 0;
    }

    .extra-file .skill-content {
        margin-top: 0.5rem;
        max-height: 320px;
    }

    @media (max-width: 600px) {
        .page {
            padding: 1rem;
        }

        .page-header {
            flex-direction: column;
        }

        .skills-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
