import { test, expect } from "@playwright/test";
import { API_URL, AUTH_HEADERS, DEV_SESSION_COOKIE, authenticate } from "./helpers";

test.describe("app smoke tests", () => {
    test("health endpoint returns ok", async ({ request }) => {
        const response = await request.get(`${API_URL}/health`);
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.status).toBe("ok");
        expect(body.timestamp).toBeDefined();
    });

    test("web app loads", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Clanqr/i, { timeout: 10_000 }).catch(() => {});
        const body = page.locator("body");
        await expect(body).toBeVisible();
    });

    test("unauthenticated API returns 401", async ({ request }) => {
        const response = await request.get(`${API_URL}/api/projects`);
        expect(response.status()).toBe(401);
    });

    test("auth status endpoint works", async ({ request }) => {
        const response = await request.get(`${API_URL}/api/auth/status`);
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(typeof body.is_setup).toBe("boolean");
        expect(typeof body.authenticated).toBe("boolean");
    });
});

test.describe("authenticated flows", () => {
    test("can list projects when authenticated", async ({ request }) => {
        const response = await request.get(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
        });
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(Array.isArray(body)).toBeTruthy();
    });

    test("can create and delete a project", async ({ request }) => {
        const create_res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E Test Project", description: "Created by Playwright" },
        });
        expect(create_res.ok()).toBeTruthy();
        const project = await create_res.json();
        expect(project.name).toBe("E2E Test Project");

        const delete_res = await request.delete(
            `${API_URL}/api/projects/${project.id}`,
            { headers: AUTH_HEADERS }
        );
        expect(delete_res.ok()).toBeTruthy();
    });

    test("web app shows content when authenticated", async ({ page }) => {
        await authenticate(page);
        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");
        const body = page.locator("body");
        await expect(body).toBeVisible();
    });
});
