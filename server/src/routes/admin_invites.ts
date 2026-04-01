import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../env';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { logger } from '../utils/logger';

const create_invite_schema = z.object({
    expires_in_days: z.number().int().min(1).max(90).optional().default(7)
});

export const invite_routes = new Hono<AppBindings>()

    // Create a new invite
    .post('/', async (context) => {
        const db = context.get('supabase');
        const user_id = context.get('user_id');

        let expires_in_days = 7;
        try {
            const body = await context.req.json();
            const parsed = create_invite_schema.safeParse(body);
            if (parsed.success) {
                expires_in_days = parsed.data.expires_in_days;
            }
        }
        catch {
            // Empty body is fine — use defaults
        }

        const expires_at = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString();

        const { data: invite, error } = await db
            .from('invite_tokens')
            .insert({
                created_by: user_id,
                expires_at
            })
            .select('id, token, expires_at, created_at')
            .single();

        if (error || !invite) {
            logger.error('Failed to create invite', { route: 'POST /api/admin/invites', error: String(error) });
            return context.json({ error: 'Failed to create invite' }, 500);
        }

        const frontend_url = env.FRONTEND_URL.split(',')[0].trim();
        const invite_url = `${frontend_url}/invite?token=${invite.token}`;

        return context.json({
            id: invite.id,
            token: invite.token,
            invite_url,
            expires_at: invite.expires_at,
            created_at: invite.created_at
        }, 201);
    })

    // List all invites
    .get('/', async (context) => {
        const db = context.get('supabase');

        const { data: invites, error } = await db
            .from('invite_tokens')
            .select('id, token, created_by, used_by, used_at, expires_at, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Failed to list invites', { route: 'GET /api/admin/invites', error: String(error) });
            return context.json({ error: 'Failed to list invites' }, 500);
        }

        const user_ids = new Set<string>();
        for (const invite of invites ?? []) {
            if (invite.created_by) user_ids.add(invite.created_by);
            if (invite.used_by) user_ids.add(invite.used_by);
        }

        const users_map: Record<string, string> = {};
        if (user_ids.size > 0) {
            const { data: users } = await db
                .from('users')
                .select('id, username')
                .in('id', Array.from(user_ids));
            for (const user of users ?? []) {
                users_map[user.id] = user.username;
            }
        }

        const now = new Date();
        const enriched = (invites ?? []).map((invite) => {
            let status: 'active' | 'used' | 'expired';
            if (invite.used_by) {
                status = 'used';
            }
            else if (new Date(invite.expires_at) < now) {
                status = 'expired';
            }
            else {
                status = 'active';
            }
            return {
                ...invite,
                created_by_username: users_map[invite.created_by] ?? null,
                used_by_username: invite.used_by ? (users_map[invite.used_by] ?? null) : null,
                status
            };
        });

        return context.json(enriched);
    })

    // Revoke (delete) an invite
    .delete('/:id', validate_uuid_params('id'), async (context) => {
        const db = context.get('supabase');
        const id = require_param(context, 'id');

        const { error } = await db
            .from('invite_tokens')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Failed to revoke invite', { route: 'DELETE /api/admin/invites/:id', id, error: String(error) });
            return context.json({ error: 'Failed to revoke invite' }, 500);
        }

        return context.json({ success: true });
    });
