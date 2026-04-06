import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { create_supabase_client } from '../db';
import { env } from '../env';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 5 * 60 * 1000;

const TOOL_MAPPING: Record<string, string[]> = {
    read: ['grep', 'glob', 'view'],
    search: ['grep', 'glob'],
    edit: ['edit', 'create'],
    execute: ['bash'],
    agent: []
};

const ALL_TOOLS = ['grep', 'glob', 'view', 'edit', 'create', 'bash'];

export interface AgentTypeInfo {
    name: string
    description: string
    tools: string[]
    prompt_content: string
}

interface AgentTypeCache {
    agents: AgentTypeInfo[]
    cached_at: number
}

// Untyped table accessor for tables not yet in generated database.types.ts
interface UntypedTableClient {
    from(table: string): {
        upsert(
            values: Record<string, unknown>,
            options: Record<string, string>
        ): Promise<{ error: { message: string } | null }>
    }
}

export class AgentRegistryService {
    private cache: AgentTypeCache | null = null;

    async list_agent_types(): Promise<AgentTypeInfo[]> {
        const cached = this.get_valid_cache();
        if (cached) return cached;
        return this.scan_agents();
    }

    async get_agent_type(name: string): Promise<AgentTypeInfo | null> {
        const agents = await this.list_agent_types();
        return agents.find((a) => a.name === name) ?? null;
    }

    async get_tool_permissions(name: string): Promise<{ allowed: string[], denied: string[] }> {
        const agent = await this.get_agent_type(name);
        if (!agent) return { allowed: [], denied: [...ALL_TOOLS] };

        const allowed_set = new Set<string>();
        for (const tool of agent.tools) {
            for (const sdk_tool of TOOL_MAPPING[tool] ?? []) allowed_set.add(sdk_tool);
        }
        const allowed = ALL_TOOLS.filter((t) => allowed_set.has(t));
        const denied = ALL_TOOLS.filter((t) => !allowed_set.has(t));
        return { allowed, denied };
    }

    async sync_agent_types(): Promise<void> {
        this.cache = null;
        const agents = this.scan_agents();
        const db = create_supabase_client() as unknown as UntypedTableClient;

        for (const agent of agents) {
            const { error } = await db.from('agent_types').upsert({
                name: agent.name,
                description: agent.description,
                tools: agent.tools,
                prompt_content: agent.prompt_content,
                updated_at: new Date().toISOString()
            }, { onConflict: 'name' });

            if (error) {
                logger.error('Failed to sync agent type', {
                    service: 'agent_registry',
                    agent: agent.name,
                    error: error.message
                });
            }
        }
        logger.info('Agent types synced to database', { service: 'agent_registry', count: agents.length });
    }

    private get_valid_cache(): AgentTypeInfo[] | null {
        if (!this.cache) return null;
        if (Date.now() - this.cache.cached_at > CACHE_TTL_MS) return null;
        return this.cache.agents;
    }

    private scan_agents(): AgentTypeInfo[] {
        const agents_dir = join(env.AGENT_RESOURCES_DIR, 'agents');
        if (!existsSync(agents_dir)) {
            logger.warn('Agent resources directory not found', { service: 'agent_registry', path: agents_dir });
            this.cache = { agents: [], cached_at: Date.now() };
            return [];
        }

        const agents: AgentTypeInfo[] = [];
        try {
            const entries = readdirSync(agents_dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
                try {
                    const content = readFileSync(join(agents_dir, entry.name), 'utf-8');
                    const fm = parse_agent_frontmatter(content);
                    if (!fm.name) continue;
                    const body = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
                    agents.push({
                        name: fm.name, description: fm.description ?? '',
                        tools: fm.tools ?? [], prompt_content: body
                    });
                }
                catch (err) {
                    logger.warn('Failed to read agent file', { service: 'agent_registry', file: entry.name, error: String(err) });
                }
            }
        }
        catch (err) {
            logger.error('Failed to scan agents directory', { service: 'agent_registry', error: String(err) });
        }

        this.cache = { agents, cached_at: Date.now() };
        logger.info('Loaded agent type definitions', { service: 'agent_registry', count: agents.length });
        return agents;
    }
}

export function parse_agent_frontmatter(content: string): { name?: string, description?: string, tools?: string[] } {
    const fm_match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm_match) return {};

    const lines = fm_match[1].split('\n');
    const result: Record<string, string> = {};
    let cur_key: string | null = null;
    let cur_val = '';

    for (const line of lines) {
        if (cur_key && /^\s+\S/.test(line)) {
            cur_val += ' ' + line.trim();
            result[cur_key] = cur_val;
            continue;
        }
        const colon_idx = line.indexOf(':');
        if (colon_idx === -1) {
            cur_key = null;
            continue;
        }

        const key = line.slice(0, colon_idx).trim();
        const value = line.slice(colon_idx + 1).trim();

        if (value === '>') {
            cur_key = key;
            cur_val = '';
            continue;
        }
        cur_key = key;
        cur_val = value;
        if (key && value) result[key] = value;
    }

    let tools: string[] | undefined;
    if (result['tools']) {
        const arr_match = result['tools'].match(/\[([^\]]*)\]/);
        if (arr_match) {
            tools = arr_match[1].split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean);
        }
    }
    return { name: result['name'], description: result['description'], tools };
}

export const agent_registry_service = new AgentRegistryService();
