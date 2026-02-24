import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";
import { get_system_stats } from "../services/system_service";
import { COPILOT_BIN, GEMINI_BIN, ENRICHED_PATH } from "../env";

export const system_routes = new Hono<AppBindings>();

system_routes.get("/stats", async (context) => {
  const stats = await get_system_stats();
  return context.json(stats);
});

// Available models cache
let cached_copilot_models: { value: string; label: string }[] | null = null;
let cached_gemini_models: { value: string; label: string }[] | null = [
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

system_routes.get("/models", async (context) => {
  const cli = context.req.query("cli") || "copilot";

  if (cli === "gemini") {
    return context.json(cached_gemini_models);
  }

  if (cached_copilot_models) return context.json(cached_copilot_models);

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
      cached_copilot_models = model_ids.map(id => ({ value: id, label: format_model_label(id) }));
    }
  } catch (err) {
    console.error("[GET /api/system/models] Failed to parse models from Copilot CLI:", err);
  }

  if (!cached_copilot_models) {
    cached_copilot_models = [];
  }

  return context.json(cached_copilot_models);
});

function format_model_label(id: string): string {
  return id
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
