import { test, expect } from "@playwright/test";
import { API_URL, AUTH_HEADERS, authenticate } from "./helpers";

// ── 1. Chat multi-turn memory ────────────────────────────────────────────────

test.describe.serial("chat: multi-turn memory", () => {
    let session_id: string;

    test.afterAll(async ({ request }) => {
        if (session_id) {
            await request
                .delete(`${API_URL}/api/chat/sessions/${session_id}`, { headers: AUTH_HEADERS })
                .catch(() => {});
        }
    });

    test("create chat session", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/chat/sessions`, {
            headers: AUTH_HEADERS,
            data: { title: "E2E Memory Test", model: "gpt-4.1" },
        });
        expect(res.ok()).toBeTruthy();
        session_id = (await res.json()).id;
    });

    test("send first message with a unique fact", async ({ request }) => {
        test.setTimeout(120_000);

        const res = await request.post(`${API_URL}/api/chat/sessions/${session_id}/send`, {
            headers: AUTH_HEADERS,
            data: { content: "Remember this code: ALPHA-7742. It is my secret project code. Just confirm you noted it." },
        });
        expect(res.ok()).toBeTruthy();

        // Read the SSE stream
        const text = await res.text();
        expect(text).toContain("ALPHA");
    });

    test("second message references first — memory works", async ({ request }) => {
        test.setTimeout(120_000);

        const res = await request.post(`${API_URL}/api/chat/sessions/${session_id}/send`, {
            headers: AUTH_HEADERS,
            data: { content: "What was the secret project code I told you?" },
        });
        expect(res.ok()).toBeTruthy();

        const text = await res.text();
        // The model should recall ALPHA-7742 from the previous turn
        expect(text).toContain("7742");
    });

    test("messages are persisted in DB", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/chat/sessions/${session_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const session = await res.json();
        // Should have 4 messages: user, assistant, user, assistant
        expect(session.chat_messages.length).toBeGreaterThanOrEqual(4);
    });
});

// ── 2. Feature form: model selectors visible by default ──────────────────────

test.describe("feature form: model selectors visible", () => {
    let project_id: string;

    test.beforeAll(async ({ request }) => {
        const res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E Form Test", description: "Model selector tests" },
        });
        expect(res.ok()).toBeTruthy();
        project_id = (await res.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request
                .delete(`${API_URL}/api/projects/${project_id}`, { headers: AUTH_HEADERS })
                .catch(() => {});
        }
    });

    test("model selectors are visible without expanding advanced settings", async ({ page }) => {
        await authenticate(page);
        await page.goto(`/projects/${project_id}`);

        // Click "New Feature" to open the form
        const new_btn = page.getByRole("button", { name: /new feature/i });
        await expect(new_btn).toBeVisible({ timeout: 15_000 });
        await new_btn.click();

        // Model selectors should be visible in the main form — NOT inside collapsed section
        const planning_select = page.locator("#create-planning-model");
        const execution_select = page.locator("#create-execution-model");

        await expect(planning_select).toBeVisible({ timeout: 10_000 });
        await expect(execution_select).toBeVisible();
    });

    test("model selectors auto-select gpt-4.1 default", async ({ page }) => {
        await authenticate(page);
        await page.goto(`/projects/${project_id}`);
        await page.getByRole("button", { name: /new feature/i }).click();

        // Wait for models to load
        const planning_select = page.locator("#create-planning-model");
        await expect(planning_select).toBeVisible({ timeout: 10_000 });

        // Wait briefly for auto-selection
        await page.waitForTimeout(1_500);

        const planning_val = await planning_select.inputValue();
        const execution_val = await page.locator("#create-execution-model").inputValue();

        expect(planning_val).toContain("gpt-4.1");
        expect(execution_val).toContain("gpt-4.1");
    });

    test("Save Draft button is enabled after entering title", async ({ page }) => {
        await authenticate(page);
        await page.goto(`/projects/${project_id}`);
        await page.getByRole("button", { name: /new feature/i }).click();

        // Wait for models to load
        await expect(page.locator("#create-planning-model")).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1_000);

        // Save Draft should be disabled without title
        const save_btn = page.getByRole("button", { name: /save draft/i });
        await expect(save_btn).toBeDisabled();

        // Enter title — Save Draft should become enabled
        await page.getByPlaceholder("Feature title").fill("Test Feature Title");
        await expect(save_btn).toBeEnabled();
    });
});

// ── 3. Monitoring page structure ─────────────────────────────────────────────

test.describe("monitoring page", () => {
    test("displays stat cards and agent grid", async ({ page }) => {
        await authenticate(page);
        await page.goto("/monitoring");

        await expect(page.getByText("Agent Monitoring")).toBeVisible();
        await expect(page.getByText("Running")).toBeVisible();
        await expect(page.getByText("Completed")).toBeVisible();
        await expect(page.getByText("Failed")).toBeVisible();
    });
});

// ── 4. Agent logs API ────────────────────────────────────────────────────────

test.describe("agent logs API", () => {
    test("returns structured response for nonexistent session", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agents/logs/nonexistent-session-id`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body).toHaveProperty("entries");
        expect(Array.isArray(body.entries)).toBeTruthy();
    });
});

// ── 5. Feature creation with models pre-selected via API ─────────────────────

test.describe("feature API: models auto-populated", () => {
    let project_id: string;

    test.beforeAll(async ({ request }) => {
        const res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E Models API Test" },
        });
        expect(res.ok()).toBeTruthy();
        project_id = (await res.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request
                .delete(`${API_URL}/api/projects/${project_id}`, { headers: AUTH_HEADERS })
                .catch(() => {});
        }
    });

    test("create feature with models and timeout", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: {
                project_id,
                title: "Feature With Models",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
                task_timeout_minutes: 5,
            },
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        expect(feature.planning_model).toBe("gpt-4.1");
        expect(feature.execution_model).toBe("gpt-4.1");
        expect(feature.task_timeout_minutes).toBe(5);
    });
});
