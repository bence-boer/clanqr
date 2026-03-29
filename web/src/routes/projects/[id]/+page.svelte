<script lang="ts">
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import { api } from '$lib/api/client';
    import { LoadingSpinner } from '$lib/components';
    import { Button } from '$lib/components/primitives/button';
    import { toast_store } from '$lib/stores/toast.svelte';
    import type { Feature, Project } from '$lib/types';
    import { use_event_stream } from '$lib/utils/event-stream.svelte';
    import { onMount } from 'svelte';
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
        const result: ItemType[] = current.filter((item) => {
            const updated = map.get(item.id);
            if (updated) {
                Object.assign(item, updated);
                map.delete(item.id);
                return true;
            }
            return false;
        });
        for (const item of map.values()) result.push(item);
        return result;
    }

    async function load_data() {
        if (!project_id) return;
        try {
            const p = await api.get_project(project_id);
            project = p;
            const incoming_features = (p as Record<string, unknown>).features as Feature[] ?? [];
            features = reconcile(features, incoming_features);
            if (selected_feature) {
                selected_feature = features.find((feat: Feature) => feat.id === (selected_feature as Feature).id) ?? null;
            }
            // Deep-link to feature via query param
            const feature_param = new URLSearchParams(window.location.search).get('feature');
            if (feature_param && !selected_feature) {
                const target = features.find((feat: Feature) => feat.id === feature_param);
                if (target) {
                    selected_feature = target;
                    show_mobile_detail = true;
                }
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

    function refresh_all() {
        load_data();
    }

    use_event_stream(
        { features_update: refresh_all, tasks_update: refresh_all },
        refresh_all,
        15_000
    );

    onMount(() => {
        load_data();
    });

    function select_feature(feature: Feature) {
        selected_feature = feature;
        show_mobile_detail = true;
    }

    async function handle_duplicate() {
        if (!selected_feature) return;
        await actions.duplicate_feature(get_deps(), selected_feature);
    }

    async function handle_delete_feature(id: string) {
        const deps = get_deps();
        deps.clear_selection(id);
        try {
            await api.delete_feature(id);
            await deps.load_data();
        }
        catch (error) {
            console.error('Failed to delete feature:', error);
            toast_store.error('Failed to delete feature');
        }
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
            <div class="list-panel" class:slide-out={show_mobile_detail}>
                <FeatureList
                    {features} {selected_feature}
                    on_select={select_feature}
                    on_delete_selected={(ids) => actions.delete_selected_features(get_deps(), ids)}
                />
            </div>

            <div class="detail-panel" class:slide-in={show_mobile_detail}>
                {#if selected_feature}
                    <FeatureDetail
                        feature={selected_feature}
                        on_submit={(id) => actions.submit_feature(get_deps(), id)}
                        on_delete={handle_delete_feature}
                        on_duplicate={handle_duplicate}
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
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem; }
    .back-link { color: var(--accent); text-decoration: none; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.25rem; }
    .page-header h2 { font-size: 1.5rem; color: var(--fg); margin-top: 0.25rem; }
    .project-desc { color: var(--fg-muted); font-size: 0.9rem; }
    .content-grid { display: grid; grid-template-columns: 280px 1fr; gap: 1rem; min-height: 400px; }
    .detail-panel { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
    .empty-detail { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: var(--fg-muted); gap: 0.75rem; }
    @media (max-width: 768px) {
        .content-grid { display: flex; flex-direction: row; overflow: hidden; width: 100%; gap: 0; min-height: 300px; }
        .list-panel, .detail-panel { flex: 0 0 100%; width: 100%; position: relative; transition: left 200ms ease; left: 0; }
        .list-panel.slide-out, .detail-panel.slide-in { left: -100%; }
    }
</style>
