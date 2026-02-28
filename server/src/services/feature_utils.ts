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
    const { data: remaining } = await supabase
        .from("tasks")
        .select("id")
        .eq("feature_id", feature_id)
        .not("status", "in", '("Complete","Skipped")');

    if (!remaining || remaining.length === 0) {
        await supabase
            .from("features")
            .update({ status: "Done" })
            .eq("id", feature_id);
        return true;
    }
    return false;
}
