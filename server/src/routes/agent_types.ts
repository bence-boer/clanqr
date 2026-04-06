import { Hono } from 'hono';
import type { AppBindings } from '../middleware/supabase';
import { agent_registry_service } from '../services/agent_registry_service';
import { logger } from '../utils/logger';

export const agent_types_routes = new Hono<AppBindings>()

    // GET / — list all agent types
    .get('/', async (c) => {
        try {
            const agents = await agent_registry_service.list_agent_types();
            return c.json(agents);
        }
        catch (error) {
            logger.error('Failed to list agent types', { route: 'GET /api/agent-types', error: String(error) });
            return c.json({ error: 'Failed to list agent types' }, 500);
        }
    })

    // GET /:name — get specific agent type
    .get('/:name', async (c) => {
        const name = c.req.param('name');
        try {
            const agent = await agent_registry_service.get_agent_type(name);
            if (!agent) return c.json({ error: 'Agent type not found' }, 404);
            return c.json(agent);
        }
        catch (error) {
            logger.error('Failed to get agent type', { route: 'GET /api/agent-types/:name', name, error: String(error) });
            return c.json({ error: 'Failed to get agent type' }, 500);
        }
    })

    // POST /sync — sync agent types from filesystem
    .post('/sync', async (c) => {
        try {
            await agent_registry_service.sync_agent_types();
            const agents = await agent_registry_service.list_agent_types();
            return c.json({ success: true, count: agents.length });
        }
        catch (error) {
            logger.error('Failed to sync agent types', { route: 'POST /api/agent-types/sync', error: String(error) });
            return c.json({ error: 'Failed to sync agent types' }, 500);
        }
    });
