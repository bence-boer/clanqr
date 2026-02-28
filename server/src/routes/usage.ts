import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";
import { get_usage_summary, get_usage_breakdown } from "../services/usage_service";

export const usage_routes = new Hono<AppBindings>();

// Aggregate summary stats
usage_routes.get("/summary", async (context) => {
    const supabase = context.get("supabase");
    try {
        const summary = await get_usage_summary(supabase);
        return context.json(summary);
    } catch (error) {
        console.error(`[GET /api/usage/summary]`, error);
        return context.json({ error: "Failed to fetch usage summary" }, 500);
    }
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
    try {
        const breakdown = await get_usage_breakdown(supabase);
        return context.json(breakdown);
    } catch (error) {
        console.error(`[GET /api/usage/breakdown]`, error);
        return context.json({ error: "Failed to fetch breakdown" }, 500);
    }
});
