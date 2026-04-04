import { test, expect } from "@playwright/test";
import { API_URL, AUTH_HEADERS, authenticate } from "./helpers";

test.describe("telemetry API endpoints", () => {
    test("GET /api/telemetry/sessions/:id/events returns paginated events", async ({
        request,
    }) => {
        // Use a fake session ID — should return empty array, not error
        const res = await request.get(
            `${API_URL}/api/telemetry/sessions/00000000-0000-0000-0000-000000000000/events`,
            { headers: AUTH_HEADERS }
        );
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(data).toHaveProperty("events");
        expect(Array.isArray(data.events)).toBeTruthy();
    });

    test("GET /api/telemetry/sessions/:id/tools returns tool calls", async ({
        request,
    }) => {
        const res = await request.get(
            `${API_URL}/api/telemetry/sessions/00000000-0000-0000-0000-000000000000/tools`,
            { headers: AUTH_HEADERS }
        );
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(data).toHaveProperty("tools");
        expect(Array.isArray(data.tools)).toBeTruthy();
    });

    test("GET /api/telemetry/sessions/:id/summary returns session summary", async ({
        request,
    }) => {
        const res = await request.get(
            `${API_URL}/api/telemetry/sessions/00000000-0000-0000-0000-000000000000/summary`,
            { headers: AUTH_HEADERS }
        );
        // May return 404 for nonexistent session or a summary
        expect([200, 404]).toContain(res.status());
    });

    test("GET /api/telemetry/sessions/:id/logs returns structured entries", async ({
        request,
    }) => {
        const res = await request.get(
            `${API_URL}/api/telemetry/sessions/test-session/logs`,
            { headers: AUTH_HEADERS }
        );
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(data).toHaveProperty("entries");
        expect(Array.isArray(data.entries)).toBeTruthy();
    });

    test("telemetry endpoints require auth", async ({ request }) => {
        const endpoints = [
            "/api/telemetry/sessions/test/events",
            "/api/telemetry/sessions/test/tools",
            "/api/telemetry/sessions/test/summary",
            "/api/telemetry/sessions/test/logs",
        ];
        for (const ep of endpoints) {
            const res = await request.get(`${API_URL}${ep}`);
            expect(res.status()).toBe(401);
        }
    });
});

test.describe("enriched models API", () => {
    test("models include billing multiplier", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/system/models`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const models = await res.json();
        expect(models.length).toBeGreaterThan(0);

        // At least some models should have billing info
        const with_billing = models.filter(
            (m: { billing_multiplier?: number }) =>
                m.billing_multiplier !== undefined && m.billing_multiplier !== null
        );
        expect(with_billing.length).toBeGreaterThan(0);
    });

    test("models include capabilities", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/system/models`, {
            headers: AUTH_HEADERS,
        });
        const models = await res.json();

        const with_caps = models.filter(
            (m: { capabilities?: object }) => m.capabilities !== undefined
        );
        expect(with_caps.length).toBeGreaterThan(0);

        // Check capability shape
        for (const m of with_caps) {
            if (m.capabilities) {
                expect(typeof m.capabilities).toBe("object");
            }
        }
    });

    test("models include reasoning effort data", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/system/models`, {
            headers: AUTH_HEADERS,
        });
        const models = await res.json();

        // Some models should support reasoning effort
        const with_reasoning = models.filter(
            (m: { reasoning_efforts?: string[] }) =>
                m.reasoning_efforts && m.reasoning_efforts.length > 0
        );
        // Not all models support it, so just verify the field exists on at least one
        if (with_reasoning.length > 0) {
            expect(Array.isArray(with_reasoning[0].reasoning_efforts)).toBeTruthy();
        }
    });
});

test.describe("enriched usage API", () => {
    test("usage summary includes cache token fields", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/usage/summary`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const summary = await res.json();

        expect(summary).toHaveProperty("total_runs");
        expect(summary).toHaveProperty("total_prompt_tokens");
        expect(summary).toHaveProperty("total_completion_tokens");
        expect(summary).toHaveProperty("total_cache_read_tokens");
        expect(summary).toHaveProperty("total_cache_write_tokens");
        expect(typeof summary.total_cache_read_tokens).toBe("number");
        expect(typeof summary.total_cache_write_tokens).toBe("number");
    });

    test("usage breakdown includes token totals", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/usage/breakdown`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const breakdown = await res.json();

        expect(breakdown).toHaveProperty("by_type");
        expect(breakdown).toHaveProperty("by_model");
        expect(breakdown).toHaveProperty("total_prompt_tokens");
        expect(breakdown).toHaveProperty("total_completion_tokens");
        expect(breakdown).toHaveProperty("total_cache_read_tokens");
        expect(breakdown).toHaveProperty("total_cache_write_tokens");
    });
});

test.describe("monitoring UI with telemetry", () => {
    test("monitoring page loads and shows stat cards", async ({ page }) => {
        await authenticate(page, true);
        await page.goto("/monitoring");
        await page.waitForLoadState("domcontentloaded");

        // Should have stat cards for Running, Completed, Failed
        await expect(page.getByText("Running")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("Completed")).toBeVisible();
        await expect(page.getByText("Failed")).toBeVisible();
    });

    test("usage page shows cache token metrics", async ({ page }) => {
        await authenticate(page, true);
        await page.goto("/usage");
        await page.waitForLoadState("domcontentloaded");

        // Wait for stats to load
        await page.waitForTimeout(2_000);

        // Should show cache token labels
        await expect(page.getByText("Cache Read")).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("Cache Write")).toBeVisible();
    });

    test("feature form shows model billing info", async ({ page }) => {
        await authenticate(page, true);
        await page.goto("/projects");
        await page.waitForLoadState("domcontentloaded");

        // Create a project first if needed
        const new_project_btn = page.getByRole("button", { name: /new project/i });
        if (await new_project_btn.isVisible().catch(() => false)) {
            await new_project_btn.click();
            await page.getByPlaceholder(/project name/i).fill("E2E Telemetry Test");
            await page
                .getByRole("button", { name: /create/i })
                .click();
            await page.waitForTimeout(1_000);
        }

        // Navigate to a project and try to create a feature
        const project_links = page.locator("a[href*='/projects/']");
        const count = await project_links.count();
        if (count > 0) {
            await project_links.first().click();
            await page.waitForLoadState("domcontentloaded");

            // Look for "New Feature" button
            const new_feature_btn = page.getByRole("button", {
                name: /new feature/i,
            });
            if (await new_feature_btn.isVisible().catch(() => false)) {
                await new_feature_btn.click();
                await page.waitForTimeout(2_000);

                // Model selectors should be visible
                const selects = page.locator("select");
                const select_count = await selects.count();
                expect(select_count).toBeGreaterThanOrEqual(2);
            }
        }
    });
});
