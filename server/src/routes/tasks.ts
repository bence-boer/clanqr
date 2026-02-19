import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/supabase";
import { pipeline_service } from "../services/pipeline_service";

const update_task_schema = z.object({
  status: z
    .enum(["Pending_Approval", "Approved", "In_Progress", "Complete"])
    .optional(),
  description: z.string().optional(),
  agent_log: z.string().optional(),
});

export const tasks_routes = new Hono<AppBindings>();

// List tasks (optionally filter by feature or status)
tasks_routes.get("/", async (context) => {
  const supabase = context.get("supabase");
  const feature_id = context.req.query("feature_id");
  const status = context.req.query("status");

  let query = supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });

  if (feature_id) {
    query = query.eq("feature_id", feature_id);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return context.json({ error: error.message }, 500);
  }
  return context.json(data);
});

// Get single task
tasks_routes.get("/:id", async (context) => {
  const supabase = context.get("supabase");
  const id = context.req.param("id");

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return context.json({ error: error.message }, 404);
  }
  return context.json(data);
});

// Update task
tasks_routes.patch("/:id", async (context) => {
  const id = context.req.param("id");
  const body = await context.req.json();
  const parsed = update_task_schema.safeParse(body);

  if (!parsed.success) {
    return context.json({ error: parsed.error.flatten() }, 400);
  }

  const supabase = context.get("supabase");
  const { data, error } = await supabase
    .from("tasks")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return context.json({ error: error.message }, 500);
  }
  return context.json(data);
});

// Approve task
tasks_routes.post("/:id/approve", async (context) => {
  const id = context.req.param("id");
  const supabase = context.get("supabase");

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "Approved" })
    .eq("id", id)
    .eq("status", "Pending_Approval")
    .select()
    .single();

  if (error) return context.json({ error: error.message }, 500);

  // Kick pipeline to process this newly approved task
  pipeline_service.process_next().catch(console.error);
  return context.json(data);
});

// Manually trigger pipeline to run a specific approved task
tasks_routes.post("/:id/run", (context) => {
  pipeline_service.process_next().catch(console.error);
  return context.json({ success: true });
});

// Bulk approve all tasks for a feature
tasks_routes.post("/approve-all/:feature_id", async (context) => {
  const feature_id = context.req.param("feature_id");
  const supabase = context.get("supabase");

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "Approved" })
    .eq("feature_id", feature_id)
    .eq("status", "Pending_Approval")
    .select();

  if (error) return context.json({ error: error.message }, 500);

  // Kick pipeline
  pipeline_service.process_next().catch(console.error);
  return context.json(data);
});
