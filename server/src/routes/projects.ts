import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";

const create_project_schema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
});

const update_project_schema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    status: z.enum(["Active", "Archived"]).optional(),
});

export const projects_routes = new Hono<AppBindings>();

// List all projects
projects_routes.get("/", async (context) => {
    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(`[GET /api/projects]`, error);
        return context.json({ error: "Failed to fetch projects" }, 500);
    }
    return context.json(data);
});

// Get single project with features
projects_routes.get("/:id", async (context) => {
    const supabase = context.get("supabase");
    const id = context.req.param("id");

    const { data, error } = await supabase
        .from("projects")
        .select("*, features(*)")
        .eq("id", id)
        .single();

    if (error) {
        console.error(`[GET /api/projects/${id}]`, error);
        return context.json({ error: "Project not found" }, 404);
    }
    return context.json(data);
});

// Create project
projects_routes.post("/", async (context) => {
    const body = await context.req.json();
    const parsed = create_project_schema.safeParse(body);

    if (!parsed.success) {
        return context.json({ error: parsed.error.flatten() }, 400);
    }

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("projects")
        .insert(parsed.data)
        .select()
        .single();

    if (error) {
        console.error(`[POST /api/projects]`, error);
        return context.json({ error: "Failed to create project" }, 500);
    }
    return context.json(data, 201);
});

// Update project
projects_routes.patch("/:id", async (context) => {
    const id = context.req.param("id");
    const body = await context.req.json();
    const parsed = update_project_schema.safeParse(body);

    if (!parsed.success) {
        return context.json({ error: parsed.error.flatten() }, 400);
    }

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("projects")
        .update(parsed.data)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error(`[PATCH /api/projects/${id}]`, error);
        return context.json({ error: "Failed to update project" }, 500);
    }
    return context.json(data);
});

// Delete project
projects_routes.delete("/:id", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (error) {
        console.error(`[DELETE /api/projects/${id}]`, error);
        return context.json({ error: "Failed to delete project" }, 500);
    }
    return context.json({ success: true });
});
