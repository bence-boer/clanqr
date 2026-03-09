import { type Subprocess } from 'bun';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { TypedSupabaseClient } from '../db';
import type { Enums } from '../database.types';

import { COPILOT_BIN, GEMINI_BIN, build_agent_env } from '../env';
import { logger } from '../utils/logger';
import { container_service } from './container_service';
import { catalog_artifacts } from './artifact_service';
import { read_progress, collect_output, kill_agent_process } from './spawn_utils';

export { progress_schema, read_progress } from './spawn_utils';

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
    // Container execution
    project_id?: string
    container_work_dir?: string
}

export interface SpawnAgentResult {
    exit_code: number
    log: string
    run_id: string
    work_dir: string
}

/**
 * Generic agent spawn function shared by agent_service and pipeline_service.
 * Handles: mkdir, spec write, agent_runs record, container exec / direct spawn,
 * output collection, optional timeout, log save, artifact cataloguing, agent_runs update.
 */
export async function spawn_agent(
    options: SpawnAgentOptions,
    supabase: TypedSupabaseClient
): Promise<SpawnAgentResult> {
    const { agent_type, work_dir, spec_file, spec_data, prompt, cli, model, timeout_ms, project_id, container_work_dir } = options;

    // 1. Prepare workspace (on host filesystem)
    try {
        mkdirSync(work_dir, { recursive: true });
        mkdirSync(join(work_dir, 'artifacts'), { recursive: true });
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

    // 3. Build spawn args — agent CLI command
    const bin = cli === 'gemini' ? 'gemini' : 'copilot';
    const cli_args = [bin, '-p', prompt];
    if (cli === 'gemini') {
        cli_args.push('--yolo');
    }
    else {
        cli_args.push('--allow-all-tools');
    }
    if (model) cli_args.push('--model', model);

    // 4. Spawn process — either via Docker exec or directly
    let log = '';
    let proc: Subprocess;
    let acquired_container = false;

    if (project_id && container_work_dir) {
        await container_service.acquire(project_id);
        acquired_container = true;
        const docker_args = container_service.build_exec_args(project_id, container_work_dir);
        docker_args.push(...cli_args);
        proc = Bun.spawn(docker_args, { stdout: 'pipe', stderr: 'pipe' });
    }
    else {
        const host_bin = cli === 'gemini' ? GEMINI_BIN : COPILOT_BIN;
        const spawn_args = [host_bin, '-p', prompt];
        if (cli === 'gemini') spawn_args.push('--yolo');
        else spawn_args.push('--allow-all-tools');
        if (model) spawn_args.push('--model', model);
        proc = Bun.spawn(spawn_args, { cwd: work_dir, stdout: 'pipe', stderr: 'pipe', env: build_agent_env() });
    }

    try {
        const MAX_LOG_BUFFER = 1024 * 1024;
        const on_chunk = (chunk: string) => {
            if (log.length + chunk.length > MAX_LOG_BUFFER) {
                const available = MAX_LOG_BUFFER - log.length;
                if (available > 0) log += chunk.slice(0, available);
            }
            else {
                log += chunk;
            }
        };
        const collect_promise = collect_output(proc, on_chunk);

        let exit_code: number;
        if (timeout_ms) {
            exit_code = await Promise.race([
                proc.exited,
                new Promise<number>((resolve) =>
                    setTimeout(() => {
                        kill_agent_process(proc);
                        resolve(-1);
                    }, timeout_ms)
                )
            ]);
        }
        else {
            exit_code = await proc.exited;
        }
        await collect_promise.catch(() => undefined);

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

        if (options.task_id) {
            await catalog_artifacts(options.task_id, work_dir, supabase);
        }

        return { exit_code, log, run_id, work_dir };
    }
    finally {
        if (acquired_container && project_id) {
            await container_service.release(project_id).catch((err) =>
                logger.warn('Failed to release container', { service: 'spawn_agent', error: String(err) })
            );
        }
    }
}
