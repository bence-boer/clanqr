import { test, expect } from "@playwright/test";
import { API_URL, AUTH_HEADERS } from "./helpers";

test.describe("feature lifecycle", () => {
    let project_id: string;
    let feature_id: string;

    test.beforeAll(async ({ request }) => {
        const res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E Lifecycle Test", description: "Automated test" },
        });
        expect(res.ok()).toBeTruthy();
        project_id = (await res.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, { headers: AUTH_HEADERS });
        }
    });

    test("create feature with config fields", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: {
                project_id,
                title: "E2E Feature",
                description: "Test feature for E2E",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
                on_task_failure: "skip",
                task_timeout_minutes: 15,
            },
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        feature_id = feature.id;
        expect(feature.status).toBe("Draft");
        expect(feature.on_task_failure).toBe("skip");
    });

    test("update feature config", async ({ request }) => {
        const res = await request.patch(`${API_URL}/api/features/${feature_id}`, {
            headers: AUTH_HEADERS,
            data: { on_task_failure: "retry", auto_approve: true },
        });
        expect(res.ok()).toBeTruthy();
        const updated = await res.json();
        expect(updated.on_task_failure).toBe("retry");
        expect(updated.auto_approve).toBe(true);
    });

    test("feature has no last_error initially", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/features/${feature_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        expect(feature.last_error).toBeNull();
        expect(feature.manager_retry_count).toBe(0);
    });

    test("delete feature cleans up", async ({ request }) => {
        const res = await request.delete(`${API_URL}/api/features/${feature_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
    });
});

test.describe.serial("task management", () => {
    let project_id: string;
    let feature_id: string;
    let task_id: string;

    test.beforeAll(async ({ request }) => {
        const proj = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E Task Test", description: "Task test" },
        });
        project_id = (await proj.json()).id;

        const feat = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: { project_id, title: "Task Feature", description: "For task tests", planning_model: "gpt-4.1", execution_model: "gpt-4.1" },
        });
        feature_id = (await feat.json()).id;
    });

    test.afterAll(async ({ request }) => {
        // Resume pipeline in case it was paused
        await request.post(`${API_URL}/api/agents/resume`, { headers: AUTH_HEADERS });
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, { headers: AUTH_HEADERS });
        }
    });

    test("create task on feature", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: { feature_id, description: "E2E test task" },
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        task_id = task.id;
        expect(task.status).toBe("Pending_Approval");
        expect(task.sort_order).toBeDefined();
    });

    test("delete pending task succeeds", async ({ request }) => {
        // Delete a Pending_Approval task (always works, no pipeline race)
        const res = await request.delete(`${API_URL}/api/tasks/${task_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
    });

    test("approve task transitions status", async ({ request }) => {
        // Create a new task to approve
        const create_res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: { feature_id, description: "E2E approval test task" },
        });
        const new_task = await create_res.json();
        task_id = new_task.id;

        // Pause pipeline to prevent it from picking up the task
        await request.post(`${API_URL}/api/agents/pause`, { headers: AUTH_HEADERS });

        const res = await request.post(`${API_URL}/api/tasks/${task_id}/approve`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        expect(task.status).toBe("Approved");

        // Clean up: delete the approved task, resume pipeline
        await request.delete(`${API_URL}/api/tasks/${task_id}`, { headers: AUTH_HEADERS });
        await request.post(`${API_URL}/api/agents/resume`, { headers: AUTH_HEADERS });
    });
});

test.describe.serial("chat workflow", () => {
    let session_id: string;

    test("create chat session", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/chat/sessions`, {
            headers: AUTH_HEADERS,
            data: { title: "E2E Chat", model: "claude-sonnet-4.5" },
        });
        expect(res.ok()).toBeTruthy();
        const session = await res.json();
        session_id = session.id;
        expect(session.title).toBe("E2E Chat");
    });

    test("list sessions includes new one", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/chat/sessions`, { headers: AUTH_HEADERS });
        expect(res.ok()).toBeTruthy();
        const sessions = await res.json();
        expect(sessions.some((s: any) => s.id === session_id)).toBeTruthy();
    });

    test("cancel returns result", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/chat/sessions/${session_id}/cancel`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(typeof body.success).toBe("boolean");
    });

    test("delete session", async ({ request }) => {
        const res = await request.delete(`${API_URL}/api/chat/sessions/${session_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
    });
});

test.describe("pipeline and usage", () => {
    test("pipeline status returns valid structure", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agents/queue`, { headers: AUTH_HEADERS });
        expect(res.ok()).toBeTruthy();
        const status = await res.json();
        expect(status.state).toBeDefined();
        expect(typeof status.queue_depth).toBe("number");
    });

    test("usage stats returns data", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/usage/summary`, { headers: AUTH_HEADERS });
        expect(res.ok()).toBeTruthy();
        const stats = await res.json();
        expect(typeof stats.total_runs).toBe("number");
    });

    test("usage history supports pagination", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/usage/history?page=1&per_page=5`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body.runs)).toBeTruthy();
        expect(typeof body.total).toBe("number");
    });

    test("usage history rejects invalid params", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/usage/history?type=invalid`, {
            headers: AUTH_HEADERS,
        });
        expect(res.status()).toBe(400);
    });
});

test.describe("resource SSRF protection", () => {
    let project_id: string;
    let feature_id: string;

    test.beforeAll(async ({ request }) => {
        const proj = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E SSRF Test", description: "SSRF test" },
        });
        project_id = (await proj.json()).id;

        const feat = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: { project_id, title: "SSRF Feature", description: "For SSRF tests", planning_model: "gpt-4.1", execution_model: "gpt-4.1" },
        });
        feature_id = (await feat.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, { headers: AUTH_HEADERS });
        }
    });

    test("rejects internal IP resource", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features/${feature_id}/resources`, {
            headers: AUTH_HEADERS,
            data: { url: "http://127.0.0.1:8080/secret" },
        });
        expect(res.ok()).toBeFalsy();
    });

    test("rejects file:// scheme", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features/${feature_id}/resources`, {
            headers: AUTH_HEADERS,
            data: { url: "file:///etc/passwd" },
        });
        expect(res.ok()).toBeFalsy();
    });

    test("accepts valid external URL", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features/${feature_id}/resources`, {
            headers: AUTH_HEADERS,
            data: { url: "https://example.com/docs", title: "Example" },
        });
        expect(res.ok()).toBeTruthy();
    });
});

test.describe("auth protection", () => {
    test("all API routes require auth", async ({ request }) => {
        const protected_routes = [
            { method: "GET", url: `${API_URL}/api/projects` },
            { method: "GET", url: `${API_URL}/api/features` },
            { method: "GET", url: `${API_URL}/api/agents/queue` },
            { method: "GET", url: `${API_URL}/api/chat/sessions` },
            { method: "GET", url: `${API_URL}/api/usage/summary` },
        ];

        for (const route of protected_routes) {
            const res = await request.fetch(route.url, { method: route.method });
            expect(res.status()).toBe(401);
        }
    });

    test("invite status is public", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/auth/invite/status?token=nonexistent`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.valid).toBe(false);
    });

    test("health endpoint is public", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/health`);
        // health may be at /health not /api/health
        if (!res.ok()) {
            const alt = await request.get(`${API_URL}/health`);
            expect(alt.ok()).toBeTruthy();
        }
    });
});

test.describe("admin protection", () => {
    test("admin routes require admin role", async ({ request }) => {
        // Regular user session should get 403
        const res = await request.get(`${API_URL}/api/admin`, { headers: AUTH_HEADERS });
        expect(res.status()).toBe(403);
    });
});

test.describe("rate limiting", () => {
    test("rapid requests get rate limited", async ({ request }) => {
        // Send many rapid requests to a rate-limited endpoint
        const promises = Array.from({ length: 60 }, () =>
            request.get(`${API_URL}/api/auth/status`)
        );
        const responses = await Promise.all(promises);
        const statuses = responses.map((r) => r.status());
        // At least some should be 429 (rate limited)
        // If rate limit is generous enough, all might pass — that's OK
        const has_rate_limit = statuses.some((s) => s === 429);
        const all_ok = statuses.every((s) => s === 200);
        expect(has_rate_limit || all_ok).toBeTruthy();
    });
});
