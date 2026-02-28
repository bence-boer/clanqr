import { type Subprocess } from "bun";
import { z } from "zod";
import type { SupabaseClient } from "../db";
import type { FeatureRow, TaskRow } from "../types";
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import { WORKSPACE_DIR } from "../env";
import { prompt_service } from "./prompt_service";
import { check_and_complete_feature } from "./feature_utils";
import { spawn_agent } from "./spawn_agent";

// --- Zod schemas for agent output validation ---

const task_output_schema = z.object({
    description: z.string().min(20, "Task description must be at least 20 characters").max(5000, "Task description must not exceed 5000 characters"),
}).strict();

const manager_output_schema = z.array(task_output_schema)
    .min(1, "At least one task is required")
    .max(50, "Maximum 50 tasks allowed");

const MAX_OUTPUT_FILE_SIZE = 1024 * 1024; // 1MB
const MANAGER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AgentProcess {
    task_id: string;
    run_id?: string;
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

    async spawn_manager(feature: FeatureRow & { resources?: { url: string; title: string | null }[]; projects?: { name: string } }, supabase: SupabaseClient) {
        const feature_id = feature.id;
        const work_dir = join(AGENT_WORKSPACE_DIR, `manager-${feature_id}`);
        const process_id = `manager-${feature_id}`;

        const spec = {
            feature_id: feature.id,
            title: feature.title,
            description: feature.description,
            project: feature.projects?.name ?? "Unknown",
            resources: (feature.resources ?? []).map((r) => ({
                url: r.url,
                title: r.title,
            })),
        };

        // Update feature status
        await supabase
            .from("features")
            .update({ status: "In_Progress" })
            .eq("id", feature_id);

        const prompt = await prompt_service.resolve_for_manager(spec, feature_id, feature.project_id);
        const cli = feature.cli || "copilot";
        const model = feature.model || (cli === "gemini" ? "gemini-3-flash-preview" : "gpt-4o");

        // Track in process map
        const agent_proc: AgentProcess = {
            task_id: process_id,
            type: "manager",
            cli,
            process: null,
            status: "running",
            started_at: new Date().toISOString(),
            log: "",
        };
        this.processes.set(process_id, agent_proc);

        try {
            const result = await spawn_agent({
                agent_type: "manager",
                work_dir,
                spec_file: "feature-spec.json",
                spec_data: spec,
                prompt,
                cli,
                model,
                feature_id,
                timeout_ms: MANAGER_TIMEOUT_MS,
            }, supabase);

            agent_proc.run_id = result.run_id;
            agent_proc.log = result.log;
            agent_proc.status = result.exit_code === 0 ? "completed" : "failed";
            agent_proc.finished_at = new Date().toISOString();

            if (result.exit_code === 0) {
                await this.parse_manager_output(feature_id, work_dir, supabase, result.run_id);
                // M-6.1: Reset retry count on successful completion
                await supabase
                    .from("features")
                    .update({ manager_retry_count: 0 })
                    .eq("id", feature_id);
            } else {
                const error_msg = result.exit_code === -1
                    ? "Manager timed out after 15 minutes"
                    : `Manager failed with exit code ${result.exit_code}`;
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
            const error_msg = error instanceof Error ? error.message : "Unknown error";
            agent_proc.log += `\nERROR: ${error_msg}`;
            await supabase
                .from("features")
                .update({
                    status: "Submitted",
                    last_error: error_msg,
                    manager_retry_count: (feature.manager_retry_count ?? 0) + 1,
                })
                .eq("id", feature_id);
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

    private async parse_manager_output(
        feature_id: string,
        work_dir: string,
        supabase: SupabaseClient,
        run_id?: string
    ) {
        const tasks_file = join(work_dir, "tasks.json");

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

    /** Remove workspace directories older than max_age_days, skipping active ones */
    cleanup_old_workspaces(max_age_days: number = 7): number {
        const cutoff = Date.now() - (max_age_days * 24 * 60 * 60 * 1000);
        let cleaned = 0;

        if (!existsSync(AGENT_WORKSPACE_DIR)) return 0;

        // Collect IDs of actively running processes to skip
        const active_ids = new Set<string>();
        for (const [id, proc] of this.processes) {
            if (proc.status === "running") {
                active_ids.add(id);
            }
        }

        for (const entry of readdirSync(AGENT_WORKSPACE_DIR, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;

            // Skip active workspaces
            const dir_name = entry.name;
            const is_active = [...active_ids].some(id => dir_name.includes(id));
            if (is_active) continue;

            const dir_path = join(AGENT_WORKSPACE_DIR, dir_name);
            try {
                const stat = statSync(dir_path);
                if (stat.mtimeMs < cutoff) {
                    rmSync(dir_path, { recursive: true, force: true });
                    cleaned++;
                }
            } catch {
                // Skip directories we can't stat
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old workspace(s)`);
        }
        return cleaned;
    }
}

export const agent_service = new AgentService();
