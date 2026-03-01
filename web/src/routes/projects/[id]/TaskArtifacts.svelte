<script lang="ts">
    import { api } from '$lib/api/client';
    import { LoadingSpinner } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { SkillLink, Trait } from '$lib/types';

    interface Props {
        task_id: string
    }

    let { task_id }: Props = $props();

    let available_traits = $state<Trait[]>([]);
    let available_skills = $state<{ name: string, description: string }[]>([]);
    let trait_assignments = $state<{ id: string, trait_id: string }[]>([]);
    let skill_links = $state<SkillLink[]>([]);
    let loading = $state(true);

    async function load() {
        loading = true;
        try {
            const [traits, skills, assignments, links] = await Promise.all([
                api.list_traits('ralph'),
                api.list_skills(),
                api.list_trait_assignments({ scope: 'task', task_id }),
                api.get_task_skills(task_id)
            ]);
            available_traits = traits;
            available_skills = skills;
            trait_assignments = assignments;
            skill_links = links;
        }
        catch (error) {
            console.error('Failed to load artifacts:', error);
            toast_store.error('Failed to load artifacts');
        }
        finally {
            loading = false;
        }
    }

    async function toggle_trait(trait: Trait) {
        const existing = trait_assignments.find((a) => a.trait_id === trait.id);
        try {
            if (existing) {
                await api.remove_trait_assignment(existing.id);
            }
            else {
                await api.assign_trait({ trait_id: trait.id, scope: 'task', task_id });
            }
            trait_assignments = await api.list_trait_assignments({ scope: 'task', task_id });
        }
        catch (error) {
            console.error('Failed to toggle trait:', error);
            toast_store.error('Failed to toggle trait');
        }
    }

    async function toggle_skill(skill_name: string) {
        const existing = skill_links.find((sl) => sl.skill_name === skill_name);
        try {
            if (existing) {
                await api.unlink_skill(existing.id);
            }
            else {
                await api.link_skill(task_id, skill_name);
            }
            skill_links = await api.get_task_skills(task_id);
        }
        catch (error) {
            console.error('Failed to toggle skill:', error);
            toast_store.error('Failed to toggle skill');
        }
    }

    // Load immediately on mount
    load();
</script>

<div class="artifacts-panel">
    {#if loading}
        <LoadingSpinner size="sm" label="Loading..." />
    {:else}
        <div class="artifacts-section">
            <h5><span class="icon" style="font-size:14px">psychology</span> Traits</h5>
            {#if available_traits.length === 0}
                <p class="empty">No traits available</p>
            {:else}
                {#each available_traits as trait (trait.id)}
                    <label class="artifact-check">
                        <input type="checkbox" checked={trait_assignments.some((a) => a.trait_id === trait.id)} onchange={() => toggle_trait(trait)} />
                        <span class="artifact-name">{trait.name}</span>
                        {#if trait.description}
                            <span class="artifact-desc">{trait.description}</span>
                        {/if}
                    </label>
                {/each}
            {/if}
        </div>
        <div class="artifacts-section">
            <h5><span class="icon" style="font-size:14px">extension</span> Skills</h5>
            {#if available_skills.length === 0}
                <p class="empty">No skills available</p>
            {:else}
                {#each available_skills as skill (skill.name)}
                    <label class="artifact-check">
                        <input type="checkbox" checked={skill_links.some((sl) => sl.skill_name === skill.name)} onchange={() => toggle_skill(skill.name)} />
                        <span class="artifact-name">{skill.name}</span>
                        {#if skill.description}
                            <span class="artifact-desc">{skill.description}</span>
                        {/if}
                    </label>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    .artifacts-panel {
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
    }
    .artifacts-section {
        margin-bottom: 0.75rem;
    }
    .artifacts-section:last-child {
        margin-bottom: 0;
    }
    .artifacts-section h5 {
        font-size: 0.8rem;
        color: var(--fg-muted);
        margin-bottom: 0.4rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }
    .artifact-check {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
        font-size: 0.8rem;
        color: var(--fg);
        padding: 0.2rem 0;
        cursor: pointer;
    }
    .artifact-check input {
        margin: 0;
        flex-shrink: 0;
    }
    .artifact-name {
        font-weight: 600;
    }
    .artifact-desc {
        color: var(--fg-muted);
        font-size: 0.75rem;
    }
    .empty {
        color: var(--fg-muted);
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
</style>
