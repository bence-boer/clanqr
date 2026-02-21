import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for the Ralph Agent Workspace.
 *
 * These tests run against the local dev stack:
 * - Server (Hono) on port 3001
 * - Web (SvelteKit) on port 5173
 * - DB (Postgres via docker-compose.dev.yml) on port 54322
 *
 * Start the dev stack before running:
 *   docker compose -f docker-compose.dev.yml up -d
 *   bun run dev
 */
export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? "github" : "html",
    timeout: 30_000,

    use: {
        baseURL: "http://localhost:5173",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    /* Start dev servers before tests if not already running */
    webServer: [
        {
            command: "cd ../server && bun run dev",
            url: "http://localhost:3001/health",
            reuseExistingServer: !process.env.CI,
            timeout: 15_000,
        },
        {
            command: "cd ../web && bun run dev",
            url: "http://localhost:5173",
            reuseExistingServer: !process.env.CI,
            timeout: 15_000,
        },
    ],
});
