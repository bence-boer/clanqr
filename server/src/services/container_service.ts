import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { env, COPILOT_BIN, ENRICHED_PATH, build_agent_env } from '../env';
import { logger } from '../utils/logger';

const IMAGE_NAME = 'ralph-agent-base:latest';
const CONTAINER_PREFIX = 'ralph-project-';
const MEMORY_LIMIT = '1536m';
const CPU_LIMIT = '1.5';

/** Base path for per-project workspaces on the host */
export const PROJECTS_WORKSPACE_DIR = join(
    env.WORKSPACE_DIR ?? join(import.meta.dir, '../..'),
    'agents/workspace/projects'
);

export class ContainerService {
    private image_ready = false;
    private building_image: Promise<void> | null = null;
    private active_agents: Map<string, number> = new Map();
    private project_locks: Map<string, Promise<void>> = new Map();

    constructor() {
        if (!existsSync(PROJECTS_WORKSPACE_DIR)) {
            mkdirSync(PROJECTS_WORKSPACE_DIR, { recursive: true });
        }
    }

    private with_project_lock(project_id: string, fn: () => Promise<void>): Promise<void> {
        const prev = this.project_locks.get(project_id) ?? Promise.resolve();
        const next = prev.then(fn, fn);
        this.project_locks.set(project_id, next.catch(() => undefined));
        return next;
    }

    container_name(project_id: string): string {
        return `${CONTAINER_PREFIX}${project_id.slice(0, 12)}`;
    }

    project_workspace(project_id: string): string {
        return join(PROJECTS_WORKSPACE_DIR, project_id);
    }

    agent_workspace(project_id: string, agent_dir_name: string): string {
        return join(PROJECTS_WORKSPACE_DIR, project_id, agent_dir_name);
    }

    async ensure_image(): Promise<void> {
        if (this.image_ready) return;
        if (this.building_image) return this.building_image;
        this.building_image = this.build_image();
        try {
            await this.building_image;
            this.image_ready = true;
        }
        finally {
            this.building_image = null;
        }
    }

    async acquire(project_id: string): Promise<void> {
        return this.with_project_lock(project_id, async () => {
            await this.ensure_running(project_id);
            const count = (this.active_agents.get(project_id) ?? 0) + 1;
            this.active_agents.set(project_id, count);
        });
    }

    async release(project_id: string): Promise<void> {
        return this.with_project_lock(project_id, async () => {
            const count = (this.active_agents.get(project_id) ?? 1) - 1;
            if (count <= 0) {
                this.active_agents.delete(project_id);
                await this.try_stop(project_id);
            }
            else {
                this.active_agents.set(project_id, count);
            }
        });
    }

    async ensure_running(project_id: string): Promise<void> {
        await this.ensure_image();
        const name = this.container_name(project_id);
        const state = await this.get_container_state(name);
        if (state === 'running') return;
        if (state === 'none') await this.create_container(project_id);
        await this.start_container(name);
    }

    async try_stop(project_id: string): Promise<void> {
        const name = this.container_name(project_id);
        if (await this.get_container_state(name) !== 'running') return;
        await this.exec_docker(['docker', 'stop', '-t', '5', name])
            .then(() => logger.info('Stopped project container', { service: 'container', project_id: project_id.slice(0, 8) }))
            .catch(() => undefined);
    }

    async remove(project_id: string): Promise<void> {
        await this.exec_docker(['docker', 'rm', '-f', this.container_name(project_id)]).catch(() => undefined);
        const ws = this.project_workspace(project_id);
        if (existsSync(ws)) rmSync(ws, { recursive: true, force: true });
    }

    build_exec_args(project_id: string, container_work_dir: string): string[] {
        const name = this.container_name(project_id);
        const agent_env = build_agent_env();
        const args = ['docker', 'exec', '-w', container_work_dir, '-e', 'HOME=/home/agent'];
        for (const [key, value] of Object.entries(agent_env)) {
            if (key === 'PATH') args.push('-e', 'PATH=/usr/local/bin:/usr/bin:/bin:/opt/fnm-node/bin:/opt/host-bin:/home/agent/.local/bin');
            else if (key !== 'HOME') args.push('-e', `${key}=${value}`);
        }
        args.push(name);
        return args;
    }

    async cleanup_orphaned(valid_project_ids: Set<string>): Promise<number> {
        let cleaned = 0;
        const result = await this.exec_docker(
            ['docker', 'ps', '-a', '--filter', `name=${CONTAINER_PREFIX}`, '--format', '{{.Names}}']
        ).catch(() => '');
        for (const name of result.trim().split('\n').filter(Boolean)) {
            const short_id = name.replace(CONTAINER_PREFIX, '');
            if (![...valid_project_ids].some((id) => id.startsWith(short_id))) {
                const ok = await this.exec_docker(['docker', 'rm', '-f', name]).then(() => true, () => false);
                if (ok) cleaned++;
            }
        }
        return cleaned;
    }

    private async build_image(): Promise<void> {
        try {
            const result = await this.exec_docker(['docker', 'image', 'inspect', IMAGE_NAME]);
            if (result.includes(IMAGE_NAME) || result.includes('Id')) return;
        }
        catch {
            // Image doesn't exist — build it
        }
        const dockerfile_path = join(import.meta.dir, '../../Dockerfile.agent');
        if (!existsSync(dockerfile_path)) throw new Error(`Dockerfile.agent not found at ${dockerfile_path}`);
        logger.info('Building agent base image...', { service: 'container' });
        await this.exec_docker(['docker', 'build', '-t', IMAGE_NAME, '-f', dockerfile_path, join(import.meta.dir, '../..')], 300_000);
    }

    private async get_container_state(name: string): Promise<'running' | 'stopped' | 'none'> {
        try {
            return (await this.exec_docker(['docker', 'inspect', '--format', '{{.State.Status}}', name])).trim() === 'running' ? 'running' : 'stopped';
        }
        catch {
            return 'none';
        }
    }

    private async create_container(project_id: string): Promise<void> {
        const name = this.container_name(project_id);
        const workspace = this.project_workspace(project_id);
        if (!existsSync(workspace)) mkdirSync(workspace, { recursive: true });

        const args = [
            'docker', 'create', '--name', name, '--network', 'host',
            '--memory', MEMORY_LIMIT, '--cpus', CPU_LIMIT, '--user', '1000:1000',
            '--log-opt', 'max-size=5m', '--log-opt', 'max-file=1',
            '-v', `${workspace}:/workspace`
        ];

        if (existsSync(COPILOT_BIN)) args.push('-v', `${COPILOT_BIN}:/usr/local/bin/copilot:ro`);
        // Mount fnm node dir — gemini CLI resolves via symlink in /opt/fnm-node/bin/
        // so __dirname points to the bundle dir (required for tool discovery)
        const fnm_default = join(env.HOME, '.local/share/fnm/aliases/default');
        if (existsSync(fnm_default)) args.push('-v', `${fnm_default}:/opt/fnm-node:ro`);
        const local_bin = join(env.HOME, '.local/bin');
        if (existsSync(local_bin)) args.push('-v', `${local_bin}:/opt/host-bin:ro`);

        // Mount gemini config files — read-write so gemini can refresh OAuth tokens
        const gemini_dir = join(env.HOME, '.gemini');
        const gemini_files = ['oauth_creds.json', 'settings.json', 'installation_id'];
        for (const f of gemini_files) {
            const fp = join(gemini_dir, f);
            if (existsSync(fp)) args.push('-v', `${fp}:/home/agent/.gemini/${f}`);
        }
        // Gemini CLI requires trustedFolders.json to enable file/shell tools in the container
        const container_trust = join(PROJECTS_WORKSPACE_DIR, '.gemini-trusted.json');
        if (!existsSync(container_trust)) {
            const trust = { '/workspace': 'TRUST_FOLDER', '/home/agent': 'TRUST_FOLDER' };
            Bun.write(container_trust, JSON.stringify(trust));
        }
        args.push('-v', `${container_trust}:/home/agent/.gemini/trustedFolders.json:ro`);

        args.push(IMAGE_NAME, 'sleep', 'infinity');

        await this.exec_docker(args);
        logger.info('Created project container', { service: 'container', project_id: project_id.slice(0, 8), name });
    }

    private async start_container(name: string): Promise<void> {
        await this.exec_docker(['docker', 'start', name]);
        logger.info('Started project container', { service: 'container', name });
    }

    private async exec_docker(args: string[], timeout_ms = 30_000): Promise<string> {
        const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, PATH: ENRICHED_PATH } });
        const result = await Promise.race([
            proc.exited,
            new Promise<number>((resolve) => setTimeout(() => {
                try {
                    proc.kill();
                }
                catch {
                    // already dead
                }
                resolve(-1);
            }, timeout_ms))
        ]);
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        if (result !== 0) throw new Error(`Docker command failed (exit ${result}): ${args.slice(0, 3).join(' ')} — ${stderr.slice(0, 500)}`);
        return stdout;
    }
}

export const container_service = new ContainerService();
