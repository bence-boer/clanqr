import type { SupabaseClient } from "../db";

/**
 * Check if all tasks for a feature are complete (Complete or Skipped).
 * If so, mark the feature as Done. Single source of truth — used by both
 * agent_service and pipeline_service to avoid race conditions.
 */
export async function check_and_complete_feature(
    feature_id: string,
    supabase: SupabaseClient
): Promise<boolean> {
    const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("feature_id", feature_id)
        .not("status", "in", '("Complete","Skipped")');

    if (count === 0) {
        // Only update if still In_Progress (prevents double-completion race)
        const { data } = await supabase
            .from("features")
            .update({ status: "Done" })
            .eq("id", feature_id)
            .eq("status", "In_Progress")
            .select("id")
            .single();
        return !!data;
    }
    return false;
}
