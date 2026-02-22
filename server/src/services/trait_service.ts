import type { SupabaseClient } from "../db";
import type { ResolvedTrait, TraitTarget, TraitRow, TraitAssignmentRow } from "../types";

/**
 * Resolves the effective set of traits for a task by walking the
 * inheritance chain: global → project → feature → task.
 */
export async function resolve_task_traits(
    supabase: SupabaseClient,
    task_id: string,
    target: TraitTarget
): Promise<ResolvedTrait[]> {
    const { data: task, error: task_error } = await supabase
        .from("tasks")
        .select("id, feature_id, features(id, project_id)")
        .eq("id", task_id)
        .single();

    if (task_error || !task) return [];

    const feature_id: string = task.feature_id;
    const project_id: string = (task as Record<string, any>).features?.project_id;

    return resolve_scope_traits(supabase, {
        scope: "task",
        task_id,
        feature_id,
        project_id,
        target,
    });
}

interface ResolveScopeOptions {
    scope: "project" | "feature" | "task";
    project_id?: string;
    feature_id?: string;
    task_id?: string;
    target?: TraitTarget;
}

/**
 * Resolves traits for a given scope, applying inheritance and exclusion rules.
 * Global traits are included first, then overridden by narrower scope assignments.
 */
export async function resolve_scope_traits(
    supabase: SupabaseClient,
    options: ResolveScopeOptions
): Promise<ResolvedTrait[]> {
    const { scope, project_id, feature_id, task_id, target } = options;

    // 1. Fetch all traits for this target
    let traits_query = supabase.from("traits").select("*");
    if (target) traits_query = traits_query.eq("target", target);
    const { data: all_traits, error: traits_error } = await traits_query;
    if (traits_error || !all_traits) return [];

    const trait_map = new Map<string, TraitRow>(
        (all_traits as TraitRow[]).map((trait) => [trait.id, trait])
    );

    // 2. Start with global traits
    const active: Map<string, { trait: TraitRow; source: "global" | "project" | "feature" | "task" }> =
        new Map();

    for (const trait of all_traits as TraitRow[]) {
        if (trait.is_global) active.set(trait.id, { trait, source: "global" });
    }

    // 3. Build assignment query for all relevant scopes
    const scope_filters: string[] = [];
    if (project_id) scope_filters.push(`project_id.eq.${project_id}`);
    if (feature_id) scope_filters.push(`feature_id.eq.${feature_id}`);
    if (task_id && scope === "task") scope_filters.push(`task_id.eq.${task_id}`);

    if (scope_filters.length > 0) {
        const { data: assignments, error: assign_error } = await supabase
            .from("trait_assignments")
            .select("*")
            .or(scope_filters.join(","))
            .order("created_at");

        if (!assign_error && assignments) {
            const scope_order: Record<string, number> = { project: 0, feature: 1, task: 2 };
            (assignments as TraitAssignmentRow[]).sort(
                (assignment_a, assignment_b) =>
                    scope_order[assignment_a.scope] - scope_order[assignment_b.scope]
            );

            for (const assignment of assignments as TraitAssignmentRow[]) {
                const assignment_scope = assignment.scope;

                if (
                    (assignment_scope === "project" && !project_id) ||
                    (assignment_scope === "feature" && !feature_id) ||
                    (assignment_scope === "task" && !task_id)
                ) {
                    continue;
                }

                if (assignment.is_excluded) {
                    active.delete(assignment.trait_id);
                } else {
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
        scope_source: source,
    }));
}
