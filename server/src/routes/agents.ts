import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";
import { agent_service } from "../services/agent_service";

export const agents_routes = new Hono<AppBindings>();

// Get status of all running agents
agents_routes.get("/status", async (context) => {
  const processes = agent_service.get_all_processes();
  return context.json(processes);
});

// Get agent log for a specific task
agents_routes.get("/log/:task_id", async (context) => {
  const task_id = context.req.param("task_id");
  const log = agent_service.get_log(task_id);
  return context.json({ task_id, log });
});

// Manually spawn manager agent for a feature
agents_routes.post("/spawn/manager/:feature_id", async (context) => {
  const feature_id = context.req.param("feature_id");
  const supabase = context.get("supabase");

  const { data: feature, error } = await supabase
    .from("features")
    .select("*, resources(*), projects(*)")
    .eq("id", feature_id)
    .single();

  if (error || !feature) {
    return context.json({ error: "Feature not found" }, 404);
  }

  try {
    await agent_service.spawn_manager(feature, supabase);
    return context.json({ success: true, message: "Manager agent spawned" });
  } catch (spawn_error) {
    const message =
      spawn_error instanceof Error ? spawn_error.message : "Unknown error";
    return context.json({ error: message }, 500);
  }
});

// Manually spawn ralph agent for a task
agents_routes.post("/spawn/ralph/:task_id", async (context) => {
  const task_id = context.req.param("task_id");
  const supabase = context.get("supabase");

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*, features(*, projects(*))")
    .eq("id", task_id)
    .single();

  if (error || !task) {
    return context.json({ error: "Task not found" }, 404);
  }

  if (task.status !== "Approved") {
    return context.json({ error: "Task must be Approved to start" }, 400);
  }

  try {
    await agent_service.spawn_ralph(task, supabase);
    return context.json({ success: true, message: "Ralph agent spawned" });
  } catch (spawn_error) {
    const message =
      spawn_error instanceof Error ? spawn_error.message : "Unknown error";
    return context.json({ error: message }, 500);
  }
});

// Stop all agents
agents_routes.post("/stop-all", async (_context) => {
  agent_service.stop_all();
  return _context.json({ success: true, message: "All agents stopped" });
});

// Stop a specific agent
agents_routes.post("/stop/:task_id", async (context) => {
  const task_id = context.req.param("task_id");
  agent_service.stop_process(task_id);
  return context.json({ success: true, message: `Agent ${task_id} stopped` });
});
