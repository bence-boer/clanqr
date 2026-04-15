import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

// Re-create the schema inline to test validation logic without triggering
// parse_env()'s process.exit(1) at module load.
const env_schema = z.object({
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
    COPILOT_BIN: z.string().optional(),
    GEMINI_BIN: z.string().optional(),
    PORT: z.coerce.number().default(3001),
    WORKSPACE_DIR: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    PATH: z.string().default('/usr/local/bin:/usr/bin:/bin'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    MAX_CONCURRENT_AGENTS: z.coerce.number().int().min(1).default(3)
});

type ParsedEnv = z.infer<typeof env_schema>;

/** Mirrors the production guard in parse_env() — testable without process.exit. */
function validate_production_secrets(data: ParsedEnv): string[] {
    const insecure: string[] = [];
    if (data.SESSION_SECRET === 'dev-session-secret' || data.SESSION_SECRET.length < 32) {
        insecure.push('SESSION_SECRET must be ≥32 chars and not the default value');
    }
    if (data.ENCRYPTION_KEY === 'dev-encryption-key' || data.ENCRYPTION_KEY.length < 32) {
        insecure.push('ENCRYPTION_KEY must be ≥32 chars and not the default value');
    }
    if (!data.GITHUB_CLIENT_ID || !data.GITHUB_CLIENT_SECRET) {
        insecure.push('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required');
    }
    return insecure;
}

/** Parse env and return data, failing the test on schema errors. */
function parse_ok(input: Record<string, string | number>): ParsedEnv {
    const result = env_schema.safeParse(input);
    expect(result.success).toBe(true);
    return (result as { success: true, data: ParsedEnv }).data;
}

const VALID_ENV: Record<string, string> = {
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_KEY: 'test-key',
    GITHUB_CALLBACK_URL: 'http://localhost:3001/api/auth/login/callback',
    FRONTEND_URL: 'http://localhost:5173',
    HOME: '/home/test',
    PORT: '3001',
    NODE_ENV: 'development',
    PATH: '/usr/bin',
    LOG_LEVEL: 'info',
    MAX_CONCURRENT_AGENTS: '3'
};

const PROD_VALID_ENV: Record<string, string> = {
    ...VALID_ENV,
    SUPABASE_KEY: 'prod-key',
    NODE_ENV: 'production',
    GITHUB_CLIENT_ID: 'gh-client-id-prod',
    GITHUB_CLIENT_SECRET: 'gh-client-secret-prod-value-here',
    SESSION_SECRET: 'a]3kF9$mPqW!xL7nR2vBdH5tY8uJ0sZe',
    ENCRYPTION_KEY: 'b]4kG0$nQrX!yM8oS3wCeI6uZ9vK1tAf'
};

describe('env schema', () => {
    it('validates a complete valid environment', () => {
        const data = parse_ok(VALID_ENV);
        expect(data.SUPABASE_KEY).toBe('test-key');
        expect(data.PORT).toBe(3001);
    });
    it('fails when SUPABASE_KEY is missing', () => {
        const without_key = { ...VALID_ENV } as Record<string, unknown>;
        delete without_key['SUPABASE_KEY'];
        const result = env_schema.safeParse(without_key);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.map((i) => i.path.join('.'))).toContain('SUPABASE_KEY');
        }
    });
    it('fails when SUPABASE_KEY is empty string', () => {
        expect(env_schema.safeParse({ ...VALID_ENV, SUPABASE_KEY: '' }).success).toBe(false);
    });
    it('fails for invalid LOG_LEVEL value', () => {
        const result = env_schema.safeParse({ ...VALID_ENV, LOG_LEVEL: 'verbose' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.map((i) => i.path.join('.'))).toContain('LOG_LEVEL');
        }
    });
    it('accepts valid LOG_LEVEL values', () => {
        for (const level of ['debug', 'info', 'warn', 'error']) {
            expect(env_schema.safeParse({ ...VALID_ENV, LOG_LEVEL: level }).success).toBe(true);
        }
    });
    it('coerces MAX_CONCURRENT_AGENTS from string to number', () => {
        const data = parse_ok({ ...VALID_ENV, MAX_CONCURRENT_AGENTS: '5' });
        expect(data.MAX_CONCURRENT_AGENTS).toBe(5);
        expect(typeof data.MAX_CONCURRENT_AGENTS).toBe('number');
    });
    it('rejects MAX_CONCURRENT_AGENTS less than 1', () => {
        expect(env_schema.safeParse({ ...VALID_ENV, MAX_CONCURRENT_AGENTS: '0' }).success).toBe(false);
    });
    it('coerces PORT from string to number', () => {
        expect(parse_ok({ ...VALID_ENV, PORT: '8080' }).PORT).toBe(8080);
    });
    it('applies defaults when optional vars are missing', () => {
        const data = parse_ok({ SUPABASE_KEY: 'key' });
        expect(data.SUPABASE_URL).toBe('http://127.0.0.1:54321');
        expect(data.GITHUB_CALLBACK_URL).toBe('http://localhost:3001/api/auth/login/callback');
        expect(data.ADMIN_GITHUB_IDS).toBe('');
        expect(data.PORT).toBe(3001);
        expect(data.NODE_ENV).toBe('production');
        expect(data.LOG_LEVEL).toBe('info');
        expect(data.MAX_CONCURRENT_AGENTS).toBe(3);
    });
    it('rejects invalid NODE_ENV value', () => {
        expect(env_schema.safeParse({ ...VALID_ENV, NODE_ENV: 'staging' }).success).toBe(false);
    });
    it('accepts optional COPILOT_BIN and GEMINI_BIN', () => {
        const data = parse_ok({ ...VALID_ENV, COPILOT_BIN: '/usr/local/bin/copilot', GEMINI_BIN: '/usr/local/bin/gemini' });
        expect(data.COPILOT_BIN).toBe('/usr/local/bin/copilot');
        expect(data.GEMINI_BIN).toBe('/usr/local/bin/gemini');
    });
    it('rejects invalid SUPABASE_URL (not a URL)', () => {
        expect(env_schema.safeParse({ ...VALID_ENV, SUPABASE_URL: 'not-a-url' }).success).toBe(false);
    });
});

describe('production secret guard', () => {
    it('passes with valid production secrets', () => {
        expect(validate_production_secrets(parse_ok(PROD_VALID_ENV))).toHaveLength(0);
    });
    it('rejects default SESSION_SECRET in production', () => {
        const issues = validate_production_secrets(parse_ok({ ...PROD_VALID_ENV, SESSION_SECRET: 'dev-session-secret' }));
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.some((m) => m.includes('SESSION_SECRET'))).toBe(true);
    });
    it('rejects default ENCRYPTION_KEY in production', () => {
        const issues = validate_production_secrets(parse_ok({ ...PROD_VALID_ENV, ENCRYPTION_KEY: 'dev-encryption-key' }));
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.some((m) => m.includes('ENCRYPTION_KEY'))).toBe(true);
    });
    it('rejects SESSION_SECRET shorter than 32 chars', () => {
        const issues = validate_production_secrets(parse_ok({ ...PROD_VALID_ENV, SESSION_SECRET: 'short-secret' }));
        expect(issues.some((m) => m.includes('SESSION_SECRET'))).toBe(true);
    });
    it('rejects ENCRYPTION_KEY shorter than 32 chars', () => {
        const issues = validate_production_secrets(parse_ok({ ...PROD_VALID_ENV, ENCRYPTION_KEY: 'short-key' }));
        expect(issues.some((m) => m.includes('ENCRYPTION_KEY'))).toBe(true);
    });
    it('rejects missing GITHUB_CLIENT_ID in production', () => {
        const issues = validate_production_secrets(parse_ok({ ...PROD_VALID_ENV, GITHUB_CLIENT_ID: '' }));
        expect(issues.some((m) => m.includes('GITHUB_CLIENT_ID'))).toBe(true);
    });
    it('rejects missing GITHUB_CLIENT_SECRET in production', () => {
        const issues = validate_production_secrets(parse_ok({ ...PROD_VALID_ENV, GITHUB_CLIENT_SECRET: '' }));
        expect(issues.some((m) => m.includes('GITHUB_CLIENT_SECRET'))).toBe(true);
    });
    it('reports multiple issues when multiple secrets are weak', () => {
        const issues = validate_production_secrets(parse_ok({
            ...PROD_VALID_ENV, SESSION_SECRET: 'dev-session-secret',
            ENCRYPTION_KEY: 'dev-encryption-key', GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: ''
        }));
        expect(issues).toHaveLength(3);
    });
    it('allows default secrets in development mode', () => {
        const data = parse_ok({ ...VALID_ENV, NODE_ENV: 'development' });
        expect(data.NODE_ENV).toBe('development');
        // Guard not invoked for non-production — schema parse succeeds with defaults
    });
    it('allows default secrets in test mode', () => {
        expect(parse_ok({ ...VALID_ENV, NODE_ENV: 'test' }).NODE_ENV).toBe('test');
    });
});
