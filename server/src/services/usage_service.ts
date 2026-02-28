import type { SupabaseClient } from "../db";

export interface UsageSummaryStats {
    total_runs: number;
    today_runs: number;
    week_runs: number;
    completed_runs: number;
    failed_runs: number;
    total_duration_ms: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
}

export interface UsageBreakdownStats {
    by_type: Record<string, number>;
    by_model: Record<string, number>;
    by_status: Record<string, number>;
}

export async function get_usage_summary(supabase: SupabaseClient): Promise<UsageSummaryStats> {
    const now = new Date();
    const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const week_start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [total_result, today_result, week_result] = await Promise.all([
        supabase.from("agent_runs").select("id", { count: "exact", head: true }),
        supabase
            .from("agent_runs")
            .select("id", { count: "exact", head: true })
            .gte("created_at", today_start),
        supabase
            .from("agent_runs")
            .select("id", { count: "exact", head: true })
            .gte("created_at", week_start),
    ]);

    const { data: stats_data } = await supabase
        .from("agent_runs")
        .select("duration_ms, prompt_tokens, completion_tokens, status");

    const stats = (stats_data ?? []).reduce(
        (acc: { total_duration_ms: number; total_prompt_tokens: number; total_completion_tokens: number; completed: number; failed: number }, run: { duration_ms: number | null; prompt_tokens: number | null; completion_tokens: number | null; status: string }) => ({
            total_duration_ms: acc.total_duration_ms + (run.duration_ms ?? 0),
            total_prompt_tokens: acc.total_prompt_tokens + (run.prompt_tokens ?? 0),
            total_completion_tokens: acc.total_completion_tokens + (run.completion_tokens ?? 0),
            completed: acc.completed + (run.status === "completed" ? 1 : 0),
            failed: acc.failed + (run.status === "failed" ? 1 : 0),
        }),
        { total_duration_ms: 0, total_prompt_tokens: 0, total_completion_tokens: 0, completed: 0, failed: 0 }
    );

    return {
        total_runs: total_result.count ?? 0,
        today_runs: today_result.count ?? 0,
        week_runs: week_result.count ?? 0,
        completed_runs: stats.completed,
        failed_runs: stats.failed,
        total_duration_ms: stats.total_duration_ms,
        total_prompt_tokens: stats.total_prompt_tokens,
        total_completion_tokens: stats.total_completion_tokens,
    };
}

export async function get_usage_breakdown(supabase: SupabaseClient): Promise<UsageBreakdownStats> {
    const { data: runs, error } = await supabase
        .from("agent_runs")
        .select("type, model, status, duration_ms, prompt_tokens, completion_tokens");

    if (error) throw error;

    const by_type: Record<string, number> = {};
    const by_model: Record<string, number> = {};
    const by_status: Record<string, number> = {};

    for (const run of runs ?? []) {
        by_type[run.type] = (by_type[run.type] ?? 0) + 1;
        by_status[run.status] = (by_status[run.status] ?? 0) + 1;
        const model_name = run.model || "unknown";
        by_model[model_name] = (by_model[model_name] ?? 0) + 1;
    }

    return { by_type, by_model, by_status };
}
