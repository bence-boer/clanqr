import { describe, it, expect } from "bun:test";
import { z } from "zod";

// Re-create the schema inline to test validation logic without triggering
// parse_env()'s process.exit(1) at module load.
// This mirrors the schema exported from env.ts exactly.
const env_schema = z.object({
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

const VALID_ENV = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_KEY: "test-key",
    RP_ID: "localhost",
    RP_ORIGIN: "http://localhost:5173",
    FRONTEND_URL: "http://localhost:5173",
    HOME: "/home/test",
    PORT: "3001",
    NODE_ENV: "development",
    PATH: "/usr/bin",
    LOG_LEVEL: "info",
    MAX_CONCURRENT_AGENTS: "3",
};

describe("env schema", () => {
    it("validates a complete valid environment", () => {
        const result = env_schema.safeParse(VALID_ENV);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.SUPABASE_KEY).toBe("test-key");
            expect(result.data.PORT).toBe(3001);
        }
    });

    it("fails when SUPABASE_KEY is missing", () => {
        const { SUPABASE_KEY, ...without_key } = VALID_ENV;
        const result = env_schema.safeParse(without_key);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map(i => i.path.join("."));
            expect(paths).toContain("SUPABASE_KEY");
        }
    });

    it("fails when SUPABASE_KEY is empty string", () => {
        const result = env_schema.safeParse({ ...VALID_ENV, SUPABASE_KEY: "" });
        expect(result.success).toBe(false);
    });

    it("fails for invalid LOG_LEVEL value", () => {
        const result = env_schema.safeParse({ ...VALID_ENV, LOG_LEVEL: "verbose" });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map(i => i.path.join("."));
            expect(paths).toContain("LOG_LEVEL");
        }
    });

    it("accepts valid LOG_LEVEL values", () => {
        for (const level of ["debug", "info", "warn", "error"]) {
            const result = env_schema.safeParse({ ...VALID_ENV, LOG_LEVEL: level });
            expect(result.success).toBe(true);
        }
    });

    it("coerces MAX_CONCURRENT_AGENTS from string to number", () => {
        const result = env_schema.safeParse({ ...VALID_ENV, MAX_CONCURRENT_AGENTS: "5" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.MAX_CONCURRENT_AGENTS).toBe(5);
            expect(typeof result.data.MAX_CONCURRENT_AGENTS).toBe("number");
        }
    });

    it("rejects MAX_CONCURRENT_AGENTS less than 1", () => {
        const result = env_schema.safeParse({ ...VALID_ENV, MAX_CONCURRENT_AGENTS: "0" });
        expect(result.success).toBe(false);
    });

    it("coerces PORT from string to number", () => {
        const result = env_schema.safeParse({ ...VALID_ENV, PORT: "8080" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.PORT).toBe(8080);
        }
    });

    it("applies defaults when optional vars are missing", () => {
        const minimal = { SUPABASE_KEY: "key" };
        const result = env_schema.safeParse(minimal);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.SUPABASE_URL).toBe("http://127.0.0.1:54321");
            expect(result.data.RP_ID).toBe("localhost");
            expect(result.data.PORT).toBe(3001);
            expect(result.data.NODE_ENV).toBe("development");
            expect(result.data.LOG_LEVEL).toBe("info");
            expect(result.data.MAX_CONCURRENT_AGENTS).toBe(3);
        }
    });

    it("rejects invalid NODE_ENV value", () => {
        const result = env_schema.safeParse({ ...VALID_ENV, NODE_ENV: "staging" });
        expect(result.success).toBe(false);
    });

    it("accepts optional COPILOT_BIN and GEMINI_BIN", () => {
        const result = env_schema.safeParse({
            ...VALID_ENV,
            COPILOT_BIN: "/usr/local/bin/copilot",
            GEMINI_BIN: "/usr/local/bin/gemini",
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.COPILOT_BIN).toBe("/usr/local/bin/copilot");
            expect(result.data.GEMINI_BIN).toBe("/usr/local/bin/gemini");
        }
    });

    it("rejects invalid SUPABASE_URL (not a URL)", () => {
        const result = env_schema.safeParse({ ...VALID_ENV, SUPABASE_URL: "not-a-url" });
        expect(result.success).toBe(false);
    });
});
