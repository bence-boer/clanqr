<script lang="ts">
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import { api } from '$lib/api/client';
    import { LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives/button';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature, Project, FeatureAgentStatus, AbbreviatedAgentProcess } from '$lib/types';
    import { use_polling } from '$lib/utils/polling.svelte';
    import { SvelteMap } from 'svelte/reactivity';
    import FeatureDetail from './FeatureDetail.svelte';
    import FeatureForm from './FeatureForm.svelte';
    import FeatureList from './FeatureList.svelte';
    import * as actions from './feature_actions';

    let project = $state<Project | null>(null);
    let features = $state<Feature[]>([]);
    let loading = $state(true);
    let show_feature_form = $state(false);
    let selected_feature = $state<Feature | null>(null);
    let show_mobile_detail = $state(false);
    let agent_info = $state<FeatureAgentStatus | null>(null);

    const project_id = $derived(page.params.id);

    function get_deps(): actions.FeatureActionDeps {
        return {
            project_id: project_id ?? '',
            load_data,
            set_show_form: (show: boolean) => {
                show_feature_form = show;
            },
            clear_selection: (feature_id?: string) => {
                if (!feature_id || selected_feature?.id === feature_id) {
                    selected_feature = null;
                    show_mobile_detail = false;
                }
            }
        };
    }

    function reconcile<ItemType extends { id: string }>(current: ItemType[], incoming: ItemType[]): ItemType[] {
        const map = new SvelteMap(incoming.map((item) => [item.id, item]));
        const result: ItemType[] = [];
        for (const item of current) {
            const updated = map.get(item.id);
            if (updated) {
                Object.assign(item, updated);
                result.push(item);
                map.delete(item.id);
            }
        }
        for (const item of map.values()) result.push(item);
        return result;
    }

    async function load_data() {
        if (!project_id) return;
        try {
            const [p, f] = await Promise.all([api.get_project(project_id), api.list_features(project_id)]);
            project = p;
            features = reconcile(features, f);
            if (selected_feature) {
                selected_feature = features.find((feat: Feature) => feat.id === (selected_feature as Feature).id) ?? null;
            }
        }
        catch (error) {
            console.error('Failed to load project:', error);
            toast_store.error('Failed to load project');
        }
        finally {
            loading = false;
        }
    }

    async function load_agent_status() {
        if (!selected_feature) {
            agent_info = null;
            return;
        }
        try {
            agent_info = await api.feature_agent_status(selected_feature.id);
            if (!agent_info) return;
            const has_running = (agent_info?.processes?.some((p: AbbreviatedAgentProcess) => p.status === 'running') ?? false) || (agent_info.pipeline.is_active_feature && agent_info.pipeline.state === 'running');
            if (has_running) load_data();
        }
        catch (err) {
            console.error('Failed to load feature agent status:', err);
            toast_store.error('Failed to load feature agent status');
        }
    }

    use_polling(() => {
        load_data();
        if (selected_feature) load_agent_status();
    }, 5000);

    function select_feature(feature: Feature) {
        selected_feature = feature;
        show_mobile_detail = true;
    }
</script>

<div class="page">
    {#if loading}
        <LoadingSpinner label="Loading..." />
    {:else if !project}
        <p class="error">Project not found</p>
    {:else}
        <div class="page-header">
            <div>
                <a href={resolve('/projects')} class="back-link">
                    <span class="icon" style="font-size:16px">arrow_back</span> Projects
                </a>
                <h2>{project.name}</h2>
                {#if project.description}
                    <p class="project-desc">{project.description}</p>
                {/if}
            </div>
            <Button variant="primary" onclick={() => (show_feature_form = !show_feature_form)}>
                <span class="icon">{show_feature_form ? 'close' : 'add'}</span>
                {show_feature_form ? 'Cancel' : 'New Feature'}
            </Button>
        </div>

        {#if show_feature_form}
            <FeatureForm on_create={(data) => actions.create_feature(get_deps(), data)} on_cancel={() => (show_feature_form = false)} />
        {/if}

        <div class="content-grid" class:show-detail={show_mobile_detail}>
            <FeatureList
                {features} {selected_feature}
                on_select={select_feature}
                on_delete_selected={(ids) => actions.delete_selected_features(get_deps(), ids)}
            />

            <div class="detail-panel">
                {#if selected_feature}
                    <FeatureDetail
                        feature={selected_feature}
                        {agent_info}
                        on_submit={(id) => actions.submit_feature(get_deps(), id)}
                        on_delete={(id) => actions.delete_feature(get_deps(), id)}
                        on_update={load_data}
                        on_back={() => (show_mobile_detail = false)}
                    />
                {:else}
                    <div class="empty-detail">
                        <span class="icon" style="font-size:48px;color:var(--fg-muted)">touch_app</span>
                        <p>Select a feature to view details</p>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .page { max-width: 1100px; }
    .page-header {
        display: flex; justify-content: space-between; align-items: flex-start;
        margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;
    }
    .back-link {
        color: var(--accent); text-decoration: none; font-size: 0.85rem;
        display: inline-flex; align-items: center; gap: 0.25rem;
    }
    .page-header h2 { font-size: 1.5rem; color: var(--fg); margin-top: 0.25rem; }
    .project-desc { color: var(--fg-muted); font-size: 0.9rem; }
    .content-grid {
        display: grid; grid-template-columns: 280px 1fr;
        gap: 1rem; min-height: 400px;
    }
    .detail-panel {
        background: var(--bg-surface); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 1.25rem;
    }
    .empty-detail {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; height: 200px; color: var(--fg-muted); gap: 0.75rem;
    }
    @media (max-width: 768px) {
        .content-grid { display: flex; flex-direction: column; }
        .content-grid > :first-child { display: block; }
        .content-grid .detail-panel { display: none; }
        .content-grid.show-detail > :first-child { display: none; }
        .content-grid.show-detail .detail-panel { display: block; }
    }
</style>
