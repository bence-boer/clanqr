import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";
import { get_system_stats, get_models } from "../services/system_service";

const cli_schema = z.enum(["copilot", "gemini"]);

export const system_routes = new Hono<AppBindings>();

system_routes.get("/stats", async (context) => {
  const stats = await get_system_stats();
  return context.json(stats);
});

system_routes.get("/models", async (context) => {
  const raw = context.req.query("cli") ?? "copilot";
  const result = cli_schema.safeParse(raw);
  if (!result.success) {
    return context.json({ error: "Invalid cli parameter: must be 'copilot' or 'gemini'" }, 400);
  }
  const models = await get_models(result.data);
  return context.json(models);
});
