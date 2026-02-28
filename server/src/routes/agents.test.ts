import { describe, expect, it } from "bun:test";
import { create_test_app, auth_headers } from "../test-app";
import { agents_routes } from "./agents";

function setup() {
    const { app, store, client } = create_test_app();
    app.route("/api/agents", agents_routes);
    return { app, store };
}

const FEATURE_ID = "00000000-0000-0000-0000-000000000010";
const INVALID_UUID = "not-a-uuid";

describe("agents routes", () => {
    describe("GET /api/agents/queue", () => {
        it("returns 401 without auth", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/queue");
            expect(res.status).toBe(401);
        });

        it("returns queue status", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/queue", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body).toHaveProperty("state");
            expect(body).toHaveProperty("queue_depth");
        });
    });

    describe("POST /api/agents/pause", () => {
        it("pauses the pipeline", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/pause", {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
        });
    });

    describe("POST /api/agents/resume", () => {
        it("resumes the pipeline", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/resume", {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
        });
    });

    describe("POST /api/agents/stop-current", () => {
        it("stops the current task", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/stop-current", {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
        });
    });

    describe("GET /api/agents/queue/log", () => {
        it("returns pipeline log", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/queue/log", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body).toHaveProperty("log");
        });
    });

    describe("GET /api/agents/feature/:feature_id", () => {
        it("returns feature agent status", async () => {
            const { app } = setup();
            const res = await app.request(`/api/agents/feature/${FEATURE_ID}`, {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body).toHaveProperty("processes");
            expect(body).toHaveProperty("pipeline");
        });

        it("rejects invalid UUID", async () => {
            const { app } = setup();
            const res = await app.request(`/api/agents/feature/${INVALID_UUID}`, {
                headers: auth_headers(),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("GET /api/agents/status", () => {
        it("returns all process statuses", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/status", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
        });
    });

    describe("GET /api/agents/log/:task_id", () => {
        it("rejects invalid UUID", async () => {
            const { app } = setup();
            const res = await app.request(`/api/agents/log/${INVALID_UUID}`, {
                headers: auth_headers(),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/agents/spawn/manager/:feature_id", () => {
        it("returns 404 for non-existent feature", async () => {
            const { app } = setup();
            const res = await app.request(
                "/api/agents/spawn/manager/00000000-0000-0000-0000-000000099999",
                { method: "POST", headers: auth_headers() }
            );
            expect(res.status).toBe(404);
        });

        it("rejects invalid UUID", async () => {
            const { app } = setup();
            const res = await app.request(`/api/agents/spawn/manager/${INVALID_UUID}`, {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/agents/stop-all", () => {
        it("stops all agents", async () => {
            const { app } = setup();
            const res = await app.request("/api/agents/stop-all", {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body.success).toBe(true);
        });
    });

    describe("POST /api/agents/stop/:task_id", () => {
        it("rejects invalid UUID", async () => {
            const { app } = setup();
            const res = await app.request(`/api/agents/stop/${INVALID_UUID}`, {
                method: "POST",
                headers: auth_headers(),
            });
            expect(res.status).toBe(400);
        });
    });
});
