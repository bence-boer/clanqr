import { z } from "zod";
import { join } from "path";

export const env_schema = z.object({
    SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
    SUPABASE_KEY: z.string().min(1, "SUPABASE_KEY environment variable is required"),
    RP_ID: z.string().default("localhost"),
    RP_ORIGIN: z.string().default("http://localhost:5173"),
    FRONTEND_URL: z.string().default("http://localhost:5173"),
    HOME: z.string().default(process.env.HOME ?? "/tmp"),
    COPILOT_BIN: z.string().optional(),
    GEMINI_BIN: z.string().optional(),
    PORT: z.coerce.number().default(3001),
    WORKSPACE_DIR: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PATH: z.string().default("/usr/local/bin:/usr/bin:/bin"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    MAX_CONCURRENT_AGENTS: z.coerce.number().int().min(1).default(3),
});

export type Env = z.infer<typeof env_schema>;

function parse_env(): Env {
    const result = env_schema.safeParse(process.env);
    if (!result.success) {
        console.error("❌ Invalid environment variables:");
        for (const issue of result.error.issues) {
            console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
        process.exit(1);
    }
    return result.data;
}

export const env = parse_env();

/** Resolved path to copilot binary */
export const COPILOT_BIN = env.COPILOT_BIN ?? join(env.HOME, ".local/bin/copilot");

/** Resolved path to gemini binary */
export const GEMINI_BIN = env.GEMINI_BIN ?? "gemini";

/** Enriched PATH for spawned processes */
export const ENRICHED_PATH = [
    join(env.HOME, ".local/bin"),
    join(env.HOME, ".bun/bin"),
    env.PATH,
].join(":");

/** Base workspace directory for agent workspaces */
export const WORKSPACE_DIR = join(
    env.WORKSPACE_DIR ?? join(import.meta.dir, "../.."),
    "agents/workspace"
);

/** Allowlist of environment variables safe for agent processes */
const AGENT_ENV_ALLOWLIST = [
    "HOME",
    "PATH",
    "USER",
    "LANG",
    "TERM",
    "SHELL",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "GITHUB_TOKEN",
];

/** Build a safe environment for agent subprocesses (no server secrets) */
export function build_agent_env(): Record<string, string> {
    const agent_env: Record<string, string> = {};
    for (const key of AGENT_ENV_ALLOWLIST) {
        if (process.env[key]) {
            agent_env[key] = process.env[key]!;
        }
    }
    agent_env.HOME = env.HOME;
    agent_env.PATH = ENRICHED_PATH;
    return agent_env;
}
