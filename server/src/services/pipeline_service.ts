import { type Subprocess } from "bun";
import { join } from "path";
import { create_supabase_client } from "../db";
import type { SupabaseClient } from "../db";
import type { TaskRow, FeatureRow } from "../types";
import { WORKSPACE_DIR } from "../env";
import { prompt_service } from "./prompt_service";
import { check_and_complete_feature } from "./feature_utils";
import { spawn_agent } from "./spawn_agent";
import { logger } from "../utils/logger";
import { can_spawn_agent, increment_agent_count, decrement_agent_count } from "./agent_service";

const PIPELINE_WORKSPACE_DIR = WORKSPACE_DIR;

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
                return;
            }

            this.state = "running";
            await this.execute_task(task, supabase);
        } catch (error) {
            logger.error("Pipeline process_next error", { service: "pipeline", error: String(error) });
            this.state = "idle";
        } finally {
            this.is_processing = false;
        }
    }

    pause() {
        if (this.state === "running") {
            this.state = "paused";
            logger.info("Pipeline paused", { service: "pipeline" });
        }
    }

    resume() {
        if (this.state === "paused") {
            this.state = "idle";
            logger.info("Pipeline resumed", { service: "pipeline" });
            this.process_next().catch((err) => logger.error("Pipeline resume error", { service: "pipeline", error: String(err) }));
        }
    }

    stop_current() {
        if (this.active_run) {
            logger.info("Stopping current run", { service: "pipeline", task_id: this.active_run.task_id });
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
        // M-10.4: Check agent concurrency limit before spawning
        if (!can_spawn_agent()) {
            logger.warn("Agent concurrency limit reached, deferring task", { service: "pipeline", task_id: task.id });
            return; // Will be retried on next process_next() call
        }

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

        increment_agent_count();
        try {
            const result = await spawn_agent({
                agent_type: "ralph",
                work_dir,
                spec_file: "task-spec.json",
                spec_data: task_spec,
                prompt,
                cli,
                model,
                timeout_ms: (task.features?.task_timeout_minutes ?? 10) * 60 * 1000,
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
            decrement_agent_count();
            this.active_run = null;
        }

        // Automatic progression — chain to next task
        await this.process_next();
    }

    private async mark_task_complete(task: PipelineTask, supabase: SupabaseClient): Promise<void> {
        await supabase.from("tasks").update({ status: "Complete" }).eq("id", task.id);

        const done = await check_and_complete_feature(task.feature_id, supabase);
        if (done) {
            logger.info("Feature complete", { service: "pipeline", feature: task.features?.title, feature_id: task.feature_id });
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

        logger.error("Task failed", {
            service: "pipeline",
            task_id: task.id,
            description: task.description.slice(0, 50),
            behavior,
            reason: reason ?? "non-zero exit",
        });

        if (behavior === "retry" && retry_count < max_retries) {
            await supabase
                .from("tasks")
                .update({ status: "Approved", retry_count: retry_count + 1 })
                .eq("id", task.id);
            logger.info("Retrying task", { service: "pipeline", task_id: task.id, attempt: retry_count + 1, max_retries });
        } else if (behavior === "skip") {
            await supabase
                .from("tasks")
                .update({ status: "Skipped", agent_log: `Skipped after failure: ${reason ?? "non-zero exit"}` })
                .eq("id", task.id);
            logger.info("Skipping failed task", { service: "pipeline", task_id: task.id });

            const done = await check_and_complete_feature(task.feature_id, supabase);
            if (done) {
                logger.info("Feature complete (some tasks skipped)", { service: "pipeline", feature: task.features?.title });
            }
        } else {
            await supabase.from("tasks").update({ status: "Approved" }).eq("id", task.id);
            this.state = "paused";
            logger.info("Pipeline paused due to task failure", { service: "pipeline", task_id: task.id });
        }
    }
}

export const pipeline_service = new PipelineService();
