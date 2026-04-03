import { defineConfig, devices } from "@playwright/test";

const is_ci = !!process.env.CI;

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: is_ci,
    retries: is_ci ? 1 : 0,
    workers: is_ci ? 1 : undefined,
    reporter: is_ci ? "github" : "html",
    timeout: 60_000,
    use: {
        baseURL: process.env.BASE_URL || "http://localhost:5173",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
            : {}),
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: is_ci
        ? undefined
        : [
              {
                  command: "cd ../server && bun run dev",
                  url: "http://localhost:3001/health",
                  reuseExistingServer: true,
                  timeout: 15_000,
              },
              {
                  command: "cd ../web && bun run dev",
                  url: "http://localhost:5173",
                  reuseExistingServer: true,
                  timeout: 15_000,
              },
          ],
});
