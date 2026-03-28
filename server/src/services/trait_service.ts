import type { TypedSupabaseClient } from '../db';
import type { Tables, Enums } from '../database.types';

export interface ResolvedTrait {
    id: string
    name: string
    description: string | null
    target: string
    content: string
    is_global: boolean
    scope_source: 'global' | 'project' | 'feature' | 'task'
}

/**
 * Resolves the effective set of traits for a feature (used by manager agents).
 */
export async function resolve_feature_traits(
    supabase: TypedSupabaseClient,
    feature_id: string,
    project_id: string,
    target: Enums<'agent_type'>
): Promise<ResolvedTrait[]> {
    return resolve_scope_traits(supabase, {
        scope: 'feature',
        feature_id,
        project_id,
        target
    });
}

/**
 * Resolves the effective set of traits for a task by walking the
 * inheritance chain: global → project → feature → task.
 */
export async function resolve_task_traits(
    supabase: TypedSupabaseClient,
    task_id: string,
    target: Enums<'agent_type'>
): Promise<ResolvedTrait[]> {
    const { data: task, error: task_error } = await supabase
        .from('tasks')
        .select('id, feature_id, features(id, project_id)')
        .eq('id', task_id)
        .returns<{ id: string, feature_id: string, features?: { id: string, project_id: string } | null }[]>()
        .single();

    if (task_error || !task) return [];

    const feature_id: string = task.feature_id;
    const project_id: string = task.features?.project_id ?? '';

    return resolve_scope_traits(supabase, {
        scope: 'task',
        task_id,
        feature_id,
        project_id,
        target
    });
}

interface ResolveScopeOptions {
    scope: 'project' | 'feature' | 'task'
    project_id?: string
    feature_id?: string
    task_id?: string
    target?: Enums<'agent_type'>
}

/**
 * Resolves traits for a given scope, applying inheritance and exclusion rules.
 * Global traits are included first, then overridden by narrower scope assignments.
 */
export async function resolve_scope_traits(
    supabase: TypedSupabaseClient,
    options: ResolveScopeOptions
): Promise<ResolvedTrait[]> {
    const { scope, project_id, feature_id, task_id, target } = options;

    // 1. Fetch all traits for this target
    let traits_query = supabase.from('traits').select('*');
    if (target) traits_query = traits_query.eq('target', target);
    const { data: all_traits, error: traits_error } = await traits_query;
    if (traits_error || !all_traits) return [];

    const trait_map = new Map(all_traits.map((trait) => [trait.id, trait]));

    // 2. Start with global traits
    const active: Map<string, { trait: Tables<'traits'>, source: 'global' | 'project' | 'feature' | 'task' }>
        = new Map();

    for (const trait of all_traits) {
        if (trait.is_global) active.set(trait.id, { trait, source: 'global' });
    }

    // 3. Build assignment query for all relevant scopes
    const scope_filters: string[] = [];
    if (project_id) scope_filters.push(`project_id.eq.${project_id}`);
    if (feature_id) scope_filters.push(`feature_id.eq.${feature_id}`);
    if (task_id && scope === 'task') scope_filters.push(`task_id.eq.${task_id}`);

    if (scope_filters.length > 0) {
        const { data: assignments, error: assign_error } = await supabase
            .from('trait_assignments')
            .select('*')
            .or(scope_filters.join(','))
            .order('created_at');

        if (!assign_error && assignments) {
            const scope_order: Record<string, number> = { project: 0, feature: 1, task: 2 };
            assignments.sort(
                (assignment_a, assignment_b) =>
                    scope_order[assignment_a.scope] - scope_order[assignment_b.scope]
            );

            for (const assignment of assignments) {
                const assignment_scope = assignment.scope;

                if (
                    (assignment_scope === 'project' && !project_id)
                    || (assignment_scope === 'feature' && !feature_id)
                    || (assignment_scope === 'task' && !task_id)
                ) {
                    continue;
                }

                if (assignment.is_excluded) {
                    active.delete(assignment.trait_id);
                }
                else {
                    const trait = trait_map.get(assignment.trait_id);
                    if (trait) active.set(assignment.trait_id, { trait, source: assignment_scope });
                }
            }
        }
    }

    return Array.from(active.values()).map(({ trait, source }) => ({
        id: trait.id,
        name: trait.name,
        description: trait.description,
        target: trait.target,
        content: trait.content,
        is_global: trait.is_global,
        scope_source: source
    }));
}
