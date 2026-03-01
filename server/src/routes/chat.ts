import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../middleware/supabase';
import { validate_uuid_params } from '../middleware/validate_params';
import { chat_service } from '../services/chat_service';
import { logger } from '../utils/logger';

const create_session_schema = z.object({
    title: z.string().optional(),
    model: z.string().optional()
});

const send_message_schema = z.object({
    content: z.string().min(1),
    model: z.string().optional()
});

export const chat_routes = new Hono<AppBindings>();

// List sessions
chat_routes.get('/sessions', async (context) => {
    const supabase = context.get('supabase');
    const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title, model, created_at, updated_at')
        .order('updated_at', { ascending: false });

    if (error) return context.json({ error: 'Failed to fetch sessions' }, 500);
    return context.json(data);
});

// Create session
chat_routes.post('/sessions', async (context) => {
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
});

// Get session with messages
chat_routes.get('/sessions/:id', validate_uuid_params('id'), async (context) => {
    const id = context.req.param('id');
    const supabase = context.get('supabase');

    const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('*, chat_messages(*)')
        .eq('id', id)
        .order('created_at', { referencedTable: 'chat_messages', ascending: true })
        .single();

    if (error || !session) return context.json({ error: 'Session not found' }, 404);
    return context.json(session);
});

// Delete session
chat_routes.delete('/sessions/:id', validate_uuid_params('id'), async (context) => {
    const id = context.req.param('id');
    const supabase = context.get('supabase');

    const { error } = await supabase.from('chat_sessions').delete().eq('id', id);
    if (error) {
        logger.error('Failed to delete session', { route: 'DELETE /api/chat/sessions/:id', id, error: String(error) });
        return context.json({ error: 'Failed to delete session' }, 500);
    }
    return context.json({ success: true });
});

// Send message (SSE streaming response)
chat_routes.post('/sessions/:id/send', validate_uuid_params('id'), async (context) => {
    const session_id = context.req.param('id');
    const supabase = context.get('supabase');

    const { data: session } = await supabase
        .from('chat_sessions')
        .select('id, model')
        .eq('id', session_id)
        .single();

    if (!session) return context.json({ error: 'Session not found' }, 404);

    if (chat_service.is_busy(session_id)) {
        return context.json({ error: 'This chat session is already processing a message' }, 409);
    }

    const body = await context.req.json();
    const result = send_message_schema.safeParse(body);
    if (!result.success) return context.json({ error: result.error.format() }, 400);

    const { content, model } = result.data;

    return new Response(
        new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    await chat_service.send_message(
                        session_id,
                        content,
                        model ?? session.model,
                        supabase,
                        (chunk) => {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)
                            );
                        }
                    );
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

// Cancel active chat in a session
chat_routes.post('/sessions/:id/cancel', validate_uuid_params('id'), async (context) => {
    const session_id = context.req.param('id');
    const cancelled = chat_service.cancel(session_id);
    return context.json({ success: cancelled });
});
