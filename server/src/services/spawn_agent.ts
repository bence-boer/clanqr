import { type Subprocess } from "bun";
import { z } from "zod";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import type { SupabaseClient } from "../db";
import type { AgentRunType } from "../types";
import { COPILOT_BIN, GEMINI_BIN, ENRICHED_PATH, WORKSPACE_DIR } from "../env";

const HOME = process.env.HOME ?? "/home/scoy";

export const progress_schema = z.object({
    status: z.enum(["completed", "failed", "partial"]),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional(),
});

export interface SpawnAgentOptions {
    agent_type: AgentRunType;
    work_dir: string;
    spec_file: string;
    spec_data: Record<string, unknown>;
    prompt: string;
    cli: string;
    model: string;
    timeout_ms?: number;
    // DB reference fields
    feature_id?: string;
    task_id?: string;
}

export interface SpawnAgentResult {
    exit_code: number;
    log: string;
    run_id: string;
    work_dir: string;
}

/**
 * Generic agent spawn function shared by agent_service and pipeline_service.
 * Handles: mkdir, spec write, agent_runs record, Bun.spawn, output collection,
 * optional timeout, log save, agent_runs update.
 */
export async function spawn_agent(
    options: SpawnAgentOptions,
    supabase: SupabaseClient
): Promise<SpawnAgentResult> {
    const { agent_type, work_dir, spec_file, spec_data, prompt, cli, model, timeout_ms } = options;

    // 1. Prepare workspace
    mkdirSync(work_dir, { recursive: true });
    writeFileSync(join(work_dir, spec_file), JSON.stringify(spec_data, null, 2));

    // 2. Create agent_runs record
    const started_at = new Date().toISOString();
    const { data: run_record } = await supabase
        .from("agent_runs")
        .insert({
            type: agent_type,
            feature_id: options.feature_id ?? null,
            task_id: options.task_id ?? null,
            status: "running",
            started_at,
            cli,
            model,
        })
        .select("id")
        .single();

    const run_id: string = run_record?.id ?? "";

    // 3. Build spawn args
    const bin = cli === "gemini" ? GEMINI_BIN : COPILOT_BIN;
    const spawn_args = [bin, "-p", prompt];
    if (cli === "gemini") {
        spawn_args.push("--yolo");
    } else {
        spawn_args.push("--allow-all-tools");
    }
    if (model) spawn_args.push("--model", model);

    // 4. Spawn process
    let log = "";
    const proc = Bun.spawn(spawn_args, {
        cwd: work_dir,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, HOME, PATH: ENRICHED_PATH },
    });

    // 5. Collect output
    const collect_promise = collect_output(proc, (chunk) => { log += chunk; });

    // 6. Wait for completion (with optional timeout)
    let exit_code: number;
    if (timeout_ms) {
        exit_code = await Promise.race([
            proc.exited,
            new Promise<number>((resolve) =>
                setTimeout(() => {
                    proc.kill();
                    resolve(-1);
                }, timeout_ms)
            ),
        ]);
    } else {
        exit_code = await proc.exited;
    }

    // Ensure output collection finishes
    await collect_promise.catch(() => { });

    // 7. Save log + update agent_runs
    const finished_at = new Date().toISOString();
    const duration_ms = Date.now() - new Date(started_at).getTime();
    writeFileSync(join(work_dir, "agent.log"), log);

    const progress_data = read_progress(work_dir);
    const succeeded = exit_code === 0;

    await supabase
        .from("agent_runs")
        .update({
            status: succeeded ? "completed" : "failed",
            log: log.slice(-10000),
            finished_at,
            duration_ms,
            summary: progress_data?.summary ?? null,
            files_changed: progress_data?.files_changed ?? null,
            ...(exit_code === -1 ? { error: "Task timed out" } : {}),
        })
        .eq("id", run_id);

    return { exit_code, log, run_id, work_dir };
}

/** Read and validate progress.json from a work directory */
export function read_progress(work_dir: string): z.infer<typeof progress_schema> | null {
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

async function collect_output(
    proc: Subprocess,
    on_chunk: (text: string) => void
): Promise<void> {
    const decoder = new TextDecoder();

    const read_stream = async (stream: ReadableStream<Uint8Array> | null | undefined) => {
        if (!stream) return;
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                on_chunk(decoder.decode(value, { stream: true }));
            }
        } catch (error) {
            console.warn("[spawn_agent] Stream read error:", error);
        }
    };

    await Promise.all([
        read_stream(proc.stdout as ReadableStream<Uint8Array> | null),
        read_stream(proc.stderr as ReadableStream<Uint8Array> | null),
    ]);
}
