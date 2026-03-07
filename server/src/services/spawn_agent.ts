import { type Subprocess } from 'bun';
import { z } from 'zod';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { TypedSupabaseClient } from '../db';
import type { Enums } from '../database.types';

import { COPILOT_BIN, GEMINI_BIN, build_agent_env } from '../env';
import { logger } from '../utils/logger';

export const progress_schema = z.object({
    status: z.enum(['completed', 'failed', 'partial']),
    summary: z.string().optional(),
    files_changed: z.array(z.string()).optional(),
    error_details: z.string().nullable().optional()
});

export interface SpawnAgentOptions {
    agent_type: Enums<'agent_type'>
    work_dir: string
    spec_file: string
    spec_data: Record<string, unknown>
    prompt: string
    cli: string
    model: string
    timeout_ms?: number
    // DB reference fields
    feature_id?: string
    task_id?: string
}

export interface SpawnAgentResult {
    exit_code: number
    log: string
    run_id: string
    work_dir: string
}

/**
 * Generic agent spawn function shared by agent_service and pipeline_service.
 * Handles: mkdir, spec write, agent_runs record, Bun.spawn, output collection,
 * optional timeout, log save, agent_runs update.
 */
export async function spawn_agent(
    options: SpawnAgentOptions,
    supabase: TypedSupabaseClient
): Promise<SpawnAgentResult> {
    const { agent_type, work_dir, spec_file, spec_data, prompt, cli, model, timeout_ms } = options;

    // 1. Prepare workspace
    try {
        mkdirSync(work_dir, { recursive: true });
        writeFileSync(join(work_dir, spec_file), JSON.stringify(spec_data, null, 2));
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to prepare agent workspace', { service: 'spawn_agent', work_dir, error: msg });
        throw new Error(`Workspace preparation failed: ${msg}`);
    }

    // 2. Create agent_runs record
    const started_at = new Date().toISOString();
    const { data: run_record, error: insert_error } = await supabase
        .from('agent_runs')
        .insert({
            type: agent_type,
            feature_id: options.feature_id ?? null,
            task_id: options.task_id ?? null,
            status: 'running',
            started_at,
            cli,
            model
        })
        .select('id')
        .single();

    if (insert_error) logger.error('Failed to insert agent_runs record', { service: 'spawn_agent', error: insert_error.message });
    const run_id: string = run_record?.id ?? '';

    // 3. Build spawn args
    const bin = cli === 'gemini' ? GEMINI_BIN : COPILOT_BIN;
    const spawn_args = [bin, '-p', prompt];
    if (cli === 'gemini') {
        spawn_args.push('--yolo');
    }
    else {
        spawn_args.push('--allow-all-tools');
    }
    if (model) spawn_args.push('--model', model);

    // 4. Spawn process
    let log = '';
    const proc = Bun.spawn(spawn_args, {
        cwd: work_dir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: build_agent_env()
    });

    // 5. Collect output (capped at 1MB)
    const MAX_LOG_BUFFER = 1024 * 1024;
    const on_chunk = (chunk: string) => {
        if (log.length + chunk.length > MAX_LOG_BUFFER) {
            const available = MAX_LOG_BUFFER - log.length;
            if (available > 0) {
                log += chunk.slice(0, available);
            }
        }
        else {
            log += chunk;
        }
    };
    const collect_promise = collect_output(proc, on_chunk);

    // 6. Wait for completion (with optional timeout)
    let exit_code: number;
    if (timeout_ms) {
        exit_code = await Promise.race([
            proc.exited,
            new Promise<number>((resolve) =>
                setTimeout(() => {
                    // M-10.5: Kill process group (negative PID) to clean up all children
                    try {
                        process.kill(-proc.pid, 'SIGKILL');
                    }
                    catch {
                        // Process may have already exited or group kill unsupported
                        try {
                            proc.kill();
                        }
                        catch {
                            /* already dead */
                        }
                    }
                    resolve(-1);
                }, timeout_ms)
            )
        ]);
    }
    else {
        exit_code = await proc.exited;
    }

    // Ensure output collection finishes
    await collect_promise.catch(() => {

    });

    // 7. Save log + update agent_runs
    const finished_at = new Date().toISOString();
    const duration_ms = Date.now() - new Date(started_at).getTime();
    writeFileSync(join(work_dir, 'agent.log'), log);

    const progress_data = read_progress(work_dir);
    const succeeded = exit_code === 0;

    const { error: update_error } = await supabase
        .from('agent_runs')
        .update({
            status: succeeded ? 'completed' : 'failed',
            log: log.slice(-10000),
            finished_at,
            duration_ms,
            summary: progress_data?.summary ?? null,
            files_changed: progress_data?.files_changed ?? null,
            ...(exit_code === -1 ? { error: 'Task timed out' } : {})
        })
        .eq('id', run_id);
    if (update_error) logger.error('Failed to update agent_runs record', { service: 'spawn_agent', run_id, error: update_error.message });

    return { exit_code, log, run_id, work_dir };
}

/** Read and validate progress.json from a work directory */
export function read_progress(work_dir: string): z.infer<typeof progress_schema> | null {
    const progress_file = join(work_dir, 'progress.json');
    if (!existsSync(progress_file)) return null;
    try {
        const raw = JSON.parse(readFileSync(progress_file, 'utf-8'));
        const result = progress_schema.safeParse(raw);
        return result.success ? result.data : null;
    }
    catch {
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
        }
        catch (error) {
            logger.warn('Stream read error', { service: 'spawn_agent', error: String(error) });
        }
    };

    await Promise.all([
        read_stream(proc.stdout as ReadableStream<Uint8Array> | null),
        read_stream(proc.stderr as ReadableStream<Uint8Array> | null)
    ]);
}
