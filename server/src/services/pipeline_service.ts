import { type Subprocess } from "bun";
import { join } from "path";
import { create_supabase_client } from "../db";
import type { SupabaseClient } from "../db";
import type { TaskRow, FeatureRow } from "../types";
import { WORKSPACE_DIR } from "../env";
import { prompt_service } from "./prompt_service";
import { check_and_complete_feature } from "./feature_utils";
import { spawn_agent } from "./spawn_agent";

const PIPELINE_WORKSPACE_DIR = WORKSPACE_DIR;

const TASK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

type PipelineState = "idle" | "running" | "paused";

interface ActiveRun {
    task_id: string;
    run_id: string;
    feature_id: string;
}

type PipelineTask = TaskRow & { features?: FeatureRow & { projects?: { name: string } } };

class PipelineService {
    private state: PipelineState = "idle";
    private active_run: ActiveRun | null = null;
    private is_processing = false;

    get_status() {
        return {
            state: this.state,
            current_task_id: this.active_run?.task_id ?? null,
            current_run_id: this.active_run?.run_id ?? null,
            current_feature_id: this.active_run?.feature_id ?? null,
        };
    }

    async process_next(): Promise<void> {
        if (this.state === "paused") return;
        if (this.is_processing || this.active_run) return;

        this.is_processing = true;

        try {
            const supabase = create_supabase_client();
            const task = await this.get_next_task(supabase);

            if (!task) {
                this.state = "idle";
                this.is_processing = false;
                return;
            }

            this.state = "running";
            this.is_processing = false;
            await this.execute_task(task, supabase);
        } catch (error) {
            console.error("Pipeline process_next error:", error);
            this.is_processing = false;
            this.state = "idle";
        }
    }

    pause() {
        if (this.state === "running") {
            this.state = "paused";
            console.log("⏸ Pipeline paused");
        }
    }

    resume() {
        if (this.state === "paused") {
            this.state = "idle";
            console.log("▶ Pipeline resumed");
            this.process_next().catch(console.error);
        }
    }

    stop_current() {
        // Pipeline stop — active_run tracking only (process is managed by spawn_agent)
        if (this.active_run) {
            console.log(`⏹ Stopping current run: ${this.active_run.task_id}`);
        }
    }

    get_log(): string {
        return "";
    }

    private async get_next_task(supabase: SupabaseClient): Promise<PipelineTask | null> {
        const { data, error } = await supabase
            .from("tasks")
            .select("*, features(*, projects(*))")
            .eq("status", "Approved")
            .order("created_at", { foreignTable: "features", ascending: true })
            .order("sort_order", { ascending: true })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data;
    }

    private async execute_task(task: PipelineTask, supabase: SupabaseClient): Promise<void> {
        const task_id = task.id;
        const feature_id: string = task.feature_id;
        const work_dir = join(PIPELINE_WORKSPACE_DIR, `ralph-${task_id}`);

        const task_spec = {
            task_id,
            description: task.description,
            feature_title: task.features?.title ?? "Unknown",
            project_name: task.features?.projects?.name ?? "Unknown",
        };

        // Mark task as in-progress
        await supabase.from("tasks").update({ status: "In_Progress" }).eq("id", task_id);

        const prompt = await prompt_service.resolve_for_task(task_id, task_spec);
        const cli = task.features?.cli || "copilot";
        const model = task.features?.model || (cli === "gemini" ? "gemini-3-flash-preview" : "gpt-4o");

        this.active_run = { task_id, run_id: "", feature_id };

        try {
            const result = await spawn_agent({
                agent_type: "ralph",
                work_dir,
                spec_file: "task-spec.json",
                spec_data: task_spec,
                prompt,
                cli,
                model,
                timeout_ms: TASK_TIMEOUT_MS,
                task_id,
            }, supabase);

            this.active_run.run_id = result.run_id;

            if (result.exit_code === 0) {
                await this.mark_task_complete(task, supabase);
            } else {
                await this.handle_failure(task, supabase, result.run_id, result.exit_code === -1 ? "Timeout" : undefined);
            }
        } catch (error) {
            const error_message = error instanceof Error ? error.message : "Unknown error";
            await this.handle_failure(task, supabase, this.active_run.run_id, error_message);
        } finally {
            this.active_run = null;
        }

        // Automatic progression — chain to next task
        await this.process_next();
    }

    private async mark_task_complete(task: PipelineTask, supabase: SupabaseClient): Promise<void> {
        await supabase.from("tasks").update({ status: "Complete" }).eq("id", task.id);

        const done = await check_and_complete_feature(task.feature_id, supabase);
        if (done) {
            console.log(`✅ Feature complete: ${task.features?.title}`);
        }
    }

    private async handle_failure(
        task: PipelineTask,
        supabase: SupabaseClient,
        run_id: string,
        reason?: string
    ): Promise<void> {
        const behavior: string = task.features?.on_task_failure ?? "stop";
        const retry_count: number = task.retry_count ?? 0;
        const max_retries: number = task.max_retries ?? 1;

        console.error(
            `❌ Task failed: ${task.description.slice(0, 50)} | behavior: ${behavior} | reason: ${reason ?? "non-zero exit"}`
        );

        if (behavior === "retry" && retry_count < max_retries) {
            await supabase
                .from("tasks")
                .update({ status: "Approved", retry_count: retry_count + 1 })
                .eq("id", task.id);
            console.log(`🔄 Retrying task (attempt ${retry_count + 1}/${max_retries})`);
        } else if (behavior === "skip") {
            await supabase
                .from("tasks")
                .update({ status: "Skipped", agent_log: `Skipped after failure: ${reason ?? "non-zero exit"}` })
                .eq("id", task.id);
            console.log(`⏭ Skipping failed task, continuing pipeline`);

            const done = await check_and_complete_feature(task.feature_id, supabase);
            if (done) {
                console.log(`✅ Feature complete (some tasks skipped): ${task.features?.title}`);
            }
        } else {
            await supabase.from("tasks").update({ status: "Approved" }).eq("id", task.id);
            this.state = "paused";
            console.log(`⏸ Pipeline paused due to task failure (stop behavior)`);
        }
    }
}

export const pipeline_service = new PipelineService();
