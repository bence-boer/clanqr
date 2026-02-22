import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";
import { skill_service } from "../services/skill_service";

const link_schema = z.object({
    task_id: z.string().uuid(),
    skill_name: z.string().min(1),
});

export const skills_routes = new Hono<AppBindings>();

// List all available Copilot CLI skills (scanned from ~/.copilot/skills/)
skills_routes.get("/", async (context) => {
    const skills = await skill_service.list_skills();
    // Omit full content from list — content is large
    return context.json(
        skills.map((skill) => ({
            name: skill.name,
            description: skill.description,
            path: skill.path,
        }))
    );
});

// Refresh skill cache
skills_routes.post("/refresh", async (_context) => {
    const skills = await skill_service.refresh_cache();
    return _context.json({ refreshed: skills.length });
});

// Get skills linked to a specific task — must come before /:name to avoid conflict
skills_routes.get("/task/:task_id", async (context) => {
    const task_id = context.req.param("task_id");
    const supabase = context.get("supabase");

    const { data, error } = await supabase
        .from("skill_links")
        .select("*")
        .eq("task_id", task_id)
        .order("created_at");

    if (error) {
        console.error(`[GET /api/skills/task/${task_id}]`, error);
        return context.json({ error: "Failed to fetch task skills" }, 500);
    }
    return context.json(data ?? []);
});

// Link a skill to a task
skills_routes.post("/link", async (context) => {
    const result = link_schema.safeParse(await context.req.json());
    if (!result.success) return context.json({ error: result.error.format() }, 400);

    const { task_id, skill_name } = result.data;

    // Verify the skill actually exists
    const skill = await skill_service.get_skill(skill_name);
    if (!skill) return context.json({ error: `Skill '${skill_name}' not found` }, 404);

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("skill_links")
        .insert({ task_id, skill_name })
        .select("*")
        .single();

    if (error) {
        console.error(`[POST /api/skills/link]`, error);
        return context.json({ error: "Failed to link skill" }, 500);
    }
    return context.json(data, 201);
});

// Unlink a skill from a task
skills_routes.delete("/link/:id", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { error } = await supabase.from("skill_links").delete().eq("id", id);
    if (error) {
        console.error(`[DELETE /api/skills/link/${id}]`, error);
        return context.json({ error: "Failed to unlink skill" }, 500);
    }
    return context.json({ success: true });
});

// Get skill detail (full SKILL.md content)
skills_routes.get("/:name", async (context) => {
    const name = context.req.param("name");
    const skill = await skill_service.get_skill(name);
    if (!skill) return context.json({ error: "Skill not found" }, 404);
    return context.json(skill);
});
