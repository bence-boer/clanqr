import { create_supabase_client } from "../db";
import { agent_service } from "./agent_service";

const POLL_INTERVAL_MS = 5000;

class WatcherService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private is_running = false;

  start() {
    if (this.is_running) return;
    this.is_running = true;
    console.log("👁️ Watcher service started (polling every 5s)");

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

    // Check for submitted features that need manager agent
    await this.check_submitted_features(supabase);

    // Check for approved tasks that need ralph agent
    await this.check_approved_tasks(supabase);
  }

  private async check_submitted_features(supabase: any) {
    const { data: features, error } = await supabase
      .from("features")
      .select("*, resources(*), projects(*)")
      .eq("status", "Submitted");

    if (error || !features) return;

    for (const feature of features) {
      const process_id = `manager-${feature.id}`;
      const existing = agent_service.get_all_processes()[process_id];

      if (!existing || existing.status === "failed") {
        console.log(`📋 Spawning manager for feature: ${feature.title}`);
        agent_service.spawn_manager(feature, supabase).catch(console.error);
      }
    }
  }

  private async check_approved_tasks(supabase: any) {
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*, features(*, projects(*))")
      .eq("status", "Approved");

    if (error || !tasks) return;

    for (const task of tasks) {
      const process_id = `ralph-${task.id}`;
      const existing = agent_service.get_all_processes()[process_id];

      if (!existing) {
        console.log(`🔨 Spawning Ralph for task: ${task.description.slice(0, 50)}...`);
        agent_service.spawn_ralph(task, supabase).catch(console.error);
      }
    }
  }
}

export const watcher_service = new WatcherService();
