import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger as hono_logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { create_supabase_client } from './db';
import { env } from './env';
import { is_test_mode, set_test_mode } from './test_mode';
import { auth_middleware } from './middleware/auth';
import { metrics_middleware } from './middleware/metrics';
import { rate_limit } from './middleware/rate_limit';
import { request_id_middleware } from './middleware/request_id';
import { supabase_middleware, type AppBindings } from './middleware/supabase';
import { admin_routes } from './routes/admin';
import { agents_routes } from './routes/agents';
import { auth_routes } from './routes/auth';
import { chat_routes } from './routes/chat';
import { events_routes } from './routes/events';
import { features_routes } from './routes/features';
import { projects_routes } from './routes/projects';
import { prompts_routes } from './routes/prompts';
import { skills_routes } from './routes/skills';
import { system_routes } from './routes/system';
import { tasks_routes } from './routes/tasks';
import { telemetry_routes } from './routes/telemetry';
import { traits_routes } from './routes/traits';
import { activity_routes } from './routes/activity';
import { usage_routes } from './routes/usage';
import { agent_types_routes } from './routes/agent_types';
import { pipeline_service } from './services/pipeline_service';
import { prompt_service } from './services/prompt_service';
import { watcher_service } from './services/watcher_service';
import { agent_registry_service } from './services/agent_registry_service';
import { logger } from './utils/logger';

const allowed_origins = env.FRONTEND_URL.split(',').map((origin) => origin.trim());

const app = new Hono<AppBindings>()
    .onError((error, context) => {
        if (error instanceof HTTPException) {
            return context.json(
                { error: { code: error.status, message: error.message } },
                error.status
            );
        }
        logger.error('Unhandled error', { method: context.req.method, path: context.req.path, error: String(error) });
        return context.json(
            { error: { code: 500, message: 'Internal server error' } },
            500
        );
    })
    .notFound((context) => {
        return context.json(
            { error: { code: 404, message: 'Not found' } },
            404
        );
    })
    // Global middleware
    .use('*', hono_logger())
    .use('*', secureHeaders())
    .use('*', request_id_middleware())
    .use('*', metrics_middleware())
    .use(
        '*',
        cors({
            origin: allowed_origins,
            allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            allowHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        })
    )
    .use('*', async (c, next) => {
        const content_length = parseInt(c.req.header('content-length') ?? '0');
        if (content_length > 1_000_000) {
            return c.json({ error: 'Request body too large (max 1MB)' }, 413);
        }
        await next();
    })
    .use('*', rate_limit(env.NODE_ENV === 'production' ? 100 : 500, 60_000))
    .use('*', supabase_middleware())
    // Health check (no auth)
    .get('/health', (context) => {
        return context.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            test_mode: is_test_mode()
        });
    })
    // Runtime test-mode toggle — defense-in-depth: env gate + secret header
    .post('/test-mode', (context) => {
        if (env.NODE_ENV === 'production') {
            return context.json({ error: 'Not available in production' }, 403);
        }
        if (context.req.header('x-test-secret') !== env.SESSION_SECRET) {
            return context.json({ error: 'Forbidden' }, 403);
        }
        const enabled = context.req.query('enabled') === 'true';
        set_test_mode(enabled);
        return context.json({ test_mode: is_test_mode() });
    })
    // Auth mutation routes (register/login) rate-limited: 10 req/min
    // Status check uses global rate limit only (called on every page load)
    .use('/api/auth/register/*', rate_limit(10, 60_000))
    .use('/api/auth/login/*', rate_limit(10, 60_000))
    .use('/api/auth/invite/*', rate_limit(10, 60_000))
    .route('/api/auth', auth_routes)
    // Protected API routes
    .use('/api/*', auth_middleware())
    // Agent session rate limit: 5 req/min
    .use('/api/agents/plan/*', rate_limit(5, 60_000))
    .route('/api/events', events_routes)
    .route('/api/projects', projects_routes)
    .route('/api/features', features_routes)
    .route('/api/tasks', tasks_routes)
    .route('/api/agents', agents_routes)
    .route('/api/prompts', prompts_routes)
    .route('/api/system', system_routes)
    // Chat routes (rate-limited: 20 req/min)
    .use('/api/chat/*', rate_limit(20, 60_000))
    .route('/api/chat', chat_routes)
    .route('/api/traits', traits_routes)
    .route('/api/skills', skills_routes)
    .route('/api/usage', usage_routes)
    .route('/api/telemetry', telemetry_routes)
    .route('/api/activity', activity_routes)
    .route('/api/agent-types', agent_types_routes)
    // Admin routes (role check handled inside admin_routes, auth already applied by /api/* above)
    .route('/api/admin', admin_routes);

// Boot sequence
async function boot() {
    const supabase = create_supabase_client();

    // 1. Recover stale agent runs from previous server crash
    const now = new Date().toISOString();

    const { data: interrupted_runs } = await supabase
        .from('agent_sessions')
        .select('feature_id')
        .eq('agent_type', 'orchestrator')
        .eq('status', 'running');
    const interrupted_feature_ids: string[] = (interrupted_runs ?? [])
        .map((r) => r.feature_id)
        .filter((id): id is string => id !== null);

    await supabase
        .from('agent_sessions')
        .update({ status: 'failed', error: 'Server restarted during execution', finished_at: now })
        .eq('status', 'running');
    await supabase
        .from('tasks')
        .update({ status: 'approved' })
        .eq('status', 'in_progress');

    if (interrupted_feature_ids.length > 0) {
        await supabase
            .from('features')
            .update({ status: 'submitted' })
            .eq('status', 'in_progress')
            .in('id', interrupted_feature_ids);
    }

    // M-6.5: Reset in_progress features that have no tasks (missing tasks.json scenario)
    const { data: in_progress_features } = await supabase
        .from('features')
        .select('id, tasks(id)')
        .eq('status', 'in_progress');

    for (const feature of in_progress_features ?? []) {
        if (!feature.tasks?.length) {
            await supabase
                .from('features')
                .update({ status: 'submitted' })
                .eq('id', feature.id);
            logger.info('Reset feature to submitted (no tasks found)', { service: 'boot', feature_id: feature.id });
        }
    }

    logger.info('Stale process recovery complete', { service: 'boot' });

    // 2. Sync base prompts from repo files → DB
    await prompt_service.sync_from_repo();

    // 3. Sync agent type definitions from filesystem → DB
    await agent_registry_service.sync_agent_types();

    // 4. Cleanup expired data
    await cleanup_expired_data(supabase);

    setInterval(() => {
        cleanup_expired_data(supabase).catch((err) => logger.error('Cleanup error', { service: 'boot', error: String(err) }));
    }, 24 * 60 * 60 * 1000);

    // 5. Start watcher service (orchestrator-only — pipeline handles task execution)
    watcher_service.start();

    // 6. Start pipeline service — trigger on any already-approved tasks
    pipeline_service.process_next().catch((err) => logger.error('Pipeline start error', { service: 'boot', error: String(err) }));
    logger.info('Pipeline service started', { service: 'boot' });
}

/** M-5.5: Clean expired sessions */
async function cleanup_expired_data(supabase: ReturnType<typeof create_supabase_client>) {
    const now = new Date().toISOString();

    // Delete expired sessions
    const { count: sessions_deleted } = await supabase
        .from('sessions')
        .delete({ count: 'exact' })
        .lt('expires_at', now);

    if ((sessions_deleted ?? 0) > 0) {
        logger.info('Cleaned expired data', {
            service: 'boot',
            sessions_deleted: sessions_deleted ?? 0
        });
    }
}

boot().catch((err) => logger.error('Boot failed', { error: String(err) }));

const port = env.PORT;
logger.info('Server running', { port, url: `http://localhost:${port}` });

export { app };

export type AppType = typeof app;

export default {
    port,
    fetch: app.fetch,
    idleTimeout: 120
};
