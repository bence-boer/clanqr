import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";
import { get_system_stats, get_models } from "../services/system_service";

export const system_routes = new Hono<AppBindings>();

system_routes.get("/stats", async (context) => {
  const stats = await get_system_stats();
  return context.json(stats);
});

system_routes.get("/models", async (context) => {
  const cli = context.req.query("cli") || "copilot";
  const models = await get_models(cli);
  return context.json(models);
});
