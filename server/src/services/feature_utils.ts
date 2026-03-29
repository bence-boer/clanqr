import type { TypedSupabaseClient } from '../db';

/**
 * Check if all tasks for a feature are complete (complete or skipped).
 * If so, mark the feature as done. Single source of truth — used by both
 * sdk_session_service and pipeline_service to avoid race conditions.
 */
export async function check_and_complete_feature(
    feature_id: string,
    supabase: TypedSupabaseClient
): Promise<boolean> {
    const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('feature_id', feature_id)
        .not('status', 'in', '("complete","skipped")');

    if (count === 0) {
        // Only update if still in_progress (prevents double-completion race)
        const { data } = await supabase
            .from('features')
            .update({ status: 'done' })
            .eq('id', feature_id)
            .eq('status', 'in_progress')
            .select('id')
            .single();
        return !!data;
    }
    return false;
}
