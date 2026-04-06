import { test, expect } from "@playwright/test";
import { API_URL, ADMIN_AUTH_HEADERS as AUTH, DEV_ADMIN_SESSION_COOKIE } from "./helpers";

// Long timeouts for agent execution
const AGENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const POLL_INTERVAL_MS = 5_000; // 5 seconds

/** Poll a condition until it returns true or timeout */
async function poll_until(
    fn: () => Promise<boolean>,
    timeout_ms: number,
    interval_ms = POLL_INTERVAL_MS,
    label = "condition"
): Promise<void> {
    const deadline = Date.now() + timeout_ms;
    while (Date.now() < deadline) {
        if (await fn()) return;
        await new Promise((r) => setTimeout(r, interval_ms));
    }
    throw new Error(`Timed out waiting for ${label} after ${timeout_ms / 1000}s`);
}

// ── 1. Direct task pipeline: create → approve → execute → verify ──────────────

test.describe.serial("agent execution: direct task pipeline", () => {
    let project_id: string;
    let feature_id: string;
    let task_id: string;

    test.afterAll(async ({ request }) => {
        // Clean up test data
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, { headers: AUTH }).catch(() => {});
        }
    });

    test("1. create test project", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH,
            data: {
                name: "E2E Agent Execution Test",
                description: "Tests direct task pipeline execution",
            },
        });
        expect(res.ok()).toBeTruthy();
        const project = await res.json();
        project_id = project.id;
        expect(project_id).toBeTruthy();
    });

    test("2. create feature with gpt-4.1 model", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH,
            data: {
                project_id,
                title: "E2E Direct Task Test",
                description: "Minimal feature for direct task pipeline testing",
                cli: "copilot",
                execution_cli: "copilot",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
            },
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        feature_id = feature.id;
        expect(feature.status).toBe("draft");
    });

    test("3. create task directly via API", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/tasks`, {
            headers: AUTH,
            data: {
                feature_id,
                title: "E2E Output File",
                description:
                    "Create a single file called 'e2e-output.txt' in the current working directory. " +
                    "The file should contain exactly the text: 'E2E test completed successfully'. " +
                    "Do not create any other files or make any other changes.",
                model: "gpt-4.1",
                sort_order: 0,
            },
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        task_id = task.id;
        expect(task.status).toBe("queued");
    });

    test("4. approve task and trigger pipeline", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/tasks/${task_id}/approve`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        expect(task.status).toBe("approved");
    });

    test("5. wait for task execution to complete", async ({ request }) => {
        test.setTimeout(AGENT_TIMEOUT_MS);

        await poll_until(
            async () => {
                const res = await request.get(`${API_URL}/api/tasks/${task_id}`, {
                    headers: AUTH,
                });
                if (!res.ok()) return false;
                const task = await res.json();
                // Terminal states
                if (task.status === "complete" || task.status === "failed") return true;
                return false;
            },
            AGENT_TIMEOUT_MS - 30_000,
            POLL_INTERVAL_MS,
            "task execution"
        );

        // Verify final state
        const res = await request.get(`${API_URL}/api/tasks/${task_id}`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const task = await res.json();
        expect(task.status).toBe("complete");
    });

    test("6. verify agent_runs record exists", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/usage/history?type=implementer&per_page=50`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        const runs = body.runs ?? body.data ?? body;
        expect(Array.isArray(runs)).toBeTruthy();

        // Find the run for our task
        const task_run = runs.find(
            (r: { task_id: string; agent_type: string }) =>
                r.task_id === task_id && r.agent_type === "implementer"
        );
        expect(task_run).toBeTruthy();
        expect(task_run.status).toBe("completed");
    });

    test("7. verify feature can be retrieved with completed task", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/features/${feature_id}`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        expect(feature.tasks).toBeDefined();
        const completed_task = feature.tasks.find((t: { id: string }) => t.id === task_id);
        expect(completed_task).toBeTruthy();
        expect(completed_task.status).toBe("complete");
    });

    test("8. verify telemetry events were captured", async ({ request }) => {
        // Get agent status to find the SDK session ID for our task
        const status_res = await request.get(`${API_URL}/api/agents/status`, {
            headers: AUTH,
        });
        expect(status_res.ok()).toBeTruthy();
        const agents = await status_res.json();
        const implementer_agent = agents.find(
            (a: { task_id: string; agent_type: string }) =>
                a.task_id === task_id && a.agent_type === "implementer"
        );
        expect(implementer_agent).toBeTruthy();
        expect(implementer_agent.sdk_session_id).toBeTruthy();

        // Verify events exist via telemetry API (using SDK session ID)
        const events_res = await request.get(
            `${API_URL}/api/telemetry/sessions/${implementer_agent.sdk_session_id}/events`,
            { headers: AUTH }
        );
        expect(events_res.ok()).toBeTruthy();
        const events = await events_res.json();
        expect(events.total).toBeGreaterThan(0);
        expect(events.events.length).toBeGreaterThan(0);

        // Verify tool calls were persisted
        const tools_res = await request.get(
            `${API_URL}/api/telemetry/sessions/${implementer_agent.sdk_session_id}/tools`,
            { headers: AUTH }
        );
        expect(tools_res.ok()).toBeTruthy();
        const tools = await tools_res.json();
        expect(tools.tools.length).toBeGreaterThan(0);

        // Verify session summary is accessible
        const summary_res = await request.get(
            `${API_URL}/api/telemetry/sessions/${implementer_agent.sdk_session_id}/summary`,
            { headers: AUTH }
        );
        expect(summary_res.ok()).toBeTruthy();
        const summary = await summary_res.json();
        expect(summary.agent_type).toBe("implementer");
        expect(summary.status).toBe("completed");
        expect(summary.event_count).toBeGreaterThan(0);

        // Verify token data was persisted (use summary which has all columns)
        expect(summary.prompt_tokens).toBeGreaterThan(0);
        expect(summary.completion_tokens).toBeGreaterThan(0);

        // Verify estimated_cost is a valid number (0 is expected for free/0x models)
        expect(summary.estimated_cost).toBeDefined();
        expect(Number(summary.estimated_cost)).toBeGreaterThanOrEqual(0);
    });
});

// ── 2. Full manager flow: submit → manager creates tasks → execute ────────────

test.describe.serial("agent execution: full orchestrator flow", () => {
    let project_id: string;
    let feature_id: string;

    test.afterAll(async ({ request }) => {
        if (project_id) {
            await request.delete(`${API_URL}/api/projects/${project_id}`, { headers: AUTH }).catch(() => {});
        }
    });

    test("1. create project for manager flow", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/projects`, {
            headers: AUTH,
            data: {
                name: "E2E Manager Flow Test",
                description: "Tests full manager → task → execution flow",
            },
        });
        expect(res.ok()).toBeTruthy();
        const project = await res.json();
        project_id = project.id;
    });

    test("2. create feature with auto_approve enabled", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features`, {
            headers: AUTH,
            data: {
                project_id,
                title: "E2E Auto-Approve Feature",
                description:
                    "Create a single file called 'manager-test-output.txt' containing the text " +
                    "'Manager flow test completed'. This is a trivial task that should be done in a single step.",
                cli: "copilot",
                execution_cli: "copilot",
                planning_model: "gpt-4.1",
                execution_model: "gpt-4.1",
                auto_approve: true,
                on_task_failure: "stop",
                task_timeout_minutes: 5,
            },
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        feature_id = feature.id;
        expect(feature.auto_approve).toBe(true);
    });

    test("3. submit feature to trigger manager", async ({ request }) => {
        const res = await request.post(`${API_URL}/api/features/${feature_id}/submit`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();
        expect(feature.status).toBe("submitted");
    });

    test("4. wait for manager to create tasks", async ({ request }) => {
        test.setTimeout(AGENT_TIMEOUT_MS);

        await poll_until(
            async () => {
                const res = await request.get(`${API_URL}/api/features/${feature_id}`, {
                    headers: AUTH,
                });
                if (!res.ok()) return false;
                const feature = await res.json();
                // Manager done when tasks exist (auto_approve moves feature to in_progress)
                if (feature.tasks && feature.tasks.length > 0) return true;
                // Also check if feature moved past submitted
                if (feature.status !== "submitted" && feature.status !== "in_progress") return true;
                return false;
            },
            AGENT_TIMEOUT_MS - 30_000,
            POLL_INTERVAL_MS,
            "manager to create tasks"
        );

        const res = await request.get(`${API_URL}/api/features/${feature_id}`, {
            headers: AUTH,
        });
        const feature = await res.json();
        expect(feature.tasks.length).toBeGreaterThan(0);
    });

    test("5. wait for all tasks to reach terminal state", async ({ request }) => {
        test.setTimeout(AGENT_TIMEOUT_MS);

        await poll_until(
            async () => {
                const res = await request.get(`${API_URL}/api/features/${feature_id}`, {
                    headers: AUTH,
                });
                if (!res.ok()) return false;
                const feature = await res.json();
                if (!feature.tasks || feature.tasks.length === 0) return false;
                // All tasks must be in a terminal state
                const terminal = ["complete", "failed", "skipped"];
                return feature.tasks.every((t: { status: string }) =>
                    terminal.includes(t.status)
                );
            },
            AGENT_TIMEOUT_MS - 30_000,
            POLL_INTERVAL_MS,
            "all tasks to complete"
        );
    });

    test("6. verify feature reached Done or has completed tasks", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/features/${feature_id}`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const feature = await res.json();

        // At least one task should have completed
        const completed = feature.tasks.filter(
            (t: { status: string }) => t.status === "complete"
        );
        expect(completed.length).toBeGreaterThan(0);
    });

    test("7. verify agent_runs records for orchestrator and implementer", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/usage/history?per_page=50`, {
            headers: AUTH,
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        const runs = body.runs ?? body.data ?? body;

        // Should have at least an orchestrator run for this feature
        const orchestrator_run = runs.find(
            (r: { feature_id: string; agent_type: string }) =>
                r.feature_id === feature_id && r.agent_type === "orchestrator"
        );
        expect(orchestrator_run).toBeTruthy();

        // Should have at least one implementer run
        const implementer_runs = runs.filter(
            (r: { feature_id: string; agent_type: string }) =>
                r.feature_id === feature_id && r.agent_type === "implementer"
        );
        expect(implementer_runs.length).toBeGreaterThan(0);
    });
});
