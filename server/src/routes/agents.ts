import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";
import { agent_service } from "../services/agent_service";
import { pipeline_service } from "../services/pipeline_service";

export const agents_routes = new Hono<AppBindings>();

// ── Pipeline status & controls ────────────────────────────────────────────

agents_routes.get("/queue", async (context) => {
  const supabase = context.get("supabase");
  const pipeline_info = pipeline_service.get_status();

  // Get count of queued (Approved) tasks
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "Approved");

  // Get current task details if running
  let current_task = null;
  if (pipeline_info.current_task_id) {
    const { data } = await supabase
      .from("tasks")
      .select("*, features(title, projects(name))")
      .eq("id", pipeline_info.current_task_id)
      .single();
    if (data) {
      current_task = {
        ...data,
        feature_title: data.features?.title ?? "Unknown",
        project_name: data.features?.projects?.name ?? "Unknown",
      };
    }
  }

  return context.json({
    state: pipeline_info.state,
    current_task,
    current_run_id: pipeline_info.current_run_id,
    queue_depth: count ?? 0,
  });
});

agents_routes.post("/pause", (_context) => {
  pipeline_service.pause();
  return _context.json({ success: true, state: "paused" });
});

agents_routes.post("/resume", (_context) => {
  pipeline_service.resume();
  return _context.json({ success: true, state: "resuming" });
});

agents_routes.post("/stop-current", (_context) => {
  pipeline_service.stop_current();
  return _context.json({ success: true });
});

// Get pipeline log for currently running task
agents_routes.get("/queue/log", (_context) => {
  const log = pipeline_service.get_log();
  return _context.json({ log });
});

// ── Legacy agent management ───────────────────────────────────────────────

agents_routes.get("/status", (context) => {
  const processes = agent_service.get_all_processes();
  return context.json(processes);
});

agents_routes.get("/log/:task_id", (context) => {
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

  if (error || !feature) return context.json({ error: "Feature not found" }, 404);

  try {
    await agent_service.spawn_manager(feature, supabase);
    return context.json({ success: true, message: "Manager agent spawned" });
  } catch (spawn_error) {
    const message = spawn_error instanceof Error ? spawn_error.message : "Unknown error";
    return context.json({ error: message }, 500);
  }
});

agents_routes.post("/stop-all", (_context) => {
  agent_service.stop_all();
  return _context.json({ success: true, message: "All agents stopped" });
});

agents_routes.post("/stop/:task_id", (context) => {
  const task_id = context.req.param("task_id");
  agent_service.stop_process(task_id);
  return context.json({ success: true, message: `Agent ${task_id} stopped` });
});
