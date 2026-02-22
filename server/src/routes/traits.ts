import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";
import { resolve_task_traits, resolve_scope_traits } from "../services/trait_service";
import type { ResolvedTrait } from "../types";

const create_trait_schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    target: z.enum(["manager", "ralph"]),
    content: z.string().min(1),
    is_global: z.boolean().default(false),
});

const update_trait_schema = create_trait_schema.partial();

const assign_schema = z.object({
    trait_id: z.string().uuid(),
    scope: z.enum(["project", "feature", "task"]),
    project_id: z.string().uuid().optional(),
    feature_id: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
    is_excluded: z.boolean().default(false),
    assigned_by: z.string().default("user"),
});

export const traits_routes = new Hono<AppBindings>();

// List all traits
traits_routes.get("/", async (context) => {
    const supabase = context.get("supabase");
    const target = context.req.query("target");

    let query = supabase.from("traits").select("*").order("name");
    if (target === "manager" || target === "ralph") {
        query = query.eq("target", target);
    }

    const { data, error } = await query;
    if (error) {
        console.error(`[GET /api/traits]`, error);
        return context.json({ error: "Failed to fetch traits" }, 500);
    }
    return context.json(data);
});

// Create trait
traits_routes.post("/", async (context) => {
    const result = create_trait_schema.safeParse(await context.req.json());
    if (!result.success) return context.json({ error: result.error.format() }, 400);

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("traits")
        .insert(result.data)
        .select("*")
        .single();

    if (error) {
        console.error(`[POST /api/traits]`, error);
        return context.json({ error: "Failed to create trait" }, 500);
    }
    return context.json(data, 201);
});

// Assign trait to a scope — must come before /:id to avoid conflict
// List assignments (filtered by scope + ID)
traits_routes.get("/assign", async (context) => {
    const supabase = context.get("supabase");
    const { scope, task_id, feature_id, project_id } = context.req.query();
    let query = supabase.from("trait_assignments").select("*");
    if (scope) query = query.eq("scope", scope);
    if (task_id) query = query.eq("task_id", task_id);
    if (feature_id) query = query.eq("feature_id", feature_id);
    if (project_id) query = query.eq("project_id", project_id);
    const { data, error } = await query;
    if (error) {
        console.error(`[GET /api/traits/assign]`, error);
        return context.json({ error: "Failed to fetch assignments" }, 500);
    }
    return context.json(data);
});

traits_routes.post("/assign", async (context) => {
    const result = assign_schema.safeParse(await context.req.json());
    if (!result.success) return context.json({ error: result.error.format() }, 400);

    const { scope, project_id, feature_id, task_id } = result.data;

    // Validate scope matches provided IDs
    if (scope === "project" && !project_id) {
        return context.json({ error: "project_id required for project scope" }, 400);
    }
    if (scope === "feature" && !feature_id) {
        return context.json({ error: "feature_id required for feature scope" }, 400);
    }
    if (scope === "task" && !task_id) {
        return context.json({ error: "task_id required for task scope" }, 400);
    }

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("trait_assignments")
        .insert(result.data)
        .select("*")
        .single();

    if (error) {
        console.error(`[POST /api/traits/assign]`, error);
        return context.json({ error: "Failed to assign trait" }, 500);
    }
    return context.json(data, 201);
});

// Resolve effective traits for a task (walks inheritance chain)
traits_routes.get("/resolve/:task_id", async (context) => {
    const task_id = context.req.param("task_id");
    const supabase = context.get("supabase");

    const resolved = await resolve_task_traits(supabase, task_id, "ralph");
    return context.json(resolved);
});

// Resolve effective traits for a feature
traits_routes.get("/resolve/feature/:id", async (context) => {
    const feature_id = context.req.param("id");
    const supabase = context.get("supabase");

    const { data: feature, error } = await supabase
        .from("features")
        .select("id, project_id")
        .eq("id", feature_id)
        .single();

    if (error || !feature) return context.json({ error: "Feature not found" }, 404);

    const resolved = await resolve_scope_traits(supabase, {
        scope: "feature",
        feature_id,
        project_id: feature.project_id,
    });

    return context.json(resolved);
});

// Get trait by ID
traits_routes.get("/:id", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { data, error } = await supabase
        .from("traits")
        .select("*, trait_assignments(id)")
        .eq("id", id)
        .single();

    if (error || !data) return context.json({ error: "Trait not found" }, 404);
    return context.json({ ...data, assignment_count: data.trait_assignments?.length ?? 0 });
});

// Update trait
traits_routes.patch("/:id", async (context) => {
    const id = context.req.param("id");
    const result = update_trait_schema.safeParse(await context.req.json());
    if (!result.success) return context.json({ error: result.error.format() }, 400);

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("traits")
        .update({ ...result.data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();

    if (error || !data) return context.json({ error: "Trait not found" }, 404);
    return context.json(data);
});

// Delete trait
traits_routes.delete("/:id", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { error } = await supabase.from("traits").delete().eq("id", id);
    if (error) {
        console.error(`[DELETE /api/traits/${id}]`, error);
        return context.json({ error: "Failed to delete trait" }, 500);
    }
    return context.json({ success: true });
});

// Remove assignment
traits_routes.delete("/assign/:id", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { error } = await supabase.from("trait_assignments").delete().eq("id", id);
    if (error) {
        console.error(`[DELETE /api/traits/assign/${id}]`, error);
        return context.json({ error: "Failed to remove assignment" }, 500);
    }
    return context.json({ success: true });
});

