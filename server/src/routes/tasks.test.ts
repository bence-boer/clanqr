import { describe, expect, it } from "bun:test";
import { create_test_app, auth_headers } from "../test-app";
import { tasks_routes } from "./tasks";

function setup() {
    const { app, store, client } = create_test_app();
    app.route("/api/tasks", tasks_routes);
    return { app, store };
}

const TASK_ID = "00000000-0000-0000-0000-000000000020";
const FEATURE_ID = "00000000-0000-0000-0000-000000000010";
const INVALID_UUID = "not-a-uuid";

describe("tasks routes", () => {
    describe("GET /api/tasks", () => {
        it("returns 401 without auth", async () => {
            const { app } = setup();
            const res = await app.request("/api/tasks");
            expect(res.status).toBe(401);
        });

        it("returns tasks list", async () => {
            const { app } = setup();
            const res = await app.request("/api/tasks", { headers: auth_headers() });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any[];
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBeGreaterThan(0);
        });

        it("filters by feature_id", async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks?feature_id=${FEATURE_ID}`, {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any[];
            expect(body.every((t: any) => t.feature_id === FEATURE_ID)).toBe(true);
        });

        it("filters by status", async () => {
            const { app } = setup();
            const res = await app.request("/api/tasks?status=Pending_Approval", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any[];
            expect(body.every((t: any) => t.status === "Pending_Approval")).toBe(true);
        });
    });

    describe("GET /api/tasks/:id", () => {
        it("returns a single task", async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK_ID}`, {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.id).toBe(TASK_ID);
        });

        it("rejects invalid UUID", async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${INVALID_UUID}`, {
                headers: auth_headers(),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/tasks", () => {
        it("creates a task", async () => {
            const { app, store } = setup();
            const res = await app.request("/api/tasks", {
                method: "POST",
                headers: { ...auth_headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ feature_id: FEATURE_ID, description: "New task" }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as any;
            expect(body.description).toBe("New task");
            expect(body.status).toBe("Pending_Approval");
        });

        it("rejects missing description", async () => {
            const { app } = setup();
            const res = await app.request("/api/tasks", {
                method: "POST",
                headers: { ...auth_headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ feature_id: FEATURE_ID }),
            });
            expect(res.status).toBe(400);
        });

        it("rejects invalid feature_id format", async () => {
            const { app } = setup();
            const res = await app.request("/api/tasks", {
                method: "POST",
                headers: { ...auth_headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ feature_id: "bad", description: "Test" }),
            });
            expect(res.status).toBe(400);
        });

        it("returns 404 for non-existent feature", async () => {
            const { app } = setup();
            const res = await app.request("/api/tasks", {
                method: "POST",
                headers: { ...auth_headers(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    feature_id: "00000000-0000-0000-0000-000000099999",
                    description: "Test",
                }),
            });
            expect(res.status).toBe(404);
        });
    });

    describe("PATCH /api/tasks/:id", () => {
        it("updates task description", async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK_ID}`, {
                method: "PATCH",
                headers: { ...auth_headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ description: "Updated task" }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.description).toBe("Updated task");
        });

        it("rejects invalid status value", async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK_ID}`, {
                method: "PATCH",
                headers: { ...auth_headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ status: "InvalidStatus" }),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/tasks/:id/approve", () => {
        it("approves a pending task", async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${TASK_ID}/approve`, {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.status).toBe("Approved");
        });

        it("rejects invalid UUID", async () => {
            const { app } = setup();
            const res = await app.request(`/api/tasks/${INVALID_UUID}/approve`, {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("DELETE /api/tasks/:id", () => {
        it("deletes a pending task", async () => {
            const { app, store } = setup();
            const before = store.tasks.length;
            const res = await app.request(`/api/tasks/${TASK_ID}`, {
                method: "DELETE",
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            expect(store.tasks.length).toBe(before - 1);
        });

        it("rejects deletion of in-progress task", async () => {
            const { app, store } = setup();
            store.tasks[0].status = "In_Progress";
            const res = await app.request(`/api/tasks/${TASK_ID}`, {
                method: "DELETE",
                headers: auth_headers(),
            });
            expect(res.status).toBe(409);
        });

        it("rejects deletion of complete task", async () => {
            const { app, store } = setup();
            store.tasks[0].status = "Complete";
            const res = await app.request(`/api/tasks/${TASK_ID}`, {
                method: "DELETE",
                headers: auth_headers(),
            });
            expect(res.status).toBe(409);
        });
    });

    describe("POST /api/tasks/approve-all/:feature_id", () => {
        it("approves all pending tasks for a feature", async () => {
            const { app, store } = setup();
            const res = await app.request(`/api/tasks/approve-all/${FEATURE_ID}`, {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any[];
            expect(body.every((t: any) => t.status === "Approved")).toBe(true);
        });
    });
});
