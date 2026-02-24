import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";

export const usage_routes = new Hono<AppBindings>();

// Aggregate summary stats
usage_routes.get("/summary", async (context) => {
    const supabase = context.get("supabase");

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

    // Aggregate duration and token stats
    const { data: stats_data } = await supabase
        .from("agent_runs")
        .select("duration_ms, prompt_tokens, completion_tokens, status");

    const stats = (stats_data ?? []).reduce(
        (accumulator: any, run: any) => ({
            total_duration_ms: accumulator.total_duration_ms + (run.duration_ms ?? 0),
            total_prompt_tokens: accumulator.total_prompt_tokens + (run.prompt_tokens ?? 0),
            total_completion_tokens:
                accumulator.total_completion_tokens + (run.completion_tokens ?? 0),
            completed: accumulator.completed + (run.status === "completed" ? 1 : 0),
            failed: accumulator.failed + (run.status === "failed" ? 1 : 0),
        }),
        { total_duration_ms: 0, total_prompt_tokens: 0, total_completion_tokens: 0, completed: 0, failed: 0 }
    );

    return context.json({
        total_runs: total_result.count ?? 0,
        today_runs: today_result.count ?? 0,
        week_runs: week_result.count ?? 0,
        completed_runs: stats.completed,
        failed_runs: stats.failed,
        total_duration_ms: stats.total_duration_ms,
        total_prompt_tokens: stats.total_prompt_tokens,
        total_completion_tokens: stats.total_completion_tokens,
    });
});

// Paginated run history
usage_routes.get("/history", async (context) => {
    const supabase = context.get("supabase");
    const page = Math.max(1, parseInt(context.req.query("page") ?? "1", 10) || 1);
    const per_page = Math.min(Math.max(1, parseInt(context.req.query("per_page") ?? "20", 10) || 20), 100);
    const type_filter = context.req.query("type");
    const status_filter = context.req.query("status");

    const offset = (page - 1) * per_page;

    let query = supabase
        .from("agent_runs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + per_page - 1);

    if (type_filter) query = query.eq("type", type_filter);
    if (status_filter) query = query.eq("status", status_filter);

    const { data, count, error } = await query;
    if (error) {
        console.error(`[GET /api/usage/history]`, error);
        return context.json({ error: "Failed to fetch history" }, 500);
    }

    return context.json({
        runs: data ?? [],
        total: count ?? 0,
        page,
        per_page,
        total_pages: Math.ceil((count ?? 0) / per_page),
    });
});

// Usage breakdown by type and model
usage_routes.get("/breakdown", async (context) => {
    const supabase = context.get("supabase");

    const { data: runs, error } = await supabase
        .from("agent_runs")
        .select("type, model, status, duration_ms, prompt_tokens, completion_tokens");

    if (error) {
        console.error(`[GET /api/usage/breakdown]`, error);
        return context.json({ error: "Failed to fetch breakdown" }, 500);
    }

    const by_type: Record<string, number> = {};
    const by_model: Record<string, number> = {};
    const by_status: Record<string, number> = {};

    for (const run of runs ?? []) {
        by_type[run.type] = (by_type[run.type] ?? 0) + 1;
        by_status[run.status] = (by_status[run.status] ?? 0) + 1;
        const model_name = run.model || "unknown";
        by_model[model_name] = (by_model[model_name] ?? 0) + 1;
    }

    return context.json({ by_type, by_model, by_status });
});
