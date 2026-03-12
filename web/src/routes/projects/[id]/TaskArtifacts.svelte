<script lang="ts">
    import { api } from '$lib/api/client';
    import { LoadingSpinner, Checkbox } from '$lib/components';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { ResolvedTrait, SkillLink, Trait } from '$lib/types';

    interface Props {
        task_id: string
    }

    let { task_id }: Props = $props();

    let available_traits = $state<Trait[]>([]);
    let available_skills = $state<{ name: string, description: string }[]>([]);
    let trait_assignments = $state<{ id: string, trait_id: string }[]>([]);
    let skill_links = $state<SkillLink[]>([]);
    let resolved_traits = $state<ResolvedTrait[]>([]);
    let loading = $state(true);
    let resolved_loading = $state(false);

    const scope_labels: Record<string, string> = {
        global: 'Global',
        project: 'From project',
        feature: 'From feature',
        task: 'Direct'
    };

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
            load_resolved();
        }
        catch (error) {
            console.error('Failed to load artifacts:', error);
            toast_store.error('Failed to load artifacts');
        }
        finally {
            loading = false;
        }
    }

    async function load_resolved() {
        resolved_loading = true;
        try {
            resolved_traits = await api.resolve_task_traits(task_id);
        }
        catch {
            resolved_traits = [];
        }
        finally {
            resolved_loading = false;
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
            load_resolved();
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
                        <Checkbox checked={trait_assignments.some((a) => a.trait_id === trait.id)} onchange={() => toggle_trait(trait)} />
                        <span class="artifact-copy">
                            <span class="artifact-name">{trait.name}</span>
                            {#if trait.description}
                                <span class="artifact-desc">{trait.description}</span>
                            {/if}
                        </span>
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
                        <Checkbox checked={skill_links.some((sl) => sl.skill_name === skill.name)} onchange={() => toggle_skill(skill.name)} />
                        <span class="artifact-copy">
                            <span class="artifact-name">{skill.name}</span>
                            {#if skill.description}
                                <span class="artifact-desc">{skill.description}</span>
                            {/if}
                        </span>
                    </label>
                {/each}
            {/if}
        </div>
        <div class="artifacts-section">
            <h5><span class="icon" style="font-size:14px">merge_type</span> Effective Traits</h5>
            {#if resolved_loading}
                <LoadingSpinner size="sm" label="Resolving..." />
            {:else if resolved_traits.length === 0}
                <p class="empty">No traits resolved for this task</p>
            {:else}
                {#each resolved_traits as rt (rt.id)}
                    <div class="resolved-trait">
                        <span class="artifact-name">{rt.name}</span>
                        <span class="scope-badge {rt.scope_source}">{scope_labels[rt.scope_source] ?? rt.scope_source}</span>
                    </div>
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
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
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
        align-items: flex-start;
        gap: 0.65rem;
        font-size: 0.8rem;
        color: var(--fg);
        padding: 0.55rem 0.65rem;
        cursor: pointer;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 2px);
    }
    .artifact-copy {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
        flex: 1;
    }
    .artifact-name {
        font-weight: 600;
        color: var(--fg);
    }
    .artifact-desc {
        color: var(--fg-muted);
        font-size: 0.75rem;
        line-height: 1.45;
    }
    .empty {
        color: var(--fg-muted);
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .resolved-trait {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.45rem 0.65rem;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 2px);
        font-size: 0.8rem;
    }
    .scope-badge {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 0.15rem 0.45rem;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        white-space: nowrap;
    }
    .scope-badge.global { background: rgba(99,102,241,0.12); color: var(--accent, #6366f1); }
    .scope-badge.project { background: rgba(34,197,94,0.12); color: #22c55e; }
    .scope-badge.feature { background: rgba(232,154,46,0.12); color: var(--warning, #e89a2e); }
    .scope-badge.task { background: rgba(201,84,74,0.12); color: var(--danger, #c9544a); }
</style>
