import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";
import { env } from "./env";
import { supabase_middleware, type AppBindings } from "./middleware/supabase";
import { auth_middleware, admin_middleware } from "./middleware/auth";
import { rate_limit } from "./middleware/rate_limit";
import { auth_routes } from "./routes/auth";
import { projects_routes } from "./routes/projects";
import { features_routes } from "./routes/features";
import { tasks_routes } from "./routes/tasks";
import { agents_routes } from "./routes/agents";
import { prompts_routes } from "./routes/prompts";
import { system_routes } from "./routes/system";
import { chat_routes } from "./routes/chat";
import { traits_routes } from "./routes/traits";
import { skills_routes } from "./routes/skills";
import { usage_routes } from "./routes/usage";
import { admin_routes } from "./routes/admin";
import { watcher_service } from "./services/watcher_service";
import { prompt_service } from "./services/prompt_service";
import { pipeline_service } from "./services/pipeline_service";
import { agent_service } from "./services/agent_service";
import { create_supabase_client } from "./db";

const app = new Hono<AppBindings>();

// ── Error boundary (BE-001) ─────────────────────────────────────────────
app.onError((error, context) => {
    if (error instanceof HTTPException) {
        return context.json(
            { error: { code: error.status, message: error.message } },
            error.status,
        );
    }
    console.error(`[Unhandled Error] ${context.req.method} ${context.req.path}`, error);
    return context.json(
        { error: { code: 500, message: "Internal server error" } },
        500,
    );
});

app.notFound((context) => {
    return context.json(
        { error: { code: 404, message: "Not found" } },
        404,
    );
});

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());

// ── CORS with explicit origin allowlist (BE-002) ────────────────────────
const allowed_origins = env.FRONTEND_URL.split(",").map((origin) => origin.trim());
app.use(
    "*",
    cors({
        origin: allowed_origins,
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);
// ── Request size limit (M-4.3) ──────────────────────────────────────────
app.use("*", async (c, next) => {
    const content_length = parseInt(c.req.header("content-length") ?? "0");
    if (content_length > 1_000_000) {
        return c.json({ error: "Request body too large (max 1MB)" }, 413);
    }
    await next();
});

// ── Global rate limit (M-4.2): 100 requests/minute per IP ──────────────
app.use("*", rate_limit(100, 60_000));

app.use("*", supabase_middleware());

// Health check (no auth)
app.get("/health", (context) => {
    return context.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (no auth required, rate-limited: 10 req/min)
app.use("/api/auth/*", rate_limit(10, 60_000));
app.route("/api/auth", auth_routes);

// Protected API routes
app.use("/api/*", auth_middleware());
// Agent spawning rate limit (M-4.2): 5 req/min
app.use("/api/agents/spawn/*", rate_limit(5, 60_000));
app.route("/api/projects", projects_routes);
app.route("/api/features", features_routes);
app.route("/api/tasks", tasks_routes);
app.route("/api/agents", agents_routes);
app.route("/api/prompts", prompts_routes);
app.route("/api/system", system_routes);
// Chat routes (rate-limited: 20 req/min)
app.use("/api/chat/*", rate_limit(20, 60_000));
app.route("/api/chat", chat_routes);
app.route("/api/traits", traits_routes);
app.route("/api/skills", skills_routes);
app.route("/api/usage", usage_routes);

// Admin routes (auth + role check)
app.use("/api/admin/*", auth_middleware());
app.use("/api/admin/*", admin_middleware());
app.route("/api/admin", admin_routes);

// Boot sequence
async function boot() {
    const supabase = create_supabase_client();

    // 1. Recover stale agent runs from previous server crash
    const now = new Date().toISOString();

    // Find features with interrupted managers BEFORE marking runs as failed
    const { data: interrupted_runs } = await supabase
        .from("agent_runs")
        .select("feature_id")
        .eq("type", "manager")
        .eq("status", "running");
    const interrupted_feature_ids = (interrupted_runs ?? [])
        .map((r: { feature_id: string | null }) => r.feature_id)
        .filter(Boolean);

    await supabase
        .from("agent_runs")
        .update({ status: "failed", error: "Server restarted during execution", finished_at: now })
        .eq("status", "running");
    await supabase
        .from("tasks")
        .update({ status: "Approved" })
        .eq("status", "In_Progress");

    // Only reset features whose managers were actually interrupted
    if (interrupted_feature_ids.length > 0) {
        await supabase
            .from("features")
            .update({ status: "Submitted" })
            .eq("status", "In_Progress")
            .in("id", interrupted_feature_ids);
    }

    // M-6.5: Reset In_Progress features that have no tasks (missing tasks.json scenario)
    const { data: in_progress_features } = await supabase
        .from("features")
        .select("id, tasks(id)")
        .eq("status", "In_Progress");

    for (const feature of in_progress_features ?? []) {
        if (!feature.tasks?.length) {
            await supabase
                .from("features")
                .update({ status: "Submitted" })
                .eq("id", feature.id);
            console.log(`[boot] Reset feature ${feature.id} to Submitted (no tasks found)`);
        }
    }

    console.log("✅ Stale process recovery complete");

    // 2. Sync base prompts from repo files → DB
    await prompt_service.sync_from_repo();

    // 3. Cleanup old workspaces (M-5.4) and expired data (M-5.5)
    agent_service.cleanup_old_workspaces(7);
    await cleanup_expired_data(supabase);

    // Schedule daily cleanup
    setInterval(() => {
        agent_service.cleanup_old_workspaces(7);
        cleanup_expired_data(supabase).catch(console.error);
    }, 24 * 60 * 60 * 1000);

    // 4. Start watcher service (manager-only — pipeline handles task execution)
    watcher_service.start();

    // 5. Start pipeline service — trigger on any already-approved tasks
    pipeline_service.process_next().catch(console.error);
    console.log("✅ Pipeline service started");
}

/** M-5.5: Clean expired sessions and used/expired invite tokens */
async function cleanup_expired_data(supabase: ReturnType<typeof create_supabase_client>) {
    const now = new Date().toISOString();
    const thirty_days_ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Delete expired sessions
    const { count: sessions_deleted } = await supabase
        .from("sessions")
        .delete({ count: "exact" })
        .lt("expires_at", now);

    // Delete used invites older than 30 days
    const { count: used_invites_deleted } = await supabase
        .from("invite_tokens")
        .delete({ count: "exact" })
        .not("used_at", "is", null)
        .lt("used_at", thirty_days_ago);

    // Delete expired unused invites
    const { count: expired_invites_deleted } = await supabase
        .from("invite_tokens")
        .delete({ count: "exact" })
        .is("used_at", null)
        .lt("expires_at", now);

    const total = (sessions_deleted ?? 0) + (used_invites_deleted ?? 0) + (expired_invites_deleted ?? 0);
    if (total > 0) {
        console.log(`🧹 Cleaned ${sessions_deleted ?? 0} expired session(s), ${(used_invites_deleted ?? 0) + (expired_invites_deleted ?? 0)} stale invite(s)`);
    }
}

boot().catch(console.error);

const port = env.PORT;
console.log(`🚀 Server running at http://localhost:${port}`);

export { app };

export default {
    port,
    fetch: app.fetch,
};
