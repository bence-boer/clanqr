import { z } from "zod";
import { join } from "path";

const env_schema = z.object({
    SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
    SUPABASE_KEY: z.string().min(1, "SUPABASE_KEY environment variable is required"),
    RP_ID: z.string().default("localhost"),
    RP_ORIGIN: z.string().default("http://localhost:5173"),
    FRONTEND_URL: z.string().default("http://localhost:5173"),
    HOME: z.string().default("/home/scoy"),
    COPILOT_BIN: z.string().optional(),
    GEMINI_BIN: z.string().optional(),
    PORT: z.coerce.number().default(3001),
    WORKSPACE_DIR: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PATH: z.string().default("/usr/local/bin:/usr/bin:/bin"),
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
export const GEMINI_BIN = env.GEMINI_BIN ?? "/home/scoy/.local/share/fnm/node-versions/v25.2.1/installation/bin/gemini";

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
