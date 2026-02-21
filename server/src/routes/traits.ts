import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";

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
  if (error) return context.json({ error: error.message }, 500);
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

  if (error) return context.json({ error: error.message }, 500);
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
  if (error) return context.json({ error: error.message }, 500);
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

  if (error) return context.json({ error: error.message }, 500);
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
  if (error) return context.json({ error: error.message }, 500);
  return context.json({ success: true });
});

// Remove assignment
traits_routes.delete("/assign/:id", async (context) => {
  const id = context.req.param("id");
  const supabase = context.get("supabase");

  const { error } = await supabase.from("trait_assignments").delete().eq("id", id);
  if (error) return context.json({ error: error.message }, 500);
  return context.json({ success: true });
});

// ─── Resolution helpers (exported for use in prompt_service) ───────────────

export interface ResolvedTrait {
  id: string;
  name: string;
  description: string | null;
  target: string;
  content: string;
  is_global: boolean;
  scope_source: "global" | "project" | "feature" | "task";
}

export async function resolve_task_traits(
  supabase: any,
  task_id: string,
  target: "manager" | "ralph"
): Promise<ResolvedTrait[]> {
  const { data: task, error: task_error } = await supabase
    .from("tasks")
    .select("id, feature_id, features(id, project_id)")
    .eq("id", task_id)
    .single();

  if (task_error || !task) return [];

  const feature_id: string = task.feature_id;
  const project_id: string = task.features?.project_id;

  return resolve_scope_traits(supabase, {
    scope: "task",
    task_id,
    feature_id,
    project_id,
    target,
  });
}

interface ResolveScopeOptions {
  scope: "project" | "feature" | "task";
  project_id?: string;
  feature_id?: string;
  task_id?: string;
  target?: "manager" | "ralph";
}

export async function resolve_scope_traits(
  supabase: any,
  options: ResolveScopeOptions
): Promise<ResolvedTrait[]> {
  const { scope, project_id, feature_id, task_id, target } = options;

  // 1. Fetch all traits for this target
  let traits_query = supabase.from("traits").select("*");
  if (target) traits_query = traits_query.eq("target", target);
  const { data: all_traits, error: traits_error } = await traits_query;
  if (traits_error || !all_traits) return [];

  const trait_map = new Map<string, any>(all_traits.map((trait: any) => [trait.id, trait]));

  // 2. Start with global traits
  const active: Map<string, { trait: any; source: "global" | "project" | "feature" | "task" }> =
    new Map();

  for (const trait of all_traits) {
    if (trait.is_global) active.set(trait.id, { trait, source: "global" });
  }

  // 3. Build assignment query for all relevant scopes
  const scope_filters: string[] = [];
  if (project_id) scope_filters.push(`project_id.eq.${project_id}`);
  if (feature_id) scope_filters.push(`feature_id.eq.${feature_id}`);
  if (task_id && scope === "task") scope_filters.push(`task_id.eq.${task_id}`);

  if (scope_filters.length > 0) {
    const { data: assignments, error: assign_error } = await supabase
      .from("trait_assignments")
      .select("*")
      .or(scope_filters.join(","))
      .order("created_at");

    if (!assign_error && assignments) {
      // Sort by scope order so later scopes override earlier
      const scope_order: Record<string, number> = { project: 0, feature: 1, task: 2 };
      assignments.sort(
        (assignment_a: any, assignment_b: any) =>
          scope_order[assignment_a.scope] - scope_order[assignment_b.scope]
      );

      for (const assignment of assignments) {
        const assignment_scope = assignment.scope as "project" | "feature" | "task";

        // Only apply if the scope is within our resolution level
        if (
          (assignment_scope === "project" && !project_id) ||
          (assignment_scope === "feature" && !feature_id) ||
          (assignment_scope === "task" && !task_id)
        ) {
          continue;
        }

        if (assignment.is_excluded) {
          active.delete(assignment.trait_id);
        } else {
          const trait = trait_map.get(assignment.trait_id);
          if (trait) active.set(assignment.trait_id, { trait, source: assignment_scope });
        }
      }
    }
  }

  return Array.from(active.values()).map(({ trait, source }) => ({
    id: trait.id,
    name: trait.name,
    description: trait.description,
    target: trait.target,
    content: trait.content,
    is_global: trait.is_global,
    scope_source: source,
  }));
}
