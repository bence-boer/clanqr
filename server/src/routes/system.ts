import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";
import { get_system_stats } from "../services/system_service";
import { COPILOT_BIN, ENRICHED_PATH } from "../env";

export const system_routes = new Hono<AppBindings>();

system_routes.get("/stats", async (context) => {
  const stats = await get_system_stats();
  return context.json(stats);
});

// Available models (parsed from copilot CLI)
let cached_models: { value: string; label: string }[] | null = null;

system_routes.get("/models", async (context) => {
  if (cached_models) return context.json(cached_models);

  try {
    const proc = Bun.spawn([COPILOT_BIN, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: ENRICHED_PATH },
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const match = output.match(/--model\s+<model>\s+.*?\(choices:\s*([\s\S]*?)\)/);
    if (match) {
      const choices_str = match[1];
      const model_ids = [...choices_str.matchAll(/"([^"]+)"/g)].map(m => m[1]);
      cached_models = [
        { value: "", label: "Default (auto)" },
        ...model_ids.map(id => ({ value: id, label: format_model_label(id) })),
      ];
    }
  } catch (err) {
    console.error("[GET /api/system/models] Failed to parse models from CLI:", err);
  }

  if (!cached_models) {
    cached_models = [{ value: "", label: "Default (auto)" }];
  }

  return context.json(cached_models);
});

function format_model_label(id: string): string {
  return id
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
