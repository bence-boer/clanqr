import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";
import { supabase_middleware, type AppBindings } from "./middleware/supabase";
import { auth_middleware } from "./middleware/auth";
import { auth_routes } from "./routes/auth";
import { projects_routes } from "./routes/projects";
import { features_routes } from "./routes/features";
import { tasks_routes } from "./routes/tasks";
import { agents_routes } from "./routes/agents";
import { prompts_routes } from "./routes/prompts";
import { system_routes } from "./routes/system";
import { chat_routes } from "./routes/chat";
import { watcher_service } from "./services/watcher_service";
import { prompt_service } from "./services/prompt_service";
import { create_supabase_client } from "./db";

const app = new Hono<AppBindings>();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use("*", supabase_middleware());

// Health check (no auth)
app.get("/health", (context) => {
  return context.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (no auth required)
app.route("/api/auth", auth_routes);

// Protected API routes
app.use("/api/*", auth_middleware());
app.route("/api/projects", projects_routes);
app.route("/api/features", features_routes);
app.route("/api/tasks", tasks_routes);
app.route("/api/agents", agents_routes);
app.route("/api/prompts", prompts_routes);
app.route("/api/system", system_routes);
app.route("/api/chat", chat_routes);

// Boot sequence
async function boot() {
  const supabase = create_supabase_client();

  // 1. Recover stale agent runs from previous server crash
  const now = new Date().toISOString();
  await supabase
    .from("agent_runs")
    .update({ status: "failed", error: "Server restarted during execution", finished_at: now })
    .eq("status", "running");
  await supabase
    .from("tasks")
    .update({ status: "Approved" })
    .eq("status", "In_Progress");
  console.log("✅ Stale process recovery complete");

  // 2. Sync base prompts from repo files → DB
  await prompt_service.sync_from_repo();

  // 3. Start watcher service
  watcher_service.start();
}

boot().catch(console.error);

const port = Number(process.env.PORT ?? 3001);
console.log(`🚀 Server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
