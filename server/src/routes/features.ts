import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";

const create_feature_schema = z.object({
    project_id: z.string().uuid(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    model: z.string().optional(),
    resources: z
        .array(z.object({ url: z.string().url(), title: z.string().optional() }))
        .optional(),
});

const update_feature_schema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    status: z.enum(["Draft", "Submitted", "In_Progress", "Done"]).optional(),
    model: z.string().nullable().optional(),
});

export const features_routes = new Hono<AppBindings>();

// List features (optionally filter by project)
features_routes.get("/", async (context) => {
    const supabase = context.get("supabase");
    const project_id = context.req.query("project_id");

    let query = supabase
        .from("features")
        .select("*, resources(*), tasks(*)")
        .order("created_at", { ascending: false });

    if (project_id) {
        query = query.eq("project_id", project_id);
    }

    const { data, error } = await query;

    if (error) {
        console.error(`[GET /api/features]`, error);
        return context.json({ error: "Failed to fetch features" }, 500);
    }
    return context.json(data);
});

// Get single feature with resources and tasks
features_routes.get("/:id", async (context) => {
    const supabase = context.get("supabase");
    const id = context.req.param("id");

    const { data, error } = await supabase
        .from("features")
        .select("*, resources(*), tasks(*)")
        .eq("id", id)
        .single();

    if (error) {
        console.error(`[GET /api/features/${id}]`, error);
        return context.json({ error: "Feature not found" }, 404);
    }
    return context.json(data);
});

// Create feature (with optional resources)
features_routes.post("/", async (context) => {
    const body = await context.req.json();
    const parsed = create_feature_schema.safeParse(body);

    if (!parsed.success) {
        return context.json({ error: parsed.error.flatten() }, 400);
    }

    const supabase = context.get("supabase");
    const { resources, ...feature_data } = parsed.data;

    const { data: feature, error: feature_error } = await supabase
        .from("features")
        .insert(feature_data)
        .select()
        .single();

    if (feature_error) {
        console.error(`[POST /api/features]`, feature_error);
        return context.json({ error: "Failed to create feature" }, 500);
    }

    if (resources && resources.length > 0) {
        const resource_rows = resources.map((r) => ({
            feature_id: feature.id,
            url: r.url,
            title: r.title,
        }));
        await supabase.from("resources").insert(resource_rows);
    }

    const { data: full_feature } = await supabase
        .from("features")
        .select("*, resources(*), tasks(*)")
        .eq("id", feature.id)
        .single();

    return context.json(full_feature, 201);
});

// Update feature
features_routes.patch("/:id", async (context) => {
    const id = context.req.param("id");
    const body = await context.req.json();
    const parsed = update_feature_schema.safeParse(body);

    if (!parsed.success) {
        return context.json({ error: parsed.error.flatten() }, 400);
    }

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("features")
        .update(parsed.data)
        .eq("id", id)
        .select("*, resources(*), tasks(*)")
        .single();

    if (error) {
        console.error(`[PATCH /api/features/${id}]`, error);
        return context.json({ error: "Failed to update feature" }, 500);
    }
    return context.json(data);
});

// Submit feature for implementation
features_routes.post("/:id/submit", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { data, error } = await supabase
        .from("features")
        .update({ status: "Submitted" })
        .eq("id", id)
        .select("*, resources(*), tasks(*)")
        .single();

    if (error) {
        console.error(`[POST /api/features/${id}/submit]`, error);
        return context.json({ error: "Failed to submit feature" }, 500);
    }
    return context.json(data);
});

// Delete feature
features_routes.delete("/:id", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { error } = await supabase.from("features").delete().eq("id", id);

    if (error) {
        console.error(`[DELETE /api/features/${id}]`, error);
        return context.json({ error: "Failed to delete feature" }, 500);
    }
    return context.json({ success: true });
});

// Add resource to feature
features_routes.post("/:id/resources", async (context) => {
    const feature_id = context.req.param("id");
    const body = await context.req.json();
    const parsed = z
        .object({ url: z.string().url(), title: z.string().optional() })
        .safeParse(body);

    if (!parsed.success) {
        return context.json({ error: parsed.error.flatten() }, 400);
    }

    const supabase = context.get("supabase");
    const { data, error } = await supabase
        .from("resources")
        .insert({ feature_id, ...parsed.data })
        .select()
        .single();

    if (error) {
        console.error(`[POST /api/features/${feature_id}/resources]`, error);
        return context.json({ error: "Failed to add resource" }, 500);
    }
    return context.json(data, 201);
});

// Delete resource
features_routes.delete("/:feature_id/resources/:id", async (context) => {
    const id = context.req.param("id");
    const supabase = context.get("supabase");

    const { error } = await supabase.from("resources").delete().eq("id", id);

    if (error) {
        console.error(`[DELETE /api/features/resources/${id}]`, error);
        return context.json({ error: "Failed to delete resource" }, 500);
    }
    return context.json({ success: true });
});
