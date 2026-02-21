import { create_supabase_client } from "../db";
import { agent_service } from "./agent_service";
import { pipeline_service } from "./pipeline_service";

const POLL_INTERVAL_MS = 5000;

class WatcherService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private is_running = false;

  start() {
    if (this.is_running) return;
    this.is_running = true;
    console.log("👁️ Watcher service started (polling every 5s for submitted features)");

    this.interval = setInterval(() => {
      this.poll().catch((error) => {
        console.error("Watcher poll error:", error);
      });
    }, POLL_INTERVAL_MS);

    // Run immediately
    this.poll().catch(console.error);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.is_running = false;
    console.log("👁️ Watcher service stopped");
  }

  private async poll() {
    const supabase = create_supabase_client();
    await this.check_submitted_features(supabase);
  }

  private spawned_features = new Set<string>();

  private async check_submitted_features(supabase: any) {
    const { data: features, error } = await supabase
      .from("features")
      .select("*, resources(*), projects(*)")
      .eq("status", "Submitted");

    if (error || !features) return;

    for (const feature of features) {
      // Skip if we already spawned a manager for this feature in this server lifetime
      if (this.spawned_features.has(feature.id)) continue;

      const process_id = `manager-${feature.id}`;
      const existing = agent_service.get_all_processes()[process_id];

      // Skip if there's already a running or completed manager process in memory
      if (existing && existing.status !== "failed") continue;

      // Check if there's already a recent running manager in the DB (survives restarts)
      const { data: recent_run } = await supabase
        .from("agent_runs")
        .select("id, status")
        .eq("type", "manager")
        .eq("reference_id", feature.id)
        .in("status", ["running", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (recent_run) continue;

      console.log(`📋 Spawning manager for feature: ${feature.title}`);
      this.spawned_features.add(feature.id);
      this.spawn_manager_and_maybe_auto_approve(feature, supabase).catch(console.error);
    }
  }

  private async spawn_manager_and_maybe_auto_approve(feature: any, supabase: any) {
    await agent_service.spawn_manager(feature, supabase);

    // If auto_approve is enabled, approve all created tasks and kick the pipeline
    if (feature.auto_approve) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("feature_id", feature.id)
        .eq("status", "Pending_Approval");

      if (tasks && tasks.length > 0) {
        await supabase
          .from("tasks")
          .update({ status: "Approved" })
          .eq("feature_id", feature.id)
          .eq("status", "Pending_Approval");

        console.log(`✅ Auto-approved ${tasks.length} tasks for feature: ${feature.title}`);
        pipeline_service.process_next().catch(console.error);
      }
    }
  }
}

export const watcher_service = new WatcherService();
