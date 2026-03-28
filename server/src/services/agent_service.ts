import { type Subprocess } from 'bun';
import type { TypedSupabaseClient } from '../db';
import type { Tables } from '../database.types';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_DIR } from '../env';
import { prompt_service } from './prompt_service';
import { spawn_agent } from './spawn_agent';
import { logger } from '../utils/logger';
import { can_spawn_agent, increment_agent_count, decrement_agent_count } from './agent_concurrency';
import { parse_manager_output } from './manager_output';
import { event_bus } from './event_bus';
import { container_service, PROJECTS_WORKSPACE_DIR } from './container_service';

// Re-export concurrency utilities for consumers
export { can_spawn_agent, increment_agent_count, decrement_agent_count, set_on_agent_freed, get_agent_concurrency } from './agent_concurrency';

const MANAGER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AgentProcess {
    task_id: string
    run_id?: string
    type: 'manager' | 'ralph'
    cli: string
    process: Subprocess | null
    status: 'running' | 'completed' | 'failed' | 'stopped'
    started_at: string
    finished_at?: string
    log: string
}

class AgentService {
    private processes: Map<string, AgentProcess> = new Map();

    constructor() {
        if (!existsSync(WORKSPACE_DIR)) mkdirSync(WORKSPACE_DIR, { recursive: true });
    }

    get_all_processes() {
        const result: Record<string, Omit<AgentProcess, 'process'>> = {};
        for (const [id, proc] of this.processes) {
            const rest = { ...proc } as Omit<AgentProcess, 'process'> & { process?: unknown };
            delete rest.process;
            result[id] = rest;
        }
        return result;
    }

    get_log(task_id: string): string {
        const proc = this.processes.get(task_id);
        if (proc) return proc.log;
        const legacy_log_path = join(WORKSPACE_DIR, task_id, 'agent.log');
        if (existsSync(legacy_log_path)) return readFileSync(legacy_log_path, 'utf-8');
        if (existsSync(PROJECTS_WORKSPACE_DIR)) {
            for (const project_dir of readdirSync(PROJECTS_WORKSPACE_DIR, { withFileTypes: true })) {
                if (!project_dir.isDirectory()) continue;
                const project_path = join(PROJECTS_WORKSPACE_DIR, project_dir.name);
                for (const agent_dir of readdirSync(project_path, { withFileTypes: true })) {
                    if (!agent_dir.isDirectory()) continue;
                    if (agent_dir.name !== task_id && !agent_dir.name.endsWith(`-${task_id}`)) continue;
                    const log_path = join(project_path, agent_dir.name, 'agent.log');
                    if (existsSync(log_path)) return readFileSync(log_path, 'utf-8');
                }
            }
        }
        return '';
    }

    async spawn_manager(
        feature: Tables<'features'> & { resources?: { url: string, title: string | null }[], projects?: { name: string, id?: string } },
        supabase: TypedSupabaseClient
    ) {
        const feature_id = feature.id;
        const project_id = feature.project_id;
        const agent_dir = `manager-${feature_id}`;
        const work_dir = container_service.agent_workspace(project_id, agent_dir);
        const container_work_dir = `/workspace/${agent_dir}`;
        const process_id = `manager-${feature_id}`;

        const spec = {
            feature_id: feature.id,
            title: feature.title,
            description: feature.description,
            project: feature.projects?.name ?? 'Unknown',
            resources: (feature.resources ?? []).map((r) => ({ url: r.url, title: r.title }))
        };

        const { error: status_error } = await supabase
            .from('features')
            .update({ status: 'in_progress' })
            .eq('id', feature_id);
        if (status_error) logger.error('Failed to update feature status', { service: 'agent', feature_id, error: status_error.message });

        event_bus.emit({ type: 'features:update', data: { feature_id, status: 'in_progress', project_id: feature.project_id } });

        const prompt = await prompt_service.resolve_for_manager(spec, feature_id, feature.project_id);
        const cli = 'copilot';
        const model = 'gpt-4.1';

        if (!can_spawn_agent()) {
            logger.warn('Agent concurrency limit reached, deferring manager spawn', { service: 'agent', feature_id });
            await supabase.from('features').update({ status: 'submitted' }).eq('id', feature_id);
            return;
        }

        const agent_proc: AgentProcess = {
            task_id: process_id, type: 'manager', cli, process: null,
            status: 'running', started_at: new Date().toISOString(), log: ''
        };
        this.processes.set(process_id, agent_proc);

        event_bus.emit({
            type: 'agents:update',
            data: { process_id, status: 'running', agent_type: 'manager', started_at: agent_proc.started_at }
        });

        increment_agent_count();
        try {
            const result = await spawn_agent({
                agent_type: 'manager', work_dir, spec_file: 'feature-spec.json',
                spec_data: spec, prompt, cli, model, feature_id, timeout_ms: MANAGER_TIMEOUT_MS,
                project_id, container_work_dir
            }, supabase);

            agent_proc.run_id = result.run_id;
            agent_proc.log = result.log;
            agent_proc.status = result.exit_code === 0 ? 'completed' : 'failed';
            agent_proc.finished_at = new Date().toISOString();

            event_bus.emit({
                type: 'agents:update',
                data: { process_id, status: agent_proc.status, agent_type: 'manager', started_at: agent_proc.started_at, finished_at: agent_proc.finished_at }
            });

            if (result.exit_code === 0) {
                await parse_manager_output(feature_id, work_dir, supabase, result.run_id, result.log);
                const { error: reset_error } = await supabase.from('features').update({ manager_retry_count: 0 }).eq('id', feature_id);
                if (reset_error) logger.error('Failed to reset manager retry count', { service: 'agent', feature_id, error: reset_error.message });
            }
            else {
                const error_msg = result.exit_code === -1
                    ? 'Manager timed out after 15 minutes'
                    : `Manager failed with exit code ${result.exit_code}`;
                const { error: fail_error } = await supabase.from('features').update({
                    status: 'submitted', last_error: error_msg, manager_retry_count: (feature.manager_retry_count ?? 0) + 1
                }).eq('id', feature_id);
                if (fail_error) logger.error('Failed to update feature after manager failure', { service: 'agent', feature_id, error: fail_error.message });
            }
        }
        catch (error) {
            agent_proc.status = 'failed';
            agent_proc.finished_at = new Date().toISOString();
            const error_msg = error instanceof Error ? error.message : 'Unknown error';
            agent_proc.log += `\nERROR: ${error_msg}`;

            event_bus.emit({
                type: 'agents:update',
                data: { process_id, status: 'failed', agent_type: 'manager', started_at: agent_proc.started_at, finished_at: agent_proc.finished_at }
            });

            const { error: catch_error } = await supabase.from('features').update({
                status: 'submitted', last_error: error_msg, manager_retry_count: (feature.manager_retry_count ?? 0) + 1
            }).eq('id', feature_id);
            if (catch_error) logger.error('Failed to update feature after manager exception', { service: 'agent', feature_id, error: catch_error.message });
        }
        finally {
            decrement_agent_count();
        }
    }

    stop_process(task_id: string, supabase?: TypedSupabaseClient) {
        const proc = this.processes.get(task_id);
        if (proc?.process) {
            proc.process.kill();
            proc.status = 'stopped';
            proc.finished_at = new Date().toISOString();
            if (supabase && proc.run_id) {
                void supabase.from('agent_sessions').update({ status: 'cancelled', finished_at: proc.finished_at }).eq('id', proc.run_id);
            }
        }
    }

    stop_all(supabase?: TypedSupabaseClient) {
        for (const proc of this.processes.values()) {
            if (proc.process && proc.status === 'running') {
                proc.process.kill();
                proc.status = 'stopped';
                proc.finished_at = new Date().toISOString();
                if (supabase && proc.run_id) {
                    void supabase.from('agent_sessions').update({ status: 'cancelled', finished_at: proc.finished_at }).eq('id', proc.run_id);
                }
            }
        }
    }

    cleanup_old_workspaces(max_age_days: number = 7): number {
        const cutoff = Date.now() - (max_age_days * 24 * 60 * 60 * 1000);
        let cleaned = 0;
        if (!existsSync(WORKSPACE_DIR)) return 0;
        const active_ids = new Set([...this.processes].filter(([, p]) => p.status === 'running').map(([id]) => id));
        for (const entry of readdirSync(WORKSPACE_DIR, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            if ([...active_ids].some((id) => entry.name.includes(id))) continue;
            const dir_path = join(WORKSPACE_DIR, entry.name);
            try {
                if (statSync(dir_path).mtimeMs < cutoff) {
                    rmSync(dir_path, { recursive: true, force: true });
                    cleaned++;
                }
            }
            catch {
                // Skip directories we can't stat
            }
        }
        if (cleaned > 0) logger.info('Cleaned old workspaces', { service: 'agent', cleaned });
        return cleaned;
    }
}

export const agent_service = new AgentService();
