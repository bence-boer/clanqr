import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger as hono_logger } from 'hono/logger';
import { security_headers } from './middleware/security_headers';
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
import { boot } from './boot';
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
    .use('*', security_headers)
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
    .use('*', bodyLimit({
        maxSize: 1_000_000, // 1MB
        onError: (c) => c.json({ error: 'Request body too large (max 1MB)' }, 413)
    }))
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
    // Runtime test-mode toggle — only available in non-production environments.
    // Defense-in-depth: NODE_ENV defaults to 'production' in env.ts, so this
    // route is inert unless explicitly configured as test/development.
    .post('/test-mode', (context) => {
        if (env.NODE_ENV === 'production') {
            return context.json({ error: 'Not available in production' }, 403);
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
