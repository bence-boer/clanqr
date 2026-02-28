import { type Subprocess } from "bun";
import { z } from "zod";
import type { SupabaseClient } from "../db";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { COPILOT_BIN, GEMINI_BIN, ENRICHED_PATH, WORKSPACE_DIR } from "../env";
import { prompt_service } from "./prompt_service";

const HOME = process.env.HOME ?? "/home/scoy";

// --- Zod schemas for agent output validation ---

const task_output_schema = z.object({
    description: z.string().min(20, "Task description must be at least 20 characters").max(5000, "Task description must not exceed 5000 characters"),
}).strict();

const manager_output_schema = z.array(task_output_schema)
    .min(1, "At least one task is required")
    .max(50, "Maximum 50 tasks allowed");

const progress_schema = z.object({
    status: z.enum(["completed", "failed", "partial"]),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional(),
});

const MAX_OUTPUT_FILE_SIZE = 1024 * 1024; // 1MB

interface AgentProcess {
    task_id: string;
    run_id?: string; // agent_runs table id
    type: "manager" | "ralph";
    cli: string;
    process: Subprocess | null;
    status: "running" | "completed" | "failed" | "stopped";
    started_at: string;
    finished_at?: string;
    log: string;
}

const AGENT_WORKSPACE_DIR = WORKSPACE_DIR;

class AgentService {
    private processes: Map<string, AgentProcess> = new Map();

    constructor() {
        if (!existsSync(AGENT_WORKSPACE_DIR)) {
            mkdirSync(AGENT_WORKSPACE_DIR, { recursive: true });
        }
    }

    get_all_processes() {
        const result: Record<string, Omit<AgentProcess, "process">> = {};
        for (const [id, proc] of this.processes) {
            const { process: _proc, ...rest } = proc;
            result[id] = rest;
        }
        return result;
    }

    get_log(task_id: string): string {
        const proc = this.processes.get(task_id);
        if (proc) {
            return proc.log;
        }

        const log_path = join(AGENT_WORKSPACE_DIR, task_id, "agent.log");
        if (existsSync(log_path)) {
            return readFileSync(log_path, "utf-8");
        }
        return "";
    }

    async spawn_manager(feature: any, supabase: SupabaseClient) {
        const feature_id = feature.id;
        const work_dir = join(AGENT_WORKSPACE_DIR, `manager-${feature_id}`);
        mkdirSync(work_dir, { recursive: true });

        // Write feature spec for the manager agent
        const spec = {
            feature_id: feature.id,
            title: feature.title,
            description: feature.description,
            project: feature.projects?.name ?? "Unknown",
            resources: (feature.resources ?? []).map((r: any) => ({
                url: r.url,
                title: r.title,
            })),
        };

        writeFileSync(
            join(work_dir, "feature-spec.json"),
            JSON.stringify(spec, null, 2)
        );

        // Update feature status
        await supabase
            .from("features")
            .update({ status: "In_Progress" })
            .eq("id", feature_id);

        const prompt = await prompt_service.resolve_for_manager(spec, feature_id, feature.project_id);

        // Create agent_runs record
        const cli = feature.cli || "copilot";
        const model = feature.model || (cli === "gemini" ? "gemini-3-flash-preview" : "gpt-4o");
        const started_at = new Date().toISOString();
        const { data: run_record } = await supabase
            .from("agent_runs")
            .insert({
                type: "manager",
                feature_id,
                status: "running",
                started_at,
                cli,
                model,
            })
            .select("id")
            .single();

        const agent_proc: AgentProcess = {
            task_id: `manager-${feature_id}`,
            run_id: run_record?.id,
            type: "manager",
            cli,
            process: null,
            status: "running",
            started_at,
            log: "",
        };

        this.processes.set(agent_proc.task_id, agent_proc);

        try {
            const bin = cli === "gemini" ? GEMINI_BIN : COPILOT_BIN;
            const manager_spawn_args = [bin, "-p", prompt];
            
            if (cli === "gemini") {
                manager_spawn_args.push("--yolo");
            } else {
                manager_spawn_args.push("--allow-all-tools");
            }
            
            if (model) manager_spawn_args.push("--model", model);

            const proc = Bun.spawn(
                manager_spawn_args,
                {
                    cwd: work_dir,
                    stdout: "pipe",
                    stderr: "pipe",
                    env: { ...process.env, HOME, PATH: ENRICHED_PATH },
                }
            );

            agent_proc.process = proc;

            // Collect output
            this.collect_output(agent_proc, proc);

            // Wait for completion
            const exit_code = await proc.exited;
            agent_proc.status = exit_code === 0 ? "completed" : "failed";
            agent_proc.finished_at = new Date().toISOString();

            // Save log
            writeFileSync(join(work_dir, "agent.log"), agent_proc.log);

            // Update agent_runs record
            if (run_record?.id) {
                const duration_ms = Date.now() - new Date(started_at).getTime();
                await supabase
                    .from("agent_runs")
                    .update({
                        status: agent_proc.status,
                        log: agent_proc.log.slice(-10000),
                        finished_at: agent_proc.finished_at,
                        duration_ms,
                    })
                    .eq("id", run_record.id);
            }

            // Parse tasks from output file
            if (exit_code === 0) {
                await this.parse_manager_output(feature_id, work_dir, supabase, run_record?.id);
            } else {
                // M-2.2: Record error and increment retry count on feature
                const error_msg = `Manager failed with exit code ${exit_code}`;
                await supabase
                    .from("features")
                    .update({
                        status: "Submitted",
                        last_error: error_msg,
                        manager_retry_count: (feature.manager_retry_count ?? 0) + 1,
                    })
                    .eq("id", feature_id);
            }
        } catch (error) {
            agent_proc.status = "failed";
            agent_proc.finished_at = new Date().toISOString();
            agent_proc.log +=
                `\nERROR: ${error instanceof Error ? error.message : "Unknown error"}`;
            // M-2.2: Record error and increment retry count on feature
            const error_msg = error instanceof Error ? error.message : "Unknown error";
            await supabase
                .from("features")
                .update({
                    status: "Submitted",
                    last_error: error_msg,
                    manager_retry_count: (feature.manager_retry_count ?? 0) + 1,
                })
                .eq("id", feature_id);
            if (run_record?.id) {
                await supabase
                    .from("agent_runs")
                    .update({
                        status: "failed",
                        error: error instanceof Error ? error.message : "Unknown error",
                        finished_at: agent_proc.finished_at,
                    })
                    .eq("id", run_record.id);
            }
        }
    }

    async spawn_ralph(task: any, supabase: SupabaseClient) {
        const task_id = task.id;
        const work_dir = join(AGENT_WORKSPACE_DIR, `ralph-${task_id}`);
        mkdirSync(work_dir, { recursive: true });

        const task_spec = {
            task_id: task.id,
            description: task.description,
            feature_title: task.features?.title ?? "Unknown",
            project_name: task.features?.projects?.name ?? "Unknown",
        };

        writeFileSync(
            join(work_dir, "task-spec.json"),
            JSON.stringify(task_spec, null, 2)
        );

        // Update task status
        await supabase
            .from("tasks")
            .update({ status: "In_Progress" })
            .eq("id", task_id);

        const prompt = await prompt_service.resolve_for_task(task_id, task_spec);

        // Create agent_runs record
        const cli = task.features?.cli || "copilot";
        const model = task.features?.model || (cli === "gemini" ? "gemini-3-flash-preview" : "gpt-4o");
        const started_at = new Date().toISOString();
        const { data: run_record } = await supabase
            .from("agent_runs")
            .insert({
                type: "ralph",
                task_id,
                status: "running",
                started_at,
                cli,
                model,
            })
            .select("id")
            .single();

        const agent_proc: AgentProcess = {
            task_id: `ralph-${task_id}`,
            run_id: run_record?.id,
            type: "ralph",
            cli,
            process: null,
            status: "running",
            started_at,
            log: "",
        };

        this.processes.set(agent_proc.task_id, agent_proc);

        try {
            const bin = cli === "gemini" ? GEMINI_BIN : COPILOT_BIN;
            const ralph_spawn_args = [bin, "-p", prompt];
            
            if (cli === "gemini") {
                ralph_spawn_args.push("--yolo");
            } else {
                ralph_spawn_args.push("--allow-all-tools");
            }
            
            if (model) ralph_spawn_args.push("--model", model);

            const proc = Bun.spawn(
                ralph_spawn_args,
                {
                    cwd: work_dir,
                    stdout: "pipe",
                    stderr: "pipe",
                    env: { ...process.env, HOME, PATH: ENRICHED_PATH },
                }
            );

            agent_proc.process = proc;
            this.collect_output(agent_proc, proc);

            const exit_code = await proc.exited;
            agent_proc.status = exit_code === 0 ? "completed" : "failed";
            agent_proc.finished_at = new Date().toISOString();

            writeFileSync(join(work_dir, "agent.log"), agent_proc.log);

            // Update agent_runs record
            if (run_record?.id) {
                const duration_ms = Date.now() - new Date(started_at).getTime();
                const progress_data = this.read_progress(work_dir);
                await supabase
                    .from("agent_runs")
                    .update({
                        status: agent_proc.status,
                        log: agent_proc.log.slice(-10000),
                        finished_at: agent_proc.finished_at,
                        duration_ms,
                        summary: progress_data?.summary ?? null,
                        files_changed: progress_data?.files_changed ?? null,
                    })
                    .eq("id", run_record.id);
            }

            // Update task status
            await supabase
                .from("tasks")
                .update({
                    status: exit_code === 0 ? "Complete" : "Approved",
                    agent_log: agent_proc.log.slice(-5000),
                })
                .eq("id", task_id);

            // Check if all tasks for the feature are complete (Complete or Skipped)
            if (exit_code === 0 && task.features) {
                const { data: remaining } = await supabase
                    .from("tasks")
                    .select("id")
                    .eq("feature_id", task.features.id)
                    .not("status", "in", '("Complete","Skipped")');

                if (!remaining || remaining.length === 0) {
                    await supabase
                        .from("features")
                        .update({ status: "Done" })
                        .eq("id", task.features.id);
                }
            }
        } catch (error) {
            agent_proc.status = "failed";
            agent_proc.finished_at = new Date().toISOString();
            agent_proc.log +=
                `\nERROR: ${error instanceof Error ? error.message : "Unknown error"}`;
            if (run_record?.id) {
                await supabase
                    .from("agent_runs")
                    .update({
                        status: "failed",
                        error: error instanceof Error ? error.message : "Unknown error",
                        finished_at: agent_proc.finished_at,
                    })
                    .eq("id", run_record.id);
            }
        }
    }

    stop_process(task_id: string, supabase?: SupabaseClient) {
        const proc = this.processes.get(task_id);
        if (proc?.process) {
            proc.process.kill();
            proc.status = "stopped";
            proc.finished_at = new Date().toISOString();
            if (supabase && proc.run_id) {
                supabase
                    .from("agent_runs")
                    .update({ status: "stopped", finished_at: proc.finished_at })
                    .eq("id", proc.run_id)
                    .then(() => { });
            }
        }
    }

    stop_all(supabase?: SupabaseClient) {
        for (const [_id, proc] of this.processes) {
            if (proc.process && proc.status === "running") {
                proc.process.kill();
                proc.status = "stopped";
                proc.finished_at = new Date().toISOString();
                if (supabase && proc.run_id) {
                    supabase
                        .from("agent_runs")
                        .update({ status: "stopped", finished_at: proc.finished_at })
                        .eq("id", proc.run_id)
                        .then(() => { });
                }
            }
        }
    }

    private async collect_output(agent_proc: AgentProcess, proc: Subprocess) {
        const decoder = new TextDecoder();

        const read_stream = async (
            stream: ReadableStream<Uint8Array> | null | undefined
        ) => {
            if (!stream) return;
            const reader = stream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    agent_proc.log += decoder.decode(value, { stream: true });
                }
            } catch (error) {
                console.warn("[agent_service] Stream read error:", error);
            }
        };

        // Read both streams concurrently — await to propagate errors (BE-013)
        await Promise.all([
            read_stream(proc.stdout as ReadableStream<Uint8Array> | null),
            read_stream(proc.stderr as ReadableStream<Uint8Array> | null),
        ]);
    }

    private async parse_manager_output(
        feature_id: string,
        work_dir: string,
        supabase: SupabaseClient,
        run_id?: string
    ) {
        const tasks_file = join(work_dir, "tasks.json");

        // M-1.2: Missing tasks.json after successful exit is an error
        if (!existsSync(tasks_file)) {
            console.error(`[agent] Manager exited 0 but no tasks.json for feature ${feature_id}`);
            await supabase.from("features")
                .update({ status: "Draft" })
                .eq("id", feature_id);
            if (run_id) {
                await supabase.from("agent_runs")
                    .update({ status: "failed", error: "Manager completed but produced no tasks.json" })
                    .eq("id", run_id);
            }
            return;
        }

        try {
            // M-1.1: Size limit check before parsing
            const { size } = Bun.file(tasks_file);
            if (size > MAX_OUTPUT_FILE_SIZE) {
                const error_msg = `tasks.json exceeds maximum size (${size} bytes > ${MAX_OUTPUT_FILE_SIZE})`;
                console.error(`[agent] ${error_msg}`);
                await supabase.from("features")
                    .update({ status: "Draft" })
                    .eq("id", feature_id);
                if (run_id) {
                    await supabase.from("agent_runs")
                        .update({ status: "failed", error: error_msg })
                        .eq("id", run_id);
                }
                return;
            }

            const content = readFileSync(tasks_file, "utf-8");
            const raw = JSON.parse(content);

            // M-1.1: Zod schema validation
            const result = manager_output_schema.safeParse(raw);

            if (!result.success) {
                const error_msg = `Invalid tasks.json: ${result.error.issues.map(i => i.message).join("; ")}`;
                console.error(`[agent] ${error_msg}`);
                await supabase.from("features")
                    .update({ status: "Draft" })
                    .eq("id", feature_id);
                if (run_id) {
                    await supabase.from("agent_runs")
                        .update({ status: "failed", error: error_msg })
                        .eq("id", run_id);
                }
                return;
            }

            const task_rows = result.data.map(t => ({
                feature_id,
                description: t.description,
                status: "Pending_Approval" as const,
            }));

            await supabase.from("tasks").insert(task_rows);
        } catch (error) {
            const error_msg = error instanceof Error ? error.message : "Unknown parse error";
            console.error("[agent_service] Failed to parse manager tasks output:", error_msg);
            await supabase.from("features")
                .update({ status: "Draft" })
                .eq("id", feature_id);
            if (run_id) {
                await supabase.from("agent_runs")
                    .update({ status: "failed", error: `Failed to parse tasks.json: ${error_msg}` })
                    .eq("id", run_id);
            }
        }
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

export const agent_service = new AgentService();
