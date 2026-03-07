<script lang="ts">
    import { Button } from '$lib/components/primitives';
    import { onMount } from 'svelte';
    import { api } from '$lib/api/client';
    import { toast_store } from '$lib/stores/toast.svelte';
    import { EmptyState, ErrorBanner, LoadingSpinner } from '$lib/components';
    import type { SkillInfoListItem } from '$lib/types';
    import SkillCard from './SkillCard.svelte';

    let skills = $state<SkillInfoListItem[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let refreshing = $state(false);
    let refresh_message = $state<string | null>(null);
    let expanded_skill = $state<string | null>(null);
    let skill_content = $state<string | null>(null);
    let skill_files = $state<{ name: string, content: string }[]>([]);
    let content_loading = $state(false);

    async function load_skills() {
        try {
            skills = await api.list_skills();
        }
        catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load skills';
        }
        finally {
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
        }
        catch (err) {
            refresh_message = err instanceof Error ? err.message : 'Refresh failed';
        }
        finally {
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
        }
        catch (err) {
            console.error('Failed to load skill content:', err);
            toast_store.error('Failed to load skill content');
            skill_content = 'Failed to load skill content.';
        }
        finally {
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
                <SkillCard
                    {skill}
                    expanded={expanded_skill === skill.name}
                    content={skill_content}
                    files={skill_files}
                    {content_loading}
                    on_toggle={() => toggle_skill(skill.name)}
                />
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
