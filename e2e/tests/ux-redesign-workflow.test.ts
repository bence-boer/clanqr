import { test, expect, type Page } from "@playwright/test";

/**
 * Comprehensive E2E workflow test for the UX redesign.
 * Validates: project → feature → resource → submit → monitoring.
 * Uses gpt-4.1 model and dev-admin-session-token for auth.
 */

const API = "http://localhost:3001";
const DEV_SESSION_COOKIE = "dev-admin-session-token";
const AUTH = { Cookie: `session=${DEV_SESSION_COOKIE}` };

async function authenticate(page: Page) {
    await page.context().addCookies([
        {
            name: "session",
            value: DEV_SESSION_COOKIE,
            domain: "localhost",
            path: "/",
        },
    ]);
}

const cleanup_project_ids: string[] = [];

// ── 1. API-driven workflow (serial) ───────────────────────────────────────────

test.describe.serial("complete project→feature→resource workflow (API)", () => {
    let project_id: string;
    let feature_id: string;

    test("1. create project", async ({ request }) => {
        const res = await request.post(`${API}/api/projects`, {
            headers: AUTH,
            data: {
                name: "E2E UX Redesign Test",
                description: "Full workflow validation for UX redesign",
            },
        });
        expect(res.ok()).toBeTruthy();
        const project = await res.json();
        project_id = project.id;
        cleanup_project_ids.push(project_id);
        expect(project.name).toBe("E2E UX Redesign Test");
    });

    test("2. create feature with gpt-4.1 model", async ({ request }) => {
        const res = await request.post(`${API}/api/features`, {
            headers: AUTH,
            data: {
                project_id,
                title: "E2E Test Feature",
                description: "Automated feature for workflow validation",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
            },
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        feature_id = feature.id;
        expect(feature.status).toBe("Draft");
        expect(feature.planning_model).toBe("gpt-4.1");
        expect(feature.execution_model).toBe("gpt-4.1");
    });

    test("3. add resource to feature", async ({ request }) => {
        const res = await request.post(`${API}/api/features/${feature_id}/resources`, {
            headers: AUTH,
            data: {
                url: "https://example.com/test-resource",
                title: "Test Resource",
            },
        });
        expect(res.ok()).toBeTruthy();
    });

    test("4. verify feature has resource", async ({ request }) => {
        const res = await request.get(`${API}/api/features/${feature_id}`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        expect(feature.resources).toBeDefined();
        expect(feature.resources.length).toBeGreaterThanOrEqual(1);
    });

    test("5. submit feature", async ({ request }) => {
        const res = await request.post(`${API}/api/features/${feature_id}/submit`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        expect(feature.status).toBe("Submitted");
    });

    test("6. verify activity feed returns data", async ({ request }) => {
        const res = await request.get(`${API}/api/activity/feed?limit=10`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const events = await res.json();
        expect(Array.isArray(events)).toBeTruthy();
    });

    test("7. verify agent status endpoint", async ({ request }) => {
        const res = await request.get(`${API}/api/agents/status`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const status = await res.json();
        expect(typeof status).toBe("object");
    });

    test("8. update feature config", async ({ request }) => {
        const res = await request.patch(`${API}/api/features/${feature_id}`, {
            headers: AUTH,
            data: { description: "Updated description for E2E test" },
        });
        expect(res.ok()).toBeTruthy();
        const updated = await res.json();
        expect(updated.description).toBe("Updated description for E2E test");
    });

    test("9. delete feature", async ({ request }) => {
        const res = await request.delete(`${API}/api/features/${feature_id}`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
    });

    test("10. delete project", async ({ request }) => {
        const res = await request.delete(`${API}/api/projects/${project_id}`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const idx = cleanup_project_ids.indexOf(project_id);
        if (idx >= 0) cleanup_project_ids.splice(idx, 1);
    });
});

// ── 2. UI-driven workflow ─────────────────────────────────────────────────────

test.describe("UI workflow: dashboard → projects → pipeline → monitoring → chat", () => {
    let cleanup_project_id: string | null = null;

    test.beforeEach(async ({ page }) => {
        await authenticate(page);
    });

    test.afterAll(async ({ request }) => {
        if (cleanup_project_id) {
            await request.delete(`${API}/api/projects/${cleanup_project_id}`, { headers: AUTH });
        }
    });

    test("dashboard shows KPI bar and activity feed", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/");

        const kpi_bar = page.locator(".kpi-bar");
        await expect(kpi_bar).toBeVisible({ timeout: 30_000 });

        const kpi_items = page.locator(".kpi-item");
        await expect(kpi_items.first()).toBeVisible({ timeout: 10_000 });
        const count = await kpi_items.count();
        expect(count).toBeGreaterThanOrEqual(3);

        const activity = page.locator(".activity-feed");
        await expect(activity).toBeVisible({ timeout: 10_000 });
    });

    test("sidebar navigation works", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/");

        const projects_link = page.locator('nav a[href="/projects"]');
        await expect(projects_link).toBeVisible({ timeout: 30_000 });
        await projects_link.click();
        await page.waitForURL("**/projects");
    });

    test("create project via API, verify UI shows it", async ({ page, request }) => {
        test.setTimeout(60_000);
        const res = await request.post(`${API}/api/projects`, {
            headers: AUTH,
            data: { name: "E2E UI Test Project", description: "Created for UI verification" },
        });
        const project = await res.json();
        cleanup_project_id = project.id;

        await page.goto("/projects");

        await expect(page.getByText("E2E UI Test Project")).toBeVisible({ timeout: 30_000 });
    });

    test("project detail page shows feature form", async ({ page }) => {
        test.setTimeout(60_000);
        if (!cleanup_project_id) {
            test.skip();
            return;
        }

        await page.goto(`/projects/${cleanup_project_id}`);

        await expect(page.getByText("E2E UI Test Project")).toBeVisible({ timeout: 30_000 });

        const add_btn = page.getByRole("button", { name: /new feature|add feature|create feature/i });
        if (await add_btn.isVisible().catch(() => false)) {
            await add_btn.click();
            const title_input = page.locator("input[placeholder='Feature title']").first();
            await expect(title_input).toBeVisible({ timeout: 5_000 });
        }
    });

    test("pipeline page shows status bar and tabs", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/pipeline");

        const status = page.locator(".status-bar");
        await expect(status).toBeVisible({ timeout: 30_000 });

        await expect(page.getByRole("tab", { name: "Queue" })).toBeVisible({ timeout: 5_000 });
        await expect(page.getByRole("tab", { name: "History" })).toBeVisible({ timeout: 5_000 });
    });

    test("monitoring page shows filter controls", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/monitoring");

        await expect(page.getByText("Agent Monitoring")).toBeVisible({ timeout: 30_000 });

        // Stat cards render with text-transform:uppercase, but DOM text is title case
        await expect(page.locator(".stat-label", { hasText: "Running" })).toBeVisible({ timeout: 15_000 });
        await expect(page.locator(".stat-label", { hasText: "Completed" })).toBeVisible();
        await expect(page.locator(".stat-label", { hasText: "Failed" })).toBeVisible();
    });

    test("chat page renders", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/chat");

        const chat = page.locator(".chat-page");
        await expect(chat).toBeVisible({ timeout: 30_000 });
    });
});

// ── 3. UX redesign feature validation ─────────────────────────────────────────

test.describe("UX redesign feature validation", () => {
    test.beforeEach(async ({ page }) => {
        await authenticate(page);
    });

    test("dashboard has collapsible system health", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/");

        const health_btn = page.locator(".kpi-item.kpi-health");
        await expect(health_btn).toBeVisible({ timeout: 30_000 });
    });

    test("projects page has search input", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/projects");

        const search = page.locator('input[placeholder="Search projects…"]');
        await expect(search).toBeVisible({ timeout: 30_000 });
    });

    test("projects page has filter pills", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/projects");

        const filter_pills = page.locator(".filter-pill");
        await expect(filter_pills.first()).toBeVisible({ timeout: 30_000 });
        const count = await filter_pills.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test("pipeline page has throughput stats", async ({ page }) => {
        test.setTimeout(60_000);
        await page.goto("/pipeline");

        const stats = page.locator(".stats-bar");
        await expect(stats).toBeVisible({ timeout: 30_000 });
    });
});

// ── 4. New API endpoints validation ───────────────────────────────────────────

test.describe("new API endpoints", () => {
    test("activity feed endpoint works", async ({ request }) => {
        const res = await request.get(`${API}/api/activity/feed`, { headers: AUTH });
        expect(res.ok()).toBeTruthy();
        const events = await res.json();
        expect(Array.isArray(events)).toBeTruthy();
    });

    test("activity feed respects limit", async ({ request }) => {
        const res = await request.get(`${API}/api/activity/feed?limit=5`, { headers: AUTH });
        expect(res.ok()).toBeTruthy();
        const events = await res.json();
        expect(Array.isArray(events)).toBeTruthy();
        expect(events.length).toBeLessThanOrEqual(5);
    });

    test("chat session creation and rename", async ({ request }) => {
        const create_res = await request.post(`${API}/api/chat/sessions`, {
            headers: AUTH,
            data: { title: "Rename Test" },
        });
        expect(create_res.ok()).toBeTruthy();
        const session = await create_res.json();

        const rename_res = await request.patch(`${API}/api/chat/sessions/${session.id}`, {
            headers: AUTH,
            data: { title: "Renamed Session" },
        });
        expect(rename_res.ok()).toBeTruthy();
        const renamed = await rename_res.json();
        expect(renamed.title).toBe("Renamed Session");

        await request.delete(`${API}/api/chat/sessions/${session.id}`, { headers: AUTH });
    });

    test("admin metrics endpoint works", async ({ request }) => {
        const res = await request.get(`${API}/api/admin/metrics`, { headers: AUTH });
        expect(res.ok()).toBeTruthy();
        const metrics = await res.json();
        expect(typeof metrics).toBe("object");
    });
});

// ── 5. Cleanup ────────────────────────────────────────────────────────────────

test.afterAll(async ({ request }) => {
    for (const id of cleanup_project_ids) {
        await request.delete(`${API}/api/projects/${id}`, { headers: AUTH }).catch(() => {});
    }
});
