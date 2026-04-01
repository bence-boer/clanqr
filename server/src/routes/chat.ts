import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params, require_param } from '../middleware/validate_params';
import { chat_send } from '../services/sdk_session_service';
import { logger } from '../utils/logger';

const create_session_schema = z.object({
    title: z.string().optional(),
    model: z.string().optional()
});

const update_session_schema = z.object({
    title: z.string().min(1).max(200)
});

const send_message_schema = z.object({
    content: z.string().min(1),
    model: z.string().optional()
});

export const chat_routes = new Hono<AppBindings>()

    .get('/sessions', async (context) => {
        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('id, title, model, created_at, updated_at')
            .order('updated_at', { ascending: false });

        if (error) return context.json({ error: 'Failed to fetch sessions' }, 500);
        return context.json(data ?? []);
    })

    .post('/sessions', async (context) => {
        const body = await context.req.json();
        const result = create_session_schema.safeParse(body);
        if (!result.success) return context.json({ error: result.error.format() }, 400);

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('chat_sessions')
            .insert({
                title: result.data.title ?? null,
                model: result.data.model ?? 'claude-sonnet-4.5'
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create session', { route: 'POST /api/chat/sessions', error: String(error) });
            return context.json({ error: 'Failed to create session' }, 500);
        }
        return context.json(data, 201);
    })

    .get('/sessions/:id', validate_uuid_params('id'), async (context) => {
        const id = require_param(context, 'id');
        const supabase = context.get('supabase');

        const { data: session, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !session) return context.json({ error: 'Session not found' }, 404);

        const { data: messages } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', id)
            .order('created_at', { ascending: true });

        return context.json({ ...session, chat_messages: messages ?? [] });
    })

    .patch('/sessions/:id', validate_uuid_params('id'), async (context) => {
        const id = require_param(context, 'id');
        const body = await context.req.json();
        const result = update_session_schema.safeParse(body);
        if (!result.success) return context.json({ error: result.error.format() }, 400);

        const supabase = context.get('supabase');
        const { data, error } = await supabase
            .from('chat_sessions')
            .update({ title: result.data.title })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            logger.error('Failed to update session', { route: 'PATCH /api/chat/sessions/:id', id, error: String(error) });
            return context.json({ error: 'Failed to update session' }, 500);
        }
        return context.json(data);
    })

    .delete('/sessions/:id', validate_uuid_params('id'), async (context) => {
        const id = require_param(context, 'id');
        const supabase = context.get('supabase');

        const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Failed to delete session', { route: 'DELETE /api/chat/sessions/:id', id, error: String(error) });
            return context.json({ error: 'Failed to delete session' }, 500);
        }
        return context.json({ success: true });
    })

    .post('/sessions/:id/send', validate_uuid_params('id'), async (context) => {
        const session_id = require_param(context, 'id');
        const supabase = context.get('supabase');

        const { data: session } = await supabase
            .from('chat_sessions')
            .select('id, model')
            .eq('id', session_id)
            .single();

        if (!session) return context.json({ error: 'Session not found' }, 404);

        const body = await context.req.json();
        const result = send_message_schema.safeParse(body);
        if (!result.success) return context.json({ error: result.error.format() }, 400);

        const { content, model } = result.data;

        return new Response(
            new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        const sdk_result = await chat_send(session_id, model ?? session.model, content);
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ chunk: sdk_result.content })}\n\n`)
                        );

                        await supabase.from('chat_messages').insert({
                            session_id,
                            role: 'user',
                            content
                        });
                        await supabase.from('chat_messages').insert({
                            session_id,
                            role: 'assistant',
                            content: sdk_result.content
                        });
                        await supabase.from('chat_sessions').update({
                            updated_at: new Date().toISOString()
                        }).eq('id', session_id);

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                    }
                    catch (err) {
                        const message = err instanceof Error ? err.message : 'Unknown error';
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
                        );
                    }
                    finally {
                        controller.close();
                    }
                }
            }),
            {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            }
        );
    });
