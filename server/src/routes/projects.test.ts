import { describe, expect, it } from "bun:test";
import { create_test_app, auth_headers } from "../test-app";
import { projects_routes } from "./projects";

function setup() {
    const { app, store, client } = create_test_app();
    app.route("/api/projects", projects_routes);
    return { app, store };
}

describe("projects routes", () => {
    describe("GET /api/projects", () => {
        it("returns 401 without auth", async () => {
            const { app } = setup();
            const res = await app.request("/api/projects");
            expect(res.status).toBe(401);
        });

        it("returns list of projects", async () => {
            const { app } = setup();
            const res = await app.request("/api/projects", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any[];
            expect(Array.isArray(body)).toBe(true);
            expect(body.length).toBeGreaterThan(0);
            expect(body[0].name).toBe("Test Project");
        });
    });

    describe("POST /api/projects", () => {
        it("creates a new project", async () => {
            const { app, store } = setup();
            const res = await app.request("/api/projects", {
                method: "POST",
                headers: {
                    ...auth_headers(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: "New Project", description: "desc" }),
            });
            expect(res.status).toBe(201);
            const body = (await res.json()) as { name: string };
            expect(body.name).toBe("New Project");
            expect(store.projects.length).toBe(2);
        });

        it("rejects invalid payload", async () => {
            const { app } = setup();
            const res = await app.request("/api/projects", {
                method: "POST",
                headers: {
                    ...auth_headers(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: "" }),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("GET /api/projects/:id", () => {
        it("returns a single project", async () => {
            const { app } = setup();
            const res = await app.request(
                "/api/projects/00000000-0000-0000-0000-000000000001",
                { headers: auth_headers() }
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as { name: string };
            expect(body.name).toBe("Test Project");
        });
    });

    describe("DELETE /api/projects/:id", () => {
        it("deletes a project", async () => {
            const { app, store } = setup();
            const res = await app.request(
                "/api/projects/00000000-0000-0000-0000-000000000001",
                {
                    method: "DELETE",
                    headers: auth_headers(),
                }
            );
            expect(res.status).toBe(200);
            expect(store.projects.length).toBe(0);
        });
    });
});
