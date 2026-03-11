import { api } from '$lib/api/client';
import { toast_store } from '$lib/stores/toast.svelte';
import type { FailureBehavior } from '$lib/types';

export interface FeatureActionDeps {
    project_id: string
    load_data: () => Promise<void>
    set_show_form: (show: boolean) => void
    clear_selection: (feature_id?: string) => void
}

export interface CreateFeatureData {
    title: string
    description?: string
    cli: string
    execution_cli: string
    planning_model: string | null
    execution_model: string | null
    on_task_failure: FailureBehavior
    task_timeout_minutes: number
    resources: { url: string, title?: string }[]
}

export async function create_feature(
    deps: FeatureActionDeps,
    data: CreateFeatureData
) {
    type FeatureInput = Parameters<typeof api.create_feature>[0];
    try {
        await api.create_feature({
            project_id: deps.project_id,
            title: data.title,
            description: data.description,
            cli: data.cli,
            execution_cli: data.execution_cli,
            planning_model: data.planning_model,
            execution_model: data.execution_model,
            on_task_failure: data.on_task_failure,
            task_timeout_minutes: data.task_timeout_minutes,
            resources: data.resources.length > 0 ? (data.resources as FeatureInput['resources']) : undefined
        });
        deps.set_show_form(false);
        await deps.load_data();
    }
    catch (error) {
        console.error('Failed to create feature:', error);
        toast_store.error('Failed to create feature');
    }
}

export async function submit_feature(deps: FeatureActionDeps, feature_id: string) {
    try {
        await api.submit_feature(feature_id);
        toast_store.success('Feature submitted! AI is analyzing your request…');
        await deps.load_data();
    }
    catch (error) {
        console.error('Failed to submit feature:', error);
        toast_store.error('Failed to submit feature');
    }
}

export async function delete_feature(deps: FeatureActionDeps, feature_id: string) {
    if (!confirm('Delete this feature?')) return;
    try {
        await api.delete_feature(feature_id);
        deps.clear_selection(feature_id);
        await deps.load_data();
    }
    catch (error) {
        console.error('Failed to delete feature:', error);
        toast_store.error('Failed to delete feature');
    }
}

export async function delete_selected_features(deps: FeatureActionDeps, ids: Set<string>) {
    try {
        await Promise.all([...ids].map((id) => api.delete_feature(id)));
        deps.clear_selection();
        await deps.load_data();
    }
    catch (error) {
        console.error('Failed to delete features:', error);
        toast_store.error('Failed to delete features');
    }
}

export async function duplicate_feature(
    deps: FeatureActionDeps,
    source: {
        title: string
        description?: string | null
        cli?: string | null
        execution_cli?: string | null
        planning_model?: string | null
        execution_model?: string | null
        on_task_failure?: FailureBehavior | null
        task_timeout_minutes?: number | null
        resources?: { url: string, title?: string | null }[] | null
    }
) {
    type FeatureInput = Parameters<typeof api.create_feature>[0];
    try {
        const resources_input = (source.resources ?? [])
            .map((r) => ({ url: r.url, title: r.title ?? undefined }))
            .filter((r) => r.url);
        await api.create_feature({
            project_id: deps.project_id,
            title: `${source.title} (copy)`,
            description: source.description ?? undefined,
            cli: source.cli ?? 'copilot',
            execution_cli: source.execution_cli ?? source.cli ?? 'copilot',
            planning_model: source.planning_model ?? null,
            execution_model: source.execution_model ?? null,
            on_task_failure: source.on_task_failure ?? 'stop',
            task_timeout_minutes: source.task_timeout_minutes ?? 10,
            resources: resources_input.length > 0 ? (resources_input as FeatureInput['resources']) : undefined
        });
        toast_store.success('Feature duplicated');
        await deps.load_data();
    }
    catch (error) {
        console.error('Failed to duplicate feature:', error);
        toast_store.error('Failed to duplicate feature');
    }
}
