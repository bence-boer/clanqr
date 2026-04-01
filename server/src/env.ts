import { z } from 'zod';
import { join } from 'path';

export const env_schema = z.object({
    SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
    SUPABASE_KEY: z.string().min(1, 'SUPABASE_KEY environment variable is required'),
    GITHUB_CLIENT_ID: z.string().default(''),
    GITHUB_CLIENT_SECRET: z.string().default(''),
    GITHUB_CALLBACK_URL: z.string().url().default('http://localhost:3001/api/auth/login/callback'),
    ADMIN_GITHUB_IDS: z.string().default(''),
    SESSION_SECRET: z.string().default('dev-session-secret'),
    ENCRYPTION_KEY: z.string().default('dev-encryption-key'),
    FRONTEND_URL: z.string().default('http://localhost:5173'),
    HOME: z.string().default(process.env.HOME ?? '/tmp'),
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    PATH: z.string().default('/usr/local/bin:/usr/bin:/bin'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    CLI_URL: z.string().default('localhost:4321'),
    SDK_MAX_CONCURRENT_SESSIONS: z.coerce.number().int().min(1).default(5),
    SDK_SESSION_TIMEOUT_MS: z.coerce.number().default(1_800_000)
});

export type Env = z.infer<typeof env_schema>;

function parse_env(): Env {
    const result = env_schema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        for (const issue of result.error.issues) {
            console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        }
        process.exit(1);
    }
    return result.data;
}

export const env = parse_env();

/** Enriched PATH for spawned processes */
export const ENRICHED_PATH = [
    join(env.HOME, '.local/bin'),
    join(env.HOME, '.bun/bin'),
    join(env.HOME, '.local/share/fnm/aliases/default/bin'),
    env.PATH
].join(':');

/** Base workspace directory for agent workspaces */
export const WORKSPACE_DIR = join(import.meta.dir, '../..', 'agents/workspace');
