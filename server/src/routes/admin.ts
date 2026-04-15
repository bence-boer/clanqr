import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { admin_middleware } from '../middleware/auth';
import { get_metrics } from '../middleware/metrics';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { check_last_admin, get_users } from '../services/admin_service';
import { audit_service } from '../services/audit_service';
import { logger } from '../utils/logger';
import { invite_routes } from './admin_invites';
import { settings_routes } from './settings';

const update_role_schema = z.object({
    role: z.enum(['admin', 'member'])
});

export const admin_routes = new Hono<AppBindings>()
    .use('*', admin_middleware())
    .route('/invites', invite_routes)
    .route('/settings', settings_routes)

    // List all users
    .get('/', async (context) => {
        const db = context.get('supabase');
        try {
            const users = await get_users(db);
            return context.json(users);
        }
        catch (error) {
            logger.error('Failed to fetch users', { route: 'GET /api/admin', error: String(error) });
            return context.json({ error: 'Failed to fetch users' }, 500);
        }
    })

    // Update a user's role
    .patch('/:id', validate_uuid_params('id'), zValidator('json', update_role_schema), async (context) => {
        const id = require_param(context, 'id');
        const current_user_id = context.get('user_id');

        const { role } = context.req.valid('json');

        if (id === current_user_id && role !== 'admin') {
            return context.json({ error: 'Cannot demote yourself' }, 400);
        }

        const db = context.get('supabase');

        if (role !== 'admin') {
            const is_last = await check_last_admin(db);
            if (is_last) {
                return context.json({ error: 'Cannot demote the last admin' }, 400);
            }
        }

        const { data, error } = await db
            .from('users')
            .update({ role })
            .eq('id', id)
            .select('id, username, display_name, role, created_at')
            .single();

        if (error) {
            logger.error('Failed to update role', { route: 'PATCH /api/admin/:id', id, error: String(error) });
            return context.json({ error: 'Failed to update role' }, 500);
        }
        audit_service.log_admin_action(current_user_id, 'admin_role_change', { target_id: id, new_role: role });
        return context.json(data);
    })

    // Revoke all sessions for a user
    .delete('/:id/sessions', validate_uuid_params('id'), async (context) => {
        const id = require_param(context, 'id');
        const current_user_id = context.get('user_id');

        if (id === current_user_id) {
            return context.json({ error: 'Cannot revoke your own sessions' }, 400);
        }

        const db = context.get('supabase');
        const { error } = await db.from('sessions').delete().eq('user_id', id);
        if (error) {
            logger.error('Failed to revoke sessions', { route: 'DELETE /api/admin/:id/sessions', id, error: String(error) });
            return context.json({ error: 'Failed to revoke sessions' }, 500);
        }
        audit_service.log_admin_action(current_user_id, 'admin_session_revoke', { target_id: id });
        return context.json({ success: true });
    })

    // Delete a user
    .delete('/:id', validate_uuid_params('id'), async (context) => {
        const id = require_param(context, 'id');
        const current_user_id = context.get('user_id');

        if (id === current_user_id) {
            return context.json({ error: 'Cannot delete yourself' }, 400);
        }

        const db = context.get('supabase');

        const { data: target } = await db
            .from('users')
            .select('role')
            .eq('id', id)
            .single();

        if (target?.role === 'admin') {
            const is_last = await check_last_admin(db);
            if (is_last) {
                return context.json({ error: 'Cannot delete the last admin' }, 400);
            }
        }

        const { error } = await db.from('users').delete().eq('id', id);
        if (error) {
            logger.error('Failed to delete user', { route: 'DELETE /api/admin/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete user' }, 500);
        }
        audit_service.log_admin_action(current_user_id, 'admin_user_delete', { target_id: id });
        return context.json({ success: true });
    })

    // Trigger workspace cleanup manually (no-op after SDK migration)
    .post('/cleanup-workspaces', async (context) => {
        return context.json({ cleaned: 0 });
    })

    // Request metrics endpoint
    .get('/metrics', async (context) => {
        return context.json(get_metrics());
    });
