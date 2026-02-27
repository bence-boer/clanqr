import { type Subprocess } from "bun";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { create_supabase_client } from "../db";
import { COPILOT_BIN, GEMINI_BIN, ENRICHED_PATH, WORKSPACE_DIR } from "../env";
import { prompt_service } from "./prompt_service";

const HOME = process.env.HOME ?? "/home/scoy";
const PIPELINE_WORKSPACE_DIR = WORKSPACE_DIR;

const TASK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const progress_schema = z.object({
    status: z.enum(["completed", "failed", "partial"]),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional(),
});

type PipelineState = "idle" | "running" | "paused";

interface ActiveRun {
    task_id: string;
    run_id: string;
    process: Subprocess;
    started_at: number;
    log: string;
    feature_id: string;
}

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

    // Called when: task approved, pipeline resumed, previous task completed
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
        if (this.active_run) {
            this.active_run.process.kill();
            console.log(`⏹ Stopped current run: ${this.active_run.task_id}`);
        }
    }

    get_log(): string {
        return this.active_run?.log ?? "";
    }

    private async get_next_task(supabase: any): Promise<any | null> {
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

    private async execute_task(task: any, supabase: any): Promise<void> {
        const task_id = task.id;
        const feature_id: string = task.feature_id;
        const work_dir = join(PIPELINE_WORKSPACE_DIR, `ralph-${task_id}`);
        mkdirSync(work_dir, { recursive: true });

        const task_spec = {
            task_id,
            description: task.description,
            feature_title: task.features?.title ?? "Unknown",
            project_name: task.features?.projects?.name ?? "Unknown",
        };

        writeFileSync(join(work_dir, "task-spec.json"), JSON.stringify(task_spec, null, 2));

        // Mark task as in-progress
        await supabase.from("tasks").update({ status: "In_Progress" }).eq("id", task_id);

        // Build prompt via prompt resolution service
        const prompt = await prompt_service.resolve_for_task(task_id, task_spec);

        // Create agent_runs record
        const cli = task.features?.cli || "copilot";
        const model = task.features?.model || (cli === "gemini" ? "gemini-3-flash-preview" : "gpt-4o");
        const started_at = new Date().toISOString();
        const { data: run_record } = await supabase
            .from("agent_runs")
            .insert({ type: "ralph", task_id, status: "running", started_at, cli, model })
            .select("id")
            .single();

        const run_id: string = run_record?.id ?? "";

        try {
            const bin = cli === "gemini" ? GEMINI_BIN : COPILOT_BIN;
            const spawn_args = [bin, "-p", prompt];
            
            if (cli === "gemini") {
                spawn_args.push("--yolo");
            } else {
                spawn_args.push("--allow-all-tools");
            }

            if (model) spawn_args.push("--model", model);

            const proc = Bun.spawn(spawn_args, {
                cwd: work_dir,
                stdout: "pipe",
                stderr: "pipe",
                env: { ...process.env, HOME, PATH: ENRICHED_PATH },
            });

            this.active_run = {
                task_id,
                run_id,
                process: proc,
                started_at: Date.now(),
                log: "",
                feature_id,
            };

            // Collect output in background
            this.collect_output(this.active_run, proc);

            // Wait with timeout
            const exit_code = await Promise.race([
                proc.exited,
                new Promise<number>((resolve) =>
                    setTimeout(() => {
                        proc.kill();
                        resolve(-1);
                    }, TASK_TIMEOUT_MS)
                ),
            ]);

            const finished_at = new Date().toISOString();
            const duration_ms = Date.now() - this.active_run.started_at;
            const log = this.active_run.log;
            const succeeded = exit_code === 0;

            // Save log file
            writeFileSync(join(work_dir, "agent.log"), log);

            // Read progress.json if available (M-1.3)
            const progress_data = this.read_progress(work_dir);

            // Update agent_runs
            await supabase
                .from("agent_runs")
                .update({
                    status: succeeded ? "completed" : "failed",
                    log: log.slice(-10000),
                    finished_at,
                    duration_ms,
                    summary: progress_data?.summary ?? null,
                    files_changed: progress_data?.files_changed ?? null,
                    ...(exit_code === -1 ? { error: "Task timed out after 10 minutes" } : {}),
                })
                .eq("id", run_id);

            if (succeeded) {
                await this.mark_task_complete(task, supabase);
            } else {
                await this.handle_failure(task, supabase, run_id, exit_code === -1 ? "Timeout" : undefined);
            }
        } catch (error) {
            const error_message = error instanceof Error ? error.message : "Unknown error";
            await supabase
                .from("agent_runs")
                .update({ status: "failed", error: error_message, finished_at: new Date().toISOString() })
                .eq("id", run_id);
            await this.handle_failure(task, supabase, run_id, error_message);
        } finally {
            this.active_run = null;
        }

        // Automatic progression — chain to next task
        await this.process_next();
    }

    private async mark_task_complete(task: any, supabase: any): Promise<void> {
        await supabase.from("tasks").update({ status: "Complete" }).eq("id", task.id);

        // Check if all tasks for this feature are complete
        const { data: remaining } = await supabase
            .from("tasks")
            .select("id")
            .eq("feature_id", task.feature_id)
            .neq("status", "Complete");

        if (!remaining || remaining.length === 0) {
            await supabase.from("features").update({ status: "Done" }).eq("id", task.feature_id);
            console.log(`✅ Feature complete: ${task.features?.title}`);
        }
    }

    private async handle_failure(
        task: any,
        supabase: any,
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
            // Re-queue: set back to Approved with incremented retry count
            await supabase
                .from("tasks")
                .update({ status: "Approved", retry_count: retry_count + 1 })
                .eq("id", task.id);
            console.log(`🔄 Retrying task (attempt ${retry_count + 1}/${max_retries})`);
            // process_next() at the end of execute_task will pick it up
        } else if (behavior === "skip") {
            // Mark as skipped (treated as complete for pipeline progression) (BE-018)
            await supabase
                .from("tasks")
                .update({ status: "Complete" })
                .eq("id", task.id);
            console.log(`⏭ Skipping failed task, continuing pipeline`);
        } else {
            // stop: pipeline pauses, task stays as Approved (so it can be retried manually)
            await supabase.from("tasks").update({ status: "Approved" }).eq("id", task.id);
            this.state = "paused";
            console.log(`⏸ Pipeline paused due to task failure (stop behavior)`);
        }
    }

    private collect_output(active_run: ActiveRun, proc: Subprocess): void {
        const decoder = new TextDecoder();

        const read_stream = async (stream: ReadableStream<Uint8Array> | null) => {
            if (!stream) return;
            const reader = stream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    active_run.log += decoder.decode(value, { stream: true });
                }
            } catch (error) {
                console.warn("[pipeline_service] Stream read error:", error);
            }
        };

        Promise.all([
            read_stream(proc.stdout as ReadableStream<Uint8Array> | null),
            read_stream(proc.stderr as ReadableStream<Uint8Array> | null),
        ]).catch((error) => {
            console.error("[pipeline_service] collect_output failed:", error);
        });
    }

    /** Read and validate progress.json from a ralph work directory (M-1.3) */
    private read_progress(work_dir: string): z.infer<typeof progress_schema> | null {
        const progress_file = join(work_dir, "progress.json");
        if (!existsSync(progress_file)) return null;

        try {
            const raw = JSON.parse(readFileSync(progress_file, "utf-8"));
            const result = progress_schema.safeParse(raw);
            return result.success ? result.data : null;
        } catch {
            return null;
        }
    }
}

export const pipeline_service = new PipelineService();
