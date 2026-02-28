import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";
import { prompt_service } from "../services/prompt_service";

const update_schema = z.object({ content: z.string().min(1) });
const role_schema = z.enum(["manager", "ralph"]);

export const prompts_routes = new Hono<AppBindings>();

// List all prompts
prompts_routes.get("/", async (context) => {
    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("role");

    if (error) {
        console.error(`[GET /api/prompts]`, error);
        return context.json({ error: "Failed to fetch prompts" }, 500);
    }
    return context.json(data);
});

// Re-sync prompts from repo files (before /:role to avoid conflict)
prompts_routes.post("/sync", async (_context) => {
    await prompt_service.sync_from_repo();
    return _context.json({ success: true, message: "Prompts synced from repo" });
});

// Get prompt by role
prompts_routes.get("/:role", async (context) => {
    const role = context.req.param("role");
    if (!role_schema.safeParse(role).success) {
        return context.json({ error: "Invalid role: must be 'manager' or 'ralph'" }, 400);
    }
    const supabase = context.get("supabase");

    const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .eq("role", role)
        .single();

    if (error || !data) return context.json({ error: "Prompt not found" }, 404);
    return context.json(data);
});

// Update prompt content
prompts_routes.patch("/:role", async (context) => {
    const role = context.req.param("role");
    if (!role_schema.safeParse(role).success) {
        return context.json({ error: "Invalid role: must be 'manager' or 'ralph'" }, 400);
    }
    const body = await context.req.json();
    const result = update_schema.safeParse(body);

    if (!result.success) {
        return context.json({ error: result.error.format() }, 400);
    }

    const ok = await prompt_service.update_prompt(role, result.data.content);
    if (!ok) return context.json({ error: "Failed to update prompt" }, 500);

    const supabase = context.get("supabase");
    const { data } = await supabase
        .from("prompts")
        .select("*")
        .eq("role", role)
        .single();

    return context.json(data);
});
