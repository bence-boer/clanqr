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
import { watcher_service } from "./services/watcher_service";

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

// Start the watcher service
watcher_service.start();

const port = Number(process.env.PORT ?? 3001);
console.log(`🚀 Server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
