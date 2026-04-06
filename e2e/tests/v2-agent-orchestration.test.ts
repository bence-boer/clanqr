import { test, expect } from "@playwright/test";
import { authenticate, API_URL, AUTH_HEADERS, ADMIN_AUTH_HEADERS } from "./helpers";

// ── Agent Types API ───────────────────────────────────────────────────────────

test.describe("agent types API", () => {
    test("list agent types returns an array", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agent-types`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body)).toBeTruthy();
    });

    test("agent types contain expected fields", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agent-types`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const agents: Record<string, unknown>[] = await res.json();
        // Skip field assertions if no agent types are loaded (env-dependent)
        if (agents.length === 0) return;

        const first = agents[0];
        expect(typeof first.name).toBe("string");
        expect(typeof first.description).toBe("string");
        expect(Array.isArray(first.tools)).toBeTruthy();
        // prompt_content is also returned from the service
        expect(typeof first.prompt_content).toBe("string");
    });

    test("get single agent type by name", async ({ request }) => {
        // First list to find a valid name
        const list_res = await request.get(`${API_URL}/api/agent-types`, {
            headers: AUTH_HEADERS,
        });
        const agents: { name: string }[] = await list_res.json();
        if (agents.length === 0) {
            // No agent types loaded — skip rather than fail
            test.skip();
            return;
        }

        const name = agents[0].name;
        const res = await request.get(`${API_URL}/api/agent-types/${name}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const agent = await res.json();
        expect(agent.name).toBe(name);
        expect(typeof agent.description).toBe("string");
        expect(Array.isArray(agent.tools)).toBeTruthy();
    });

    test("get nonexistent agent type returns 404", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agent-types/nonexistent_type_xyz`, {
            headers: AUTH_HEADERS,
        });
        expect(res.status()).toBe(404);
        const body = await res.json();
        expect(body.error).toBeDefined();
    });

    test("sync agent types returns success with count", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/agent-types/sync`, {
            headers: ADMIN_AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(typeof body.count).toBe("number");
    });

    test("sync agent types requires admin", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/agent-types/sync`, {
            headers: AUTH_HEADERS,
        });
        expect(res.status()).toBe(403);
    });

    test("agent types require authentication", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agent-types`);
        expect(res.status()).toBe(401);
    });
});

// ── Task Dependencies API ─────────────────────────────────────────────────────

test.describe.serial("task dependencies API", () => {
    let project_id: string;
    let feature_id: string;
    let task_a_id: string;
    let task_b_id: string;

    test.beforeAll(async ({ request }) => {
        // Create project
        const proj_res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E Deps Test", description: "Task dependency tests" },
        });
        expect(proj_res.ok()).toBeTruthy();
        project_id = (await proj_res.json()).id;

        // Create feature
        const feat_res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: {
                project_id,
                title: "Deps Feature",
                description: "For dependency tests",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
            },
        });
        expect(feat_res.ok()).toBeTruthy();
        feature_id = (await feat_res.json()).id;

        // Create two tasks
        const task_a_res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: { feature_id, description: "Task A — upstream" },
        });
        expect(task_a_res.ok()).toBeTruthy();
        task_a_id = (await task_a_res.json()).id;

        const task_b_res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: { feature_id, description: "Task B — downstream" },
        });
        expect(task_b_res.ok()).toBeTruthy();
        task_b_id = (await task_b_res.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, {
                headers: AUTH_HEADERS,
            });
        }
    });

    test("dependencies are initially empty", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/tasks/${task_b_id}/dependencies`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const deps = await res.json();
        expect(Array.isArray(deps)).toBeTruthy();
        expect(deps.length).toBe(0);
    });

    test("add a dependency between two tasks", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/tasks/${task_b_id}/dependencies`, {
            headers: AUTH_HEADERS,
            data: { depends_on_task_id: task_a_id },
        });
        expect(res.status()).toBe(201);
        const dep = await res.json();
        expect(dep.task_id).toBe(task_b_id);
        expect(dep.depends_on_task_id).toBe(task_a_id);
    });

    test("get dependencies returns the added dependency", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/tasks/${task_b_id}/dependencies`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const deps: { task_id: string; depends_on_task_id: string }[] = await res.json();
        expect(deps.length).toBeGreaterThanOrEqual(1);
        const match = deps.find((d) => d.depends_on_task_id === task_a_id);
        expect(match).toBeDefined();
    });

    test("adding a cyclic dependency returns 400", async ({ request }) => {
        // B already depends on A; adding A depends on B would create a cycle
        const res = await request.post(`${API_URL}/api/tasks/${task_a_id}/dependencies`, {
            headers: AUTH_HEADERS,
            data: { depends_on_task_id: task_b_id },
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toBeDefined();
    });

    test("delete a dependency", async ({ request }) => {
        const del_res = await request.delete(
            `${API_URL}/api/tasks/${task_b_id}/dependencies/${task_a_id}`,
            { headers: AUTH_HEADERS }
        );
        expect(del_res.ok()).toBeTruthy();
        const body = await del_res.json();
        expect(body.success).toBe(true);

        // Verify deletion
        const get_res = await request.get(`${API_URL}/api/tasks/${task_b_id}/dependencies`, {
            headers: AUTH_HEADERS,
        });
        expect(get_res.ok()).toBeTruthy();
        const deps = await get_res.json();
        const match = deps.find((d: { depends_on_task_id: string }) => d.depends_on_task_id === task_a_id);
        expect(match).toBeUndefined();
    });

    test("dependency on invalid UUID returns 400", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/tasks/not-a-uuid/dependencies`, {
            headers: AUTH_HEADERS,
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toBeDefined();
    });
});

// ── DAG API ───────────────────────────────────────────────────────────────────

test.describe("DAG API", () => {
    let project_id: string;
    let feature_id: string;

    test.beforeAll(async ({ request }) => {
        const proj_res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E DAG Test", description: "DAG tests" },
        });
        expect(proj_res.ok()).toBeTruthy();
        project_id = (await proj_res.json()).id;

        const feat_res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: {
                project_id,
                title: "DAG Feature",
                description: "For DAG tests",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
            },
        });
        expect(feat_res.ok()).toBeTruthy();
        feature_id = (await feat_res.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, {
                headers: AUTH_HEADERS,
            });
        }
    });

    test("get DAG for feature with no tasks returns empty structure", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agents/dag/${feature_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const dag = await res.json();
        expect(Array.isArray(dag.nodes)).toBeTruthy();
        expect(Array.isArray(dag.edges)).toBeTruthy();
        expect(typeof dag.wave_count).toBe("number");
        expect(dag.nodes.length).toBe(0);
        expect(dag.edges.length).toBe(0);
        expect(dag.wave_count).toBe(0);
    });

    test("get DAG for feature with tasks returns nodes", async ({ request }) => {
        // Create a task so the DAG has a node
        const task_res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: { feature_id, description: "DAG node task" },
        });
        expect(task_res.ok()).toBeTruthy();

        const res = await request.get(`${API_URL}/api/agents/dag/${feature_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const dag = await res.json();
        expect(dag.nodes.length).toBeGreaterThanOrEqual(1);

        // Verify node shape
        const node = dag.nodes[0];
        expect(node.id).toBeDefined();
        expect(typeof node.status).toBe("string");
        expect(node.agent_type).toBeDefined();
    });

    test("get DAG with invalid feature_id returns 400", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/agents/dag/not-a-uuid`, {
            headers: AUTH_HEADERS,
        });
        expect(res.status()).toBe(400);
    });
});

// ── Verification API ──────────────────────────────────────────────────────────

test.describe("verification API", () => {
    test("verify for nonexistent task returns 404", async ({ request }) => {
        // Use a valid UUID that won't match any real task
        const fake_id = "00000000-0000-0000-0000-000000000099";
        const res = await request.post(`${API_URL}/api/agents/verify/${fake_id}`, {
            headers: AUTH_HEADERS,
            data: {},
        });
        expect(res.status()).toBe(404);
        const body = await res.json();
        expect(body.error).toBeDefined();
    });

    test("verify with invalid UUID returns 400", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/agents/verify/bad-uuid`, {
            headers: AUTH_HEADERS,
            data: {},
        });
        expect(res.status()).toBe(400);
    });
});

// ── V2 Task Fields ────────────────────────────────────────────────────────────

test.describe.serial("V2 task fields", () => {
    let project_id: string;
    let feature_id: string;
    let task_id: string;

    test.beforeAll(async ({ request }) => {
        const proj_res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH_HEADERS,
            data: { name: "E2E V2 Fields Test", description: "V2 task field tests" },
        });
        expect(proj_res.ok()).toBeTruthy();
        project_id = (await proj_res.json()).id;

        const feat_res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH_HEADERS,
            data: {
                project_id,
                title: "V2 Fields Feature",
                description: "For V2 field tests",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
            },
        });
        expect(feat_res.ok()).toBeTruthy();
        feature_id = (await feat_res.json()).id;
    });

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, {
                headers: AUTH_HEADERS,
            });
        }
    });

    test("create task with V2 fields", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: {
                feature_id,
                description: "Task with V2 fields",
                agent_type: "architect",
                execution_strategy: "parallel",
                definition_of_done: "All tests pass and code compiles",
                skills: ["typescript", "testing"],
                context_paths: ["src/routes/api.ts", "src/utils/helpers.ts"],
                wave_number: 0,
            },
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        task_id = task.id;

        expect(task.agent_type).toBe("architect");
        expect(task.execution_strategy).toBe("parallel");
        expect(task.definition_of_done).toBe("All tests pass and code compiles");
        expect(task.skills).toEqual(["typescript", "testing"]);
        expect(task.context_paths).toEqual(["src/routes/api.ts", "src/utils/helpers.ts"]);
        expect(task.wave_number).toBe(0);
    });

    test("read task returns V2 fields", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/tasks/${task_id}`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        expect(task.agent_type).toBe("architect");
        expect(task.execution_strategy).toBe("parallel");
        expect(task.definition_of_done).toBe("All tests pass and code compiles");
        expect(task.skills).toEqual(["typescript", "testing"]);
        expect(task.context_paths).toEqual(["src/routes/api.ts", "src/utils/helpers.ts"]);
        // verification_status should exist on the row
        expect(task.verification_status).toBeDefined();
    });

    test("update task V2 fields", async ({ request }) => {
        const res = await request.patch(`${API_URL}/api/tasks/${task_id}`, {
            headers: AUTH_HEADERS,
            data: {
                agent_type: "implementer",
                execution_strategy: "sequential",
                skills: ["go", "docker"],
            },
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        expect(task.agent_type).toBe("implementer");
        expect(task.execution_strategy).toBe("sequential");
        expect(task.skills).toEqual(["go", "docker"]);
    });

    test("task defaults: agent_type is implementer, strategy is sequential", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH_HEADERS,
            data: { feature_id, description: "Default fields task" },
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        expect(task.agent_type).toBe("implementer");
        expect(task.execution_strategy).toBe("sequential");
        expect(task.skills).toEqual([]);
        expect(task.context_paths).toEqual([]);
    });
});

// ── V2 Pipeline Page UI ──────────────────────────────────────────────────────

test.describe("V2 pipeline page UI", () => {
    test.beforeEach(async ({ page }) => {
        await authenticate(page, true);
    });

    test("pipeline page has DAG and History tabs", async ({ page }) => {
        await page.goto("/pipeline");
        await page.waitForLoadState("domcontentloaded");

        // The Tabs component renders role="tablist" with role="tab" buttons
        const tablist = page.locator('[role="tablist"]');
        await expect(tablist).toBeVisible({ timeout: 15_000 });

        const dag_tab = page.locator('button[role="tab"]', { hasText: "DAG" });
        const history_tab = page.locator('button[role="tab"]', { hasText: "History" });
        await expect(dag_tab).toBeVisible();
        await expect(history_tab).toBeVisible();
    });

    test("pipeline page does NOT have a Queue tab", async ({ page }) => {
        await page.goto("/pipeline");
        await page.waitForLoadState("domcontentloaded");

        await page.locator('[role="tablist"]').waitFor({ timeout: 15_000 });

        const queue_tab = page.locator('button[role="tab"]', { hasText: /^Queue$/i });
        await expect(queue_tab).not.toBeVisible();
    });

    test("pipeline page shows status bar and header", async ({ page }) => {
        await page.goto("/pipeline");
        await page.waitForLoadState("domcontentloaded");

        // h2 header with "Pipeline"
        const heading = page.locator("h2", { hasText: "Pipeline" });
        await expect(heading).toBeVisible({ timeout: 15_000 });

        // Subtitle text
        const subtitle = page.locator(".subtitle", { hasText: "Execution DAG" });
        await expect(subtitle).toBeVisible();
    });
});

// ── Agent Types Page UI ───────────────────────────────────────────────────────

test.describe("agent types page UI", () => {
    test.beforeEach(async ({ page }) => {
        await authenticate(page, true);
    });

    test("agent types page loads with heading", async ({ page }) => {
        await page.goto("/agent-types");
        await page.waitForLoadState("domcontentloaded");

        const heading = page.locator("h2", { hasText: "Agent Types" });
        await expect(heading).toBeVisible({ timeout: 15_000 });
    });

    test("agent types page has sync button", async ({ page }) => {
        await page.goto("/agent-types");
        await page.waitForLoadState("domcontentloaded");

        // The sync button contains text "Sync from Filesystem"
        const sync_btn = page.getByRole("button", { name: /sync from filesystem/i });
        await expect(sync_btn).toBeVisible({ timeout: 15_000 });
    });

    test("agent types page has search input", async ({ page }) => {
        await page.goto("/agent-types");
        await page.waitForLoadState("domcontentloaded");

        const search = page.locator('input[aria-label="Search agent types"]');
        await expect(search).toBeVisible({ timeout: 15_000 });
    });

    test("agent types page renders cards or empty state", async ({ page }) => {
        await page.goto("/agent-types");
        await page.waitForLoadState("domcontentloaded");

        // Wait for either type cards or the empty state to appear (auto-waiting
        // avoids a race where the spinner disappears before the DOM updates).
        const cards = page.locator(".type-card").first();
        const empty_state = page.locator("text=No agent types found");
        await expect(cards.or(empty_state)).toBeVisible({ timeout: 15_000 });
    });
});
