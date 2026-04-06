import { describe, it, expect, mock } from 'bun:test';

// --- Mocks must be registered before importing the service ---

mock.module('../env', () => ({
    env: {
        AGENT_RESOURCES_DIR: '/nonexistent-test-dir',
        LOG_LEVEL: 'error'
    }
}));

mock.module('../db', () => ({
    create_supabase_client: () => ({
        from: () => ({
            upsert: () => Promise.resolve({ error: null })
        })
    })
}));

mock.module('../utils/logger', () => ({
    logger: {
        debug: () => {
        },
        info: () => {
        },
        warn: () => {
        },
        error: () => {
        }
    }
}));

import { AgentRegistryService, parse_agent_frontmatter } from './agent_registry_service';
import type { AgentTypeInfo } from './agent_registry_service';

// Testable subclass that exposes internals without using 'any'
class TestableService extends AgentRegistryService {
    inject_cache(agents: AgentTypeInfo[], cached_at: number): void {
        Object.assign(this, { cache: { agents, cached_at } });
    }

    read_cache(): AgentTypeInfo[] | null {
        const state = this as unknown as Record<string, unknown>;
        const cache = state['cache'] as { agents: AgentTypeInfo[], cached_at: number } | null;
        if (!cache) return null;
        const ttl = 5 * 60 * 1000;
        if (Date.now() - cache.cached_at > ttl) return null;
        return cache.agents;
    }
}

describe('parse_agent_frontmatter', () => {
    it('should parse valid frontmatter with tools array', () => {
        const result = parse_agent_frontmatter(
            '---\nname: implementer\ndescription: A coding agent\ntools: [\'read\', \'edit\', \'execute\']\n---\n\nBody content here'
        );
        expect(result.name).toBe('implementer');
        expect(result.description).toBe('A coding agent');
        expect(result.tools).toEqual(['read', 'edit', 'execute']);
    });

    it('should handle missing frontmatter gracefully', () => {
        const result = parse_agent_frontmatter('No frontmatter here, just body text.');
        expect(result).toEqual({});
    });

    it('should handle malformed frontmatter without crashing', () => {
        const result = parse_agent_frontmatter('---\ngarbage no colon here\n---\n\nBody');
        expect(result).toEqual({});
    });

    it('should handle empty content', () => {
        const result = parse_agent_frontmatter('');
        expect(result).toEqual({});
    });

    it('should parse multiline description with > continuation', () => {
        const result = parse_agent_frontmatter(
            '---\nname: orchestrator\ndescription: >\n  A multi-line description\n  that continues here\ntools: [\'read\', \'search\']\n---\n\nBody'
        );
        expect(result.name).toBe('orchestrator');
        expect(result.description).toContain('multi-line');
        expect(result.tools).toEqual(['read', 'search']);
    });
});

describe('AgentRegistryService', () => {
    describe('get_tool_permissions', () => {
        it('should map read tool to grep, glob, view', async () => {
            const service = new TestableService();
            service.inject_cache([{
                name: 'reader', description: 'Read-only agent',
                tools: ['read'], prompt_content: ''
            }], Date.now());

            const perms = await service.get_tool_permissions('reader');
            expect(perms.allowed).toEqual(['grep', 'glob', 'view']);
            expect(perms.denied).toEqual(['edit', 'create', 'bash']);
        });

        it('should map multiple tool categories correctly', async () => {
            const service = new TestableService();
            service.inject_cache([{
                name: 'full', description: 'Full agent',
                tools: ['read', 'edit', 'execute'], prompt_content: ''
            }], Date.now());

            const perms = await service.get_tool_permissions('full');
            expect(perms.allowed.sort()).toEqual(['bash', 'create', 'edit', 'glob', 'grep', 'view']);
            expect(perms.denied).toEqual([]);
        });

        it('should return all denied for unknown agent', async () => {
            const service = new TestableService();
            service.inject_cache([], Date.now());

            const perms = await service.get_tool_permissions('nonexistent');
            expect(perms.allowed).toEqual([]);
            expect(perms.denied).toEqual(['grep', 'glob', 'view', 'edit', 'create', 'bash']);
        });

        it('should ignore agent meta-tool in mapping', async () => {
            const service = new TestableService();
            service.inject_cache([{
                name: 'orchestrator', description: 'Orchestrator',
                tools: ['read', 'search', 'agent'], prompt_content: ''
            }], Date.now());

            const perms = await service.get_tool_permissions('orchestrator');
            expect(perms.allowed.sort()).toEqual(['glob', 'grep', 'view']);
            expect(perms.denied.sort()).toEqual(['bash', 'create', 'edit']);
        });
    });

    describe('get_agent_type', () => {
        it('should find agent by name from cache', async () => {
            const service = new TestableService();
            service.inject_cache([
                { name: 'explorer', description: 'Explores code', tools: ['read'], prompt_content: 'You explore' },
                { name: 'implementer', description: 'Writes code', tools: ['edit'], prompt_content: 'You implement' }
            ], Date.now());

            const result = await service.get_agent_type('implementer');
            expect(result).toBeTruthy();
            expect(result?.name).toBe('implementer');
            expect(result?.description).toBe('Writes code');
        });

        it('should return null for non-existent agent', async () => {
            const service = new TestableService();
            service.inject_cache([
                { name: 'explorer', description: 'Explores', tools: ['read'], prompt_content: '' }
            ], Date.now());

            const result = await service.get_agent_type('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('cache TTL', () => {
        it('should return null for expired cache', () => {
            const service = new TestableService();
            service.inject_cache(
                [{ name: 'test', description: '', tools: [], prompt_content: '' }],
                Date.now() - 6 * 60 * 1000
            );
            expect(service.read_cache()).toBeNull();
        });

        it('should return agents for valid cache', () => {
            const agents: AgentTypeInfo[] = [{ name: 'test', description: '', tools: [], prompt_content: '' }];
            const service = new TestableService();
            service.inject_cache(agents, Date.now() - 2 * 60 * 1000);
            expect(service.read_cache()).toEqual(agents);
        });

        it('should return null when no cache exists', () => {
            const service = new TestableService();
            expect(service.read_cache()).toBeNull();
        });
    });

    describe('list_agent_types with missing directory', () => {
        it('should return empty array when directory does not exist', async () => {
            const service = new AgentRegistryService();
            const result = await service.list_agent_types();
            expect(result).toEqual([]);
        });
    });
});
