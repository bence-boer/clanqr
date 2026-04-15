import { test, expect } from "@playwright/test";
import { API_URL, AUTH_HEADERS, ADMIN_AUTH_HEADERS } from "./helpers";

// ── Verification API — happy path (M5) ───────────────────────────────────────

test.describe.serial("verification happy path", () => {
    let project_id: string;
    let task_id: string;

    test.beforeAll(async ({ request }) => {
        const proj_res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E Verify Happy", description: "Verification happy-path tests" },
        });
        expect(proj_res.ok()).toBeTruthy();
        project_id = (await proj_res.json()).id;

        const feat_res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: {
                project_id,
                title: "Verify Feature",
                description: "For verification happy-path test",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
            },
        });
        expect(feat_res.ok()).toBeTruthy();
        const feature_id = (await feat_res.json()).id;

        const task_res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: { feature_id, description: "Task to verify" },
        });
        expect(task_res.ok()).toBeTruthy();
        task_id = (await task_res.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, {
                headers: AUTH_HEADERS,
            });
        }
    });

    test("verify existing task returns 200 with verdict and reasons", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/agents/verify/${task_id}`, {
            headers: ADMIN_AUTH_HEADERS,
            data: {},
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(typeof body.verdict).toBe("string");
        expect(Array.isArray(body.reasons)).toBeTruthy();
    });
});

// ── Traits API ────────────────────────────────────────────────────────────────

test.describe.serial("traits API CRUD", () => {
    let trait_id: string;

    test("list traits returns 200 with array", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/traits`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body)).toBeTruthy();
    });

    test("create trait with V2 target", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/traits`, {
            headers: ADMIN_AUTH_HEADERS,
            data: {
                name: "e2e_test_trait",
                target: "architect",
                content: "Test trait content for E2E coverage",
            },
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        trait_id = body.id;
        expect(trait_id).toBeDefined();
        expect(body.name).toBe("e2e_test_trait");
        expect(body.target).toBe("architect");
    });

    test("get trait by ID returns the created trait", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/traits/${trait_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.id).toBe(trait_id);
        expect(body.name).toBe("e2e_test_trait");
    });

    test("delete trait by ID removes it", async ({ request }) => {
        const del_res = await request.delete(`${API_URL}/api/traits/${trait_id}`, {
            headers: ADMIN_AUTH_HEADERS,
        });
        expect(del_res.ok()).toBeTruthy();

        // Verify deletion — should return 404
        const get_res = await request.get(`${API_URL}/api/traits/${trait_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(get_res.status()).toBe(404);
    });
});

// ── Prompts API ───────────────────────────────────────────────────────────────

test.describe("prompts API", () => {
    test("list prompts returns 200 with array", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/prompts`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body)).toBeTruthy();
    });

    test("get prompt for orchestrator returns 200 or 404", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/prompts/orchestrator`, {
            headers: AUTH_HEADERS,
        });
        // 200 if prompt is seeded, 404 if not — both are acceptable
        expect([200, 404]).toContain(res.status());
    });

    test("get prompt for invalid type returns 400", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/prompts/invalid_type`, {
            headers: AUTH_HEADERS,
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toBeDefined();
    });
});

// ── Skills API ────────────────────────────────────────────────────────────────

test.describe("skills API", () => {
    test("list skills returns 200 with array", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/skills`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body)).toBeTruthy();
    });

    test("refresh skills returns 200 with count", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/skills/refresh`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(typeof body.refreshed).toBe("number");
    });
});
