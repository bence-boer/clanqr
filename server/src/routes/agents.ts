import { Hono } from "hono";
import type { AppBindings } from "../middleware/supabase";
import { validate_uuid_params } from "../middleware/validate_params";
import { agent_service } from "../services/agent_service";
import { pipeline_service } from "../services/pipeline_service";
import { logger } from "../utils/logger";

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

agents_routes.post("/pause", (context) => {
    pipeline_service.pause();
    return context.json({ success: true, state: "paused" });
});

agents_routes.post("/resume", (context) => {
    pipeline_service.resume();
    return context.json({ success: true, state: "resuming" });
});

agents_routes.post("/stop-current", (context) => {
    pipeline_service.stop_current();
    return context.json({ success: true });
});

// Get pipeline log for currently running task
agents_routes.get("/queue/log", (context) => {
    const log = pipeline_service.get_log();
    return context.json({ log });
});

// Get agent status for a specific feature
agents_routes.get("/feature/:feature_id", validate_uuid_params("feature_id"), (context) => {
    const feature_id = context.req.param("feature_id");
    const processes = agent_service.get_all_processes();

    // Find any process related to this feature
    // Manager task_id is `manager-${feature_id}`
    // Ralph task_id is `ralph-${task_id}` but we'd need to lookup task -> feature
    // For simplicity, let's just return all processes and filter in the service or here
    
    const feature_processes = Object.entries(processes)
        .filter(([id, proc]) => {
            if (id === `manager-${feature_id}`) return true;
            // For ralph, we might need a better way, but agent_service doesn't store feature_id in the Map
            // Let's assume the UI only cares about the manager for now, or we can improve agent_service
            return false;
        })
        .map(([id, proc]) => ({
            id,
            type: proc.type,
            status: proc.status,
            started_at: proc.started_at,
            finished_at: proc.finished_at,
        }));

    // Also check the pipeline_service for currently running ralph task for this feature
    const pipeline_status = pipeline_service.get_status();
    
    return context.json({
        processes: feature_processes,
        pipeline: {
            state: pipeline_status.state,
            is_active_feature: pipeline_status.current_feature_id === feature_id,
            current_task_id: pipeline_status.current_task_id,
        },
    });
});

// ── Legacy agent management ───────────────────────────────────────────────

agents_routes.get("/status", (context) => {
    const processes = agent_service.get_all_processes();
    return context.json(processes);
});

agents_routes.get("/log/:task_id", validate_uuid_params("task_id"), (context) => {
    const task_id = context.req.param("task_id");
    const log = agent_service.get_log(task_id);
    return context.json({ task_id, log });
});

// Manually spawn manager agent for a feature
agents_routes.post("/spawn/manager/:feature_id", validate_uuid_params("feature_id"), async (context) => {
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
        logger.error("Failed to spawn manager agent", { route: "POST /api/agents/spawn/manager/:feature_id", feature_id, error: String(spawn_error) });
        return context.json({ error: "Failed to spawn manager agent" }, 500);
    }
});

agents_routes.post("/stop-all", (_context) => {
    agent_service.stop_all();
    return _context.json({ success: true, message: "All agents stopped" });
});

agents_routes.post("/stop/:task_id", validate_uuid_params("task_id"), (context) => {
    const task_id = context.req.param("task_id");
    agent_service.stop_process(task_id);
    return context.json({ success: true, message: `Agent ${task_id} stopped` });
});
