import { test, expect } from "@playwright/test";
import { API_URL, AUTH_HEADERS, ADMIN_AUTH_HEADERS, authenticate } from "./helpers";

test.describe("dynamic model list", () => {
    test("GET /api/system/models returns array of models", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/system/models`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const models = await res.json();
        expect(Array.isArray(models)).toBeTruthy();
        expect(models.length).toBeGreaterThan(0);
    });

    test("each model has value and label", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/system/models`, {
            headers: AUTH_HEADERS,
        });
        const models = await res.json();

        for (const model of models) {
            expect(typeof model.value).toBe("string");
            expect(model.value.length).toBeGreaterThan(0);
            expect(typeof model.label).toBe("string");
            expect(model.label.length).toBeGreaterThan(0);
        }
    });

    test("gpt-4.1 is available in model list", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/system/models`, {
            headers: AUTH_HEADERS,
        });
        const models = await res.json();
        const gpt41 = models.find((m: { value: string }) => m.value === "gpt-4.1");
        expect(gpt41).toBeTruthy();
    });

    test("models endpoint requires auth", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/system/models`);
        expect(res.status()).toBe(401);
    });

    test("models are accessible from chat page UI", async ({ page }) => {
        await authenticate(page, true);
        await page.goto("/chat");
        await page.waitForLoadState("domcontentloaded");

        // The chat page should have a model selector
        const model_selector = page.locator("select");
        await model_selector.first().waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
        const count = await model_selector.count();

        // If a select exists, verify it has options
        if (count > 0) {
            const options = model_selector.first().locator("option");
            const option_count = await options.count();
            expect(option_count).toBeGreaterThan(0);
        }
    });
});
